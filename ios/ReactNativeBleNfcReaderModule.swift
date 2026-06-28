import ACSSmartCardIO
import CoreBluetooth
import ExpoModulesCore
import Foundation
import SmartCardIO

private let readerDiscoveredEvent = "onReaderDiscovered"
private let cardPresentEvent = "onCardPresent"
private let cardRemovedEvent = "onCardRemoved"
private let defaultScanTimeoutMs = 5000.0
private let metadataTimeoutMs = 1000
private let readUidApdu = "FFCA000000"

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
  private var cardMonitorThread: Thread?
  private var cardMonitorGeneration = 0
  private let readerStateLock = NSLock()
  private let terminalIoLock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("ReactNativeBleNfcReader")

    Events(readerDiscoveredEvent, cardPresentEvent, cardRemovedEvent)

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

    AsyncFunction("readCardUid") { (readerId: String, promise: Promise) in
      do {
        promise.resolve(try self.readCardUid(readerId: readerId))
      } catch let error as Exception {
        promise.reject(error)
      } catch {
        promise.reject(cardCommandFailedException(status: "unknown"))
      }
    }

    AsyncFunction("transmit") { (readerId: String, apdu: String, promise: Promise) in
      do {
        promise.resolve(try self.transmit(readerId: readerId, apdu: apdu))
      } catch let error as Exception {
        promise.reject(error)
      } catch {
        promise.reject(cardCommandFailedException(status: "unknown"))
      }
    }
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
    if let activeReader = withReaderStateLock({ activeReader }) {
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

    if let activeReader = withReaderStateLock({ activeReader }) {
      if activeReader.id != readerId {
        throw readerAlreadyConnectedException(readerId: activeReader.id)
      }

      return readerForTerminal(activeReader.terminal, includeMetadata: true)
    }

    guard let terminal = knownTerminals[readerId] else {
      throw readerNotFoundException(readerId: readerId)
    }

    withReaderStateLock {
      activeReader = (readerId, terminal)
    }
    let reader = readerForTerminal(terminal, includeMetadata: true)
    startCardMonitor(readerId: readerId, terminal: terminal)
    return reader
  }

  private func disconnectReader(readerId: String) throws {
    let terminal = try withReaderStateLock {
      guard let activeReader, activeReader.id == readerId else {
        throw readerNotConnectedException(readerId: readerId)
      }

      return activeReader.terminal
    }

    try withTerminalLock {
      try scanManager.disconnect(terminal: terminal)
    }
    stopCardMonitor()
    withReaderStateLock {
      if activeReader?.id == readerId {
        activeReader = nil
      }
    }
  }

  private func readCardUid(readerId: String) throws -> String {
    let response = try transmit(readerId: readerId, apdu: readUidApdu)

    if response.count < 4 {
      throw cardCommandFailedException(status: "unknown")
    }

    let status = String(response.suffix(4))
    if status != "9000" {
      throw cardCommandFailedException(status: status)
    }

    return String(response.dropLast(4))
  }

  private func transmit(readerId: String, apdu: String) throws -> String {
    let terminal = try activeTerminal(readerId: readerId)

    return try withTerminalLock {
      let card = try terminal.connect(protocolString: "*")
      defer {
        try? card.disconnect(reset: false)
      }

      let channel = try card.basicChannel()
      let commandApdu = try CommandAPDU(apdu: hexBytes(apdu))
      let responseApdu = try channel.transmit(apdu: commandApdu)

      return hexString(responseApdu.bytes)
    }
  }

  private func activeTerminal(readerId: String) throws -> any CardTerminal {
    try withReaderStateLock {
      guard let activeReader, activeReader.id == readerId else {
        throw readerNotConnectedException(readerId: readerId)
      }

      return activeReader.terminal
    }
  }

  private func startCardMonitor(readerId: String, terminal: any CardTerminal) {
    stopCardMonitor()

    let generation = withReaderStateLock {
      cardMonitorGeneration += 1
      return cardMonitorGeneration
    }
    let thread = Thread { [weak self] in
      self?.monitorCardState(readerId: readerId, terminal: terminal, generation: generation)
    }

    withReaderStateLock {
      cardMonitorThread = thread
    }
    thread.start()
  }

  private func stopCardMonitor() {
    let thread = withReaderStateLock {
      cardMonitorGeneration += 1
      let thread = cardMonitorThread
      cardMonitorThread = nil
      return thread
    }
    thread?.cancel()

    guard let thread, thread !== Thread.current else {
      return
    }

    let deadline = Date().addingTimeInterval(1.5)
    while !thread.isFinished && Date() < deadline {
      Thread.sleep(forTimeInterval: 0.05)
    }
  }

  private func monitorCardState(readerId: String, terminal: any CardTerminal, generation: Int) {
    var wasPresent: Bool?

    while !Thread.current.isCancelled && isCurrentCardMonitor(generation) {
      let present = cardPresent(terminal)

      guard let present else {
        Thread.sleep(forTimeInterval: 0.5)
        continue
      }

      if present && wasPresent != true {
        sendCardEvent(cardPresentEvent, readerId: readerId, generation: generation)
      }

      if !present && wasPresent == true {
        if !cardStillAbsent(terminal) {
          continue
        }

        sendCardEvent(cardRemovedEvent, readerId: readerId, generation: generation)
      }

      wasPresent = present

      if !waitForCardChange(terminal, present: present) {
        break
      }
    }
  }

  private func isCurrentCardMonitor(_ generation: Int) -> Bool {
    return withReaderStateLock {
      cardMonitorGeneration == generation && cardMonitorThread === Thread.current
    }
  }

  private func cardPresent(_ terminal: any CardTerminal) -> Bool? {
    do {
      return try withTerminalLock {
        try terminal.isCardPresent()
      }
    } catch {
      return nil
    }
  }

  private func cardStillAbsent(_ terminal: any CardTerminal) -> Bool {
    Thread.sleep(forTimeInterval: 0.25)
    return cardPresent(terminal) != true
  }

  private func waitForCardChange(_ terminal: any CardTerminal, present: Bool) -> Bool {
    do {
      try withTerminalLock {
        if present {
          _ = try terminal.waitForCardAbsent(timeout: 1000)
        } else {
          _ = try terminal.waitForCardPresent(timeout: 1000)
        }
      }
      return true
    } catch {
      return !Thread.current.isCancelled
    }
  }

  private func withTerminalLock<T>(_ block: () throws -> T) rethrows -> T {
    terminalIoLock.lock()
    defer {
      terminalIoLock.unlock()
    }

    return try block()
  }

  private func withReaderStateLock<T>(_ block: () throws -> T) rethrows -> T {
    readerStateLock.lock()
    defer {
      readerStateLock.unlock()
    }

    return try block()
  }

  private func sendCardEvent(_ eventName: String, readerId: String, generation: Int) {
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        return
      }

      let shouldSend = self.withReaderStateLock {
        self.activeReader?.id == readerId && self.cardMonitorGeneration == generation
      }

      guard shouldSend else {
        return
      }

      self.sendEvent(eventName, ["readerId": readerId])
    }
  }

  private func hexBytes(_ value: String) throws -> [UInt8] {
    if value.count % 2 != 0 {
      throw invalidHexStringException()
    }

    var bytes: [UInt8] = []
    var index = value.startIndex

    while index < value.endIndex {
      let nextIndex = value.index(index, offsetBy: 2)
      guard let byte = UInt8(value[index..<nextIndex], radix: 16) else {
        throw invalidHexStringException()
      }

      bytes.append(byte)
      index = nextIndex
    }

    return bytes
  }

  private func hexString(_ bytes: [UInt8]) -> String {
    return bytes.map { String(format: "%02X", $0) }.joined()
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

private func invalidHexStringException() -> Exception {
  return Exception(
    name: "InvalidHexStringException",
    description: "apdu must contain only hex characters",
    code: "INVALID_HEX_STRING"
  )
}

private func cardCommandFailedException(status: String) -> Exception {
  return Exception(
    name: "CardCommandFailedException",
    description: "Card command failed with APDU Status \(status)",
    code: "CARD_COMMAND_FAILED"
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
