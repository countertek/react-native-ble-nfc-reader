import { NativeModule, requireNativeModule } from 'expo';

declare class ReactNativeBleNfcReaderModule extends NativeModule<{}> {}

export default requireNativeModule<ReactNativeBleNfcReaderModule>('ReactNativeBleNfcReader');
