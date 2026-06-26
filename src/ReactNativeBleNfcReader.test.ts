import { normalizeHexString, splitApduResponse } from './ReactNativeBleNfcReader';
import { BleNfcReaderError } from './ReactNativeBleNfcReader.types';
import webModule from './ReactNativeBleNfcReaderModule.web';

jest.mock('expo', () => ({
  NativeModule: class {},
  requireNativeModule: () => ({}),
  registerWebModule: (ModuleClass: new () => object) => new ModuleClass(),
}));

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

describe('web module', () => {
  it('fails with a typed unsupported-platform error', () => {
    expect(() => webModule.scanReaders()).toThrow(
      expect.objectContaining({
        code: 'UNSUPPORTED_PLATFORM',
      })
    );
  });
});
