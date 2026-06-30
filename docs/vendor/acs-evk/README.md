# ACS EVK Reference

This folder keeps the upstream ACS BLE EVK Android and iOS demo projects as reference material. The package runtime uses the vendored binaries under `android/libs` and `ios/Frameworks`; this folder is not part of the build.

Demo capabilities not currently exposed by the library:

- Reader admin settings: set/reset master key and get/set terminal timeouts.
- Full reader diagnostics: battery status, system ID, hardware revision, software revision, and manufacturer name.
- Protocol selection: `T=0`, `T=1`, `*`, or `direct`.
- Card session details: ATR and active protocol after connecting.
- Direct/control commands: `transmitControlCommand(controlCode, data)`.
- Script runner: parse command files/input, execute commands line-by-line, and compare expected responses.

Covered by the library today: scan/stop scan, connect/disconnect, card present/removed events, UID read, raw APDU transmit, and MIFARE authenticate/read/write.
