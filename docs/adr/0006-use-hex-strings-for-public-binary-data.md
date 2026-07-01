# Use Hex Strings for Public Binary Data

The public JavaScript API represents APDUs, keys, UIDs, and MIFARE block data as hex strings. This matches ACS examples and smart card documentation, avoids React Native Buffer assumptions, and keeps the published npm API serializable across platforms.

