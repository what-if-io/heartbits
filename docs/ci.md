# CI / Continuous Integration

HeartBits uses [Forgejo Actions](https://forgejo.org/docs/latest/user/actions/) for CI — a self-hosted, GitHub Actions–compatible system. The workflow files live in `.forgejo/workflows/` and use the same syntax as GitHub Actions, so they work on GitHub too with no changes.

---

## Workflows

### `relay.yml` — Relay Server

**Triggers:** push to any branch when files under `relay-server/` change, or manual dispatch.

**What it does:**

1. Checks out the repo
2. Sets up Node.js 22 with npm cache
3. `npm ci` — clean install
4. `npm test` — runs the relay test suite

**Runner:** `ubuntu-latest` (any Linux runner works).

---

### `android.yml` — Android Build

**Triggers:** push to `main` when files under `HeartbitsAndroid/` change, or manual dispatch.

**What it does:**

1. Checks out the repo
2. Sets up JDK 17 (Temurin distribution) with Gradle cache
3. `gradle assembleDebug` — builds a debug APK
4. Uploads `app-debug.apk` as a workflow artifact (kept for 7 days)

**Runner:** `ubuntu-latest`. No signing keys required — debug builds use the default debug keystore.

To download the built APK: go to the workflow run → Artifacts → `heartbits-debug`.

---

### `ios.yml` — iOS + watchOS Build

**Triggers:** push to `main` when files under `Heartbits/`, `Heartbits Watch App/`, or `Heartbits.xcodeproj/` change, or manual dispatch.

**What it does:**

1. Checks out the repo
2. Builds the iOS target for the **iOS Simulator** (no signing)
3. Builds the watchOS target for the **watchOS Simulator** (no signing)

Both builds use `CODE_SIGNING_REQUIRED=NO` — the goal is compilation correctness, not a signable artifact.

**Runner:** `self-hosted` — requires a macOS machine with Xcode installed. Simulator builds don't need an Apple Developer account.

#### Setting up the macOS runner

Any Mac with Xcode can act as a runner. Install the Forgejo runner binary:

```bash
# Download from https://code.forgejo.org/forgejo/runner/releases
# Then register it against your Forgejo instance:
forgejo-runner register \
  --instance https://your-forgejo-instance \
  --token YOUR_RUNNER_TOKEN \
  --name my-mac \
  --labels self-hosted,macos,xcode
```

For GitHub Actions, use a [self-hosted runner](https://docs.github.com/en/actions/hosting-your-own-runners) with the same labels.

---

### `desktop.yml` — Desktop (placeholder)

Currently a stub (`workflow_dispatch` only, push trigger commented out). Will cover Windows and Linux desktop targets when those are added.

---

## Runner matrix

| Workflow | Runner type | Why |
|---|---|---|
| `relay.yml` | Hosted Linux | Node.js CI needs no special environment |
| `android.yml` | Hosted Linux | Android SDK available on standard Ubuntu images |
| `ios.yml` | Self-hosted macOS | Xcode only runs on macOS; Apple's EULA prohibits macOS VMs on non-Apple hardware |
| `desktop.yml` | Hosted (future) | Windows/Linux builds can use hosted runners |

---

## Running workflows locally

You can replay any workflow locally using [act](https://github.com/nektos/act) (GitHub Actions) or [forgejo-runner exec](https://forgejo.org/docs/latest/user/actions/#run-a-workflow-locally) (Forgejo):

```bash
# GitHub Actions / act
act push --job test -W .forgejo/workflows/relay.yml

# Forgejo runner local exec
forgejo-runner exec -W .forgejo/workflows/relay.yml
```

iOS workflows require a real Mac and won't run in a container — skip them with `--job build` filtering or run `xcodebuild` directly.

---

## Adding a new workflow

1. Create `.forgejo/workflows/your-service.yml`
2. Follow the path filter pattern so it only triggers on relevant changes:
   ```yaml
   on:
     push:
       paths:
         - 'your-service/**'
   ```
3. Pin action versions (`@v4`, not `@latest`) to avoid surprise breakage
4. Keep secrets out of workflow files — use repository secrets (`${{ secrets.MY_SECRET }}`) for anything sensitive

---

## Migrating to GitHub Actions

The `.forgejo/workflows/` files are valid GitHub Actions YAML. To use them on GitHub:

1. Copy or symlink `.forgejo/workflows/` → `.github/workflows/`
2. The `self-hosted` iOS runner label still requires a registered macOS runner — [set one up](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners) or skip iOS CI and rely on local `xcodebuild` checks
3. Hosted runner labels (`ubuntu-latest`, `windows-latest`) work identically on both platforms
