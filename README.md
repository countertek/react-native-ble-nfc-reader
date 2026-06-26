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

## ACS SDK Placement

ACS SDK redistribution rights are not confirmed, so the npm package does not
bundle ACS binaries yet. Native setup fails until these files are present in the
installed package:

- `android/libs/acssmcio-*.aar`
- `android/libs/smartcardio-*.aar`
- `ios/Frameworks/ACSSmartCardIO.xcframework`
- `ios/Frameworks/SmartCardIO.xcframework`
