import { Platform } from 'react-native';

import {
  ApduResponse,
  AuthenticateBlockOptions,
  BleNfcReaderError,
  CardMonitorOptions,
  createUnsupportedPlatformError,
  HexString,
  Reader,
  ReaderCardEvent,
  ReaderDiscoveredEvent,
  ReaderDiscoverySubscription,
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Reader permission failed';
}

function normalizeNativeError(error: unknown): unknown {
  if (error instanceof BleNfcReaderError) {
    return error;
  }

  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return error;
  }

  if (error.code === 'READER_PERMISSION_DENIED') {
    return new BleNfcReaderError('READER_PERMISSION_DENIED', getErrorMessage(error));
  }

  if (error.code === 'READER_PERMISSION_UNDETERMINED') {
    return new BleNfcReaderError('READER_PERMISSION_UNDETERMINED', getErrorMessage(error));
  }

  if (error.code === 'READER_PERMISSION_MISSING') {
    return new BleNfcReaderError('READER_PERMISSION_MISSING', getErrorMessage(error));
  }

  if (error.code === 'INVALID_SCAN_TIMEOUT') {
    return new BleNfcReaderError('INVALID_SCAN_TIMEOUT', getErrorMessage(error));
  }

  if (error.code === 'INVALID_CARD_MONITOR_OPTIONS') {
    return new BleNfcReaderError('INVALID_CARD_MONITOR_OPTIONS', getErrorMessage(error));
  }

  if (error.code === 'READER_SCAN_UNAVAILABLE') {
    return new BleNfcReaderError('READER_SCAN_UNAVAILABLE', getErrorMessage(error));
  }

  if (error.code === 'READER_NOT_FOUND') {
    return new BleNfcReaderError('READER_NOT_FOUND', getErrorMessage(error));
  }

  if (error.code === 'READER_ALREADY_CONNECTED') {
    return new BleNfcReaderError('READER_ALREADY_CONNECTED', getErrorMessage(error));
  }

  if (error.code === 'READER_NOT_CONNECTED') {
    return new BleNfcReaderError('READER_NOT_CONNECTED', getErrorMessage(error));
  }

  if (error.code === 'READER_CONNECTION_UNAVAILABLE') {
    return new BleNfcReaderError('READER_CONNECTION_UNAVAILABLE', getErrorMessage(error));
  }

  if (error.code === 'CARD_MONITOR_ALREADY_ACTIVE') {
    return new BleNfcReaderError('CARD_MONITOR_ALREADY_ACTIVE', getErrorMessage(error));
  }

  if (error.code === 'CARD_COMMAND_FAILED') {
    const message = getErrorMessage(error);
    return new BleNfcReaderError('CARD_COMMAND_FAILED', message, extractApduStatus(message));
  }

  if (error.code === 'INVALID_HEX_STRING') {
    return new BleNfcReaderError('INVALID_HEX_STRING', getErrorMessage(error));
  }

  if (error.code === 'INVALID_MIFARE_BLOCK') {
    return new BleNfcReaderError('INVALID_MIFARE_BLOCK', getErrorMessage(error));
  }

  if (error.code === 'INVALID_MIFARE_KEY_TYPE') {
    return new BleNfcReaderError('INVALID_MIFARE_KEY_TYPE', getErrorMessage(error));
  }

  return error;
}

function extractApduStatus(message: string): HexString | undefined {
  const match = message.match(/\bAPDU Status ([0-9a-fA-F]{4})\b/);

  if (match === null) {
    return undefined;
  }

  return match[1].toUpperCase();
}

async function callNative<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw normalizeNativeError(error);
  }
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
  if (!Number.isInteger(block) || block < 0 || block > 255) {
    throw new BleNfcReaderError(
      'INVALID_MIFARE_BLOCK',
      'block must be an integer between 0 and 255'
    );
  }
}

function assertKeyType(keyType: string): void {
  if (keyType === 'A') {
    return;
  }

  if (keyType === 'B') {
    return;
  }

  throw new BleNfcReaderError('INVALID_MIFARE_KEY_TYPE', 'keyType must be A or B');
}

function isMifareTrailerBlock(block: number): boolean {
  if (block < 128) {
    return block % 4 === 3;
  }

  return (block - 143) % 16 === 0;
}

function normalizeScanOptions(options?: ScanReadersOptions): ScanReadersOptions | undefined {
  if (options?.timeoutMs === undefined) {
    return options;
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new BleNfcReaderError('INVALID_SCAN_TIMEOUT', 'timeoutMs must be greater than 0');
  }

  return options;
}

