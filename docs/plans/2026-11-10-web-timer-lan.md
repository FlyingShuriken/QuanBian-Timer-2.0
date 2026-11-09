# Web Timer and LAN Display Implementation Plan

> Execution skill for the implementation turn — `executing-plans`. Complete and verify each phase before moving on.

**Goal** — Replace the Electron and Vite app with a Next.js web app, fix the audited match-day failures, and let a browser controller and multiple displays, including OBS, connect to a timer server on the venue LAN.

**Architecture** — One Node process on any LAN computer serves the Next.js controller and display pages, owns the match clock, and publishes read-only snapshots over WebSocket. The controller sends authenticated HTTP commands to the host. Each display connects independently and renders the same shared presentation, whether in a browser or OBS.

**Stack** — Next.js App Router, React, JavaScript, Tailwind, Node HTTP, `ws`, JSZip, and Node's built-in test runner. Use a supported Node LTS version compatible with the locked Next.js release.

## Scope and operating assumptions

- One active match and one designated operator, with multiple simultaneous read-only displays. The host, controller, and display are roles. A single computer can fill several roles, or C can host, A can control, and B and other machines can display. The host continues timing when any client disconnects. The OBS uplink is separate from the LAN connection.
- Preserve the Chinese operator UI, covers, stage order, team labels and colors, keyboard controls, coaching breaks, and existing supported JSON and ZIP formats. Retain the current pause warning and manual timing workflow.
- Only the host runs Node. The controller opens `http://<HOST-LAN-IP>:3210/` and viewers open `http://<HOST-LAN-IP>:3210/display`. A browser on the host can use `localhost`. Any display can use the URL directly in OBS Browser Source.
- Hosted access-code pairing, accounts, multiple matches, and automatic LAN discovery are future work. The LAN operator credential authorizes control of the local server. Keep the state snapshot independent of connection setup so a hosted relay can reuse it.

## Phase 1 — Replace the desktop shell

### 1. Capture the baseline and migration inputs

**Inspect** `package.json`, `README.md`, `saizhi.json`, `src/App.jsx`, `src/components/rules/Modal.jsx`, and `src/assets/`.

- Record the browser build, existing keyboard behavior, and screenshots of the cover, single clock, dual clocks, and pause overlay.
- Prepare test fixtures for the sample match, a branded ZIP, an invalid archive, and a shorter replacement format. Check that the actual background image bytes are available. The current checkout contains LFS pointers, so retrieve the originals or record the missing-asset blocker before claiming visual parity.
- Give existing users an export path before switching browser origins. Prefer ZIP for appearance and JSON for stages. Test with a legacy export. Document how to recover stages or copy original image and font files if an old export omitted them. A fresh Next.js origin cannot read another origin's local storage automatically.

**Gate** — A known match and branding package can be restored from test fixtures. Record missing legacy assets explicitly.

### 2. Port the browser app and remove Electron

**Create** `src/app/layout.jsx`, `src/app/page.jsx`, `next.config.mjs`, and `server.mjs`. **Modify** `package.json`, `package-lock.json`, `.gitignore`, Tailwind/PostCSS and lint config, `src/App.jsx`, `src/components/rules/Modal.jsx`, and `README.md`.

