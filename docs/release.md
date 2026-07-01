# Release

Public releases of `@countertek/react-native-ble-nfc-reader` are published to [npmjs.com](https://www.npmjs.com/package/@countertek/react-native-ble-nfc-reader). Consumers install with:

```sh
npm install @countertek/react-native-ble-nfc-reader
```

GitHub Actions automates publishing; npm is the package registry.

## Maintainer setup

Before the first automated publish can succeed, a maintainer with publish access to the `@countertek` npm organization must complete the steps below.

### 1. Create or join the `@countertek` npm organization

1. Sign in at [npmjs.com](https://www.npmjs.com/).
2. Open [npm organization settings](https://www.npmjs.com/settings/countertek/members) (or create the org from your account if it does not exist yet).
3. Ensure your npm user is an org **owner** or a **member** with permission to publish packages under `@countertek`.

Scoped packages such as `@countertek/react-native-ble-nfc-reader` live under the org namespace. They do **not** require the unscoped name `react-native-ble-nfc-reader` to be available on npm.

### 2. Create an npm access token

1. Go to [Access Tokens](https://www.npmjs.com/settings/~tokens) (or the org token page if your org uses granular tokens).
2. Create a token with **publish** rights for the `@countertek` scope or for `@countertek/react-native-ble-nfc-reader`.
3. Copy the token value; npm shows it only once.

Classic tokens: choose **Automation** (recommended for CI) or **Publish** with access to the `@countertek` org.

### 3. Add the `NPM_TOKEN` GitHub Actions secret

1. In this GitHub repository, open `Settings` → `Secrets and variables` → `Actions`.
2. Create a repository secret named `NPM_TOKEN` with the npm token value.

### 4. First publish considerations

- Scoped packages are **private by default** on npm. This workflow passes `--access public` so the first publish is public; no separate claim step is needed for the unscoped name.
- The first successful `npm publish` creates `@countertek/react-native-ble-nfc-reader` on npm under the org.
- After merging release automation, cut a GitHub Release to verify the workflow end-to-end.

## Publish a release

1. Bump `version` in `package.json` on `main` and merge the change.
2. Create a GitHub Release from the matching tag (for example `v0.1.1`). Publishing the release triggers the `Release` workflow.
3. The workflow runs `pnpm run lint`, `pnpm run build`, then `npm publish --provenance --access public`.
4. Confirm the new version appears on npm and that `npm install @countertek/react-native-ble-nfc-reader@<version>` resolves.

## Manual verification after publish

- Install the published version into the `example/` app or another Expo development build.
- Run the manual hardware checklist in [README.md](../README.md#manual-hardware-checklist) on at least one Android and one iOS device when the release touches native Reader or card behavior.
