# Expose Explicit Reader Permission Helpers

The public API exposes `getReaderPermissionStatus()` and `requestReaderPermissions()` so apps can build predictable onboarding before scanning. `scanReaders()` still fails with a typed permission error when required Bluetooth permissions are missing.

