import { NativeModule, requireNativeModule } from 'expo';

import {
  AuthenticateBlockOptions,
  HexString,
  Reader,
  ReaderCardEvent,
  ReaderDiscoveredEvent,
  ReaderId,
  ReaderPermissionStatus,
  ReadBlockOptions,
  ScanReadersOptions,
  WriteBlockOptions,
} from './ReactNativeBleNfcReader.types';

type ReactNativeBleNfcReaderModuleEvents = {
  onReaderDiscovered(event: ReaderDiscoveredEvent): void;
  onCardPresent(event: ReaderCardEvent): void;
  onCardRemoved(event: ReaderCardEvent): void;
};

export declare class ReactNativeBleNfcReaderModule extends NativeModule<ReactNativeBleNfcReaderModuleEvents> {
  getReaderPermissionStatus?: () => Promise<ReaderPermissionStatus>;
  requestReaderPermissions?: () => Promise<ReaderPermissionStatus>;
  scanReaders?: (options?: ScanReadersOptions) => Promise<Reader[]>;
  stopReaderScan?: () => Promise<Reader[]>;
  connectReader?: (readerId: ReaderId) => Promise<Reader>;
  disconnectReader?: (readerId: ReaderId) => Promise<void>;
  readCardUid?: (readerId: ReaderId) => Promise<HexString>;
  transmit?: (readerId: ReaderId, apdu: HexString) => Promise<HexString>;
  authenticateBlock?: (options: AuthenticateBlockOptions) => Promise<void>;
  readBlock?: (options: ReadBlockOptions) => Promise<HexString>;
  writeBlock?: (options: WriteBlockOptions) => Promise<void>;
}

export default requireNativeModule<ReactNativeBleNfcReaderModule>('ReactNativeBleNfcReader');
