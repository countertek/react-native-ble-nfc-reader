# react-native-ble-nfc-reader

[![npm version](https://img.shields.io/npm/v/@countertek/react-native-ble-nfc-reader)](https://www.npmjs.com/package/@countertek/react-native-ble-nfc-reader)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/countertek/react-native-ble-nfc-reader)

Expo native module for ACS BLE NFC Readers — scan for a Reader, connect over Bluetooth, read card UIDs, send raw APDUs, and work with MIFARE Classic Cards.

> [!IMPORTANT]
> This package ships native Android and iOS code. **Expo Go and web are not supported.** Install it into an Expo app with a [development build](https://docs.expo.dev/develop/development-builds/introduction/) or a bare React Native app, then run `expo prebuild` / `npx expo run:android` or `npx expo run:ios` so the native module is compiled in.

## Installation

Install the package from [npmjs.com](https://www.npmjs.com/package/@countertek/react-native-ble-nfc-reader):

```sh
npm install @countertek/react-native-ble-nfc-reader
```

npm is the public distribution path for this native module. See [docs/release.md](docs/release.md) for maintainer release steps.

Add the config plugin to your app config:

```json
{
  "expo": {
    "plugins": ["@countertek/react-native-ble-nfc-reader"]
  }
}
```

The plugin adds Android BLE permissions and iOS Bluetooth usage descriptions. Rebuild the native app after adding or updating the plugin.

## Requirements

| | |
| --- | --- |
| **Platforms** | Android 6.0+ (API 23+), iOS 15.0+ |
| **App type** | Expo development build or bare React Native — not Expo Go, not web |
| **Hardware** | ACS BLE Reader supported by the bundled ACS SDK binaries |
| **Cards** | MIFARE Classic Card for the `mifare` helpers |

See the [`example/`](example/) app for a minimal Expo development-build setup.

## Documentation

Detailed guides — installation troubleshooting, Reader lifecycle, card/APDU usage, MIFARE Classic, and release expectations — are on [DeepWiki](https://deepwiki.com/countertek/react-native-ble-nfc-reader). The [docs/deepwiki.md](docs/deepwiki.md) outline in this repo seeds that structure.

## Reader flow

Typical integration order:

1. **Permissions** — check and request Reader permission before scanning.
2. **Scan** — discover nearby Readers for a bounded window.
3. **Connect** — connect one Reader at a time.
4. **Card** — start monitoring when you need card presence events, read UIDs, transmit APDUs, or use MIFARE Classic helpers.

### Reader permissions

Call `getReaderPermissionStatus()` before scanning. Call `requestReaderPermissions()` when the app needs to prompt.

| Status | Meaning |
| --- | --- |
| `READER_PERMISSION_UNDETERMINED` | Not asked yet — request before scanning (iOS rejects `scanReaders()` until permission is requested) |
| `READER_PERMISSION_DENIED` | User denied runtime access |
| `READER_PERMISSION_MISSING` | Native permission declaration is missing from the app |

On Android, missing Bluetooth/location permission may report as `denied` before the first request; call `requestReaderPermissions()` to prompt.

### Reader scanning

- `scanReaders({ timeoutMs })` — bounded scan; resolves with discovered Readers.
- `addReaderDiscoveredListener()` — receive Readers during the scan window.
- `stopReaderScan()` — end the active scan early.

Starting a new `scanReaders()` while one is active supersedes the prior scan: the prior promise resolves with partial results collected so far, and discovery events for that scan stop once it ends.

### Reader connection

- `connectReader(readerId)` — connect one Reader per app process; returns the connected `Reader`. `metadata` may include model, firmware version, serial number, or battery level when the ACS Reader provides those fields.
- `disconnectReader(readerId)` — release the native connection before connecting another Reader. If disconnect rejects, treat the Reader as still active and retry before connecting elsewhere.

### Card and APDU

After connecting a Reader:

- `addCardPresentListener()` / `addCardRemovedListener()` — subscribe to Card Presence Events (`{ readerId }`).
- `addCardMonitorErrorListener()` — subscribe to card-monitor polling/transport failures (`{ readerId, message }`). Emitted when Card Presence Event monitoring hits a genuine Reader polling or transport failure (for example, an ACS terminal I/O error while polling card presence or waiting for a card change). Does not fire when monitoring ends via an explicit `stopCardMonitor()`, cancellation/interruption of the monitor thread, or configured `autoStopAfterMs` — those paths stop silently.
- `startCardMonitor(readerId, options?)` — explicitly start Card Presence Event monitoring. Connecting a Reader no longer starts monitoring by default in v0.2.0.
- `stopCardMonitor(readerId)` — stop monitoring silently. An explicit stop, configured auto-stop, or cancellation does not mean the card was physically removed; it does not emit a Card Presence Event or a card-monitor error.
- `readCardUid(readerId)` — card UID as a Hex String.
- `transmit(readerId, apdu)` — send a raw APDU Hex String; resolves with `responseData` (APDU Response Data) and `status` (APDU Status). Non-`9000` statuses are returned, not thrown.

`startCardMonitor()` defaults to `{ pollingIntervalMs: 1000, autoStopAfterMs: null }`. `pollingIntervalMs` must be an integer of at least `100`. `autoStopAfterMs`, when provided, must be a positive integer. Repeated starts with the same options are idempotent; repeated starts with different options reject with `CARD_MONITOR_ALREADY_ACTIVE`.

Card commands do not require Card Presence Event monitoring. For example, `readCardUid(readerId)` works after `connectReader(readerId)` even when no monitor is running.

```ts
const present = addCardPresentListener(({ readerId }) => {
  console.log('Card present', readerId);
});
const removed = addCardRemovedListener(({ readerId }) => {
  console.log('Card removed', readerId);
});
const monitorError = addCardMonitorErrorListener(({ readerId, message }) => {
  console.log('Card monitor error', readerId, message);
});

const reader = await connectReader(readerId);
await startCardMonitor(reader.id, { pollingIntervalMs: 1000, autoStopAfterMs: 30000 });
await stopCardMonitor(reader.id);
await disconnectReader(reader.id);

monitorError.remove();
present.remove();
removed.remove();
```

### MIFARE Classic

Use `mifare.authenticateBlock({ readerId, block, keyType, key })` with a caller-owned key before `mifare.readBlock({ readerId, block })` or `mifare.writeBlock({ readerId, block, data })`.

- Keys are loaded into the Reader only for the operation and are not stored by this package.
- `readBlock()` returns 16 bytes as a Hex String.
- `writeBlock()` rejects trailer blocks unless `allowTrailerWrite` is set.

## Manual hardware checklist

Run these checks on real hardware when changing Reader, card, or MIFARE behavior. PRs that touch those flows should note what was tested.

**Android**

1. Grant Reader permission.
2. Start a 5 second scan; confirm an ACS BLE Reader appears.
3. Confirm scanning stops at timeout and after `stopReaderScan()`.
4. Connect the discovered Reader; confirm optional metadata when available.
5. Confirm no Card Presence Events arrive after `connectReader()` alone.
6. Start Card Presence Event monitoring; present and remove a card; confirm presence events update.
7. Start monitoring while a card is already present; confirm an immediate Card Presence Event.
8. Stop monitoring; confirm stop is silent and later card changes do not emit events.
9. Start monitoring with `autoStopAfterMs`; confirm auto-stop is silent.
10. Read the card UID without monitoring running.
11. Transmit `FFCA000000`; confirm APDU Response Data and APDU Status are shown separately.
12. Authenticate a MIFARE Classic block with a caller-owned key, read the block, write 16 bytes, read it back.
13. Disconnect; confirm a second connect works only after disconnect.

**iOS**

1. Grant Bluetooth permission.
2. Start a 5 second scan; confirm an ACS BLE Reader appears.
3. Confirm scanning stops at timeout and after `stopReaderScan()`.
4. Connect the discovered Reader; confirm optional metadata when available.
5. Confirm no Card Presence Events arrive after `connectReader()` alone.
6. Start Card Presence Event monitoring; present and remove a card; confirm presence events update.
7. Start monitoring while a card is already present; confirm an immediate Card Presence Event.
8. Stop monitoring; confirm stop is silent and later card changes do not emit events.
9. Start monitoring with `autoStopAfterMs`; confirm auto-stop is silent.
10. Read the card UID without monitoring running.
11. Transmit `FFCA000000`; confirm APDU Response Data and APDU Status are shown separately.
12. Authenticate a MIFARE Classic block with a caller-owned key, read the block, write 16 bytes, read it back.
13. Disconnect; confirm a second connect works only after disconnect.

## ACS SDK

ACS SDK binaries are bundled in the native package:

- `android/libs/acssmcio-*.aar`
- `android/libs/smartcardio-*.aar`
- `ios/Frameworks/ACSSmartCardIO.xcframework`
- `ios/Frameworks/SmartCardIO.xcframework`

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled ACS and SmartCardIO/OpenJDK notices.

## Development

From the repo root:

```sh
pnpm install
pnpm run lint
pnpm run build
```

Changes to Reader or card flows need the manual hardware checklist on physical devices.
