import { registerWebModule, NativeModule } from 'expo';

import { createUnsupportedPlatformError } from './ReactNativeBleNfcReader.types';

// ReactNativeBleNfcReaderModule is not available on the web platform.
class ReactNativeBleNfcReaderModule extends NativeModule {
  getReaderPermissionStatus(): never {
    throw createUnsupportedPlatformError();
  }

  requestReaderPermissions(): never {
    throw createUnsupportedPlatformError();
  }

  scanReaders(): never {
    throw createUnsupportedPlatformError();
  }

  connectReader(): never {
    throw createUnsupportedPlatformError();
  }

  disconnectReader(): never {
    throw createUnsupportedPlatformError();
  }

  readCardUid(): never {
    throw createUnsupportedPlatformError();
  }

  transmit(): never {
    throw createUnsupportedPlatformError();
  }

  authenticateBlock(): never {
    throw createUnsupportedPlatformError();
  }

  readBlock(): never {
    throw createUnsupportedPlatformError();
  }

  writeBlock(): never {
    throw createUnsupportedPlatformError();
  }
}

export default registerWebModule(ReactNativeBleNfcReaderModule, 'ReactNativeBleNfcReaderModule');
