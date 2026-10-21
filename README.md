# Claudie

**Master your terminal sessions, don't just babysit and watch them run.**

**The first desktop pet that's actually useful.**

**English** · [Русский](README.ru.md)

Pixel-art Clawds on your screen, one for every running Claude Code session, showing what each one is doing: typing, running a command, searching, waiting for your permission, asking a question, done, or long asleep. Subagents join in as mini Clawds around their session's one. Claude Code can run on another machine over ssh: the Clawds still appear on the client.

<p align="center"><img src="docs/media/hero.gif" alt="Six sessions: typing, a crew of subagents, waiting for permission, asking a question, a feverish full context and plan mode"></p>

> Claudie is an unofficial fan project. It is not affiliated with or endorsed by Anthropic. Claude and Clawd belong to Anthropic.

## What it shows

| | | | | |
|:-:|:-:|:-:|:-:|:-:|
| <img src="docs/media/clip-type.gif" width="96"><br>Editing | <img src="docs/media/clip-hammer.gif" width="96"><br>Running a command | <img src="docs/media/clip-search.gif" width="96"><br>Reading, searching | <img src="docs/media/clip-globe.gif" width="96"><br>On the web | <img src="docs/media/clip-work.gif" width="96"><br>Thinking, other tools |
| <img src="docs/media/clip-alert.gif" width="96"><br>Waiting for permission | <img src="docs/media/clip-ask.gif" width="96"><br>Asking a question | <img src="docs/media/clip-fidget.gif" width="96"><br>Subagents at work | <img src="docs/media/clip-compact.gif" width="96"><br>Compacting | <img src="docs/media/clip-sick.gif" width="96"><br>Context almost full |
| <img src="docs/media/clip-celebrate.gif" width="96"><br>Done | <img src="docs/media/clip-sad.gif" width="96"><br>Failed | <img src="docs/media/clip-puzzled.gif" width="96"><br>Stopped with Esc or turned down | <img src="docs/media/clip-confetti.gif" width="96"><br>Committed or pushed | <img src="docs/media/clip-upset.gif" width="96"><br>Tests failed |
| <img src="docs/media/clip-refresh.gif" width="96"><br>Fresh after compacting | <img src="docs/media/clip-yawn.gif" width="96"><br>Idle, before a nap | <img src="docs/media/clip-sleep.gif" width="96"><br>Idle | <img src="docs/media/clip-cobweb.gif" width="96"><br>Idle for 5 min | <img src="docs/media/clip-overgrown.gif" width="96"><br>Idle for 9 min |
| <img src="docs/media/clip-snowedIn.gif" width="96"><br>Idle for 13 min | <img src="docs/media/clip-skeleton.gif" width="96"><br>Idle for 17 min | <img src="docs/media/clip-highJump.gif" width="96"><br>A dialog ignored too long | <img src="docs/media/clip-chatA.gif" width="96"><br>Idle neighbours chat | <img src="docs/media/clip-poke.gif" width="96"><br>Clicked |

That's not all: the app has more animations than these, and the [settings page](#settings) shows every one of them.

Claude Code doesn't report when you approve a permission, only when the approved tool is done. So the `!` stays up while the approved command runs: an edit clears it at once, a long build only at its end.

Subagents get a look of their own, picked from their name (explorer, reviewer, security, planner, tester, debugger, writer, designer, executor, refactorer, or a helper for anything else). In plan mode the session's own Clawd puts on the planner's hard hat. Up to six minis stand around a session's Clawd; a pixel +N over the last one counts the rest.

<p align="center"><img src="docs/media/skins.png" alt="Eleven subagent skins"></p>

Every session of the same project shares a colour, each in its own size. The images above are rendered from the same code that draws the Clawds in the app.

