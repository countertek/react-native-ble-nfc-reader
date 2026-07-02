# BLE NFC Reader

This context describes the public language for the React Native Expo module that controls ACS Bluetooth NFC smart card readers.

## Language

**Reader**:
A Bluetooth NFC smart card reader supported by this library and exposed through the public JavaScript API.
_Avoid_: Terminal, CardTerminal, device

**MIFARE Classic Card**:
A smart card type this library supports through generic authentication, block read, and block write operations.
_Avoid_: hotel card, room key

**Hotel Credential Encoding**:
The proprietary data format an internal app writes to a MIFARE Classic Card for hotel guest room access.
_Avoid_: card API, reader API

**Hex String**:
An even-length string of hexadecimal characters used by the public JavaScript API to represent APDUs, keys, card UIDs, and block data.
_Avoid_: Buffer, byte array, binary string

**APDU Response Data**:
The response payload bytes returned by a card command, excluding the status word.
_Avoid_: response, raw response

**APDU Status**:
The two-byte status word returned at the end of an APDU response, represented as a four-character Hex String such as `9000`.
_Avoid_: status code, result code

**Card Presence Event**:
The public event emitted when a connected Reader reports that a card is present.
_Avoid_: card detection, tap event