function normalizeCardMonitorOptions(options?: CardMonitorOptions): Required<CardMonitorOptions> {
  const pollingIntervalMs = options?.pollingIntervalMs ?? 1000;
  const autoStopAfterMs = options?.autoStopAfterMs ?? null;

  if (
    !Number.isFinite(pollingIntervalMs) ||
    !Number.isInteger(pollingIntervalMs) ||
    pollingIntervalMs < 100
  ) {
    throw new BleNfcReaderError(
      'INVALID_CARD_MONITOR_OPTIONS',
      'pollingIntervalMs must be an integer greater than or equal to 100'
    );
  }

  if (
    autoStopAfterMs !== null &&
    (!Number.isFinite(autoStopAfterMs) ||
      !Number.isInteger(autoStopAfterMs) ||
      autoStopAfterMs <= 0)
  ) {
    throw new BleNfcReaderError(
      'INVALID_CARD_MONITOR_OPTIONS',
      'autoStopAfterMs must be a positive integer'
    );
  }

  return {
    pollingIntervalMs,
    autoStopAfterMs,
  };
}

export async function getReaderPermissionStatus(): Promise<ReaderPermissionStatus> {
  return callNative(() => getNativeMethod('getReaderPermissionStatus')());
}

export async function requestReaderPermissions(): Promise<ReaderPermissionStatus> {
  return callNative(() => getNativeMethod('requestReaderPermissions')());
}

export async function scanReaders(options?: ScanReadersOptions): Promise<Reader[]> {
  return callNative(() => getNativeMethod('scanReaders')(normalizeScanOptions(options)));
}

export async function stopReaderScan(): Promise<Reader[]> {
  return callNative(() => getNativeMethod('stopReaderScan')());
}

export function addReaderDiscoveredListener(
  listener: (event: ReaderDiscoveredEvent) => void
): ReaderDiscoverySubscription {
  assertNativeListenerAvailable();
  return nativeModule.addListener('onReaderDiscovered', listener);
}

export function addCardPresentListener(
  listener: (event: ReaderCardEvent) => void
): ReaderDiscoverySubscription {
  assertNativeListenerAvailable();
  return nativeModule.addListener('onCardPresent', listener);
}

export function addCardRemovedListener(
  listener: (event: ReaderCardEvent) => void
): ReaderDiscoverySubscription {
  assertNativeListenerAvailable();
  return nativeModule.addListener('onCardRemoved', listener);
}

function assertNativeListenerAvailable(): void {
  if (Platform.OS === 'web') {
    throw createUnsupportedPlatformError();
  }

  if (typeof nativeModule.addListener !== 'function') {
    throw new BleNfcReaderError(
      'NATIVE_METHOD_UNAVAILABLE',
      'addListener is not available in this native build'
    );
  }
}

export async function connectReader(readerId: ReaderId): Promise<Reader> {
  return callNative(() => getNativeMethod('connectReader')(readerId));
}

export async function disconnectReader(readerId: ReaderId): Promise<void> {
  return callNative(() => getNativeMethod('disconnectReader')(readerId));
}

export async function startCardMonitor(
  readerId: ReaderId,
  options?: CardMonitorOptions
): Promise<void> {
  return callNative(() =>
    getNativeMethod('startCardMonitor')(readerId, normalizeCardMonitorOptions(options))
  );
}

export async function stopCardMonitor(readerId: ReaderId): Promise<void> {
  return callNative(() => getNativeMethod('stopCardMonitor')(readerId));
}

export async function readCardUid(readerId: ReaderId): Promise<HexString> {
  const uid = await callNative(() => getNativeMethod('readCardUid')(readerId));
  return normalizeHexString(uid, 'uid');
}

export async function transmit(readerId: ReaderId, apdu: HexString): Promise<ApduResponse> {
  const response = await callNative(() =>
    getNativeMethod('transmit')(readerId, normalizeHexString(apdu, 'apdu'))
  );
  return splitApduResponse(response);
}

export const mifare = {
  async authenticateBlock(options: AuthenticateBlockOptions): Promise<void> {
    assertBlock(options.block);
    assertKeyType(options.keyType);

    return callNative(() =>
      getNativeMethod('authenticateBlock')({
        ...options,
        key: normalizeSizedHexString(options.key, 'key', 6),
      })
    );
  },

  async readBlock(options: ReadBlockOptions): Promise<HexString> {
    assertBlock(options.block);

    const data = await callNative(() => getNativeMethod('readBlock')(options));
    return normalizeHexString(data, 'data');
  },

  async writeBlock(options: WriteBlockOptions): Promise<void> {
    assertBlock(options.block);

    if (options.allowTrailerWrite !== true && isMifareTrailerBlock(options.block)) {
      throw new BleNfcReaderError(
        'INVALID_MIFARE_BLOCK',
        'trailer block writes require allowTrailerWrite'
      );
    }

    return callNative(() =>
      getNativeMethod('writeBlock')({
        ...options,
        data: normalizeSizedHexString(options.data, 'data', 16),
      })
    );
  },
};
