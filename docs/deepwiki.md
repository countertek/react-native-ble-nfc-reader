# DeepWiki documentation

Long-form guides for `@countertek/react-native-ble-nfc-reader` live on [DeepWiki](https://deepwiki.com/countertek/react-native-ble-nfc-reader). The README stays focused on install, constraints, and the main usage path; DeepWiki carries detailed API explanations, troubleshooting, and hardware-specific notes.

This file defines the DeepWiki outline and seeds the topics DeepWiki indexes from the repository.

## Outline

1. [Installation and build troubleshooting](#installation-and-build-troubleshooting)
2. [Reader lifecycle](#reader-lifecycle)
3. [Card and APDU usage](#card-and-apdu-usage)
4. [MIFARE Classic usage](#mifare-classic-usage)
5. [Release and support expectations](#release-and-support-expectations)

---

## Installation and build troubleshooting

### Supported app types

This package ships native Android and iOS code. **Expo Go and web are not supported.**

| App type | Supported |
| --- | --- |
| Expo development build | Yes |
| Bare React Native | Yes |
| Expo Go | No |
| Web | No |

Install into an Expo app with a [development build](https://docs.expo.dev/develop/development-builds/introduction/) or a bare React Native app, then run `expo prebuild` / `npx expo run:android` or `npx expo run:ios` so the native module is compiled in.

### Install steps

```sh
npm install @countertek/react-native-ble-nfc-reader
```

Add the config plugin to `app.json` / `app.config.js`:

```json
{
  "expo": {
    "plugins": ["@countertek/react-native-ble-nfc-reader"]
  }
}
```

The plugin adds Android BLE permissions and iOS Bluetooth usage descriptions. Rebuild the native app after adding or updating the plugin.

### Platform requirements

| | |
| --- | --- |
| **Android** | 6.0+ (API 23+) |
| **iOS** | 15.0+ |
| **Hardware** | ACS BLE Reader supported by the bundled ACS SDK binaries |

See the [`example/`](https://github.com/countertek/react-native-ble-nfc-reader/tree/main/example) app for a minimal Expo development-build setup.

### Common build and runtime issues

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `UNSUPPORTED_PLATFORM` or `NATIVE_METHOD_UNAVAILABLE` | Running in Expo Go, web, or a build without the native module | Create a development build or bare app; run `expo prebuild` and rebuild |
| Plugin changes have no effect | Native project not regenerated | Rebuild after changing the config plugin |
| Reader never appears during scan | Bluetooth off, permissions denied, or Reader out of range | Check `getReaderPermissionStatus()` / `requestReaderPermissions()`; on Android, location may be required for BLE scan |
| iOS rejects `scanReaders()` immediately | Permission not requested yet | Call `requestReaderPermissions()` before scanning |
| `READER_PERMISSION_MISSING` | Config plugin not applied or native project stale | Confirm the plugin is in app config and rebuild |

### ACS SDK binaries

ACS SDK binaries are bundled in the native package:

- `android/libs/acssmcio-*.aar`
- `android/libs/smartcardio-*.aar`
- `ios/Frameworks/ACSSmartCardIO.xcframework`
- `ios/Frameworks/SmartCardIO.xcframework`

See [THIRD_PARTY_NOTICES.md](https://github.com/countertek/react-native-ble-nfc-reader/blob/main/THIRD_PARTY_NOTICES.md) for bundled ACS and SmartCardIO/OpenJDK notices.

---

## Reader lifecycle

Typical integration order:

1. **Permissions** — check and request Reader permission before scanning.
2. **Scan** — discover nearby Readers for a bounded window.
3. **Connect** — connect one Reader at a time.
4. **Card** — listen for card presence, read UIDs, transmit APDUs, or use MIFARE Classic helpers.

### Permissions

| API | Purpose |
| --- | --- |
| `getReaderPermissionStatus()` | Check current permission without prompting |
| `requestReaderPermissions()` | Prompt when access is undetermined |

| Status | Meaning |
| --- | --- |
| `granted` | Runtime access granted |
| `denied` | User denied runtime access |
| `undetermined` | Not asked yet — request before scanning (iOS rejects `scanReaders()` until permission is requested) |

On Android, missing Bluetooth/location permission may report as `denied` before the first request; call `requestReaderPermissions()` to prompt.

Typed errors for permission problems: `READER_PERMISSION_DENIED`, `READER_PERMISSION_UNDETERMINED`, `READER_PERMISSION_MISSING`.

### Scanning

| API | Purpose |
| --- | --- |
| `scanReaders({ timeoutMs })` | Bounded scan; resolves with discovered Readers |
| `addReaderDiscoveredListener()` | Receive Readers during the scan window |
| `stopReaderScan()` | End the active scan early |

Starting a new `scanReaders()` while one is active supersedes the prior scan: the prior promise resolves with partial results collected so far, and discovery events for that scan stop once it ends.

`timeoutMs` must be greater than 0 or `INVALID_SCAN_TIMEOUT` is thrown.

### Connection

| API | Purpose |
| --- | --- |
| `connectReader(readerId)` | Connect one Reader per app process; returns the connected `Reader` |
| `disconnectReader(readerId)` | Release the native connection before connecting another Reader |

`Reader.metadata` may include `model`, `firmwareVersion`, `serialNumber`, or `batteryLevel` when the ACS Reader provides those fields.

Only one Reader may be connected per app process. If `disconnectReader()` rejects, treat the Reader as still active and retry before connecting elsewhere.

| Error code | When |
| --- | --- |
| `READER_NOT_FOUND` | `readerId` not known |
| `READER_ALREADY_CONNECTED` | Another connect while one Reader is active |
| `READER_NOT_CONNECTED` | Card or disconnect call without an active connection |
| `READER_CONNECTION_UNAVAILABLE` | Native connection layer failed |
| `READER_SCAN_UNAVAILABLE` | BLE scan cannot start |

---

## Card and APDU usage

After connecting a Reader:

| API | Purpose |
| --- | --- |
| `addCardPresentListener()` | Card placed on Reader |
| `addCardRemovedListener()` | Card removed from Reader |
| `readCardUid(readerId)` | Card UID as a Hex String |
| `transmit(readerId, apdu)` | Send a raw APDU Hex String |

### Hex String conventions

Public APIs represent APDUs, keys, card UIDs, and block data as **Hex Strings**: even-length strings of hexadecimal characters. Use `normalizeHexString()` to validate and uppercase values before sending them to native code.

### APDU responses

`transmit()` resolves with:

- `responseData` — response payload bytes, excluding the status word
- `status` — two-byte status word as a four-character Hex String (for example `9000`)

Non-`9000` statuses are **returned, not thrown**. Inspect `status` in application code when the card protocol requires it.

Use `splitApduResponse()` to parse a combined Hex String into `responseData` and `status`.

Higher-level MIFARE helpers throw `CARD_COMMAND_FAILED` for failed semantic operations and include `apduStatus` on the error when one is available.

### Quick verification APDU

Transmit `FFCA000000` to read the card UID via the standard GET DATA command. Confirm APDU Response Data and APDU Status are shown separately in your UI.

---

## MIFARE Classic usage

Use `mifare.authenticateBlock({ readerId, block, keyType, key })` with a caller-owned key before `mifare.readBlock({ readerId, block })` or `mifare.writeBlock({ readerId, block, data })`.

| API | Purpose |
| --- | --- |
| `mifare.authenticateBlock(options)` | Load a 6-byte key for one block operation |
| `mifare.readBlock(options)` | Read 16 bytes as a Hex String |
| `mifare.writeBlock(options)` | Write 16 bytes from a Hex String |

### Keys and blocks

- Keys are loaded into the Reader only for the operation and are **not stored** by this package.
- `key` must be exactly 6 bytes (12 hex characters).
- `block` must be an integer from 0 to 255.
- `keyType` must be `'A'` or `'B'`.
- `readBlock()` and `writeBlock()` return or accept 16 bytes as a Hex String.

### Trailer block protection

`writeBlock()` rejects MIFARE Classic sector trailer blocks unless the caller sets `allowTrailerWrite: true`. Trailer blocks contain keys and access bits; the default protects cards from accidental permanent misconfiguration.

Trailer blocks are block index `3 mod 4` in the low sectors and follow the large-sector layout above block 128.

### Typical flow

1. Connect a Reader and wait for a card.
2. `mifare.authenticateBlock({ readerId, block, keyType: 'A', key: 'FFFFFFFFFFFF' })` (use the real key for your card).
3. `mifare.readBlock({ readerId, block })`.
4. Optionally `mifare.writeBlock({ readerId, block, data })` with 16 bytes of hex.
5. Read the block back to verify the write.

---

## Release and support expectations

### Distribution

Public releases publish to [npm](https://www.npmjs.com/package/@countertek/react-native-ble-nfc-reader) as `@countertek/react-native-ble-nfc-reader`. Install with:

```sh
npm install @countertek/react-native-ble-nfc-reader
```

GitHub Actions automates publishing via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC). Maintainer release steps are documented in [docs/release.md](release.md).

### Versioning and verification

After installing a published version:

1. Rebuild the native app so the bundled ACS SDK binaries match the release.
2. Run the [manual hardware checklist](https://github.com/countertek/react-native-ble-nfc-reader/blob/main/README.md#manual-hardware-checklist) on at least one Android and one iOS device when the release touches native Reader or card behavior.

### Support scope

| In scope | Out of scope |
| --- | --- |
| ACS BLE Readers supported by the bundled SDK | Unsupported Reader models or firmware |
| MIFARE Classic authenticate / read / write | Proprietary hotel-credential encoding formats |
| Expo development builds and bare React Native on Android 6+ and iOS 15+ | Expo Go, web, or desktop targets |
| Bug reports and API questions via GitHub Issues | On-site hardware integration consulting |

Report bugs and feature requests on [GitHub Issues](https://github.com/countertek/react-native-ble-nfc-reader/issues). Include platform, Reader model, and the steps from the manual hardware checklist that fail.

### Documentation maintenance

The README badge links to [DeepWiki](https://deepwiki.com/countertek/react-native-ble-nfc-reader) and enables automatic weekly refreshes of the indexed wiki from the public repository.
