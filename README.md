# react-native-ble-nfc-reader

Expo native module for ACS BLE NFC readers.

## Requirements

- Android 6.0+ (API 23+)
- iOS 15.0+
- Native development build or prebuilt app; Expo Go is not supported.

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
`requestReaderPermissions()` to ask for access.

## ACS SDK

ACS SDK binaries are bundled in the native package setup:

- `android/libs/acssmcio-*.aar`
- `android/libs/smartcardio-*.aar`
- `ios/Frameworks/ACSSmartCardIO.xcframework`
- `ios/Frameworks/SmartCardIO.xcframework`

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled ACS and
SmartCardIO/OpenJDK notices.
