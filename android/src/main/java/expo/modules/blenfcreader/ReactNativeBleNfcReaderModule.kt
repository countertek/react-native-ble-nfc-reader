package expo.modules.blenfcreader

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
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
import javax.smartcardio.Card
import javax.smartcardio.CardException
import javax.smartcardio.CardTerminal
import javax.smartcardio.CommandAPDU

private const val READER_DISCOVERED_EVENT = "onReaderDiscovered"
private const val CARD_PRESENT_EVENT = "onCardPresent"
private const val CARD_REMOVED_EVENT = "onCardRemoved"
private const val CARD_MONITOR_ERROR_EVENT = "onCardMonitorError"
private const val DEFAULT_CARD_MONITOR_ERROR_MESSAGE = "Card monitor failed"
private const val DEFAULT_SCAN_TIMEOUT_MS = 5000.0
private const val DEFAULT_CARD_MONITOR_POLLING_INTERVAL_MS = 1000.0
private const val MIN_CARD_MONITOR_POLLING_INTERVAL_MS = 100.0
private const val METADATA_TIMEOUT_MS = 1000L
private const val READ_UID_APDU = "FFCA000000"
private const val MIFARE_KEY_SLOT = "00"

class ReactNativeBleNfcReaderModule : Module() {
  private val scanHandler = Handler(Looper.getMainLooper())
  private val readerLock = Any()
  private val terminalIoLock = Any()
  private val scanTerminalTypes = intArrayOf(
    BluetoothTerminalManager.TERMINAL_TYPE_ACR3901U_S1,
    BluetoothTerminalManager.TERMINAL_TYPE_ACR1255U_J1,
    BluetoothTerminalManager.TERMINAL_TYPE_AMR220_C,
    BluetoothTerminalManager.TERMINAL_TYPE_ACR1255U_J1_V2,
    BluetoothTerminalManager.TERMINAL_TYPE_ACR1555U
  )
  private val discoveredReaders = LinkedHashMap<String, Map<String, Any>>()
  private val knownTerminals = LinkedHashMap<String, CardTerminal>()
  private var activeScanManager: BluetoothTerminalManager? = null
  private var activeReaderId: String? = null
  private var activeReaderTerminal: CardTerminal? = null
  private var activeReaderManager: BluetoothTerminalManager? = null
  private var activeCard: Card? = null
  private var cardMonitorThread: Thread? = null
  private var cardMonitorAutoStopRunnable: Runnable? = null
  private var cardMonitorGeneration = 0
  private var activeCardMonitorReaderId: String? = null
  private var activeCardMonitorOptions: NormalizedCardMonitorOptions? = null
  private var scanPromise: Promise? = null
  private var scanStopRunnable: Runnable? = null
  private var scanTypeRunnable: Runnable? = null
  private var scanTypeIndex = 0
  private var scanTypeDelayMs = 1000L
  private var readerPermissionsRequested = false

