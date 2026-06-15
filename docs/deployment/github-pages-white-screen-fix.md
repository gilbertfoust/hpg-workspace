# GitHub Pages White Screen Fix

The GitHub Pages workflow already sets `GITHUB_REPOSITORY`, but `vite.config.ts` was requiring a separate `DEPLOY_TARGET=github-pages` flag before applying the `/hpg-workspace/` base path.

Because the workflow did not set that extra flag, the Pages build could emit root-relative assets and produce a blank white screen on the GitHub Pages project URL.

This branch updates Vite to use `GITHUB_REPOSITORY` directly:

- Lovable/local preview: no `GITHUB_REPOSITORY`, so base remains `/`.
- GitHub Pages build: `GITHUB_REPOSITORY=gilbertfoust/hpg-workspace`, so base becomes `/hpg-workspace/`.

This restores the behavior from the earlier working version where the GitHub Pages base path was hardcoded to `/hpg-workspace/`.
