import {
  mifare,
  normalizeHexString,
  readCardUid,
  scanReaders,
  splitApduResponse,
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
