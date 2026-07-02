import {
  addCardPresentListener,
  addCardRemovedListener,
  addReaderDiscoveredListener,
  connectReader,
  disconnectReader,
  getReaderPermissionStatus,
  mifare,
  normalizeHexString,
  readCardUid,
  requestReaderPermissions,
  scanReaders,
  splitApduResponse,
  startCardMonitor,
  stopReaderScan,
  stopCardMonitor,
  transmit,
} from './ReactNativeBleNfcReader';
import { BleNfcReaderError } from './ReactNativeBleNfcReader.types';
import webModule from './ReactNativeBleNfcReaderModule.web';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo', () => {
  const nativeModule = {};

  return {
    NativeModule: class {},
    __mockNativeModule: nativeModule,
    requireNativeModule: () => nativeModule,
    registerWebModule: (ModuleClass: new () => object) => new ModuleClass(),
  };
});

const mockPlatform = jest.requireMock('react-native').Platform as { OS: string };
const mockNativeModule = jest.requireMock('expo').__mockNativeModule as Record<string, jest.Mock>;

beforeEach(() => {
  mockPlatform.OS = 'ios';
  Object.keys(mockNativeModule).forEach((key) => {
    delete mockNativeModule[key];
  });
});

describe('normalizeHexString', () => {
  it('normalizes valid hex strings', () => {
    expect(normalizeHexString('00a4ff')).toBe('00A4FF');
    expect(normalizeHexString('')).toBe('');
  });

  it('rejects invalid hex strings', () => {
    expect(() => normalizeHexString('ABC')).toThrow(BleNfcReaderError);
    expect(() => normalizeHexString('00ZZ')).toThrow(BleNfcReaderError);
    expect(() => normalizeHexString(123 as unknown as string)).toThrow(BleNfcReaderError);
  });
});

describe('BleNfcReaderError', () => {
  it('preserves APDU status values that look falsey to callers', () => {
    const error = new BleNfcReaderError('INVALID_APDU_RESPONSE', 'bad response', '0000');

    expect(error.apduStatus).toBe('0000');
  });
});

describe('splitApduResponse', () => {
  it('splits response data from APDU status', () => {
    expect(splitApduResponse('deadbeef9000')).toEqual({
      responseData: 'DEADBEEF',
      status: '9000',
    });
  });

  it('allows status-only responses', () => {
    expect(splitApduResponse('6A82')).toEqual({
      responseData: '',
      status: '6A82',
    });
  });

  it('rejects responses without APDU status', () => {
    expect(() => splitApduResponse('90')).toThrow(BleNfcReaderError);
  });
});

