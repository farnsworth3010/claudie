# Claudie

Pixel-art Clawd mascots over every window, one per running Claude Code session, showing what each session is doing: working (and with which tool), waiting for permission, asking a question, done, idle. Claudie is cross-platform by design: the daemon, the core and the plugin run wherever Claude Code does, and the overlay is a thin client per OS (macOS and GNOME so far).

The maintainer wants to understand and control every part of it, so the way of working below matters as much as the code.

## How we work
- Small steps, one module or idea at a time. Before writing, explain what and why; after writing, explain each file and each decision. Wait for the maintainer's approval before the next step.
- Deliver exactly what was asked. Propose anything else in one sentence and wait.
- Never commit, push or touch git history: the maintainer commits. Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), checked by commitlint; never add AI attribution.
- Comments: short, one line where possible, only the non-obvious *why*; never narrate edit history.
- If you cannot build or run a client where you are (the Swift app needs a Mac), say so: the maintainer builds it and reports errors. Keep client changes small and explained. The GNOME extension can be tried in a nested shell (`dbus-run-session gnome-shell --devkit --wayland`).

## Architecture
```
machine (where Claude Code runs)                                  client
Claude Code ─http hooks─────────────────────► daemon ─SSE /events─► overlay app
            ─SessionStart: claudie-session-start.sh (curl + pid) ─┘   127.0.0.1:47321
```
- Claude Code posts every event to the daemon with `http` hooks; only SessionStart, which can't be an http hook, goes through a script, which also tells the daemon the session's pid. The script downloads the daemon for its platform from the plugin version's GitHub release once (checked against SHA256SUMS, kept in `${CLAUDE_PLUGIN_DATA}`) and runs `claudie-daemon start`, which starts it detached when nothing answers and replaces a running release of another version (`GET /version`, `POST /quit`); so installing or updating the plugin is the whole server setup. The daemon drops an event that arrives twice within 2 s, which is what doubled hooks send.
- The usage limits come only to the status line command: `/claudie:limits` (`backend/plugin/commands/limits.md`) puts `claudie-statusline.sh` there, which posts its input to `POST /statusline` and runs the user's previous status line, kept in `statusline-inner` in the plugin's data directory. The limits live in the daemon's memory and go out with every snapshot.
- Denied permissions and Esc send no hook at all; the daemon learns them, and how full the context is, by tailing the session's transcript.
- The daemon holds the only truth about sessions and streams full snapshots `{now, sessions, settings}`. It checks every few seconds that each session's process still runs, keeps the sessions in `$XDG_STATE_HOME/claudie/sessions.json` across restarts and the overlay settings in `$XDG_CONFIG_HOME/claudie/settings.json`.
- Each overlay runs the scene (`backend/core/src/scene`) in its platform's JavaScript engine: the macOS app (`frontends/macos`) in JavaScriptCore through `scene.js`, the GNOME Shell extension (`frontends/gnome`) in GJS, which imports `Stage` from core directly. It feeds the scene snapshots, screens and the mouse, and draws the sprites it hands back. A right click on a Clawd opens the settings page.
- The daemon serves the settings page at `/` (Angular, embedded in its binary): the settings, a live preview running the same scene on a canvas, a simulator that posts made-up hooks, and a gallery of every animation.

| Language | Where | Role |
|---|---|---|
| POSIX sh | `backend/plugin/` | The SessionStart hook: send the event with `curl` and the pid. No `jq`, no GNU-only flags, no `/proc`. |
| Go | `backend/daemon/` | A thin shell: HTTP, SSE, timers, files, process checks. Standard library plus goja; no domain logic. Ships as one static binary per platform. |
| TypeScript | `backend/core/` | All the logic: the session reducer, the director, sprites, layout. Runs in Node for tests, in goja inside the daemon, in the clients' engines (JavaScriptCore in the macOS app, GJS in the GNOME extension). |
| Swift | `frontends/macos/` | The macOS client: windows above everything, click-through, drawing with Core Animation, the mouse, the SSE client. |
| TypeScript (GJS) | `frontends/gnome/` | The GNOME client, a GNOME Shell extension: actors in the top chrome, reactive only over a Clawd, the mouse, the SSE client (Soup). Under Wayland only the shell may draw above every window. |
| TypeScript, Angular | `frontends/web/` | The settings page: forms, the preview and gallery canvases, the simulator. All drawing and logic come from `backend/core`. |

Parts talk JSON: hook → daemon (the Claude Code event), daemon → app (snapshots), Go ↔ TS and Swift ↔ TS (JSON strings across the bridge).

