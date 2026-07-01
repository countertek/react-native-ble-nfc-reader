# Release

Public releases of `@countertek/react-native-ble-nfc-reader` are published to [npmjs.com](https://www.npmjs.com/package/@countertek/react-native-ble-nfc-reader). Consumers install with:

```sh
npm install @countertek/react-native-ble-nfc-reader
```

GitHub Actions automates publishing via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC). No long-lived `NPM_TOKEN` is required.

## Maintainer setup

Before the first automated publish can succeed, a maintainer with publish access to the `@countertek` npm organization must complete the steps below.

### 1. Create or join the `@countertek` npm organization

1. Sign in at [npmjs.com](https://www.npmjs.com/).
2. Check whether the org already exists at [npmjs.com/org/countertek](https://www.npmjs.com/org/countertek).
   - **If it exists:** ask an org **owner** to invite you at [Members](https://www.npmjs.com/settings/countertek/members). You need at least **Member** role (Members can publish packages under the org scope).
   - **If it does not exist:** create it from [Create an organization](https://www.npmjs.com/org/create). Public orgs that publish only public packages are free.
3. Confirm your npm user can publish under `@countertek` (org **Owner**, **Admin**, or **Member** with write access to the scope).

**Scoped vs unscoped names:** `@countertek/react-native-ble-nfc-reader` is a separate package name from `react-native-ble-nfc-reader`. The unscoped name is already taken on npm by another project; that does **not** block publishing under the `@countertek` scope.

### 2. Bootstrap: one-time manual first publish

Trusted Publishing can only be configured **after** the package exists on npm. The first publish must be done manually from your machine (interactive `npm login` + 2FA):

```sh
git clone https://github.com/countertek/react-native-ble-nfc-reader.git
cd react-native-ble-nfc-reader
pnpm install
pnpm run build
npm login
npm publish --access public
```

This creates `@countertek/react-native-ble-nfc-reader` on the registry. You only do this once; all later releases use GitHub Actions + OIDC.

**Do not** create a granular access token with **Bypass 2FA** for CI. npm shows a security warning for that option and recommends Trusted Publishing instead.

### 3. Configure Trusted Publishing on npm

After the first manual publish:

1. Open package settings: [Trusted publishing for `@countertek/react-native-ble-nfc-reader`](https://www.npmjs.com/package/@countertek/react-native-ble-nfc-reader/access).
2. Under **Trusted Publisher**, choose **GitHub Actions**.
3. Enter these values exactly (case-sensitive):

| Field | Value |
| --- | --- |
| Organization or user | `countertek` |
| Repository | `react-native-ble-nfc-reader` |
| Workflow filename | `release.yml` |
| Environment name | *(leave blank)* |

4. Under **Allowed actions**, enable **`npm publish`**.
5. Save the configuration.

npm does not validate these fields until the first CI publish. Double-check the workflow filename matches [`.github/workflows/release.yml`](../.github/workflows/release.yml).

### 4. Verify the Release workflow

The [Release workflow](../.github/workflows/release.yml) is already configured for OIDC:

- `permissions.id-token: write` — lets GitHub issue short-lived OIDC credentials
- Node 24 + latest npm CLI (requires npm 11.5.1+)
- `npm publish --access public` with **no** `NODE_AUTH_TOKEN`

Merge [PR #38](https://github.com/countertek/react-native-ble-nfc-reader/pull/38) (or ensure equivalent workflow is on `main`), then cut a GitHub Release to verify end-to-end.

### 5. Harden publishing access (recommended after OIDC works)

Once Trusted Publishing succeeds from CI:

1. Open [package publishing access](https://www.npmjs.com/package/@countertek/react-native-ble-nfc-reader/access).
2. Set **Publishing access** to **Require two-factor authentication and disallow tokens**.
3. Revoke any automation tokens you created during setup.

Trusted publishers keep working; only long-lived write tokens are blocked.

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `ENEEDAUTH` / Unable to authenticate | Trusted publisher not configured, or fields mismatch | Verify org/repo/workflow filename exactly; package must exist on npm first |
| `403 Forbidden` | User lacks org publish rights | Confirm org membership at [Members](https://www.npmjs.com/settings/countertek/members) |
| `402 Payment Required` | Scoped publish without public access | Workflow uses `--access public`; verify `publishConfig.access` in `package.json` |
| OIDC ignored, token errors | `NODE_AUTH_TOKEN` set in workflow | Remove token env vars from the publish step; OIDC is used when no write token is present |
| Workflow filename mismatch | Configured name differs from file | Must be exactly `release.yml` |
| Provenance missing | Private GitHub repo | Provenance requires a **public** source repository |
| `npm publish` uses old auth | npm CLI too old | Workflow upgrades to latest npm; requires npm 11.5.1+ and Node 22.14+ |

## Publish a release

1. Bump `version` in `package.json` on `main` and merge the change.
2. Create a GitHub Release from the matching tag (for example `v0.1.1`). Publishing the release triggers the `Release` workflow.
3. The workflow runs `pnpm run lint`, `pnpm run build`, then `npm publish --access public` via OIDC.
4. Confirm the new version appears on npm and that `npm install @countertek/react-native-ble-nfc-reader@<version>` resolves.

## Manual verification after publish

- Install the published version into the `example/` app or another Expo development build.
- Run the manual hardware checklist in [README.md](../README.md#manual-hardware-checklist) on at least one Android and one iOS device when the release touches native Reader or card behavior.
