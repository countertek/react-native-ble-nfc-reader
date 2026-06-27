package expo.modules.blenfcreader

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.acs.smartcardio.BluetoothSmartCard
import com.acs.smartcardio.BluetoothTerminalManager
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import javax.smartcardio.CardTerminal

private const val READER_DISCOVERED_EVENT = "onReaderDiscovered"
private const val DEFAULT_SCAN_TIMEOUT_MS = 5000.0

class ReactNativeBleNfcReaderModule : Module() {
  private val scanHandler = Handler(Looper.getMainLooper())
  private val scanTerminalTypes = intArrayOf(
    BluetoothTerminalManager.TERMINAL_TYPE_ACR3901U_S1,
    BluetoothTerminalManager.TERMINAL_TYPE_ACR1255U_J1,
    BluetoothTerminalManager.TERMINAL_TYPE_AMR220_C,
    BluetoothTerminalManager.TERMINAL_TYPE_ACR1255U_J1_V2,
    BluetoothTerminalManager.TERMINAL_TYPE_ACR1555U
  )
  private val discoveredReaders = LinkedHashMap<String, Map<String, String>>()
  private var activeScanManager: BluetoothTerminalManager? = null
  private var scanPromise: Promise? = null
  private var scanStopRunnable: Runnable? = null
  private var scanTypeRunnable: Runnable? = null
  private var scanTypeIndex = 0
  private var scanTypeDelayMs = 1000L

  override fun definition() = ModuleDefinition {
    Name("ReactNativeBleNfcReader")

    Events(READER_DISCOVERED_EVENT)

    AsyncFunction("getReaderPermissionStatus") {
      getReaderPermissionStatus()
    }

    AsyncFunction("requestReaderPermissions") { promise: Promise ->
      requestReaderPermissions(promise)
    }

    AsyncFunction("scanReaders") { options: ScanReadersOptions?, promise: Promise ->
      scanHandler.post {
        try {
          scanReaders(options, promise)
        } catch (error: CodedException) {
          promise.reject(error)
        } catch (_: Exception) {
          promise.reject(ReaderScanUnavailableException())
        }
      }
    }

    AsyncFunction("stopReaderScan") { promise: Promise ->
      scanHandler.post {
        promise.resolve(finishScan())
      }
    }
  }

  private fun getReaderPermissionStatus(): String {
    ensureReaderPermissionsDeclared()

    if (requiredReaderPermissions().all(::isPermissionGranted)) {
      return "granted"
    }

    return "denied"
  }

  private fun requestReaderPermissions(promise: Promise) {
    val permissionsToRequest = requiredReaderPermissions()
    ensureReaderPermissionsDeclared()

    if (permissionsToRequest.all(::isPermissionGranted)) {
      promise.resolve("granted")
      return
    }

    val permissions = appContext.permissions
    if (permissions == null) {
      promise.reject(ReaderPermissionMissingException())
      return
    }

    permissions.askForPermissions(
      { response ->
        val granted = permissionsToRequest.all { permission ->
          response[permission]?.status == PermissionsStatus.GRANTED || isPermissionGranted(permission)
        }
        promise.resolve(if (granted) "granted" else "denied")
      },
      *permissionsToRequest
    )
  }

  private fun requiredReaderPermissions(): Array<String> {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      return arrayOf(
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.BLUETOOTH_CONNECT
      )
    }

