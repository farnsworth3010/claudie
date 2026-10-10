# Claudie

Pixel-art Clawd mascots over every window on a Mac, one per running Claude Code session, showing what each session is doing: working (and with which tool), waiting for permission, asking a question, done, idle.

The maintainer wants to understand and control every part of it, so the way of working below matters as much as the code.

## How we work
- Small steps, one module or idea at a time. Before writing, explain what and why; after writing, explain each file and each decision. Wait for the maintainer's approval before the next step.
- Deliver exactly what was asked. Propose anything else in one sentence and wait.
- Never commit, push or touch git history: the maintainer commits. Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), checked by commitlint; never add AI attribution.
- Comments: short, one line where possible, only the non-obvious *why*; never narrate edit history.
- If you cannot build or run the Swift app where you are, say so: the maintainer builds it and reports errors. Keep Swift changes small and explained.

## Architecture
```
server (where Claude Code runs)                                      Mac
Claude Code ─http hooks─────────────────────► daemon ─SSE /events─► Claudie.app
            ─SessionStart: claudie-session-start.sh (curl + pid) ─┘   127.0.0.1:47321
```
- Claude Code posts every event to the daemon with `http` hooks; only SessionStart, which can't be an http hook, goes through a script, which also tells the daemon the session's pid. The script will start the daemon in the background when nothing answers on the port, so installing the plugin is the whole server setup.
- Denied permissions and Esc send no hook at all; the daemon learns them from the session's transcript.
- The daemon holds the only truth about sessions and streams full snapshots `{now, sessions}`; the Mac app only draws them.

| Language | Where | Role |
|---|---|---|
| POSIX sh | `backend/plugin/` | The SessionStart hook: send the event with `curl` and the pid. No `jq`, no GNU-only flags, no `/proc`. |
| Go | `backend/daemon/` | A thin shell: HTTP, SSE, timers, files, process checks. Standard library plus goja; no domain logic. Ships as one static binary per platform. |
| TypeScript | `backend/core/` | All the logic: the session reducer, the director, sprites, layout. Runs in Node for tests, in goja inside the daemon, in JavaScriptCore inside the app. |
| Swift | `frontends/macos/` | Windows above everything, click-through, drawing with Core Animation, the mouse, the SSE client. |

Parts talk JSON: hook → daemon (the Claude Code event), daemon → app (snapshots), Go ↔ TS and Swift ↔ TS (JSON strings across the bridge).

## Rules for `backend/core/`
- `backend/core/src` must run in goja and JavaScriptCore: no `node:*` imports and no Node, DOM or browser globals. Only tests may use Node APIs.
- Node runs `.ts` by stripping types, so only erasable syntax (no `enum`, `namespace`, parameter properties), `import type` for type-only imports, and `.ts` extensions in relative imports. `tsconfig.json` enforces this.
- Logic is pure functions where possible, tested with `node:test` against recorded events.

## Layout
Source code lives in each part's `src/`.
- `backend/core/`: TypeScript package (`src/`, `test/`). `pnpm build` bundles `src/daemon-entry.ts` into `backend/daemon/src/core.js` (gitignored).
- `backend/daemon/`: Go module `claudie/daemon`, package `main` in `src/` with its `_test.go` files (Go keeps tests next to the code); `bin/` holds built binaries (gitignored).
- `backend/plugin/`: Claude Code hooks.
- `frontends/macos/`: Swift package, code in `src/`.
- `.githooks/commit-msg`: runs commitlint; `pnpm install` points `core.hooksPath` at `.githooks`.

## Commands
Package manager: pnpm (workspace root plus `backend/core`). Node 25 and Go are needed for development only.

| Command | What it does |
|---|---|
| `pnpm install` | Install tools; also enables the commit-msg hook |
| `pnpm check` | Everything below: lint, typecheck, TS tests, build, Go checks |
| `pnpm lint` / `pnpm format` | Biome: check / fix formatting and lint in TS, JS and JSON |
| `pnpm typecheck` | `tsc` over `backend/core/` (checks only, emits nothing) |
| `pnpm test` | `node --test` in `backend/core/` |
| `pnpm build` | Bundle the core for the daemon |
| `pnpm go:check` | `gofmt`, `go vet`, `go test` and `govulncheck` in `backend/daemon/` |
| `swift run` (in `frontends/macos/`, on a Mac) | Build and start the overlay |

Build the daemon from `backend/daemon/`, always with `-o`: a plain `go build` drops a binary into the source tree.
```sh
go build -o bin/claudie-daemon ./src
for t in linux/amd64 linux/arm64 darwin/amd64 darwin/arm64; do
  CGO_ENABLED=0 GOOS=${t%/*} GOARCH=${t#*/} go build -trimpath -ldflags='-s -w' -o bin/claudie-daemon-${t%/*}-${t#*/} ./src
done
```

## Requirements that shape decisions
- Installing must be trivial: on the server only `/plugin install`, nothing else to set up (no Node, no `jq`, no systemd).
- macOS is the only frontend. No zellij or terminal integration for now.
- Http hooks arrive in order, but parallel tool calls and transcript lines can still interleave; the reducer must cope, and tests prove it.