describe('public native wrappers', () => {
  it('rejects instead of throwing synchronously when a native method is missing', async () => {
    await expect(scanReaders()).rejects.toEqual(
      expect.objectContaining({
        code: 'NATIVE_METHOD_UNAVAILABLE',
      })
    );
  });

  it('returns native Reader permission status values', async () => {
    mockNativeModule.getReaderPermissionStatus = jest.fn(async () => 'denied');
    mockNativeModule.requestReaderPermissions = jest.fn(async () => 'granted');

    await expect(getReaderPermissionStatus()).resolves.toBe('denied');
    await expect(requestReaderPermissions()).resolves.toBe('granted');
  });

  it('maps native permission failures to typed errors', async () => {
    mockNativeModule.scanReaders = jest.fn(async () => {
      const error = new Error('Reader Bluetooth permission is denied');
      Object.assign(error, { code: 'READER_PERMISSION_DENIED' });
      throw error;
    });

    await expect(scanReaders()).rejects.toEqual(
      expect.objectContaining({
        code: 'READER_PERMISSION_DENIED',
      })
    );
    await expect(scanReaders()).rejects.toBeInstanceOf(BleNfcReaderError);
  });

  it('maps missing native permission setup to typed errors', async () => {
    mockNativeModule.getReaderPermissionStatus = jest.fn(async () => {
      const error = new Error('Required Reader Bluetooth permissions are missing');
      Object.assign(error, { code: 'READER_PERMISSION_MISSING' });
      throw error;
    });

    await expect(getReaderPermissionStatus()).rejects.toEqual(
      expect.objectContaining({
        code: 'READER_PERMISSION_MISSING',
      })
    );
    await expect(getReaderPermissionStatus()).rejects.toBeInstanceOf(BleNfcReaderError);
  });

  it('maps undetermined native permission failures to typed errors', async () => {
    mockNativeModule.scanReaders = jest.fn(async () => {
      const error = new Error('Reader Bluetooth permission has not been requested');
      Object.assign(error, { code: 'READER_PERMISSION_UNDETERMINED' });
      throw error;
    });

    await expect(scanReaders()).rejects.toEqual(
      expect.objectContaining({
        code: 'READER_PERMISSION_UNDETERMINED',
      })
    );
    await expect(scanReaders()).rejects.toBeInstanceOf(BleNfcReaderError);
  });

  it('maps native scan availability failures to typed errors', async () => {
    mockNativeModule.scanReaders = jest.fn(async () => {
      const error = new Error('Reader scanning is not available');
      Object.assign(error, { code: 'READER_SCAN_UNAVAILABLE' });
      throw error;
    });

    await expect(scanReaders()).rejects.toEqual(
      expect.objectContaining({
        code: 'READER_SCAN_UNAVAILABLE',
      })
    );
    await expect(scanReaders()).rejects.toBeInstanceOf(BleNfcReaderError);
  });

  it('passes bounded scan options to native', async () => {
    mockNativeModule.scanReaders = jest.fn(async () => [{ id: 'reader-1', name: 'Reader 1' }]);

    await expect(scanReaders({ timeoutMs: 1000 })).resolves.toEqual([
      { id: 'reader-1', name: 'Reader 1' },
    ]);

    expect(mockNativeModule.scanReaders).toHaveBeenCalledWith({ timeoutMs: 1000 });
  });

  it('rejects invalid scan timeouts before native calls', async () => {
    mockNativeModule.scanReaders = jest.fn(async () => []);

    await expect(scanReaders({ timeoutMs: 0 })).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_SCAN_TIMEOUT',
      })
    );

    expect(mockNativeModule.scanReaders).not.toHaveBeenCalled();
  });

  it('rejects non-finite scan timeouts before native calls', async () => {
    mockNativeModule.scanReaders = jest.fn(async () => []);

    await expect(scanReaders({ timeoutMs: Number.POSITIVE_INFINITY })).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_SCAN_TIMEOUT',
      })
    );

    expect(mockNativeModule.scanReaders).not.toHaveBeenCalled();
  });

  it('subscribes to Reader discovery events', () => {
    const listener = jest.fn();
    const subscription = { remove: jest.fn() };
    mockNativeModule.addListener = jest.fn(() => subscription);

    expect(addReaderDiscoveredListener(listener)).toBe(subscription);
    expect(mockNativeModule.addListener).toHaveBeenCalledWith('onReaderDiscovered', listener);
  });

  it('subscribes to card presence events', () => {
    const listener = jest.fn();
    const subscription = { remove: jest.fn() };
    mockNativeModule.addListener = jest.fn(() => subscription);

    expect(addCardPresentListener(listener)).toBe(subscription);
    expect(addCardRemovedListener(listener)).toBe(subscription);
    expect(mockNativeModule.addListener).toHaveBeenCalledWith('onCardPresent', listener);
    expect(mockNativeModule.addListener).toHaveBeenCalledWith('onCardRemoved', listener);
  });

  it('rejects event listeners on web with unsupported-platform errors', () => {
    mockPlatform.OS = 'web';
    const listener = jest.fn();

    expect(() => addReaderDiscoveredListener(listener)).toThrow(
      expect.objectContaining({
        code: 'UNSUPPORTED_PLATFORM',
      })
    );
    expect(() => addCardPresentListener(listener)).toThrow(
      expect.objectContaining({
        code: 'UNSUPPORTED_PLATFORM',
      })
    );
    expect(() => addCardRemovedListener(listener)).toThrow(
      expect.objectContaining({
        code: 'UNSUPPORTED_PLATFORM',
      })
    );
  });

  it('maps native validation errors to typed errors', async () => {
    mockNativeModule.readBlock = jest.fn(async () => {
      const error = new Error('block must be an integer between 0 and 255');
      Object.assign(error, { code: 'INVALID_MIFARE_BLOCK' });
      throw error;
    });

    await expect(mifare.readBlock({ readerId: 'reader-1', block: 4 })).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_MIFARE_BLOCK',
      })
    );
    await expect(mifare.readBlock({ readerId: 'reader-1', block: 4 })).rejects.toBeInstanceOf(
      BleNfcReaderError
    );

    mockNativeModule.authenticateBlock = jest.fn(async () => {
      const error = new Error('keyType must be A or B');
      Object.assign(error, { code: 'INVALID_MIFARE_KEY_TYPE' });
      throw error;
    });

    await expect(
      mifare.authenticateBlock({
        readerId: 'reader-1',
        block: 4,
        keyType: 'A',
        key: 'FFFFFFFFFFFF',
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_MIFARE_KEY_TYPE',
      })
    );

    mockNativeModule.transmit = jest.fn(async () => {
      const error = new Error('apdu must contain only hex characters');
      Object.assign(error, { code: 'INVALID_HEX_STRING' });
      throw error;
    });

    await expect(transmit('reader-1', '00a4')).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_HEX_STRING',
      })
    );
  });

  it('maps native card command failures to typed errors', async () => {
    mockNativeModule.readCardUid = jest.fn(async () => {
      const error = new Error('Card command failed with APDU Status 6A82');
      Object.assign(error, { code: 'CARD_COMMAND_FAILED' });
      throw error;
    });

    await expect(readCardUid('reader-1')).rejects.toEqual(
      expect.objectContaining({
        code: 'CARD_COMMAND_FAILED',
      })
    );
    await expect(readCardUid('reader-1')).rejects.toBeInstanceOf(BleNfcReaderError);
  });

  it('maps native APDU status into card command errors', async () => {
    mockNativeModule.readCardUid = jest.fn(async () => {
      const error = new Error('Card command failed with APDU Status 6300');
      Object.assign(error, { code: 'CARD_COMMAND_FAILED' });
      throw error;
    });

    await expect(readCardUid('reader-1')).rejects.toEqual(
      expect.objectContaining({
        apduStatus: '6300',
        code: 'CARD_COMMAND_FAILED',
      })
    );
  });

  it('stops an active Reader scan', async () => {
    mockNativeModule.stopReaderScan = jest.fn(async () => [{ id: 'reader-1' }]);

    await expect(stopReaderScan()).resolves.toEqual([{ id: 'reader-1' }]);
  });

  it('starts and stops card monitoring through native calls', async () => {
    mockNativeModule.startCardMonitor = jest.fn(async () => undefined);
    mockNativeModule.stopCardMonitor = jest.fn(async () => undefined);

    await expect(startCardMonitor('reader-1')).resolves.toBeUndefined();
    await expect(
      startCardMonitor('reader-1', { pollingIntervalMs: 250, autoStopAfterMs: 1000 })
    ).resolves.toBeUndefined();
    await expect(stopCardMonitor('reader-1')).resolves.toBeUndefined();

    expect(mockNativeModule.startCardMonitor).toHaveBeenNthCalledWith(1, 'reader-1', {
      pollingIntervalMs: 1000,
      autoStopAfterMs: null,
    });
    expect(mockNativeModule.startCardMonitor).toHaveBeenNthCalledWith(2, 'reader-1', {
      pollingIntervalMs: 250,
      autoStopAfterMs: 1000,
    });
    expect(mockNativeModule.stopCardMonitor).toHaveBeenCalledWith('reader-1');
  });

  it('rejects invalid card monitor options before native calls', async () => {
    mockNativeModule.startCardMonitor = jest.fn(async () => undefined);

    await expect(startCardMonitor('reader-1', { pollingIntervalMs: 99 })).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_CARD_MONITOR_OPTIONS',
      })
    );
    await expect(startCardMonitor('reader-1', { pollingIntervalMs: Number.NaN })).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_CARD_MONITOR_OPTIONS',
      })
    );
    await expect(startCardMonitor('reader-1', { pollingIntervalMs: 100.5 })).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_CARD_MONITOR_OPTIONS',
      })
    );
    await expect(startCardMonitor('reader-1', { autoStopAfterMs: 0 })).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_CARD_MONITOR_OPTIONS',
      })
    );

    expect(mockNativeModule.startCardMonitor).not.toHaveBeenCalled();
  });

  it('maps active card monitor conflicts to typed errors', async () => {
    mockNativeModule.startCardMonitor = jest.fn(async () => {
      const error = new Error('Card monitor is already active with different options');
      Object.assign(error, { code: 'CARD_MONITOR_ALREADY_ACTIVE' });
      throw error;
    });

    await expect(startCardMonitor('reader-1')).rejects.toEqual(
      expect.objectContaining({
        code: 'CARD_MONITOR_ALREADY_ACTIVE',
      })
    );
    await expect(startCardMonitor('reader-1')).rejects.toBeInstanceOf(BleNfcReaderError);
  });

  it('connects and disconnects Readers by Reader ID', async () => {
    mockNativeModule.connectReader = jest.fn(async () => ({
      id: 'reader-1',
      name: 'Reader 1',
      metadata: {
        model: 'ACR1555U',
      },
    }));
    mockNativeModule.disconnectReader = jest.fn(async () => undefined);

    await expect(connectReader('reader-1')).resolves.toEqual({
      id: 'reader-1',
      name: 'Reader 1',
      metadata: {
        model: 'ACR1555U',
      },
    });
    await expect(disconnectReader('reader-1')).resolves.toBeUndefined();
    expect(mockNativeModule.connectReader).toHaveBeenCalledWith('reader-1');
    expect(mockNativeModule.disconnectReader).toHaveBeenCalledWith('reader-1');
  });

  it('maps native Reader connection failures to typed errors', async () => {
    mockNativeModule.connectReader = jest.fn(async () => {
      const error = new Error('Another Reader is already connected');
      Object.assign(error, { code: 'READER_ALREADY_CONNECTED' });
      throw error;
    });

    await expect(connectReader('reader-2')).rejects.toEqual(
      expect.objectContaining({
        code: 'READER_ALREADY_CONNECTED',
      })
    );
    await expect(connectReader('reader-2')).rejects.toBeInstanceOf(BleNfcReaderError);
  });

  it('normalizes card UIDs returned from native', async () => {
    mockNativeModule.readCardUid = jest.fn(async () => 'deadbeef');

    await expect(readCardUid('reader-1')).resolves.toBe('DEADBEEF');
  });

  it('returns non-success APDU status without throwing', async () => {
    mockNativeModule.transmit = jest.fn(async () => '6a82');

    await expect(transmit('reader-1', '00a40400')).resolves.toEqual({
      responseData: '',
      status: '6A82',
    });
  });
});

