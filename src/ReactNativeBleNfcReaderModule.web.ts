import { registerWebModule, NativeModule } from 'expo';

// ReactNativeBleNfcReaderModule is not available on the web platform.
class ReactNativeBleNfcReaderModule extends NativeModule<{}> {}

export default registerWebModule(ReactNativeBleNfcReaderModule, 'ReactNativeBleNfcReaderModule');
