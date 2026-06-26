import CoreBluetooth
import ExpoModulesCore

public class ReactNativeBleNfcReaderModule: Module {
  private var bluetoothManager: CBCentralManager?
  private var bluetoothDelegate: ReaderPermissionDelegate?
  private var pendingPermissionPromise: Promise?

  public func definition() -> ModuleDefinition {
    Name("ReactNativeBleNfcReader")

    AsyncFunction("getReaderPermissionStatus") { () -> String in
      return self.readerPermissionStatus()
    }

    AsyncFunction("requestReaderPermissions") { (promise: Promise) in
      let status = self.readerPermissionStatus()

      if status != "undetermined" {
        promise.resolve(status)
        return
      }

      self.pendingPermissionPromise = promise
      self.bluetoothDelegate = ReaderPermissionDelegate { [weak self] in
        self?.resolvePendingPermissionPromise()
      }
      self.bluetoothManager = CBCentralManager(delegate: self.bluetoothDelegate, queue: nil)
    }
    .runOnQueue(.main)
  }

  private func readerPermissionStatus() -> String {
    switch CBManager.authorization {
    case .allowedAlways:
      return "granted"
    case .notDetermined:
      return "undetermined"
    case .denied, .restricted:
      return "denied"
    @unknown default:
      return "denied"
    }
  }

  private func resolvePendingPermissionPromise() {
    guard let promise = pendingPermissionPromise else {
      return
    }

    pendingPermissionPromise = nil
    promise.resolve(readerPermissionStatus())
  }
}

private class ReaderPermissionDelegate: NSObject, CBCentralManagerDelegate {
  private let onAuthorizationChanged: () -> Void

  init(onAuthorizationChanged: @escaping () -> Void) {
    self.onAuthorizationChanged = onAuthorizationChanged
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    onAuthorizationChanged()
  }
}
