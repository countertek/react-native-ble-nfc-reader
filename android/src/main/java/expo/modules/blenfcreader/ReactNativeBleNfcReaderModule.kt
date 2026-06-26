package expo.modules.blenfcreader

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ReactNativeBleNfcReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReactNativeBleNfcReader")

    AsyncFunction("getReaderPermissionStatus") {
      getReaderPermissionStatus()
    }

    AsyncFunction("requestReaderPermissions") { promise: Promise ->
      requestReaderPermissions(promise)
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
}

private class ReaderPermissionMissingException : CodedException(
  "READER_PERMISSION_MISSING",
  "Required Reader Bluetooth permissions are missing from the Android manifest",
  null
)
