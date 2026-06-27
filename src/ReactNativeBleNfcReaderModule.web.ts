import { registerWebModule, NativeModule } from 'expo';

import {
  createUnsupportedPlatformError,
  HexString,
  Reader,
  ReaderId,
  ReaderPermissionStatus,
  ScanReadersOptions,
} from './ReactNativeBleNfcReader.types';

// ReactNativeBleNfcReaderModule is not available on the web platform.
class ReactNativeBleNfcReaderModule extends NativeModule {
  private rejectUnsupported<T>(): Promise<T> {
    return Promise.reject(createUnsupportedPlatformError());
  }

  getReaderPermissionStatus(): Promise<ReaderPermissionStatus> {
    return this.rejectUnsupported();
  }

  requestReaderPermissions(): Promise<ReaderPermissionStatus> {
    return this.rejectUnsupported();
  }

  scanReaders(_options?: ScanReadersOptions): Promise<Reader[]> {
    return this.rejectUnsupported();
  }

  stopReaderScan(): Promise<Reader[]> {
    return this.rejectUnsupported();
  }

  connectReader(_readerId: ReaderId): Promise<Reader> {
    return this.rejectUnsupported();
  }

  disconnectReader(_readerId: ReaderId): Promise<void> {
    return this.rejectUnsupported();
  }

  readCardUid(_readerId: ReaderId): Promise<HexString> {
    return this.rejectUnsupported();
  }

  transmit(_readerId: ReaderId, _apdu: HexString): Promise<HexString> {
    return this.rejectUnsupported();
  }

  authenticateBlock(): Promise<void> {
    return this.rejectUnsupported();
  }

  readBlock(): Promise<HexString> {
    return this.rejectUnsupported();
  }

  writeBlock(): Promise<void> {
    return this.rejectUnsupported();
  }
}

export default registerWebModule(ReactNativeBleNfcReaderModule, 'ReactNativeBleNfcReaderModule');
