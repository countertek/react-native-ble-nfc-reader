import ACSSmartCardIO
import CoreBluetooth
import ExpoModulesCore
import SmartCardIO

private let readerDiscoveredEvent = "onReaderDiscovered"
private let defaultScanTimeoutMs = 5000.0

public class ReactNativeBleNfcReaderModule: Module, BluetoothTerminalManagerDelegate {
  private var bluetoothManager: CBCentralManager?
  private var bluetoothDelegate: ReaderPermissionDelegate?
  private var pendingPermissionPromises: [Promise] = []
  private let scanManager = BluetoothSmartCard.shared.manager
  private let scanTerminalTypes: [BluetoothTerminalManager.TerminalType] = [
    .acr3901us1,
    .acr1255uj1,
    .amr220c,
    .acr1255uj1v2,
    .acr1555u
  ]
  private var scanPromise: Promise?
  private var scanTimer: Timer?
  private var scanTypeTimer: Timer?
  private var scanTypeIndex = 0
  private var scanTypeDelay = 1.0
  private var discoveredReaderIds = Set<String>()
  private var discoveredReaders: [[String: String]] = []

  public func definition() -> ModuleDefinition {
    Name("ReactNativeBleNfcReader")

    Events(readerDiscoveredEvent)

    AsyncFunction("getReaderPermissionStatus") { () -> String in
      return self.readerPermissionStatus()
    }

    AsyncFunction("requestReaderPermissions") { (promise: Promise) in
      let status = self.readerPermissionStatus()

      if status != "undetermined" {
        promise.resolve(status)
        return
      }

      self.pendingPermissionPromises.append(promise)

      if self.bluetoothManager == nil {
        self.bluetoothDelegate = ReaderPermissionDelegate { [weak self] in
          self?.resolvePendingPermissionPromises()
        }
        self.bluetoothManager = CBCentralManager(delegate: self.bluetoothDelegate, queue: nil)
      }
    }
    .runOnQueue(.main)

    AsyncFunction("scanReaders") { (options: ScanReadersOptions?, promise: Promise) in
      self.scanReaders(options: options, promise: promise)
    }
    .runOnQueue(.main)

    AsyncFunction("stopReaderScan") { (promise: Promise) in
      promise.resolve(self.finishScan())
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

  private func resolvePendingPermissionPromises() {
    let status = readerPermissionStatus()

    if status == "undetermined" {
      return
    }

    let promises = pendingPermissionPromises
    pendingPermissionPromises = []
    bluetoothManager = nil
    bluetoothDelegate = nil

    promises.forEach { promise in
      promise.resolve(status)
    }
  }

  private func scanReaders(options: ScanReadersOptions?, promise: Promise) {
    if readerPermissionStatus() != "granted" {
      promise.reject(readerPermissionDeniedException())
      return
    }

    let timeoutMs = options?.timeoutMs ?? defaultScanTimeoutMs

    if !timeoutMs.isFinite || timeoutMs <= 0 {
      promise.reject(invalidScanTimeoutException())
      return
    }

    _ = finishScan()

    scanManager.delegate = self
    scanPromise = promise
    scanTypeIndex = 0
    scanTypeDelay = max(0.25, timeoutMs / Double(scanTerminalTypes.count) / 1000.0)
    discoveredReaderIds = []
    discoveredReaders = []

    startCurrentScanType()

    scanTimer = Timer.scheduledTimer(withTimeInterval: timeoutMs / 1000.0, repeats: false) { [weak self] _ in
      _ = self?.finishScan()
    }
  }

  private func startCurrentScanType() {
    scanManager.stopScan()
    scanManager.startScan(terminalType: scanTerminalTypes[scanTypeIndex])

    scanTypeIndex = (scanTypeIndex + 1) % scanTerminalTypes.count
    scanTypeTimer = Timer.scheduledTimer(withTimeInterval: scanTypeDelay, repeats: false) { [weak self] _ in
      self?.startCurrentScanType()
    }
  }

  private func finishScan() -> [[String: String]] {
    scanTimer?.invalidate()
    scanTypeTimer?.invalidate()
    scanTimer = nil
    scanTypeTimer = nil

    scanManager.stopScan()

    let readers = discoveredReaders
    discoveredReaderIds = []
    discoveredReaders = []

    scanPromise?.resolve(readers)
    scanPromise = nil

    return readers
  }

  public func bluetoothTerminalManagerDidUpdateState(_ manager: BluetoothTerminalManager) {}

  public func bluetoothTerminalManager(
    _ manager: BluetoothTerminalManager,
    didDiscover terminal: any CardTerminal
  ) {
    let reader = [
      "id": terminal.name,
      "name": terminal.name
    ]

    if discoveredReaderIds.contains(terminal.name) {
      return
    }

    discoveredReaderIds.insert(terminal.name)
    discoveredReaders.append(reader)
    sendEvent(readerDiscoveredEvent, ["reader": reader])
  }
}

private struct ScanReadersOptions: Record {
  @Field
  var timeoutMs: Double?
}

private func readerPermissionDeniedException() -> Exception {
  return Exception(
    name: "ReaderPermissionDeniedException",
    description: "Reader Bluetooth permission is denied",
    code: "READER_PERMISSION_DENIED"
  )
}

private func invalidScanTimeoutException() -> Exception {
  return Exception(
    name: "InvalidScanTimeoutException",
    description: "timeoutMs must be greater than 0",
    code: "INVALID_SCAN_TIMEOUT"
  )
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
