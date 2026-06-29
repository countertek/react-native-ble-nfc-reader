# react-native-ble-nfc-reader

Expo native module for ACS BLE NFC Readers.

## Installation

Install the package from npm:

```sh
npm install react-native-ble-nfc-reader
```

npm is the primary install path for native React Native and Expo apps. JSR is
secondary and, if used, is only for TypeScript API, types, and docs.

## Requirements

- Android 6.0+ (API 23+)
- iOS 15.0+
- Native development build or prebuilt app; Expo Go and web are not supported.
- ACS BLE Reader supported by the bundled ACS SDK binaries.
- MIFARE Classic Card for the MIFARE Classic helpers.

This package contains native Android and iOS code. After installing it, build a
native development build or run prebuild before using the module.

Add the config plugin to your app config:

```json
{
  "expo": {
    "plugins": ["react-native-ble-nfc-reader"]
  }
}
```

The plugin adds Android BLE permissions and iOS Bluetooth usage descriptions.

## Reader permissions

Use `getReaderPermissionStatus()` before scanning and `requestReaderPermissions()`
when the app needs to prompt. Android reports missing runtime Bluetooth/location
permission as `denied` even before the first request; call
`requestReaderPermissions()` to ask for access. On iOS, calling `scanReaders()`
before Bluetooth permission has been requested rejects with
`READER_PERMISSION_UNDETERMINED`; check status and request Reader permission
before scanning. `READER_PERMISSION_DENIED` means runtime access was denied,
while `READER_PERMISSION_MISSING` means the native permission declaration is
missing.

## Reader scanning

Use `scanReaders({ timeoutMs })` for bounded scans and
`addReaderDiscoveredListener()` to receive Readers during the scan window. Call
`stopReaderScan()` to end the active scan early. Starting a new `scanReaders()`
while one is active supersedes the prior bounded scan: the prior promise resolves
with partial Reader results collected so far, and discovery events for that scan
stop once it ends.

## Reader connection

Use `connectReader(readerId)` with a discovered Reader ID to connect one Reader
per app process. It returns the connected `Reader`; `metadata` may include model,
firmware version, serial number, or battery level when the ACS Reader provides
those fields. Call `disconnectReader(readerId)` to release the native Reader
connection before connecting another Reader. If `disconnectReader()` rejects,
treat the Reader as still active and retry disconnect before connecting another
Reader.

## Card and APDU

Use `addCardPresentListener()` and `addCardRemovedListener()` after connecting a
Reader. `readCardUid(readerId)` returns the presented card UID as a Hex String.
`transmit(readerId, apdu)` sends a raw APDU Hex String and resolves with
`responseData` and `status`; non-`9000` APDU statuses are returned, not thrown.

## MIFARE Classic

Use `mifare.authenticateBlock({ readerId, block, keyType, key })` with a
caller-owned key before `mifare.readBlock({ readerId, block })` or
`mifare.writeBlock({ readerId, block, data })`. Keys are loaded into the Reader
only for the operation and are not stored by this package. `readBlock()` returns
16 bytes as a Hex String. `writeBlock()` rejects trailer blocks unless
`allowTrailerWrite` is set.

## Manual hardware checklist

- Android: grant Reader permission, start a 5 second scan, confirm an ACS BLE
  Reader appears during the scan, then confirm scanning stops at timeout and
  after `stopReaderScan()`. Connect the discovered Reader, confirm optional
  metadata appears when available, present and remove a card, confirm the card
  presence events update, read the card UID, transmit `FFCA000000`, confirm APDU
  Response Data and APDU Status are shown separately, authenticate a MIFARE
  Classic block with a caller-owned key, read the block, write 16 bytes, read it
  back, disconnect it, then confirm a second connect works only after disconnect.
- iOS: grant Bluetooth permission, start a 5 second scan, confirm an ACS BLE
  Reader appears during the scan, then confirm scanning stops at timeout and
  after `stopReaderScan()`. Connect the discovered Reader, confirm optional
  metadata appears when available, present and remove a card, confirm the card
  presence events update, read the card UID, transmit `FFCA000000`, confirm APDU
  Response Data and APDU Status are shown separately, authenticate a MIFARE
  Classic block with a caller-owned key, read the block, write 16 bytes, read it
  back, disconnect it, then confirm a second connect works only after disconnect.

## ACS SDK

ACS SDK binaries are bundled in the native package setup:

- `android/libs/acssmcio-*.aar`
- `android/libs/smartcardio-*.aar`
- `ios/Frameworks/ACSSmartCardIO.xcframework`
- `ios/Frameworks/SmartCardIO.xcframework`

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled ACS and
SmartCardIO/OpenJDK notices.
