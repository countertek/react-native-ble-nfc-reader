# Keys Are Caller-Owned

MIFARE keys are provided by the app at operation time and are never persisted by this package in JavaScript state, native storage, config, examples, or logs. The library may load a key into a Reader session to perform authentication, but key ownership stays outside the open-source package.