  override fun definition() = ModuleDefinition {
    Name("ReactNativeBleNfcReader")

    Events(
      READER_DISCOVERED_EVENT,
      CARD_PRESENT_EVENT,
      CARD_REMOVED_EVENT,
      CARD_MONITOR_ERROR_EVENT
    )

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

    AsyncFunction("connectReader") { readerId: String, promise: Promise ->
      scanHandler.post {
        try {
          promise.resolve(connectReader(readerId))
        } catch (error: CodedException) {
          promise.reject(error)
        } catch (_: Exception) {
          promise.reject(ReaderConnectionUnavailableException())
        }
      }
    }

    AsyncFunction("disconnectReader") { readerId: String, promise: Promise ->
      scanHandler.post {
        try {
          disconnectReader(readerId)
          promise.resolve(null)
        } catch (error: CodedException) {
          promise.reject(error)
        } catch (_: Exception) {
          promise.reject(ReaderConnectionUnavailableException())
        }
      }
    }

    AsyncFunction("startCardMonitor") { readerId: String, options: CardMonitorOptions?, promise: Promise ->
      scanHandler.post {
        try {
          startCardMonitor(readerId, options)
          promise.resolve(null)
        } catch (error: CodedException) {
          promise.reject(error)
        } catch (_: Exception) {
          promise.reject(ReaderConnectionUnavailableException())
        }
      }
    }

    AsyncFunction("stopCardMonitor") { readerId: String, promise: Promise ->
      scanHandler.post {
        try {
          stopCardMonitor(readerId)
          promise.resolve(null)
        } catch (error: CodedException) {
          promise.reject(error)
        } catch (_: Exception) {
          promise.reject(ReaderConnectionUnavailableException())
        }
      }
    }

    AsyncFunction("readCardUid") { readerId: String, promise: Promise ->
      try {
        promise.resolve(readCardUid(readerId))
      } catch (error: CodedException) {
        promise.reject(error)
      } catch (_: CardException) {
        promise.reject(CardCommandFailedException("unknown"))
      } catch (_: Exception) {
        promise.reject(ReaderConnectionUnavailableException())
      }
    }

    AsyncFunction("transmit") { readerId: String, apdu: String, promise: Promise ->
      try {
        promise.resolve(transmit(readerId, apdu))
      } catch (error: CodedException) {
        promise.reject(error)
      } catch (_: CardException) {
        promise.reject(CardCommandFailedException("unknown"))
      } catch (_: Exception) {
        promise.reject(ReaderConnectionUnavailableException())
      }
    }

    AsyncFunction("authenticateBlock") { options: AuthenticateBlockOptions, promise: Promise ->
      try {
        authenticateBlock(options)
        promise.resolve(null)
      } catch (error: CodedException) {
        promise.reject(error)
      } catch (_: CardException) {
        promise.reject(CardCommandFailedException("unknown"))
      } catch (_: Exception) {
        promise.reject(ReaderConnectionUnavailableException())
      }
    }

    AsyncFunction("readBlock") { options: ReadBlockOptions, promise: Promise ->
      try {
        promise.resolve(readBlock(options))
      } catch (error: CodedException) {
        promise.reject(error)
      } catch (_: CardException) {
        promise.reject(CardCommandFailedException("unknown"))
      } catch (_: Exception) {
        promise.reject(ReaderConnectionUnavailableException())
      }
    }

    AsyncFunction("writeBlock") { options: WriteBlockOptions, promise: Promise ->
      try {
        writeBlock(options)
        promise.resolve(null)
      } catch (error: CodedException) {
        promise.reject(error)
      } catch (_: CardException) {
        promise.reject(CardCommandFailedException("unknown"))
      } catch (_: Exception) {
        promise.reject(ReaderConnectionUnavailableException())
      }
    }
  }

