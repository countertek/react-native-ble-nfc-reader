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
import ReactNativeBleNfcReaderModule, {
  ReactNativeBleNfcReaderModule as NativeReaderModule,
} from './ReactNativeBleNfcReaderModule';

const nativeModule: NativeReaderModule = ReactNativeBleNfcReaderModule;

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

function normalizeSizedHexString(value: string, name: string, byteLength: number): HexString {
  const normalizedValue = normalizeHexString(value, name);

  if (normalizedValue.length !== byteLength * 2) {
    throw new BleNfcReaderError(
      'INVALID_HEX_STRING',
      `${name} must be ${byteLength} bytes (${byteLength * 2} hex characters)`
    );
  }

  return normalizedValue;
}

function assertBlock(block: number): void {
  if (!Number.isInteger(block) || block < 0) {
    throw new BleNfcReaderError('INVALID_MIFARE_BLOCK', 'block must be a non-negative integer');
  }
}

export async function getReaderPermissionStatus(): Promise<ReaderPermissionStatus> {
  return getNativeMethod('getReaderPermissionStatus')();
}

export async function requestReaderPermissions(): Promise<ReaderPermissionStatus> {
  return getNativeMethod('requestReaderPermissions')();
}

export async function scanReaders(options?: ScanReadersOptions): Promise<Reader[]> {
  return getNativeMethod('scanReaders')(options);
}

export async function connectReader(readerId: ReaderId): Promise<void> {
  return getNativeMethod('connectReader')(readerId);
}

export async function disconnectReader(readerId: ReaderId): Promise<void> {
  return getNativeMethod('disconnectReader')(readerId);
}

export async function readCardUid(readerId: ReaderId): Promise<HexString> {
  const uid = await getNativeMethod('readCardUid')(readerId);
  return normalizeHexString(uid, 'uid');
}

export async function transmit(readerId: ReaderId, apdu: HexString): Promise<ApduResponse> {
  const response = await getNativeMethod('transmit')(readerId, normalizeHexString(apdu, 'apdu'));
  return splitApduResponse(response);
}

export const mifare = {
  async authenticateBlock(options: AuthenticateBlockOptions): Promise<void> {
    assertBlock(options.block);

    return getNativeMethod('authenticateBlock')({
      ...options,
      key: normalizeSizedHexString(options.key, 'key', 6),
    });
  },

  async readBlock(options: ReadBlockOptions): Promise<HexString> {
    assertBlock(options.block);

    const data = await getNativeMethod('readBlock')(options);
    return normalizeHexString(data, 'data');
  },

  async writeBlock(options: WriteBlockOptions): Promise<void> {
    assertBlock(options.block);

    return getNativeMethod('writeBlock')({
      ...options,
      data: normalizeSizedHexString(options.data, 'data', 16),
    });
  },
};
