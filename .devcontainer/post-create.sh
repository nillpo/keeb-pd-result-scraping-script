#!/bin/sh
[ -f ~/.claude/.config.json ] || echo '{}' > ~/.claude/.config.json
sudo chown -R $(id -u):$(id -g) /home/vscode/.claude /commandhistory /home/vscode/.config

# Install project dependencies (lockfile must be up to date)
[ -f pnpm-lock.yaml ] && pnpm install --frozen-lockfile
