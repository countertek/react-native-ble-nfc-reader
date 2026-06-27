import ACSSmartCardIO
import CoreBluetooth
import ExpoModulesCore
import SmartCardIO

private let readerDiscoveredEvent = "onReaderDiscovered"
private let defaultScanTimeoutMs = 5000.0
private let metadataTimeoutMs = 1000

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
  private var discoveredReaders: [[String: Any]] = []
  private var knownTerminals: [String: any CardTerminal] = [:]
  private var activeReader: (id: String, terminal: any CardTerminal)?

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

    AsyncFunction("connectReader") { (readerId: String, promise: Promise) in
      do {
        promise.resolve(try self.connectReader(readerId: readerId))
      } catch let error as Exception {
        promise.reject(error)
      } catch {
        promise.reject(readerConnectionUnavailableException())
      }
    }
    .runOnQueue(.main)

    AsyncFunction("disconnectReader") { (readerId: String, promise: Promise) in
      do {
        try self.disconnectReader(readerId: readerId)
        promise.resolve(nil)
      } catch let error as Exception {
        promise.reject(error)
      } catch {
        promise.reject(readerConnectionUnavailableException())
      }
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
    let permissionStatus = readerPermissionStatus()

    if permissionStatus == "undetermined" {
      promise.reject(readerPermissionUndeterminedException())
      return
    }

    if permissionStatus != "granted" {
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
    knownTerminals = [:]
    if let activeReader {
      knownTerminals[activeReader.id] = activeReader.terminal
    }

    startCurrentScanType()

    scanTimer = Timer.scheduledTimer(withTimeInterval: timeoutMs / 1000.0, repeats: false) { [weak self] _ in
      _ = self?.finishScan()
    }
  }

  private func startCurrentScanType() {
    if scanPromise == nil {
      return
    }

    scanManager.stopScan()
    scanManager.startScan(terminalType: scanTerminalTypes[scanTypeIndex])

    scanTypeIndex = (scanTypeIndex + 1) % scanTerminalTypes.count
    scanTypeTimer = Timer.scheduledTimer(withTimeInterval: scanTypeDelay, repeats: false) { [weak self] _ in
      self?.startCurrentScanType()
    }
  }

  private func finishScan() -> [[String: Any]] {
    scanTimer?.invalidate()
    scanTypeTimer?.invalidate()
    scanTimer = nil
    scanTypeTimer = nil

    scanManager.stopScan()
    scanManager.delegate = nil

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
    if scanPromise == nil {
      return
    }

    let reader = readerForTerminal(terminal)

    if discoveredReaderIds.contains(terminal.name) {
      return
    }

    discoveredReaderIds.insert(terminal.name)
    knownTerminals[terminal.name] = terminal
    discoveredReaders.append(reader)
    sendEvent(readerDiscoveredEvent, ["reader": reader])
  }

  private func connectReader(readerId: String) throws -> [String: Any] {
    _ = finishScan()

    if let activeReader {
      if activeReader.id != readerId {
        throw readerAlreadyConnectedException(readerId: activeReader.id)
      }

      return readerForTerminal(activeReader.terminal, includeMetadata: true)
    }

    guard let terminal = knownTerminals[readerId] else {
      throw readerNotFoundException(readerId: readerId)
    }

    activeReader = (readerId, terminal)
    return readerForTerminal(terminal, includeMetadata: true)
  }

  private func disconnectReader(readerId: String) throws {
    guard let activeReader, activeReader.id == readerId else {
      throw readerNotConnectedException(readerId: readerId)
    }

    try scanManager.disconnect(terminal: activeReader.terminal)
    self.activeReader = nil
  }

  private func readerForTerminal(
    _ terminal: any CardTerminal,
    includeMetadata: Bool = false
  ) -> [String: Any] {
    var reader: [String: Any] = [
      "id": terminal.name,
      "name": terminal.name
    ]

    if !includeMetadata {
      return reader
    }

    let metadata = readerMetadata(terminal)
    if !metadata.isEmpty {
      reader["metadata"] = metadata
    }

    return reader
  }

  private func readerMetadata(_ terminal: any CardTerminal) -> [String: Any] {
    var metadata: [String: Any] = [:]

    addDeviceInfo(&metadata, key: "model", terminal: terminal, type: .modelNumberString)
    addDeviceInfo(&metadata, key: "firmwareVersion", terminal: terminal, type: .firmwareRevisionString)
    addDeviceInfo(&metadata, key: "serialNumber", terminal: terminal, type: .serialNumberString)

    do {
      let batteryLevel = try scanManager.batteryLevel(terminal: terminal, timeout: metadataTimeoutMs)
      if batteryLevel >= 0 && batteryLevel <= 100 {
        metadata["batteryLevel"] = batteryLevel
      }
    } catch {
      // Metadata support varies by Reader model.
    }

    return metadata
  }

  private func addDeviceInfo(
    _ metadata: inout [String: Any],
    key: String,
    terminal: any CardTerminal,
    type: BluetoothTerminalManager.DeviceInfoType
  ) {
    do {
      guard let value = try scanManager.deviceInfo(terminal: terminal, type: type, timeout: metadataTimeoutMs)?
        .trimmingCharacters(in: .whitespacesAndNewlines) else {
        return
      }

      if value.isEmpty {
        return
      }

      metadata[key] = value
    } catch {
      // Metadata support varies by Reader model.
    }
  }
}

private struct ScanReadersOptions: Record {
  @Field
  var timeoutMs: Double?
}

private func readerPermissionUndeterminedException() -> Exception {
  return Exception(
    name: "ReaderPermissionUndeterminedException",
    description: "Reader Bluetooth permission has not been requested",
    code: "READER_PERMISSION_UNDETERMINED"
  )
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

private func readerNotFoundException(readerId: String) -> Exception {
  return Exception(
    name: "ReaderNotFoundException",
    description: "Reader \(readerId) has not been discovered",
    code: "READER_NOT_FOUND"
  )
}

private func readerAlreadyConnectedException(readerId: String) -> Exception {
  return Exception(
    name: "ReaderAlreadyConnectedException",
    description: "Reader \(readerId) is already connected; disconnect it before connecting another Reader",
    code: "READER_ALREADY_CONNECTED"
  )
}

private func readerNotConnectedException(readerId: String) -> Exception {
  return Exception(
    name: "ReaderNotConnectedException",
    description: "Reader \(readerId) is not connected",
    code: "READER_NOT_CONNECTED"
  )
}

private func readerConnectionUnavailableException() -> Exception {
  return Exception(
    name: "ReaderConnectionUnavailableException",
    description: "Reader connection is not available",
    code: "READER_CONNECTION_UNAVAILABLE"
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
