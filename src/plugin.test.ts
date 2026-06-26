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
