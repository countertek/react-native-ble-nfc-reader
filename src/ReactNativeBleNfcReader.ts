import {
  ApduResponse,
  AuthenticateBlockOptions,
  BleNfcReaderError,
  HexString,
  Reader,
  ReaderId,
  ReaderPermissionStatus,
  ReadBlockOptions,
  ScanReadersOptions,
  WriteBlockOptions,
} from './ReactNativeBleNfcReader.types';
import ReactNativeBleNfcReaderModule from './ReactNativeBleNfcReaderModule';

type NativeReaderModule = {
  getReaderPermissionStatus?: () => Promise<ReaderPermissionStatus>;
  requestReaderPermissions?: () => Promise<ReaderPermissionStatus>;
  scanReaders?: (options?: ScanReadersOptions) => Promise<Reader[]>;
  connectReader?: (readerId: ReaderId) => Promise<void>;
  disconnectReader?: (readerId: ReaderId) => Promise<void>;
  readCardUid?: (readerId: ReaderId) => Promise<HexString>;
  transmit?: (readerId: ReaderId, apdu: HexString) => Promise<HexString>;
  authenticateBlock?: (options: AuthenticateBlockOptions) => Promise<void>;
  readBlock?: (options: ReadBlockOptions) => Promise<HexString>;
  writeBlock?: (options: WriteBlockOptions) => Promise<void>;
};

const nativeModule = ReactNativeBleNfcReaderModule as NativeReaderModule;

export function normalizeHexString(value: string, name = 'value'): HexString {
  if (typeof value !== 'string') {
    throw new BleNfcReaderError('INVALID_HEX_STRING', `${name} must be a string`);
  }

  if (!/^[0-9a-fA-F]*$/.test(value)) {
    throw new BleNfcReaderError('INVALID_HEX_STRING', `${name} must contain only hex characters`);
  }

  if (value.length % 2 !== 0) {
    throw new BleNfcReaderError(
      'INVALID_HEX_STRING',
      `${name} must have an even number of characters`
    );
  }

  return value.toUpperCase();
}

export function splitApduResponse(response: HexString): ApduResponse {
  const normalizedResponse = normalizeHexString(response, 'response');

  if (normalizedResponse.length < 4) {
    throw new BleNfcReaderError(
      'INVALID_APDU_RESPONSE',
      'response must include a two-byte APDU status'
    );
  }

  return {
    responseData: normalizedResponse.slice(0, -4),
    status: normalizedResponse.slice(-4),
  };
}

function getNativeMethod<Name extends keyof NativeReaderModule>(
  name: Name
): NonNullable<NativeReaderModule[Name]> {
  const method = nativeModule[name];

  if (typeof method !== 'function') {
    throw new BleNfcReaderError(
      'NATIVE_METHOD_UNAVAILABLE',
      `${String(name)} is not available in this native build`
    );
  }

  return method;
}

export function getReaderPermissionStatus(): Promise<ReaderPermissionStatus> {
  return getNativeMethod('getReaderPermissionStatus')();
}

export function requestReaderPermissions(): Promise<ReaderPermissionStatus> {
  return getNativeMethod('requestReaderPermissions')();
}

export function scanReaders(options?: ScanReadersOptions): Promise<Reader[]> {
  return getNativeMethod('scanReaders')(options);
}

export function connectReader(readerId: ReaderId): Promise<void> {
  return getNativeMethod('connectReader')(readerId);
}

export function disconnectReader(readerId: ReaderId): Promise<void> {
  return getNativeMethod('disconnectReader')(readerId);
}

export function readCardUid(readerId: ReaderId): Promise<HexString> {
  return getNativeMethod('readCardUid')(readerId);
}

export async function transmit(readerId: ReaderId, apdu: HexString): Promise<ApduResponse> {
  const response = await getNativeMethod('transmit')(readerId, normalizeHexString(apdu, 'apdu'));
  return splitApduResponse(response);
}

export const mifare = {
  authenticateBlock(options: AuthenticateBlockOptions): Promise<void> {
    return getNativeMethod('authenticateBlock')({
      ...options,
      key: normalizeHexString(options.key, 'key'),
    });
  },

  async readBlock(options: ReadBlockOptions): Promise<HexString> {
    const data = await getNativeMethod('readBlock')(options);
    return normalizeHexString(data, 'data');
  },

  writeBlock(options: WriteBlockOptions): Promise<void> {
    return getNativeMethod('writeBlock')({
      ...options,
      data: normalizeHexString(options.data, 'data'),
    });
  },
};
