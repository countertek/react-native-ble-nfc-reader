# Release

Public releases of `react-native-ble-nfc-reader` are published to [npmjs.com](https://www.npmjs.com/package/react-native-ble-nfc-reader). Consumers install with:

```sh
npm install react-native-ble-nfc-reader
```

GitHub Actions automates publishing; npm is the package registry.

## Maintainer setup

1. Create an npm access token for the `react-native-ble-nfc-reader` package with publish rights.
2. Add the token to this repository as the `NPM_TOKEN` Actions secret (`Settings` → `Secrets and variables` → `Actions`).

## Publish a release

1. Bump `version` in `package.json` on `main` and merge the change.
2. Create a GitHub Release from the matching tag (for example `v0.1.1`). Publishing the release triggers the `Release` workflow.
3. The workflow runs `pnpm run lint`, `pnpm run build`, then `npm publish --provenance --access public`.
4. Confirm the new version appears on npm and that `npm install react-native-ble-nfc-reader@<version>` resolves.

## Manual verification after publish

- Install the published version into the `example/` app or another Expo development build.
- Run the manual hardware checklist in [README.md](../README.md#manual-hardware-checklist) on at least one Android and one iOS device when the release touches native Reader or card behavior.
