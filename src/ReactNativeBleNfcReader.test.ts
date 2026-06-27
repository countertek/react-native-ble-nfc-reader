import {
  addReaderDiscoveredListener,
  getReaderPermissionStatus,
  mifare,
  normalizeHexString,
  readCardUid,
  requestReaderPermissions,
  scanReaders,
  splitApduResponse,
  stopReaderScan,
  transmit,
} from './ReactNativeBleNfcReader';
import { BleNfcReaderError } from './ReactNativeBleNfcReader.types';
import webModule from './ReactNativeBleNfcReaderModule.web';

jest.mock('expo', () => {
  const nativeModule = {};

  return {
    NativeModule: class {},
    __mockNativeModule: nativeModule,
    requireNativeModule: () => nativeModule,
    registerWebModule: (ModuleClass: new () => object) => new ModuleClass(),
  };
});

const mockNativeModule = jest.requireMock('expo').__mockNativeModule as Record<string, jest.Mock>;

beforeEach(() => {
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

  it('stops an active Reader scan', async () => {
    mockNativeModule.stopReaderScan = jest.fn(async () => [{ id: 'reader-1' }]);

    await expect(stopReaderScan()).resolves.toEqual([{ id: 'reader-1' }]);
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
      mifare.writeBlock({
        readerId: 'reader-1',
        block: 4,
        data: 'FFFF',
      })
    ).rejects.toThrow(BleNfcReaderError);

    expect(mockNativeModule.authenticateBlock).not.toHaveBeenCalled();
    expect(mockNativeModule.writeBlock).not.toHaveBeenCalled();
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
});
