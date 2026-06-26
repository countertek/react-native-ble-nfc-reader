import { NativeModule, requireNativeModule } from 'expo';

import {
  AuthenticateBlockOptions,
  HexString,
  Reader,
  ReaderId,
  ReaderPermissionStatus,
  ReadBlockOptions,
  ScanReadersOptions,
  WriteBlockOptions,
} from './ReactNativeBleNfcReader.types';

declare class ReactNativeBleNfcReaderModule extends NativeModule {
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
}

export default requireNativeModule<ReactNativeBleNfcReaderModule>('ReactNativeBleNfcReader');