    return arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
  }

  private fun isPermissionGranted(permission: String): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return true
    }

    return context().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
  }

  private fun ensureReaderPermissionsDeclared() {
    val declaredPermissions = context()
      .packageManager
      .getPackageInfo(context().packageName, PackageManager.GET_PERMISSIONS)
      .requestedPermissions
      ?.toSet()
      ?: emptySet()

    val missingPermissions = requiredReaderPermissions().filter { permission ->
      !declaredPermissions.contains(permission)
    }

    if (missingPermissions.isNotEmpty()) {
      throw ReaderPermissionMissingException()
    }
  }

  private fun context(): Context {
    return appContext.reactContext ?: throw ReaderPermissionMissingException()
  }

  private fun scanReaders(options: ScanReadersOptions?, promise: Promise) {
    ensureReaderPermissionsDeclared()

    if (!requiredReaderPermissions().all(::isPermissionGranted)) {
      throw ReaderPermissionDeniedException()
    }

    val timeoutMs = normalizedTimeoutMs(options)
    finishScan()

    val manager = BluetoothSmartCard.getInstance(context()).manager ?: throw ReaderScanUnavailableException()
    activeScanManager = manager
    scanPromise = promise
    scanTypeIndex = 0
    scanTypeDelayMs = maxOf(250L, timeoutMs / scanTerminalTypes.size)
    discoveredReaders.clear()

    startCurrentScanType()

    scanStopRunnable = Runnable {
      finishScan()
    }
    scanHandler.postDelayed(scanStopRunnable!!, timeoutMs)
  }

  private fun normalizedTimeoutMs(options: ScanReadersOptions?): Long {
    val timeoutMs = options?.timeoutMs ?: DEFAULT_SCAN_TIMEOUT_MS

    if (!timeoutMs.isFinite() || timeoutMs <= 0) {
      throw InvalidScanTimeoutException()
    }

    return timeoutMs.toLong()
  }

  private fun startCurrentScanType() {
    val manager = activeScanManager ?: return

    manager.stopScan()
    manager.startScan(scanTerminalTypes[scanTypeIndex]) { terminal ->
      scanHandler.post {
        addDiscoveredReader(terminal)
      }
    }

    scanTypeIndex = (scanTypeIndex + 1) % scanTerminalTypes.size
    scanTypeRunnable = Runnable {
      startCurrentScanType()
    }
    scanHandler.postDelayed(scanTypeRunnable!!, scanTypeDelayMs)
  }

  private fun addDiscoveredReader(terminal: CardTerminal) {
    if (activeScanManager == null || scanPromise == null) {
      return
    }

    val reader = mapOf(
      "id" to terminal.name,
      "name" to terminal.name
    )

    if (discoveredReaders.putIfAbsent(terminal.name, reader) != null) {
      return
    }

    sendEvent(READER_DISCOVERED_EVENT, Bundle().apply {
      putBundle("reader", readerBundle(reader))
    })
  }

  private fun finishScan(): ArrayList<Map<String, String>> {
    scanStopRunnable?.let(scanHandler::removeCallbacks)
    scanTypeRunnable?.let(scanHandler::removeCallbacks)
    scanStopRunnable = null
    scanTypeRunnable = null

    activeScanManager?.stopScan()
    activeScanManager = null

    val readers = ArrayList(discoveredReaders.values)
    discoveredReaders.clear()

    scanPromise?.resolve(readers)
    scanPromise = null

    return readers
  }

  private fun readerBundle(reader: Map<String, String>): Bundle {
    return Bundle().apply {
      putString("id", reader["id"])
      putString("name", reader["name"])
    }
  }
}

private class ScanReadersOptions : Record {
  @Field
  var timeoutMs: Double? = null
}

private class ReaderPermissionMissingException : CodedException(
  "READER_PERMISSION_MISSING",
  "Required Reader Bluetooth permissions are missing from the Android manifest",
  null
)

private class ReaderPermissionDeniedException : CodedException(
  "READER_PERMISSION_DENIED",
  "Reader Bluetooth permission is denied",
  null
)

private class InvalidScanTimeoutException : CodedException(
  "INVALID_SCAN_TIMEOUT",
  "timeoutMs must be greater than 0",
  null
)

private class ReaderScanUnavailableException : CodedException(
  "READER_SCAN_UNAVAILABLE",
  "Reader scanning is not available on this Android device",
  null
)
