# Native apps (Expo / React Native) with OTA previews per PR

Generic: this works for any Expo/React Native app that publishes an OTA update per pull request (EAS Update or similar)
and shares it with a QR code. Nothing here is connected to any real project.

## Extension points that already exist in the core

| Typical need | Extension point in Vistazo |
|---|---|
| The "version" is an OTA branch per PR, not a web URL | The version's `previews[]`: `{ kind: "qr" \| "deeplink" \| "download", label, url, instructions }`. The review page draws the QR. CLI: `--qr URL --qr-label …`, `--deeplink`, `--download` |
| Knowing which build/channel is needed (runtimeVersion, channel, branch, PR, commit) | The version's free-form `meta`. CLI: `--meta runtimeVersion=… --meta branch=… --meta pr=…` |
| No web target: Playwright does not apply | `vistazo publish --shots <dir>` (alias of `--assets`): a folder of screenshots/videos from any runner named `<flow>__<step>[__n].png`, or a `manifest.json` |
| Existing E2E with Appium/WebdriverIO or Maestro | Save screenshots with that naming (templates in `integrations/`) |
| Screens identified by testID / route names | Use the route name as `stepKey` and the testID in the notes: the diff and carry-over then match across versions |
| Data to test with (users, codes to scan) | Test kit: `--kit kit.json` or the HTML of a QR label page |
| Sensitive data on screen | Only capture against non-production environments with seed data; `allowHosts` in the config; `mask` in Playwright; on native, the runner must mask before uploading |
| Login for reviewers | Test kit or review notes with a test user **from the test environment** (never real credentials in Vistazo) |
| Publishing from CI, not only from the agent | Workflow template (inactive) in `integrations/github-actions/` |

## What such an app would need on its side (outside Vistazo)
1. A non-production environment selectable by channel/environment variable, with seed data and test users.
2. Hardware mocks (scanner, camera, printer) to walk through flows without a device.
3. A runner that leaves screenshots per step (Appium/WDIO, Maestro) on an emulator.
4. A CI step that, after publishing the PR's OTA update, calls `vistazo publish --shots … --qr … --meta …`.
5. (Optional) Returning Vistazo's approval state as a PR check. Not done yet in Vistazo.

## What is not covered
- Commenting live on the native app (it would need emulator streaming).
- Syncing PR state with the review (by design: the PR is only a link).
