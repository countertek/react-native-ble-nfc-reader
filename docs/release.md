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
2. Check whether the org already exists at [npmjs.com/org/countertek](https://www.npmjs.com/org/countertek).
   - **If it exists:** ask an org **owner** to invite you at [Members](https://www.npmjs.com/settings/countertek/members). You need at least **Member** role (Members can publish packages under the org scope).
   - **If it does not exist:** create it from [Create an organization](https://www.npmjs.com/org/create). Public orgs that publish only public packages are free.
3. Confirm your npm user can publish under `@countertek` (org **Owner**, **Admin**, or **Member** with write access to the scope).

**Scoped vs unscoped names:** `@countertek/react-native-ble-nfc-reader` is a separate package name from `react-native-ble-nfc-reader`. The unscoped name is already taken on npm by another project; that does **not** block publishing under the `@countertek` scope. The org owns the `@countertek` namespace; the first successful publish claims `@countertek/react-native-ble-nfc-reader`.

### 2. Create a granular npm access token (for CI)

npm no longer supports legacy Automation/Publish tokens. Use a [granular access token](https://docs.npmjs.com/creating-and-viewing-access-tokens):

1. Open [Access Tokens](https://www.npmjs.com/settings/~/tokens) → **Generate New Token**.
2. Under **Packages and scopes**, choose **Only select packages and scopes** and grant **Read and write** to the `@countertek` scope (or to `@countertek/react-native-ble-nfc-reader` after the first publish).
3. Enable **Bypass two-factor authentication** so GitHub Actions can publish without an interactive OTP prompt.
4. Set a reasonable expiration, generate the token, and copy the value immediately (npm shows the full token only once).

**Important:** granting an org token **Read and write** under **Organizations** only manages org settings and teams—it does **not** authorize package publishes. Publish rights come from **Packages and scopes**.

### 3. Add the `NPM_TOKEN` GitHub Actions secret

1. In this GitHub repository, open [Settings → Secrets and variables → Actions](https://github.com/countertek/react-native-ble-nfc-reader/settings/secrets/actions).
2. Create a repository secret named `NPM_TOKEN` with the granular token value.

The [Release workflow](../.github/workflows/release.yml) passes it as `NODE_AUTH_TOKEN` to `npm publish --provenance --access public`.

### 4. First publish considerations

- Scoped packages are **private by default** on npm. This workflow passes `--access public` so the first publish is public.
- The first successful `npm publish` creates `@countertek/react-native-ble-nfc-reader` on npm under the org (currently unclaimed).
- After merging release automation, cut a GitHub Release to verify the workflow end-to-end.

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `403 Forbidden` on publish | Token lacks **Read and write** on `@countertek` scope/package, or user lacks org publish rights | Regenerate token with correct **Packages and scopes** permissions; confirm org membership |
| `403` / OTP required | 2FA enabled, token missing **Bypass 2FA** | Regenerate token with **Bypass two-factor authentication** checked |
| `402 Payment Required` | Scoped publish without `--access public` on a free account | Workflow already uses `--access public`; verify `package.json` `name` is `@countertek/react-native-ble-nfc-reader` |
| `404` on org settings URL | Org name typo or org not created yet | Verify [npmjs.com/org/countertek](https://www.npmjs.com/org/countertek); create or get invited |
| Package name mismatch | `package.json` `name` does not match intended scope | Must be exactly `@countertek/react-native-ble-nfc-reader` |
| `ENEEDAUTH` / missing token | `NPM_TOKEN` secret missing or empty in GitHub | Add or update the repository secret |

## Publish a release

1. Bump `version` in `package.json` on `main` and merge the change.
2. Create a GitHub Release from the matching tag (for example `v0.1.1`). Publishing the release triggers the `Release` workflow.
3. The workflow runs `pnpm run lint`, `pnpm run build`, then `npm publish --provenance --access public`.
4. Confirm the new version appears on npm and that `npm install @countertek/react-native-ble-nfc-reader@<version>` resolves.

## Manual verification after publish

- Install the published version into the `example/` app or another Expo development build.
- Run the manual hardware checklist in [README.md](../README.md#manual-hardware-checklist) on at least one Android and one iOS device when the release touches native Reader or card behavior.
