@echo off
npx.cmd pnpm install
npx.cmd pnpm --filter @nuclearplayer/player lint:fix