## Using it
- **Hover** a Clawd to see its project, what it is doing, how full its context is and its subagents.
- **Drag** the group anywhere; it walks along, bumps into the screen edges and remembers where you left it.
- **Click** to poke a Clawd. Three clicks in a row chirp.
- **Ctrl + scroll** over a Clawd to make them bigger or smaller.
- **Right-click** a Clawd to open the [settings page](#settings).
- Everything else on the screen stays clickable: only the drawn pixels catch the mouse.

## How it works
```
 Claude Code machine                          Client
┌──────────────────────────────────┐      ┌───────────────┐
│                                  │      │               │
│  Claude Code ──hooks─┐           │      │               │
│                      ▼           │      │               │
│                claudie-daemon ───┼─────►│  Claudie.app  │
│                      ▲           │      │               │
│  transcripts ────────┘           │      │               │
│                                  │      │               │
└──────────────────────────────────┘      └───────────────┘
                                   events, 127.0.0.1:47321
```
- **Hooks.** Claude Code reports every event to the daemon through its hooks.
- **The daemon** works out what every session is doing. Denied permissions and Esc leave no hook, so it also reads each session's transcript; that is also where it learns how full the context is. It checks that each session's process is still alive, and keeps the sessions across restarts.
- **The Mac app** draws what the daemon says, in a transparent window above all others.
- **The GNOME extension** does the same from inside GNOME Shell, the only place that may draw above every window under Wayland.
- **The settings page** is served by the daemon itself, so it works the same from any computer that reaches it.

| Part | Language | Where |
|---|---|---|
| Session logic, animations, layout | TypeScript | `backend/core` |
| Daemon | Go (runs the TypeScript in [goja](https://github.com/dop251/goja)) | `backend/daemon` |
| Hook | POSIX sh | `backend/plugin` |
| Mac app | Swift (runs the TypeScript in JavaScriptCore) | `frontends/macos` |
| GNOME extension | TypeScript, bundled with the core and run by GNOME Shell's JavaScript | `frontends/gnome` |
| Settings page | TypeScript, [Angular](https://angular.dev) | `frontends/web` |

The daemon, the overlays and the settings page run the same TypeScript, so the logic lives in one place and is tested once.

## Why these technologies
- **Go:** one daemon for all systems, a single static binary per platform with nothing else to install.
- **TypeScript:** one simple engine for the scene: the logic is written once and runs in Node, in the daemon, in the app and in the browser.
- **Swift:** a native frontend for macOS.
- **GNOME Shell extension:** a frontend for GNOME; under Wayland only the shell itself may draw above every window.
- **Angular:** the settings page.

## Resource use
Claudie is idle most of the time, and what it does is light.
- **Daemon.** One static Go binary with nothing else to install. With two sessions open (one working, one idle) it held about 24 MB of memory and used about 1 s of CPU in 15 minutes, around 0.1% of one core. It wakes for hook events, reads the new lines of each session's transcript every 0.4 s, checks every 5 s that the sessions' processes are alive, and saves the sessions to disk within a second of a change. With no sessions both timers stop: it used no measurable CPU in a minute and woke about once a second, until the next hook.
- **Overlay.** At rest the scene ticks 20 times a second; it follows the display's refresh rate only while something moves. To know when the pointer is over a Clawd, the Mac app listens to mouse moves and the GNOME extension reads the pointer on each tick. A tick that changes nothing redraws nothing, and with no Clawds on screen the timer stops until the daemon sends something new.
- **Claude Code.** Hooks are small HTTP posts to `127.0.0.1`; the SessionStart script runs `curl` once per session.
- **Network.** Everything stays on `127.0.0.1`; the only download is the daemon, once, from this repository's releases.

## Install and run
**You need:** Claude Code on macOS or Linux; the overlay runs on macOS 14 or later, or on GNOME Shell 50.

1. **Install the plugin** in Claude Code:
   ```
   /plugin marketplace add farnsworth3010/claudie
   /plugin install claudie@claudie
   ```
   That is the whole setup on the Claude Code side. The first session started after it downloads the daemon for your platform from this repository's releases, checks its checksum, and starts it in the background; later sessions find it running.
2. **On a Mac, install the app**: download `Claudie-macos.zip` from the [latest release](https://github.com/farnsworth3010/claudie/releases/latest), unzip it, move `Claudie.app` to Applications and open it. The app is not notarized, so macOS blocks the first start: open System Settings, go to Privacy & Security, scroll down to the message about Claudie and click Open Anyway. Or clear the mark from a terminal with `xattr -d com.apple.quarantine /Applications/Claudie.app`.

   **To build it from source** instead you need the Xcode Command Line Tools (`xcode-select --install`), and [Node.js](https://nodejs.org) 25 with [pnpm](https://pnpm.io) to build the scene it runs:
   ```sh
   git clone https://github.com/farnsworth3010/claudie.git && cd claudie
   pnpm install && pnpm build
   cd frontends/macos && swift run
   ```
3. **On GNOME, install the extension**: download `Claudie-gnome.zip` from the [latest release](https://github.com/farnsworth3010/claudie/releases/latest) and run
   ```sh
   gnome-extensions install --force Claudie-gnome.zip
   ```
   Log out and back in (on Wayland, GNOME loads a new extension only at login), then turn it on with `gnome-extensions enable claudie@farnsworth3010.github.io` or in the Extensions app. From then on it starts by itself at every login. It needs GNOME Shell 50.

   **To build it from source** you need [Node.js](https://nodejs.org) 25 with [pnpm](https://pnpm.io); `pnpm install && tools/build-gnome-extension.sh` in the clone writes `frontends/gnome/dist/Claudie-gnome.zip`, which installs the same way.

If Claude Code runs on another machine, the overlay still talks to `127.0.0.1:47321` on its own computer: forward that port to the machine with the daemon, for example `ssh -L 47321:127.0.0.1:47321 <host>`.

The daemon logs to `~/.local/state/claudie/daemon.log`. To run it from source instead, build it with `(cd backend/daemon && go build -o bin/claudie-daemon ./src)` (needs [Go](https://go.dev) 1.27 and `pnpm build` first) and start `backend/daemon/bin/claudie-daemon` before your sessions.

**Updating:** `claude plugin update claudie@claudie`, or `/plugin` in a session. The next session starts the new daemon in place of the old one by itself.

### Installing without a release
If the release with the daemon is not available, build the daemon from source on the machine where Claude Code runs. You need Git, [Node.js](https://nodejs.org) 25, [pnpm](https://pnpm.io) and [Go](https://go.dev) 1.27.

1. **Build the daemon:**
   ```sh
   git clone https://github.com/farnsworth3010/claudie.git && cd claudie
   pnpm install && pnpm build
   (cd backend/daemon && go build -o bin/claudie-daemon ./src)
   ```
2. **Tell Claude Code where the daemon is**, for example in your shell profile (`~/.zshrc`, `~/.bashrc`):
   ```sh
   export CLAUDIE_DAEMON="$HOME/claudie/backend/daemon/bin/claudie-daemon"
   ```
   The plugin's hook then starts this binary at the start of every session and downloads nothing. Without the variable, start the daemon by hand with `backend/daemon/bin/claudie-daemon start`, and again after every reboot.
3. **Install the plugin** in Claude Code as usual:
   ```
   /plugin marketplace add farnsworth3010/claudie
   /plugin install claudie@claudie
   ```
4. **Install the overlay** on the client (step 2 or 3 above).

**Updating:** `git pull`, build again (`pnpm build` and `go build`), then stop the daemon with `curl -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:47321/quit`: a daemon built from source is never replaced by itself. The next session starts the new one.

### Demo
`tools/demo.sh` shows the mascots without real sessions: it sends made-up sessions in every state to the daemon (a typist, a crew of subagents, a permission and a question waiting, a fever from a full context, plan mode, a commit) and keeps them busy until you press Ctrl+C, which removes them. It only needs a daemon answering at `127.0.0.1:47321`, and the Clawds show on the [settings page](#settings) in a browser (the live preview) or, on a Mac, in the app.

**With the plugin installed** the daemon is already running; from a clone of the repository, run the script and open [http://127.0.0.1:47321/](http://127.0.0.1:47321/):
```sh
./tools/demo.sh
```
**Without the plugin**, build and start the daemon from the clone first, with [Go](https://go.dev) 1.27 and Node.js:
```sh
pnpm install && pnpm build
(cd backend/daemon && go build -o bin/claudie-daemon ./src)
backend/daemon/bin/claudie-daemon start   # the daemon, in the background
./tools/demo.sh
```
**To see the Clawds over the windows**, start the app on the Mac before the script ([installed](#install-and-run), or built from the clone as below), and run the script in a second terminal:
```sh
(cd frontends/macos && swift run)         # the app; leave it running
```
Afterwards stop the daemon you started with `curl -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:47321/quit`.

The [settings page](#settings) has a simulator too: buttons that start made-up sessions and walk them through every state one step at a time.

### Settings
**Right-click a Clawd**, or open [http://127.0.0.1:47321/](http://127.0.0.1:47321/) in a browser, for the settings page that the daemon serves. On it:
- the settings, applied to every overlay at once;
- a live preview of your sessions, drawn by the same code as the app, which you can hover, drag, poke and resize;
- a simulator of made-up sessions, which show on the Mac too and end when you close the page;
- a gallery of every animation, subagent skin, stage of sickness, colour and size.

The daemon keeps the settings in `~/.config/claudie/settings.json` and sends them to the app:

| Setting | Default | What it does |
|---|---|---|
| `size` | 4 | Screen points per pixel of art, 2 to 12 (Ctrl + scroll changes it) |
| `miniSize` | 0.5 | Subagents' minis as a share of their session's Clawd, 0.3 to 1; they scale with it |
| `opacity` | 1 | 0.2 to 1 |
| `pace` | 1 | How fast the animations play, 0.5 to 1.5 |
| `overFullscreen` | false | Stay visible over full-screen apps |
| `clickThrough` | false | Clicks go past the Clawds to what is under them; hold ⌥ Option on a Mac, Alt on GNOME, to drag, poke or right-click them |
| `overDock` | true | The Clawds may stand on the Dock; off, they keep out of its area (on GNOME: out of any dock or panel the work area leaves out) |
| `overMenuBar` | false | The Clawds may climb onto the menu bar (the top bar on GNOME) |
| `gaze` | true | Eyes follow the pointer |
| `antics` | true | Clowning around when a dialog waits too long |
| `neglect` | true | Cobwebs, a flower, snow and bones when idle for long |
| `stroll` | false | Idle, paces slowly about instead of sleeping, gathering cobwebs and turning to bones |
| `anywhere` | false | With `wander` and without gravity, walks all over the screen, upright, instead of crawling round its edges |
| `sleepAfter` | 45 | Seconds idle before it yawns and falls asleep, 10 to 600 |
| `neglectAfter` | 300 | Seconds idle before the cobwebs, 60 to 3600; the flower, snow and bones follow in proportion |
| `patience` | 30 | Seconds a dialog waits before the antics, 5 to 300 |
| `inertia` | false | A thrown group keeps flying, slows down and bounces off the screen's edges |
| `gravity` | false | A group let go of falls to the bottom of its screen and stands there |
| `wander` | false | Walks about on its own and crawls along the screen's edges, turned to stand on them; with gravity, along the bottom only. It stays put while a session waits for you. Without gravity, dragged up to an edge it clings to it, turned, and crawls on from where you let go |
| `limits` | false | Clocks of the 5-hour and weekly usage limits; they need the status line set up, see [Usage limits](#usage-limits) |
| `clockInertia` | false | Thrown clocks keep flying, slow down and bounce off the screen's edges |
| `clockGravity` | false | Clocks let go of fall to the bottom of their screen |

### Usage limits
With `limits` on, two pixel clocks show up: `5h` for the 5-hour limit, `wk` for the weekly one. They stand apart from the Clawds, in the bottom-right corner at first: drag them where you like and they stay there, never walking or clinging to an edge; with `clockInertia` and `clockGravity` they can be thrown and fall, like the group with `inertia` and `gravity`. The Clawds and the clocks never overlap: the group steps aside for the clocks, and clocks dragged onto the group make way. How full a dial is shows how much of the limit is used: green, yellow from 50%, red from 80%. Hover a clock for the share used and when it resets. Only Pro and Max plans have these limits.

Claude Code hands the limits only to the [status line](https://code.claude.com/docs/en/statusline) command, so Claudie needs to sit in it. Run this once in Claude Code:
```
/claudie:limits
```
It puts Claudie's wrapper in `statusLine` in `~/.claude/settings.json`, showing you the change first. The wrapper passes the limits to the daemon and then runs the status line you had before, so that one looks and works as it did; the old command is kept in `~/.claude/plugins/data/claudie-claudie/statusline-inner`. If something replaces the wrapper later, a new session tells you, and `/claudie:limits` sets it up again. `/claudie:limits off` puts your old status line back.

By hand: write your status line command to `statusline-inner` and set the command in `settings.json` to:
```json
"statusLine": { "type": "command", "command": "sh ~/.claude/plugins/data/claudie-claudie/claudie-statusline.sh" }
```

## Uninstall
1. **If you set up the [limit clocks](#usage-limits)**, run `/claudie:limits off` first: removing the plugin deletes the wrapper, which would leave the status line empty.
2. **Remove the plugin** in Claude Code; this also deletes the daemon binary it downloaded:
   ```
   /plugin uninstall claudie@claudie
   /plugin marketplace remove claudie
   ```
3. **Stop the daemon:**
   ```sh
   curl -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:47321/quit
   ```
4. **Delete its files** (sessions, log, settings, the GNOME extension's saved position and sound):
   ```sh
   rm -rf ~/.local/state/claudie ~/.config/claudie ~/.cache/claudie
   ```
5. **On the Mac**, quit the app, forget its saved position with `defaults delete Claudie`, and delete `Claudie.app` (or the clone, if you built it from source).
6. **On GNOME**, remove the extension with `gnome-extensions uninstall claudie@farnsworth3010.github.io`.

## Plans
- **Notice a stop before the first word.** Esc or Ctrl+C while Claude is still thinking, before it has written anything, leaves no trace: Claude Code sends no hook and writes nothing to the transcript, so the Clawd keeps thinking until the next prompt (or Claude Code's idle notification about a minute later). A stop after the reply has begun is caught already. This waits for Claude Code to report interruptions.

## Development
`pnpm check` runs everything: Biome lint and format, TypeScript typecheck, the TypeScript tests, the build, then `gofmt`, `go vet`, the Go tests and `govulncheck`. Commit messages follow Conventional Commits, checked by commitlint. See [CLAUDE.md](CLAUDE.md) for the layout and the rules the code follows.

### Releasing
A release is a tag `vX.Y.Z` that matches `version` in `backend/plugin/.claude-plugin/plugin.json`: the plugin's hook downloads the daemon from the release of that tag, and CI refuses a tag that differs.

1. **Bump the version** in `backend/plugin/.claude-plugin/plugin.json` (for example `0.1.0` to `0.1.1`) and commit it (`chore: release 0.1.1`).
2. **Merge into `main`**: users install the plugin from the default branch.
3. **Tag and push:**
   ```sh
   git tag v0.1.1 && git push origin v0.1.1
   ```
   CI runs `pnpm check`, builds the daemon for every platform with `SHA256SUMS`, builds the GNOME extension and the Mac app, and publishes a release with all of them.
4. **Check the release:** it must hold `claudie-daemon-<os>-<arch>` for `linux` and `darwin` on `amd64` and `arm64`, `SHA256SUMS`, `Claudie-gnome.zip` and `Claudie-macos.zip`. The file names are fixed: the hook and the install instructions rely on them.

**If CI is not available**, do the same by hand: build the daemons with `tools/build-daemons.sh` and the GNOME extension with `tools/build-gnome-extension.sh`, build the app on a Mac with `pnpm build && tools/build-macos-app.sh`, then create the release for the tag on GitHub and attach `backend/daemon/bin/release/*`, `frontends/gnome/dist/Claudie-gnome.zip` and `frontends/macos/.build/app/Claudie-macos.zip`.

## How AI is used here
Claudie is built together with Claude Code, Anthropic's coding agent, and the way of working is written down in [CLAUDE.md](CLAUDE.md), which the agent reads at the start of every session.
- **The maintainer decides; the agent writes and explains.** Architecture, languages, the state model and every trade-off are the maintainer's calls. The agent writes most of the code in small steps, explains each file and decision, and waits for approval before the next one.
- **Facts come from experiments, not guesses.** How Claude Code really reports permissions, Esc, subagents and compaction was established by driving real sessions and recording their events; the state logic is tested against those recordings.
- **Parallel agents, separate review.** Independent parts (animations, the Go daemon, the Swift app) are often written by parallel subagents against agreed interfaces, and a separate reviewer agent hunts for bugs before anything is called done.
- **Humans close the loop.** The agent works on Linux, so the maintainer builds and runs the Swift app on a Mac and reports back; every commit is made by the maintainer.

## License
[MIT](LICENSE). The license covers the code only: Claude and Clawd, the mascot the sprites show, belong to Anthropic.
