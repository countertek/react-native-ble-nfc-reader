Pod::Spec.new do |s|
  s.name           = 'ReactNativeBleNfcReader'
  s.version        = '1.0.0'
  s.summary        = 'React Native BLE NFC reader'
  s.description    = 'Expo native module for ACS BLE NFC readers'
  s.author         = 'countertek'
  s.homepage       = 'https://github.com/countertek/react-native-ble-nfc-reader'
  s.platforms      = {
    :ios => '15.0'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = 'ReactNativeBleNfcReaderModule.swift'
  s.vendored_frameworks = 'Frameworks/ACSSmartCardIO.xcframework', 'Frameworks/SmartCardIO.xcframework'
end
