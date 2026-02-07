# MLX Video UI - Pinokio Launcher

This folder contains Pinokio launcher scripts for the MLX Video UI.

## What it does
- Clones the UI repo into `app/`
- Installs backend Python deps and frontend Node deps
- Starts backend + frontend together with one click

## Scripts
- `install.js`: clone `mlx-video-UI` into `app/`, clone `mlx-video` into `mlx-video/`, then install deps
- `start.js`: start backend + frontend together (auto-picks free ports if defaults are taken)
- `update.js`: `git pull` + reinstall deps
- `reset.js`: remove `app/` and `mlx-video/`

## Notes
- Frontend is started with `NEXT_PUBLIC_API_BASE` pointing at the selected backend URL.
- `start.js` writes `local.url` so the Pinokio menu can open the UI automatically.