describe('mifare', () => {
  it('normalizes keys and block data before native calls', async () => {
    mockNativeModule.authenticateBlock = jest.fn(async () => undefined);
    mockNativeModule.readBlock = jest.fn(async () => '00112233445566778899aabbccddeeff');
    mockNativeModule.writeBlock = jest.fn(async () => undefined);

    await mifare.authenticateBlock({
      readerId: 'reader-1',
      block: 4,
      keyType: 'A',
      key: 'ffffffffffff',
    });
    await mifare.writeBlock({
      readerId: 'reader-1',
      block: 4,
      data: '00112233445566778899aabbccddeeff',
    });
    await expect(mifare.readBlock({ readerId: 'reader-1', block: 4 })).resolves.toBe(
      '00112233445566778899AABBCCDDEEFF'
    );

    expect(mockNativeModule.authenticateBlock).toHaveBeenCalledWith({
      readerId: 'reader-1',
      block: 4,
      keyType: 'A',
      key: 'FFFFFFFFFFFF',
    });
    expect(mockNativeModule.writeBlock).toHaveBeenCalledWith({
      readerId: 'reader-1',
      block: 4,
      data: '00112233445566778899AABBCCDDEEFF',
    });
    expect(mockNativeModule.readBlock).toHaveBeenCalledWith({
      readerId: 'reader-1',
      block: 4,
    });
  });

  it('rejects invalid block, key, and data values before native calls', async () => {
    mockNativeModule.authenticateBlock = jest.fn(async () => undefined);
    mockNativeModule.writeBlock = jest.fn(async () => undefined);

    await expect(
      mifare.authenticateBlock({
        readerId: 'reader-1',
        block: -1,
        keyType: 'A',
        key: 'FFFFFFFFFFFF',
      })
    ).rejects.toThrow(BleNfcReaderError);
    await expect(
      mifare.authenticateBlock({
        readerId: 'reader-1',
        block: 4,
        keyType: 'A',
        key: 'FFFF',
      })
    ).rejects.toThrow(BleNfcReaderError);
    await expect(
      mifare.authenticateBlock({
        readerId: 'reader-1',
        block: 4,
        keyType: 'C' as 'A',
        key: 'FFFFFFFFFFFF',
      })
    ).rejects.toThrow(BleNfcReaderError);
    await expect(
      mifare.writeBlock({
        readerId: 'reader-1',
        block: 4,
        data: 'FFFF',
      })
    ).rejects.toThrow(BleNfcReaderError);

    expect(mockNativeModule.authenticateBlock).not.toHaveBeenCalled();
    expect(mockNativeModule.writeBlock).not.toHaveBeenCalled();
  });

  it('rejects trailer block writes unless explicitly allowed', async () => {
    mockNativeModule.writeBlock = jest.fn(async () => undefined);

    for (const block of [3, 7, 143]) {
      await expect(
        mifare.writeBlock({
          readerId: 'reader-1',
          block,
          data: '00112233445566778899AABBCCDDEEFF',
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'INVALID_MIFARE_BLOCK',
        })
      );
    }

    expect(mockNativeModule.writeBlock).not.toHaveBeenCalled();

    await mifare.writeBlock({
      readerId: 'reader-1',
      block: 143,
      data: '00112233445566778899AABBCCDDEEFF',
      allowTrailerWrite: true,
    });

    expect(mockNativeModule.writeBlock).toHaveBeenCalledWith({
      readerId: 'reader-1',
      block: 143,
      data: '00112233445566778899AABBCCDDEEFF',
      allowTrailerWrite: true,
    });
  });
});

describe('web module', () => {
  it('fails with a typed unsupported-platform rejection', async () => {
    await expect(webModule.scanReaders()).rejects.toEqual(
      expect.objectContaining({
        code: 'UNSUPPORTED_PLATFORM',
      })
    );
  });

  it('fails all public async entrypoints with unsupported-platform rejections', async () => {
    await expect(webModule.getReaderPermissionStatus()).rejects.toEqual(
      expect.objectContaining({ code: 'UNSUPPORTED_PLATFORM' })
    );
    await expect(webModule.requestReaderPermissions()).rejects.toEqual(
      expect.objectContaining({ code: 'UNSUPPORTED_PLATFORM' })
    );
    await expect(webModule.connectReader('reader-1')).rejects.toEqual(
      expect.objectContaining({ code: 'UNSUPPORTED_PLATFORM' })
    );
    await expect(webModule.startCardMonitor('reader-1')).rejects.toEqual(
      expect.objectContaining({ code: 'UNSUPPORTED_PLATFORM' })
    );
    await expect(webModule.stopCardMonitor('reader-1')).rejects.toEqual(
      expect.objectContaining({ code: 'UNSUPPORTED_PLATFORM' })
    );
  });
});
