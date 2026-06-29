const { compileModsAsync } = require('expo/config-plugins');

const plugin = require('../app.plugin.js');

describe('config plugin helpers', () => {
  it('adds Android BLE permissions once', () => {
    const androidManifest = { manifest: {} };

    plugin.addAndroidBleRequirements(androidManifest);
    plugin.addAndroidBleRequirements(androidManifest);

    expect(androidManifest.manifest.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
    expect(androidManifest.manifest['uses-feature']).toEqual([
      {
        $: {
          'android:name': 'android.hardware.bluetooth_le',
          'android:required': 'true',
        },
      },
    ]);
    expect(androidManifest.manifest['uses-permission']).toHaveLength(6);
    expect(androidManifest.manifest['uses-permission']).toEqual(
      expect.arrayContaining([
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
      ])
    );
  });

  it('adds iOS Bluetooth usage descriptions without replacing app text', () => {
    const infoPlist = {
      NSBluetoothAlwaysUsageDescription: 'Custom Bluetooth copy',
    };

    plugin.setIosBluetoothUsageDescriptions(infoPlist);

    expect(infoPlist.NSBluetoothAlwaysUsageDescription).toBe('Custom Bluetooth copy');
    expect(infoPlist.NSBluetoothPeripheralUsageDescription).toContain('connect ACS readers');
  });

  it('exports the config plugin without requiring app-specific options', () => {
    expect(typeof plugin).toBe('function');
  });
});

describe('config plugin mods', () => {
  it('applies Android BLE requirements through Expo manifest mods', async () => {
    const config = await compilePlugin();
    const androidManifest = config._internal.modResults.android.manifest;
    const requiredPermissionNames = [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
    ];
    const permissions = androidManifest.manifest['uses-permission'].filter((permission) =>
      requiredPermissionNames.includes(permission.$['android:name'])
    );

    expect(androidManifest.manifest['uses-feature']).toEqual(
      expect.arrayContaining([
        {
          $: {
            'android:name': 'android.hardware.bluetooth_le',
            'android:required': 'true',
          },
        },
      ])
    );
    expect(permissions).toHaveLength(requiredPermissionNames.length);
    expect(permissions).toEqual(
      expect.arrayContaining([
        {
          $: {
            'android:name': 'android.permission.BLUETOOTH_SCAN',
            'android:usesPermissionFlags': 'neverForLocation',
            'tools:targetApi': 's',
          },
        },
      ])
    );
  });

  it('applies iOS Bluetooth descriptions through Expo Info.plist mods', async () => {
    const config = await compilePlugin({
      ios: {
        infoPlist: {
          NSBluetoothAlwaysUsageDescription: 'Custom Bluetooth copy',
        },
      },
    });
    const infoPlist = config._internal.modResults.ios.infoPlist;

    expect(infoPlist.NSBluetoothAlwaysUsageDescription).toBe('Custom Bluetooth copy');
    expect(infoPlist.NSBluetoothPeripheralUsageDescription).toContain('connect ACS readers');
  });
});

function compilePlugin(config = {}) {
  return compileModsAsync(
    plugin({
      name: 'Test App',
      slug: 'test-app',
      ...config,
    }),
    {
      projectRoot: process.cwd(),
      platforms: ['android', 'ios'],
      introspect: true,
    }
  );
}
