# 全辩计时器

A browser-based timer for debate competitions. One computer hosts the app. The controller and any number of read-only displays use browsers or OBS on the same network. The host and controller can also be the same computer.

## Local development

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3210/ for control and http://localhost:3210/display for the display on the same computer.

## Run a match over LAN

1. On the host, connect to a trusted private LAN. Find its IPv4 address in the operating system's network settings and allow inbound TCP port 3210 on that network. Use Ethernet when available.
2. Build and start the host. Replace the example address with the host's actual LAN address.

   ```sh
   npm ci
   npm run build
   TIMER_LAN_HOST=192.168.1.20 npm start
   ```

   In Windows PowerShell, run `$env:TIMER_LAN_HOST = "192.168.1.20"` before `npm start`.

3. On the controller, open the LAN controller URL printed by the host. Enter the operator credential printed in the same terminal. Keep the terminal open during the match. If the host is also the controller, use the same printed LAN address. Signing in from another browser replaces the previous operator session.
4. In OBS, add a **Browser Source** with the printed display URL ending in `/display`. Set its width and height to the OBS canvas dimensions, for example 1920 × 1080. Additional displays can open the same URL without credentials.

The LAN mode uses plain HTTP. Use it on a trusted private network and keep the port off the public internet. The timer feed works over the LAN without internet. The OBS livestream uplink still requires an internet connection.

## Formats and controls

Use **设定** to import JSON or a ZIP package, edit the stage list, and apply the draft. Applying a format returns the match to the first stage with a stopped clock. Export JSON for stages or ZIP for stages and branding. The sample format is `saizhi.json`.

If migrating from the old app, export its ZIP before changing browser origins. Keep copies of original backgrounds and fonts if the old export omitted them. If you only have browser-stored stages, use the old browser's developer tools to copy the value of the `debateTimerSessions` local storage key into a JSON file and import it here.

| Shortcut | Action |
| --- | --- |
| Q / W | Start or stop the primary / secondary clock. W applies only to dual stages. |
| , / . | Previous / next stage |
| R | Reset both clocks |
| P | Emergency pause / dismiss the warning |
| 1 / 2 | Toggle a 60- or 120-second coaching break |

## Recovery

The host remains in charge when the controller or a viewer disconnects. A viewer that stops receiving updates freezes after three seconds and shows a connection warning until it can load a fresh snapshot. The controller disables match controls while disconnected.

A host restart restores the applied format, assets, and regular stage with stopped clocks. In LAN mode the host generates a new operator credential at startup. Back up the host's `.data/` folder or export a ZIP before moving the host. Set `TIMER_DATA_DIR` to store its files in a different directory.

## Verify

Run `npm test`, `npm run lint`, and `npm run build`. Before a live event, rehearse with the actual host, controller, and OBS machines. Verify the layout, a full dual-clock handoff, viewer disconnect and reconnect, and loss of internet with the LAN still connected.
