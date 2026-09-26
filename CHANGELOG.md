# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 1.0.0 — 2026-09-26

### Added

- Provider account usage connector for Claude Code Router: shows the Volcano Engine Coding Plan quota of the `ark` provider as three windows (5-hour / weekly / monthly) with remaining percentage, reset time, and color-coded status (`ok` / `warning` / `critical`).
- CLI lookup through `PATH` plus common install dirs (`/opt/homebrew/bin`, `/usr/local/bin`, …), with a spawn strategy that executes node-shebang CLIs via the host runtime (`ELECTRON_RUN_AS_NODE=1`) so the plugin works inside CCR's restricted-PATH Electron gateway.
- `install.sh` — syncs the plugin into CCR's extension directory with a `--dry-run` mode and timestamped backups.
- Six unit tests covering usage parsing and the spawn strategy; CI on macOS & Ubuntu with Node 18/20/22.
- Bilingual documentation (English / 简体中文).