  private fun getReaderPermissionStatus(): String {
    ensureReaderPermissionsDeclared()

    if (requiredReaderPermissions().all(::isPermissionGranted)) {
      return "granted"
    }

    if (!readerPermissionsRequested) {
      val activity = appContext.currentActivity
      if (activity != null) {
        val previouslyDenied = requiredReaderPermissions().any { permission ->
          ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)
        }
        if (previouslyDenied) {
          return "denied"
        }
      }
      return "undetermined"
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
        readerPermissionsRequested = true
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
    val declaredPermissions = packageInfoWithPermissions()
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

  private fun packageInfoWithPermissions() =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val context = context()
      context.packageManager.getPackageInfo(
        context.packageName,
        PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong())
      )
    } else {
      val context = context()
      @Suppress("DEPRECATION")
      context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
    }

  private fun context(): Context {
    return appContext.reactContext ?: throw ReaderPermissionMissingException()
  }

  private fun scanReaders(options: ScanReadersOptions?, promise: Promise) {
    ensureReaderPermissionsDeclared()

    when (getReaderPermissionStatus()) {
      "undetermined" -> throw ReaderPermissionUndeterminedException()
      "denied" -> throw ReaderPermissionDeniedException()
    }

    val timeoutMs = normalizedTimeoutMs(options)
    finishScan()

    val manager = BluetoothSmartCard.getInstance(context()).manager ?: throw ReaderScanUnavailableException()
    activeScanManager = manager
    scanPromise = promise
    scanTypeIndex = 0
    scanTypeDelayMs = maxOf(250L, timeoutMs / scanTerminalTypes.size)
    discoveredReaders.clear()
    synchronized(readerLock) {
      val activeId = activeReaderId
      val activeTerminal = activeReaderTerminal
      knownTerminals.clear()
      if (activeId != null && activeTerminal != null) {
        knownTerminals[activeId] = activeTerminal
      }
    }

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

  private fun normalizeCardMonitorOptions(options: CardMonitorOptions?): NormalizedCardMonitorOptions {
    val pollingIntervalMs = options?.pollingIntervalMs ?: DEFAULT_CARD_MONITOR_POLLING_INTERVAL_MS
    val autoStopAfterMs = options?.autoStopAfterMs

    if (
      !pollingIntervalMs.isFinite() ||
      pollingIntervalMs % 1.0 != 0.0 ||
      pollingIntervalMs < MIN_CARD_MONITOR_POLLING_INTERVAL_MS
    ) {
      throw InvalidCardMonitorOptionsException(
        "pollingIntervalMs must be an integer greater than or equal to ${MIN_CARD_MONITOR_POLLING_INTERVAL_MS.toInt()}"
      )
    }

    if (
      autoStopAfterMs != null &&
      (!autoStopAfterMs.isFinite() || autoStopAfterMs % 1.0 != 0.0 || autoStopAfterMs <= 0)
    ) {
      throw InvalidCardMonitorOptionsException("autoStopAfterMs must be a positive integer")
    }

    return NormalizedCardMonitorOptions(
      pollingIntervalMs = pollingIntervalMs.toLong(),
      autoStopAfterMs = autoStopAfterMs?.toLong()
    )
  }

  private fun startCurrentScanType() {
    if (scanPromise == null) {
      return
    }

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

    val reader = readerForTerminal(terminal)

    if (discoveredReaders.putIfAbsent(terminal.name, reader) != null) {
      return
    }

    synchronized(readerLock) {
      knownTerminals[terminal.name] = terminal
    }

    sendEvent(READER_DISCOVERED_EVENT, Bundle().apply {
      putBundle("reader", readerBundle(reader))
    })
  }

  private fun connectReader(readerId: String): Map<String, Any> {
    val manager = readerManager()
    finishScan()

    val terminal = synchronized(readerLock) {
      val activeId = activeReaderId

      if (activeId != null && activeId != readerId) {
        throw ReaderAlreadyConnectedException(activeId)
      }

      if (activeId == readerId) {
        val activeTerminal = activeReaderTerminal ?: throw ReaderNotConnectedException(readerId)
        return@synchronized activeTerminal
      }

      val knownTerminal = knownTerminals[readerId] ?: throw ReaderNotFoundException(readerId)
      activeReaderId = readerId
      activeReaderTerminal = knownTerminal
      activeReaderManager = manager
      knownTerminal
    }

    return readerForTerminal(terminal, manager)
  }

  private fun disconnectReader(readerId: String) {
    val activeConnection = synchronized(readerLock) {
      if (activeReaderId != readerId) {
        throw ReaderNotConnectedException(readerId)
      }

      val terminal = activeReaderTerminal ?: throw ReaderNotConnectedException(readerId)
      val manager = activeReaderManager ?: throw ReaderConnectionUnavailableException()
      Pair(manager, terminal)
    }

    synchronized(terminalIoLock) {
      disconnectActiveCardLocked()
      activeConnection.first.disconnect(activeConnection.second)
    }

    stopCardMonitorInternal()
    synchronized(readerLock) {
      activeReaderId = null
      activeReaderTerminal = null
      activeReaderManager = null
    }
  }

  private fun readCardUid(readerId: String): String {
    return transmitSuccessful(readerId, READ_UID_APDU)
  }

  private fun authenticateBlock(options: AuthenticateBlockOptions) {
    val block = normalizeMifareBlock(options.block)
    val key = normalizeSizedHexString(options.key, "key", 6)
    val keyType = mifareKeyTypeByte(options.keyType)
    val blockHex = byteHex(block)

    transmitSuccessful(options.readerId, "FF8200${MIFARE_KEY_SLOT}06$key")
    transmitSuccessful(options.readerId, "FF860000050100$blockHex$keyType$MIFARE_KEY_SLOT")
  }

  private fun readBlock(options: ReadBlockOptions): String {
    val block = normalizeMifareBlock(options.block)
    return transmitSuccessful(options.readerId, "FFB000${byteHex(block)}10")
  }

  private fun writeBlock(options: WriteBlockOptions) {
    val block = normalizeMifareBlock(options.block)

    if (options.allowTrailerWrite != true && isMifareTrailerBlock(block)) {
      throw InvalidMifareBlockException("trailer block writes require allowTrailerWrite")
    }

    val data = normalizeSizedHexString(options.data, "data", 16)
    transmitSuccessful(options.readerId, "FFD600${byteHex(block)}10$data")
  }

  private fun transmitSuccessful(readerId: String, apdu: String): String {
    val response = transmit(readerId, apdu)

    if (response.length < 4) {
      throw CardCommandFailedException("unknown")
    }

    val status = response.takeLast(4)
    if (status != "9000") {
      throw CardCommandFailedException(status)
    }

    return response.dropLast(4)
  }

  private fun transmit(readerId: String, apdu: String): String {
    val command = CommandAPDU(hexToBytes(apdu))

    return withConnectedCard(readerId) { card ->
      val response = card.basicChannel.transmit(command)
      bytesToHex(response.bytes)
    }
  }

  private fun <T> withConnectedCard(readerId: String, block: (Card) -> T): T {
    val terminal = activeTerminal(readerId)

    synchronized(terminalIoLock) {
      try {
        val card = activeCard ?: terminal.connect("*").also { activeCard = it }
        return block(card)
      } catch (error: Exception) {
        disconnectActiveCardLocked()
        throw error
      }
    }
  }

  private fun disconnectActiveCardLocked() {
    val card = activeCard ?: return
    activeCard = null

    try {
      card.disconnect(false)
    } catch (_: CardException) {
    }
  }

  private fun activeTerminal(readerId: String): CardTerminal {
    return synchronized(readerLock) {
      if (activeReaderId != readerId) {
        throw ReaderNotConnectedException(readerId)
      }

      activeReaderTerminal ?: throw ReaderNotConnectedException(readerId)
    }
  }

  private fun startCardMonitor(readerId: String, options: CardMonitorOptions?) {
    val normalizedOptions = normalizeCardMonitorOptions(options)
    val terminal = synchronized(readerLock) {
      if (activeReaderId != readerId) {
        throw ReaderNotConnectedException(readerId)
      }

      val monitorThread = cardMonitorThread
      if (monitorThread != null && monitorThread.isAlive) {
        if (activeCardMonitorReaderId == readerId && activeCardMonitorOptions == normalizedOptions) {
          return
        }

        throw CardMonitorAlreadyActiveException()
      }

      if (monitorThread != null) {
        clearInactiveCardMonitorLocked()
      }

      activeReaderTerminal ?: throw ReaderNotConnectedException(readerId)
    }

    val generation = synchronized(readerLock) {
      cardMonitorGeneration += 1
      cardMonitorGeneration
    }
    val thread = Thread {
      try {
        var wasPresent: Boolean? = null

        monitorLoop@ while (!Thread.currentThread().isInterrupted && isCurrentCardMonitor(generation)) {
          try {
            val present = pollCardPresent(terminal, generation) ?: break@monitorLoop

            if (present && wasPresent != true) {
              sendCardEvent(CARD_PRESENT_EVENT, readerId, generation)
            }

            if (!present && wasPresent == true) {
              when (val stillAbsent = confirmCardAbsent(terminal, generation)) {
                null -> break@monitorLoop
                false -> continue@monitorLoop
                true -> {
                  synchronized(terminalIoLock) {
                    disconnectActiveCardLocked()
                  }
                  sendCardEvent(CARD_REMOVED_EVENT, readerId, generation)
                }
              }
            }

            wasPresent = present

            if (!waitForCardChange(
                terminal,
                present,
                normalizedOptions.pollingIntervalMs,
                generation
              )
            ) {
              break@monitorLoop
            }
          } catch (error: CardException) {
            if (isCardMonitorStopRequested(generation) || error.cause is InterruptedException) {
              break@monitorLoop
            }
            terminateCardMonitorWithError(readerId, generation, error)
            break@monitorLoop
          }
        }
      } finally {
        clearCardMonitorIfCurrent(generation)
      }
    }

    synchronized(readerLock) {
      cardMonitorThread = thread
      activeCardMonitorReaderId = readerId
      activeCardMonitorOptions = normalizedOptions
    }
    normalizedOptions.autoStopAfterMs?.let { autoStopAfterMs ->
      val autoStopRunnable = Runnable {
        stopCardMonitorIfCurrent(generation)
      }
      synchronized(readerLock) {
        cardMonitorAutoStopRunnable = autoStopRunnable
      }
      scanHandler.postDelayed(autoStopRunnable, autoStopAfterMs)
    }
    thread.start()
  }

  private fun stopCardMonitor(readerId: String) {
    synchronized(readerLock) {
      if (activeReaderId != readerId) {
        throw ReaderNotConnectedException(readerId)
      }
    }

    stopCardMonitorInternal()
  }

  private fun stopCardMonitorIfCurrent(generation: Int) {
    val shouldStop = synchronized(readerLock) {
      cardMonitorGeneration == generation
    }

    if (shouldStop) {
      stopCardMonitorInternal()
    }
  }

  private fun clearCardMonitorIfCurrent(generation: Int) {
    synchronized(readerLock) {
      if (cardMonitorGeneration != generation || cardMonitorThread != Thread.currentThread()) {
        return
      }

      clearActiveCardMonitorLocked()
    }
  }

  private fun clearInactiveCardMonitorLocked() {
    cardMonitorAutoStopRunnable?.let(scanHandler::removeCallbacks)
    cardMonitorAutoStopRunnable = null
    cardMonitorThread = null
    activeCardMonitorReaderId = null
    activeCardMonitorOptions = null
  }

  private fun clearActiveCardMonitorLocked() {
    cardMonitorGeneration += 1
    clearInactiveCardMonitorLocked()
  }

  private fun stopCardMonitorInternal() {
    val thread = synchronized(readerLock) {
      val currentThread = cardMonitorThread
      clearActiveCardMonitorLocked()
      currentThread
    }
    thread?.interrupt()

    if (thread == null || thread == Thread.currentThread()) {
      return
    }

    try {
      thread.join(1500)
    } catch (_: InterruptedException) {
      Thread.currentThread().interrupt()
    }
  }

  private fun isCurrentCardMonitor(generation: Int): Boolean {
    return synchronized(readerLock) {
      cardMonitorGeneration == generation && cardMonitorThread == Thread.currentThread()
    }
  }

  private fun pollCardPresent(terminal: CardTerminal, generation: Int): Boolean? {
    if (isCardMonitorStopRequested(generation)) {
      return null
    }

    return synchronized(terminalIoLock) {
      try {
        terminal.isCardPresent
      } catch (error: CardException) {
        if (error.cause is InterruptedException) {
          null
        } else {
          throw error
        }
      }
    }
  }

  private fun confirmCardAbsent(terminal: CardTerminal, generation: Int): Boolean? {
    sleepCardMonitor(250)
    if (isCardMonitorStopRequested(generation)) {
      return null
    }

    val present = pollCardPresent(terminal, generation) ?: return null
    return !present
  }

  private fun waitForCardChange(
    terminal: CardTerminal,
    present: Boolean,
    pollingIntervalMs: Long,
    generation: Int
  ): Boolean {
    if (isCardMonitorStopRequested(generation)) {
      return false
    }

    return synchronized(terminalIoLock) {
      try {
        if (present) {
          terminal.waitForCardAbsent(pollingIntervalMs)
        } else {
          terminal.waitForCardPresent(pollingIntervalMs)
        }
        true
      } catch (error: CardException) {
        if (error.cause is InterruptedException) {
          false
        } else {
          throw error
        }
      }
    }
  }

  private fun isCardMonitorStopRequested(generation: Int): Boolean {
    return Thread.currentThread().isInterrupted || !isCurrentCardMonitor(generation)
  }

  private fun terminateCardMonitorWithError(readerId: String, generation: Int, error: CardException) {
    val message = error.message ?: DEFAULT_CARD_MONITOR_ERROR_MESSAGE
    val deliveryGeneration = synchronized(readerLock) {
      if (cardMonitorGeneration != generation || cardMonitorThread != Thread.currentThread()) {
        return
      }

      val send = activeReaderId == readerId
      // Clear immediately so a same-options restart is not treated as an idempotent no-op
      // while async error delivery is still pending.
      clearActiveCardMonitorLocked()
      if (!send) {
        return
      }
      cardMonitorGeneration
    }

    scanHandler.post {
      val shouldSend = synchronized(readerLock) {
        activeReaderId == readerId && cardMonitorGeneration == deliveryGeneration
      }

      if (!shouldSend) {
        return@post
      }

      sendEvent(CARD_MONITOR_ERROR_EVENT, Bundle().apply {
        putString("readerId", readerId)
        putString("message", message)
      })
    }
  }

  private fun sleepCardMonitor(delayMs: Long) {
    try {
      Thread.sleep(delayMs)
    } catch (_: InterruptedException) {
      Thread.currentThread().interrupt()
    }
  }

  private fun sendCardEvent(eventName: String, readerId: String, generation: Int) {
    scanHandler.post {
      val connected = synchronized(readerLock) {
        activeReaderId == readerId && cardMonitorGeneration == generation
      }

      if (!connected) {
        return@post
      }

      sendEvent(eventName, Bundle().apply {
        putString("readerId", readerId)
      })
    }
  }

  private fun normalizeMifareBlock(block: Int): Int {
    if (block < 0 || block > 255) {
      throw InvalidMifareBlockException("block must be an integer between 0 and 255")
    }

    return block
  }

  private fun mifareKeyTypeByte(keyType: String): String {
    if (keyType == "A") {
      return "60"
    }

    if (keyType == "B") {
      return "61"
    }

    throw InvalidMifareKeyTypeException()
  }

  private fun isMifareTrailerBlock(block: Int): Boolean {
    if (block < 128) {
      return block % 4 == 3
    }

    return (block - 143) % 16 == 0
  }

  private fun normalizeSizedHexString(value: String, name: String, byteLength: Int): String {
    val bytes = hexToBytes(value, name)

    if (bytes.size != byteLength) {
      throw InvalidHexStringException("$name must be $byteLength bytes (${byteLength * 2} hex characters)")
    }

    return bytesToHex(bytes)
  }

  private fun byteHex(value: Int): String {
    return "%02X".format(value and 0xFF)
  }

  private fun hexToBytes(value: String, name: String = "apdu"): ByteArray {
    if (value.length % 2 != 0 || !value.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) {
      throw InvalidHexStringException("$name must contain only hex characters and have an even number of characters")
    }

    return value.chunked(2).map { byte ->
      byte.toInt(16).toByte()
    }.toByteArray()
  }

  private fun bytesToHex(value: ByteArray): String {
    return value.joinToString("") { byte ->
      "%02X".format(byte.toInt() and 0xFF)
    }
  }

  private fun readerManager(): BluetoothTerminalManager {
    return BluetoothSmartCard.getInstance(context()).manager ?: throw ReaderConnectionUnavailableException()
  }

  private fun readerForTerminal(
    terminal: CardTerminal,
    manager: BluetoothTerminalManager? = null
  ): MutableMap<String, Any> {
    val reader = mutableMapOf<String, Any>(
      "id" to terminal.name,
      "name" to terminal.name
    )
    val metadata = readerMetadata(terminal, manager)

    if (metadata.isNotEmpty()) {
      reader["metadata"] = metadata
    }

    return reader
  }

  private fun readerMetadata(
    terminal: CardTerminal,
    manager: BluetoothTerminalManager?
  ): MutableMap<String, Any> {
    val metadata = mutableMapOf<String, Any>()

    if (manager == null) {
      return metadata
    }

    addDeviceInfo(metadata, "model", manager, terminal, BluetoothTerminalManager.DEVICE_INFO_MODEL_NUMBER_STRING)
    addDeviceInfo(
      metadata,
      "firmwareVersion",
      manager,
      terminal,
      BluetoothTerminalManager.DEVICE_INFO_FIRMWARE_REVISION_STRING
    )
    addDeviceInfo(metadata, "serialNumber", manager, terminal, BluetoothTerminalManager.DEVICE_INFO_SERIAL_NUMBER_STRING)

    try {
      val batteryLevel = manager.getBatteryLevel(terminal, METADATA_TIMEOUT_MS)
      if (batteryLevel in 0..100) {
        metadata["batteryLevel"] = batteryLevel
      }
    } catch (_: Exception) {
      // Metadata support varies by Reader model.
    }

    return metadata
  }

  private fun addDeviceInfo(
    metadata: MutableMap<String, Any>,
    key: String,
    manager: BluetoothTerminalManager,
    terminal: CardTerminal,
    type: Int
  ) {
    try {
      val value = manager.getDeviceInfo(terminal, type, METADATA_TIMEOUT_MS)?.trim()
      if (!value.isNullOrEmpty()) {
        metadata[key] = value
      }
    } catch (_: Exception) {
      // Metadata support varies by Reader model.
    }
  }

  private fun finishScan(): ArrayList<Map<String, Any>> {
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

  private fun readerBundle(reader: Map<String, Any>): Bundle {
    return Bundle().apply {
      putString("id", reader["id"] as? String)
      putString("name", reader["name"] as? String)
    }
  }
}

private class ScanReadersOptions : Record {
  @Field
  var timeoutMs: Double? = null
}

private class CardMonitorOptions : Record {
  @Field
  var pollingIntervalMs: Double? = null

  @Field
  var autoStopAfterMs: Double? = null
}

private data class NormalizedCardMonitorOptions(
  val pollingIntervalMs: Long,
  val autoStopAfterMs: Long?
)

private class AuthenticateBlockOptions : Record {
  @Field
  var readerId: String = ""

  @Field
  var block: Int = -1

  @Field
  var keyType: String = ""

  @Field
  var key: String = ""
}

private class ReadBlockOptions : Record {
  @Field
  var readerId: String = ""

  @Field
  var block: Int = -1
}

private class WriteBlockOptions : Record {
  @Field
  var readerId: String = ""

  @Field
  var block: Int = -1

  @Field
  var data: String = ""

  @Field
  var allowTrailerWrite: Boolean? = null
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

private class ReaderPermissionUndeterminedException : CodedException(
  "READER_PERMISSION_UNDETERMINED",
  "Reader Bluetooth permission has not been requested",
  null
)

private class InvalidScanTimeoutException : CodedException(
  "INVALID_SCAN_TIMEOUT",
  "timeoutMs must be greater than 0",
  null
)

private class InvalidCardMonitorOptionsException(message: String) : CodedException(
  "INVALID_CARD_MONITOR_OPTIONS",
  message,
  null
)

private class InvalidHexStringException(message: String = "apdu must contain only hex characters and have an even number of characters") : CodedException(
  "INVALID_HEX_STRING",
  message,
  null
)

private class InvalidMifareBlockException(message: String) : CodedException(
  "INVALID_MIFARE_BLOCK",
  message,
  null
)

private class InvalidMifareKeyTypeException : CodedException(
  "INVALID_MIFARE_KEY_TYPE",
  "keyType must be A or B",
  null
)

private class ReaderScanUnavailableException : CodedException(
  "READER_SCAN_UNAVAILABLE",
  "Reader scanning is not available on this Android device",
  null
)

private class ReaderNotFoundException(readerId: String) : CodedException(
  "READER_NOT_FOUND",
  "Reader $readerId has not been discovered",
  null
)

private class ReaderAlreadyConnectedException(readerId: String) : CodedException(
  "READER_ALREADY_CONNECTED",
  "Reader $readerId is already connected; disconnect it before connecting another Reader",
  null
)

private class ReaderNotConnectedException(readerId: String) : CodedException(
  "READER_NOT_CONNECTED",
  "Reader $readerId is not connected",
  null
)

private class ReaderConnectionUnavailableException : CodedException(
  "READER_CONNECTION_UNAVAILABLE",
  "Reader connection is not available on this Android device",
  null
)

private class CardMonitorAlreadyActiveException : CodedException(
  "CARD_MONITOR_ALREADY_ACTIVE",
  "Card monitor is already active with different options",
  null
)

private class CardCommandFailedException(status: String) : CodedException(
  "CARD_COMMAND_FAILED",
  "Card command failed with APDU Status $status",
  null
)
