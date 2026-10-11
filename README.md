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
- **The settings page** is served by the daemon itself, so it works the same from any computer that reaches it.

| Part | Language | Where |
|---|---|---|
| Session logic, animations, layout | TypeScript | `backend/core` |
| Daemon | Go (runs the TypeScript in [goja](https://github.com/dop251/goja)) | `backend/daemon` |
| Hook | POSIX sh | `backend/plugin` |
| Mac app | Swift (runs the TypeScript in JavaScriptCore) | `frontends/macos` |
| Settings page | TypeScript, [Angular](https://angular.dev) | `frontends/web` |

The daemon, the app and the settings page run the same TypeScript, so the logic lives in one place and is tested once.

## Why these technologies
- **Go:** one daemon for all systems, a single static binary per platform with nothing else to install.
- **TypeScript:** one simple engine for the scene: the logic is written once and runs in Node, in the daemon, in the app and in the browser.
- **Swift:** a native frontend for macOS.
- **Angular:** the settings page.

## Resource use
Claudie is idle most of the time, and what it does is light.
- **Daemon.** One static Go binary with nothing else to install. With two sessions open (one working, one idle) it held about 24 MB of memory and used about 1 s of CPU in 15 minutes, around 0.1% of one core. It wakes for hook events, reads the new lines of each session's transcript every 0.4 s, checks every 5 s that the sessions' processes are alive, and saves the sessions to disk within a second of a change.
- **App.** At rest the scene ticks 20 times a second; it follows the display's refresh rate only while something moves. It also listens to mouse moves to know when the pointer is over a Clawd.
- **Claude Code.** Hooks are small HTTP posts to `127.0.0.1`; the SessionStart script runs `curl` once per session.
- **Network.** Everything stays on `127.0.0.1`; the only download is the daemon, once, from this repository's releases.

## Install and run
**You need:** Claude Code on macOS or Linux; the app currently needs macOS 14 or later.

1. **Install the plugin** in Claude Code:
   ```
   /plugin marketplace add farnsworth3010/claudie
   /plugin install claudie@claudie
   ```
   That is the whole setup on the Claude Code side. The first session started after it downloads the daemon for your platform from this repository's releases, checks its checksum, and starts it in the background; later sessions find it running.
2. **Install the app** on the client: download `Claudie-macos.zip` from the [latest release](https://github.com/farnsworth3010/claudie/releases/latest), unzip it, move `Claudie.app` to Applications and open it. The app is not notarized, so macOS blocks the first start; clear the mark once with `xattr -d com.apple.quarantine /Applications/Claudie.app`.

   **To build it from source** instead you need the Xcode Command Line Tools (`xcode-select --install`), and [Node.js](https://nodejs.org) 25 with [pnpm](https://pnpm.io) to build the scene it runs:
   ```sh
   git clone https://github.com/farnsworth3010/claudie.git && cd claudie
   pnpm install && pnpm build
   cd frontends/macos && swift run
   ```
   If Claude Code runs on another machine, the app still talks to `127.0.0.1:47321` on the Mac: forward that port to the machine with the daemon, for example `ssh -L 47321:127.0.0.1:47321 <host>`.

The daemon logs to `~/.local/state/claudie/daemon.log`. To run it from source instead, build it with `(cd backend/daemon && go build -o bin/claudie-daemon ./src)` (needs [Go](https://go.dev) 1.27 and `pnpm build` first) and start `backend/daemon/bin/claudie-daemon` before your sessions.

**Updating:** `claude plugin update claudie@claudie`, or `/plugin` in a session. The next session starts the new daemon in place of the old one by itself.

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
| `clickThrough` | false | Clicks go past the Clawds to what is under them; hold ⌥ Option to drag, poke or right-click them (macOS) |
| `overDock` | true | The Clawds may stand on the Dock; off, they keep out of its area (macOS) |
| `overMenuBar` | false | The Clawds may climb onto the menu bar (macOS) |
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

## Uninstall
1. **Remove the plugin** in Claude Code; this also deletes the daemon binary it downloaded:
   ```
   /plugin uninstall claudie@claudie
   /plugin marketplace remove claudie
   ```
2. **Stop the daemon:**
   ```sh
   curl -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:47321/quit
   ```
3. **Delete its files** (sessions, log, settings):
   ```sh
   rm -rf ~/.local/state/claudie ~/.config/claudie
   ```
4. **On the Mac**, quit the app, forget its saved position with `defaults delete Claudie`, and delete `Claudie.app` (or the clone, if you built it from source).

## Plans
- **Notice a stop before the first word.** Esc or Ctrl+C while Claude is still thinking, before it has written anything, leaves no trace: Claude Code sends no hook and writes nothing to the transcript, so the Clawd keeps thinking until the next prompt (or Claude Code's idle notification about a minute later). A stop after the reply has begun is caught already. This waits for Claude Code to report interruptions.

## Development
`pnpm check` runs everything: Biome lint and format, TypeScript typecheck, the TypeScript tests, the build, then `gofmt`, `go vet`, the Go tests and `govulncheck`. Commit messages follow Conventional Commits, checked by commitlint. A release is a tag `vX.Y.Z` matching `version` in `backend/plugin/.claude-plugin/plugin.json`: CI builds the daemon for every platform and publishes it. See [CLAUDE.md](CLAUDE.md) for the layout and the rules the code follows.

## How AI is used here
Claudie is built together with Claude Code, Anthropic's coding agent, and the way of working is written down in [CLAUDE.md](CLAUDE.md), which the agent reads at the start of every session.
- **The maintainer decides; the agent writes and explains.** Architecture, languages, the state model and every trade-off are the maintainer's calls. The agent writes most of the code in small steps, explains each file and decision, and waits for approval before the next one.
- **Facts come from experiments, not guesses.** How Claude Code really reports permissions, Esc, subagents and compaction was established by driving real sessions and recording their events; the state logic is tested against those recordings.
- **Parallel agents, separate review.** Independent parts (animations, the Go daemon, the Swift app) are often written by parallel subagents against agreed interfaces, and a separate reviewer agent hunts for bugs before anything is called done.
- **Humans close the loop.** The agent works on Linux, so the maintainer builds and runs the Swift app on a Mac and reports back; every commit is made by the maintainer.

## License
[MIT](LICENSE). The license covers the code only: Claude and Clawd, the mascot the sprites show, belong to Anthropic.
