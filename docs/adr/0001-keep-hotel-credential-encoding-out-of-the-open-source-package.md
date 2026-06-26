# Keep Hotel Credential Encoding Out of the Open Source Package

The package exposes generic Reader and MIFARE Classic Card operations, while hotel credential encoding remains in the internal app. This keeps the open-source API useful for smart card read/write workflows without publishing hotel-lock-specific data formats, keys, or assumptions.

