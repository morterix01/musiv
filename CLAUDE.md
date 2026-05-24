# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nuclear is a free, open-source desktop music player (no ads, no tracking). This repo is a **rewrite** of the original Nuclear codebase — it is a Tauri v2 app with a React frontend and Rust backend, managed as a pnpm monorepo with Turborepo.

## Commands

All commands run from the repo root unless noted:

```bash
pnpm dev            # Start the player in dev mode (Tauri hot-reload)
pnpm build          # Build all packages
pnpm lint           # Lint all packages
pnpm lint:fix       # Auto-fix linting issues
pnpm test           # Run all tests
pnpm test:coverage  # Run tests with V8 coverage
pnpm type-check     # TypeScript checks across all packages
pnpm storybook      # Run Storybook for UI components
pnpm tauri          # Run Tauri CLI for the player
```

Run a single package's tests: `pnpm --filter @nuclearplayer/player test`

Run a single test file: `pnpm --filter @nuclearplayer/player exec vitest --run src/path/to/file.test.ts`

## Architecture

### Monorepo Layout

```
packages/
  player/         # @nuclearplayer/player — Main Tauri app (React + Rust)
  ui/             # @nuclearplayer/ui — Shared presentational components
  model/          # @nuclearplayer/model — Zod schemas / shared data types
  plugin-sdk/     # @nuclearplayer/plugin-sdk — Plugin API (no sandboxing)
  themes/         # @nuclearplayer/themes — Theme system (CSS variables)
  tailwind-config/# @nuclearplayer/tailwind-config — Tailwind v4 CSS-first config
  hifi/           # @nuclearplayer/hifi — Advanced HTML5 audio component
  i18n/           # @nuclearplayer/i18n — Internationalization
  eslint-config/  # @nuclearplayer/eslint-config — Shared ESLint + Prettier rules
  storybook/      # @nuclearplayer/storybook — Component stories
  website/        # @nuclearplayer/website — Marketing site (Astro)
  docs/           # @nuclearplayer/docs — Gitbook documentation
  tools/          # @nuclearplayer/tools — Build utilities
```

### Player Package (packages/player)

**Frontend** (`src/`):
- `main.tsx` — React entry point with store hydration and service setup
- `App.tsx` — Root component wiring router and query client
- `routes/` — File-based routing via TanStack Router (auto-generated route tree)
- `views/` — Feature views (Dashboard, Search, Artist, Album, Settings, etc.)
- `stores/` — Zustand stores (queue, playlist, favorites, settings, etc.)
- `services/` — Business logic layer (MCP, MPD, plugins, themes, bridge, etc.)

**Rust backend** (`src-tauri/src/`):
- `lib.rs` — Tauri app initialization and command registration
- `commands.rs` — IPC commands exposed to the frontend
- `mcp/` — Model Context Protocol server
- `mpd/` — Music Player Daemon support
- `ytdlp.rs` — yt-dlp integration for audio streams
- `http.rs` — HTTP fetching and stream serving

### State Management

- **Zustand** — persistent UI state (queue, playlists, settings)
- **React state** — local/temporary component state
- **TanStack Query v5** — all HTTP requests and async data fetching

### Styling

Tailwind v4 CSS-first setup. Configuration lives in `packages/tailwind-config/global.css` using `@theme` and `@layer` directives — there is no `tailwind.config.js`. **Do not use Tailwind's built-in color palette**; use the custom palette defined in `global.css`. Design direction: neo-brutalist with premium polish (Discord-like feel).

## Coding Conventions

- **TypeScript**: use `type`, not `interface` (except when declaration merging is required). Props are `type`, never `interface`.
- **React components**: `const Component: FC<Props> = () => {}` — not `function Component()`.
- **No magic numbers** — extract into named constants.
- **Compound components** (`Component.Sub`) for complex widgets.
- **UI components are dumb/presentational** — keep business logic in services or stores.
- **No inline comments** — if the why is not obvious from the code, it belongs in the commit message or PR description.
- Complex or performance-critical logic belongs in Rust (Tauri commands), not the frontend.

## Testing

- Framework: **Vitest + React Testing Library**
- Test from the user's perspective — avoid mocks unless the dependency is external (HTTP, filesystem, Tauri IPC).
- Snapshot tests cover basic rendering only; name them starting with `(Snapshot)`.
- Extract DOM querying into helper wrappers; keep assertions in the test body.

## Key Conventions to Follow

- Use shared configs — never duplicate ESLint, Prettier, TypeScript, or Tailwind config locally in a package when a shared one exists.
- Use **Lucide React** for icons.
- Use **framer-motion** + **tw-animate-css** for animations (springy physics; disable during high-friction moments like resize).
- Use **sonner** for toasts.
- Routes follow TanStack Router file-based convention — add files under `src/routes/` and the route tree is auto-generated.
- The plugin system has no sandboxing — treat plugin API surface as a public contract.
