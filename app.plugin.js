const fs = require('fs');
const path = require('path');
const {
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
} = require('expo/config-plugins');
const pkg = require('./package.json');

const IOS_BLUETOOTH_MESSAGE =
  'Allow $(PRODUCT_NAME) to use Bluetooth to connect ACS readers.';

const ANDROID_BLE_FEATURE = {
  $: {
    'android:name': 'android.hardware.bluetooth_le',
    'android:required': 'true',
  },
};

const ANDROID_BLE_PERMISSIONS = [
  {
    $: {
      'android:name': 'android.permission.BLUETOOTH',
      'android:maxSdkVersion': '30',
    },
  },
  {
    $: {
      'android:name': 'android.permission.BLUETOOTH_ADMIN',
      'android:maxSdkVersion': '30',
    },
  },
  {
    $: {
      'android:name': 'android.permission.ACCESS_FINE_LOCATION',
      'android:maxSdkVersion': '30',
    },
  },
  {
    $: {
      'android:name': 'android.permission.ACCESS_COARSE_LOCATION',
      'android:maxSdkVersion': '28',
    },
  },
  {
    $: {
      'android:name': 'android.permission.BLUETOOTH_SCAN',
      'android:usesPermissionFlags': 'neverForLocation',
      'tools:targetApi': 's',
    },
  },
  {
    $: {
      'android:name': 'android.permission.BLUETOOTH_CONNECT',
    },
  },
];

function ensureManifestItems(manifest, key) {
  if (!manifest.manifest[key]) {
    manifest.manifest[key] = [];
  }

  return manifest.manifest[key];
}

function upsertAndroidNamedItem(items, item) {
  const name = item.$['android:name'];
  const existing = items.find((candidate) => candidate.$['android:name'] === name);

  if (existing) {
    existing.$ = { ...existing.$, ...item.$ };
    return;
  }

  items.push(item);
}

function addAndroidBleRequirements(androidManifest) {
  const manifest = androidManifest.manifest;

  if (!manifest.$) {
    manifest.$ = {};
  }
  manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

  const features = ensureManifestItems(androidManifest, 'uses-feature');
  upsertAndroidNamedItem(features, ANDROID_BLE_FEATURE);

  const permissions = ensureManifestItems(androidManifest, 'uses-permission');
  ANDROID_BLE_PERMISSIONS.forEach((permission) => {
    upsertAndroidNamedItem(permissions, permission);
  });

  return androidManifest;
}

function setIosBluetoothUsageDescriptions(infoPlist) {
  if (!infoPlist.NSBluetoothAlwaysUsageDescription) {
    infoPlist.NSBluetoothAlwaysUsageDescription = IOS_BLUETOOTH_MESSAGE;
  }

  if (!infoPlist.NSBluetoothPeripheralUsageDescription) {
    infoPlist.NSBluetoothPeripheralUsageDescription = IOS_BLUETOOTH_MESSAGE;
  }

  return infoPlist;
}

function hasMatchingFile(dir, pattern) {
  if (!fs.existsSync(dir)) {
    return false;
  }

  return fs.readdirSync(dir).some((file) => pattern.test(file));
}

function getMissingAcsSdkBinaries(packageRoot = __dirname) {
  const missing = [];
  const androidLibs = path.join(packageRoot, 'android', 'libs');
  const iosFrameworks = path.join(packageRoot, 'ios', 'Frameworks');

  if (!hasMatchingFile(androidLibs, /^acssmcio-.+\.aar$/)) {
    missing.push('android/libs/acssmcio-*.aar');
  }

  if (!hasMatchingFile(androidLibs, /^smartcardio-.+\.aar$/)) {
    missing.push('android/libs/smartcardio-*.aar');
  }

  if (!fs.existsSync(path.join(iosFrameworks, 'ACSSmartCardIO.xcframework'))) {
    missing.push('ios/Frameworks/ACSSmartCardIO.xcframework');
  }

  if (!fs.existsSync(path.join(iosFrameworks, 'SmartCardIO.xcframework'))) {
    missing.push('ios/Frameworks/SmartCardIO.xcframework');
  }

  return missing;
}

function assertAcsSdkBinariesPresent(packageRoot = __dirname) {
  const missing = getMissingAcsSdkBinaries(packageRoot);

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    [
      'react-native-ble-nfc-reader requires ACS SDK binaries for native builds.',
      'ACS redistribution rights are not confirmed, so this package does not bundle them yet.',
      `Missing: ${missing.join(', ')}`,
      'See README.md#acs-sdk-placement.',
    ].join('\n')
  );
}

function withBleNfcReader(config) {
  assertAcsSdkBinariesPresent();

  config = withInfoPlist(config, (nextConfig) => {
    setIosBluetoothUsageDescriptions(nextConfig.modResults);
    return nextConfig;
  });

  config = withAndroidManifest(config, (nextConfig) => {
    addAndroidBleRequirements(nextConfig.modResults);
    return nextConfig;
  });

  return config;
}

module.exports = createRunOncePlugin(withBleNfcReader, pkg.name, pkg.version);
module.exports.addAndroidBleRequirements = addAndroidBleRequirements;
module.exports.assertAcsSdkBinariesPresent = assertAcsSdkBinariesPresent;
module.exports.getMissingAcsSdkBinaries = getMissingAcsSdkBinaries;
module.exports.setIosBluetoothUsageDescriptions = setIosBluetoothUsageDescriptions;
module.exports.withBleNfcReader = withBleNfcReader;
