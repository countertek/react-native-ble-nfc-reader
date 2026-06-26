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

function withBleNfcReader(config) {
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
module.exports.setIosBluetoothUsageDescriptions = setIosBluetoothUsageDescriptions;
module.exports.withBleNfcReader = withBleNfcReader;