- Mount the current React UI from an App Router client boundary. Hydrate browser state after mount and guard against saving defaults before existing data is loaded. Keep CSS and visual layout. Serve real default backgrounds and fonts locally for offline display.
- Replace Electron dialogs with browser file inputs. Remove `window.electronAPI`, Electron dependencies and scripts, `main.js`, `preload.js`, `fileStorage.js`, `build.js`, and the tracked `application/` release tree. Remove Vite's entry/config and tracked `dist/`. Leave historical releases recoverable in Git history and remove active build references.
- Wire `npm run dev`, `npm run build`, `npm start`, and lint. Use a small custom Node entry point in both dev and production, bound to loopback at this stage. Delegate page and static requests to Next.js. [Next.js custom server guide](https://nextjs.org/docs/app/guides/custom-server)

**Gate** — `npm ci` and `npm run build` succeed. Browser smoke checks cover the existing UI. The tracked runtime and lockfile contain no Electron tooling.

## Phase 2 — Fix the audited critical bugs one at a time

For each task, add a regression check, confirm it reproduces the failure, make the smallest fix, then rerun the focused check and the build. Keep separate reviewable changes.

| Task | Files | Fix and regression check |
|---|---|---|
| 3. Keyboard ownership | `src/App.jsx`, `src/components/Screen.jsx`, `src/hooks/utils/useKeyboardShortcut.jsx` | One handler owns previous and next. Ignore editing targets, open setup dialogs, and key repeats. Verify one press moves one stage and typing in setup leaves the match alone. Gate the secondary toggle to dual stages. Verify the emergency pause cannot leave a hidden clock running. |
| 4. Countdown and handoff | Create `src/timer/engine.mjs` and `tests/timer-engine.test.mjs`. Update `src/hooks/useTimers.jsx` and `src/hooks/states/useTimerState.jsx`. | Use one elapsed-time clock and a test-controlled monotonic time source. Store remaining time on pause and resume on the first press. Display whole seconds rounded up and hand off only at true expiry. Start the other eligible side explicitly and stop when both are exhausted. Verify delayed ticks, repeated pause/resume, reset, and both handoff directions. Remove the old parallel timing loop after callers move. |
| 5. Match recovery | `src/App.jsx`, `src/components/rules/jsonUtils.jsx`, `src/components/rules/Modal.jsx`, `tests/match-format.test.mjs` | Normalize supported legacy records into one validated shape. Require a non-empty list, valid names, booleans, and finite supported durations. Accept a zero-duration cover. Validate before replacing the active match, reset the index on replacement, and recover from malformed saved data. Keep coaching mode separate from the saved match. Verify empty and invalid imports, shorter replacement, and restart during coaching. |
| 6. Apply formats and persist artwork | `src/components/rules/Modal.jsx`, `src/components/rules/AddRecord/AddModal.jsx`, `src/components/modals/ColorModal.jsx`, `src/timer/config.mjs`, `server/storage.mjs`, `tests/match-format.test.mjs` | Wire JSON import, an explicit Apply action, and visible errors. Keep the draft separate until Apply. Validate ZIP contents and bound archive size and expansion before committing anything. Preserve asset bytes and format metadata for restart and re-export. Store assets once on the host with generated IDs and a fixed storage root. Use validated file types and sizes, then atomically commit the format and appearance after all assets are ready. Verify import → apply → reload → export and re-import, including images and fonts. |

The missing preload bridge and duplicate IPC registration leave the runtime in Phase 1. The upload escape remains a regression case for the replacement web asset handler.

**Gate** — `npm test`, `npm run lint`, and `npm run build` pass. The operator can run a complete single- and dual-clock match in the browser and recover a valid configuration after invalid input.

## Phase 3 — Add LAN transmission

### 7. Move match authority to the LAN host

**Create** `server/match.mjs`, `server/operator-auth.mjs`, and `tests/lan-server.test.mjs`. **Modify** `server.mjs`, `server/storage.mjs`, `package.json`, `src/App.jsx`, and `src/components/rules/Modal.jsx`.

- Extend the existing Node entry point with match command handling. Keep Next.js responsible for page and static requests.
- Reuse the tested engine on the server. The operator sends typed, validated commands such as start, pause, reset, and next. Serialize state transitions and enforce one running side. Save the format, appearance, and regular stage cursor to an ignored data directory. Restore a valid stage stopped after a server restart and keep the normal match when coaching was active. Refreshing the operator browser during a match must leave the running clock intact.
- When LAN mode is enabled, generate a random operator credential at host startup and show it locally on the host. Exchange it through a same-origin login for an HttpOnly, SameSite session cookie. Require the session and a matching configured Host and Origin on all mutations, including uploads and imports. Rate-limit failed logins. Keep the credential out of URLs and display snapshots. A viewer can open the display and its assets without logging in. Keep loopback binding by default and enable LAN binding explicitly on a trusted private network. Plain HTTP is for that network only because it does not encrypt the credential or session.

**Gate** — Integration tests cover authenticated commands from another computer, operator refresh, server restart, rejected unauthenticated and cross-origin writes, and traversal attempts against the asset endpoint. Invalid input leaves the last saved configuration usable.

### 8. Stream read-only state and render it in OBS

**Create** `src/app/display/page.jsx`, `src/components/TimerDisplay.jsx`, and `src/hooks/useMatchFeed.jsx`. **Modify** `src/components/Screen.jsx`, `src/components/Timer.jsx`, `server.mjs`, and `tests/lan-server.test.mjs`.

- Extract the shared display from `Screen.jsx`. The viewer shows the stage, clocks, cover, theme, and pause state without controls. Serve all presentation assets from the host. Show host connection status and a copyable display URL in the controller. Disable controls when disconnected. If a request is interrupted, refresh authoritative state before accepting another action and avoid replaying commands automatically.
- Upgrade `/ws/display` as a read-only socket. Send the complete snapshot immediately, on accepted changes and expiry, and in a periodic heartbeat. Include a server instance ID, sequence, stage and clock states, timing reference, and asset URLs. Ignore messages from old connections and use the fresh snapshot after reconnect. Leave operator commands on the HTTP path.
- Estimate the server's time using a round-trip sample, then render remaining time from the last authoritative snapshot and elapsed local monotonic time. A viewer never advances a stage or starts the other clock independently. Start with a one-second heartbeat and three-second stale threshold. During a short gap B can count down to zero. After the threshold, freeze with a clear disconnected indicator until a fresh snapshot arrives.

**Gate** — Tests verify that multiple viewers get the same authoritative state, viewer messages cannot mutate the match, and one viewer can disconnect and recover without interrupting the others or the controller. Verify stale and restarted-server behavior.

### 9. Run the LAN acceptance check

**Update** `README.md` with `npm ci`, `npm run build`, `npm start`, the LAN bind option, how to find the host address and operator credential, firewall setup, Browser Source URL and dimensions, and recovery instructions. Document both combined and dedicated host setups. [OBS Browser Source guide](https://obsproject.com/kb/Browser-Source)

1. Run the production build on C. Open the controller on A and authenticate. Add an OBS Browser Source on B and open the display in at least one additional browser, all using C's LAN address. Confirm the cover, fonts, colors, single and dual stages, and pause overlay match.
2. Run start, pause, resume, reset, stage changes, coaching, and automatic handoff. Compare all displays and record observed latency during the rehearsal. Repeat with the host and controller on the same computer.
3. Drop internet while preserving the LAN. Verify timer control and the OBS preview continue. Then drop one viewer's LAN connection, change stages from the controller, and verify that the other viewers stay live and the disconnected viewer recovers to the latest snapshot.
4. Reload OBS and disconnect the controller during a running stage. Verify that connected viewers keep receiving host updates and that the controller reconnects to the current state. Restart the host separately and verify recovery to the saved match with a stopped clock.
5. Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`. Record any acceptance checks that require venue access.

## Rollout boundary

Keep one web runtime and one clock authority. Revisit hosted infrastructure when cross-network use is requested. The future access code should pair a viewer to a match session while preserving the same read-only state contract and keeping operator authority separate.