## Rules for `backend/core/`
- `backend/core/src` must run in goja, JavaScriptCore and GJS: no `node:*` imports and no Node, DOM or browser globals. Only tests may use Node APIs.
- Node runs `.ts` by stripping types, so only erasable syntax (no `enum`, `namespace`, parameter properties), `import type` for type-only imports, and `.ts` extensions in relative imports. `tsconfig.json` enforces this.
- Logic is pure functions where possible, tested with `node:test` against recorded events.

## Layout
Source code lives in each part's `src/`.
- `backend/core/`: TypeScript package. `src/` by area: `session/` (the state of a session: reducer, transcript, aging, the session list), `settings/`, `limits/` (the usage limits read from the status line input), `rest/` (the time at the screen and when a break is due, fed the idle time by the overlays), `scene/` (everything drawn: art, clips, drawing, the director, the stage), `shared/` (small helpers), and `entries/`, the two bundle entry points. In each area, types, constants and helpers live in their own files (`types.ts`, `constants.ts` or `constants/`). Tests are in `test/`, mirroring `src/`. `pnpm build` bundles `src/entries/daemon.ts` into `backend/daemon/internal/core/core.js` and `src/entries/app.ts` into `frontends/macos/src/Resources/scene.js` (both gitignored).
- `backend/daemon/`: Go module `claudie/daemon`. `src/main.go` is a thin `package main` that wires the packages in `internal/` (`config`, `core` the goja bridge, `server` HTTP and SSE, `web` the embedded settings page, `hub` snapshot fan-out, `watch` timers and the transcript tailer, `store` files, `proc` process checks, `eventlog`); an interface lives in the package that uses it. All tests are in `test/`, one folder per package, as black-box tests of its exported API, so there are no `_test.go` files next to the code. `bin/` holds built binaries (gitignored).
- `backend/plugin/`: the Claude Code plugin: `.claude-plugin/plugin.json` (its `version` and `repository` are what the hook downloads), `hooks/hooks.json`, `bin/claudie-session-start.sh`, `bin/claudie-statusline.sh` (the status line wrapper, copied into the data directory by the SessionStart hook), `commands/limits.md`. `.claude-plugin/marketplace.json` at the repository root lists it.
- `frontends/web/`: Angular 22 app (standalone components, signals, no zone.js), package `@claudie/web`. `src/app/` by feature: `daemon/` (the service that follows `/events` and posts settings and hooks), `preview/`, `settings/`, `simulator/`, `gallery/`, `shared/` (the frame loop, canvas painting); constants and types in their own files as in core. It imports core as `@claudie/core/<path>.ts` (core's `exports`), and its own files with `.ts` too, as core does, so `node:test` can load the pure ones. Angular pins TypeScript to 6.0, so this package has its own `typescript`; core keeps 7. Pure logic is tested with `node:test` in `test/`. `pnpm build` builds it into `backend/daemon/internal/web/dist/` (gitignored), which the daemon embeds.
- `frontends/macos/`: the macOS client, a Swift package, code in `src/` by layer: `App/` (entry point, wiring), `Daemon/` (SSE client, HTTP), `Scene/` (the JavaScriptCore engine, its models, coordinates), `Overlay/` (the panel, drawing, input), `Support/` (constants, logging). It needs `scene.js`, so run `pnpm build` before `swift run`.
- `frontends/gnome/`: the GNOME client, package `@claudie/gnome`, a GNOME Shell extension (uuid `claudie@farnsworth3010.github.io`, `metadata.json`, `stylesheet.css`). `src/` by layer: `extension.ts` (enable/disable, wiring), `daemon/` (SSE stream, settings POST), `overlay/` (chrome container, sprites, screens, input, tooltip), `idle/` (the time since the last input, for the break reminder), `store/` (the saved anchor, `$XDG_STATE_HOME/claudie/gnome.json`), `sound/`, and `lib/`, pure code without `gi://` imports, tested with `node:test` in `test/`. Types come from `@girs/*`; `tsconfig.json` covers `src` without Node types (GNOME's `global` clashes with Node's), `tsconfig.test.json` the tests. `pnpm build` bundles it with core into `dist/<uuid>/` (gitignored).
- `tools/demo.sh`: made-up sessions in every state, sent to a running daemon; Ctrl+C ends them.
- `docs/media/`: the README's images and GIFs, rendered from the scene code by `backend/core/tools/media/` (`pnpm media`, needs ImageMagick); re-render after changing animations.
- `tools/build-gnome-extension.sh`: the GNOME extension as `Claudie-gnome.zip` in `frontends/gnome/dist/`; the release workflow attaches it to the release.
- `tools/build-macos-app.sh`: the macOS app as `Claudie.app` in a zip (needs a Mac and `pnpm build` first); the release workflow attaches it to the release.
- `tools/build-daemons.sh`: the daemon for every platform plus SHA256SUMS in `backend/daemon/bin/release/`. `.github/workflows/release.yml` runs it on a `vX.Y.Z` tag, which must match the plugin's version, and publishes the release.
- `.githooks/commit-msg`: runs commitlint; `pnpm install` points `core.hooksPath` at `.githooks`.

## Commands
Package manager: pnpm (workspace root plus `backend/core` and `frontends/web`). Node 25 and Go are needed for development only.

| Command | What it does |
|---|---|
| `pnpm install` | Install tools; also enables the commit-msg hook |
| `pnpm check` | Everything below: lint, typecheck, TS tests, build, Go checks |
| `pnpm lint` / `pnpm format` | Biome: check / fix formatting and lint in TS, JS and JSON |
| `pnpm typecheck` | `tsc` over `backend/core/` and `frontends/web/` (checks only, emits nothing; `ng build` checks the templates) |
| `pnpm test` | `node --test` in `backend/core/` and `frontends/web/` |
| `pnpm build` | Bundle the core for the daemon and the scene for the Mac app, build the GNOME extension and the settings page |
| `pnpm media` | Render the README's images and GIFs into `docs/media/` |
| `pnpm go:check` | `gofmt`, `go vet`, `go test` and `govulncheck` in `backend/daemon/` |
| `pnpm --filter @claudie/web start` | The settings page with live reload on :4200, proxied to a running daemon |
| `swift run` (in `frontends/macos/`, on a Mac) | Build and start the macOS overlay |
| `tools/build-gnome-extension.sh`, then `gnome-extensions install --force frontends/gnome/dist/Claudie-gnome.zip` | Build and install the GNOME overlay (log out and in on Wayland, then `gnome-extensions enable`) |

Develop with the plugin from this clone, never with hooks added by hand next to an installed plugin (every event would arrive twice; the daemon drops exact copies, but don't rely on it):
```sh
CLAUDIE_DAEMON=$PWD/backend/daemon/bin/claudie-daemon claude --plugin-dir backend/plugin
```
The hook then starts your build when nothing answers. A build from source reports version `dev`, and a running `dev` daemon is never replaced by a release, nor does a `dev` binary replace anything; restart it yourself after rebuilding (`curl -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:47321/quit`).

Build the daemon from `backend/daemon/`, always with `-o`: a plain `go build` drops a binary into the source tree. `tools/build-daemons.sh` builds the release binaries for every platform.
```sh
go build -o bin/claudie-daemon ./src
```

A reinstalled GNOME extension that is already enabled keeps running the old code: Wayland can't restart the shell, disable/enable reuses the module cached by its URI, and GJS refuses a query string in a module URI (`?t=…` is "Module not found"). To load the new build in the running session, paste this line in Looking Glass (Alt+F2, `lg`, Evaluator); `1` means active. It imports a uniquely named copy of `extension.js` (the bundle has only `gi://` and `resource://` imports) and swaps it in. Looking Glass splits the input on `;`, so keep `;` out of strings. An agent can't run it: the shell refuses `Eval` and `Screenshot` over D-Bus, so the maintainer pastes it.
```js
const uuid = 'claudie@farnsworth3010.github.io', em = Main.extensionManager, ext = em.lookup(uuid); await em._callExtensionDisable(uuid); const copy = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_tmp_dir(), `claudie-${Date.now()}.js`])); ext.dir.get_child('extension.js').copy(copy, Gio.FileCopyFlags.OVERWRITE, null, null); const mod = await import(copy.get_uri()); copy.delete(null); ext.stateObj = new mod.default({...ext.metadata, dir: ext.dir, path: ext.path}); await em._callExtensionEnable(uuid); ext.state
```

## Requirements that shape decisions
- Installing must be trivial: on the machine with Claude Code only `/plugin install`, nothing else to set up (no Node, no `jq`, no systemd).
- Keep platform-specific code inside its client; the daemon, the core and the plugin stay portable across the systems Claude Code runs on. Overlays exist for macOS and GNOME so far, and the settings page is for settings and showing off, not a second overlay.
- Http hooks arrive in order, but parallel tool calls and transcript lines can still interleave; the reducer must cope, and tests prove it.
