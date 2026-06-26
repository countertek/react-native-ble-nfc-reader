export type HexString = string;
export type ReaderId = string;

export type ReaderPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type ReaderMetadata = {
  model?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  batteryLevel?: number;
};

export type Reader = {
  id: ReaderId;
  name?: string;
  metadata?: ReaderMetadata;
};

export type ScanReadersOptions = {
  timeoutMs?: number;
};

export type ApduResponse = {
  responseData: HexString;
  status: HexString;
};

export type MifareKeyType = 'A' | 'B';

export type AuthenticateBlockOptions = {
  readerId: ReaderId;
  block: number;
  keyType: MifareKeyType;
  key: HexString;
};

export type ReadBlockOptions = {
  readerId: ReaderId;
  block: number;
};

export type WriteBlockOptions = {
  readerId: ReaderId;
  block: number;
  data: HexString;
  allowTrailerWrite?: boolean;
};

export type BleNfcReaderErrorCode =
  | 'INVALID_HEX_STRING'
  | 'INVALID_APDU_RESPONSE'
  | 'INVALID_MIFARE_BLOCK'
  | 'NATIVE_METHOD_UNAVAILABLE'
  | 'READER_PERMISSION_DENIED'
  | 'READER_PERMISSION_MISSING'
  | 'UNSUPPORTED_PLATFORM';

export class BleNfcReaderError extends Error {
  readonly code: BleNfcReaderErrorCode;
  readonly apduStatus?: HexString;

  constructor(code: BleNfcReaderErrorCode, message: string, apduStatus?: HexString) {
    super(message);
    this.name = 'BleNfcReaderError';
    this.code = code;

    if (apduStatus !== undefined) {
      this.apduStatus = apduStatus;
    }
  }
}

export function createUnsupportedPlatformError(): BleNfcReaderError {
  return new BleNfcReaderError(
    'UNSUPPORTED_PLATFORM',
    'react-native-ble-nfc-reader requires a native development build on iOS or Android'
  );
}
