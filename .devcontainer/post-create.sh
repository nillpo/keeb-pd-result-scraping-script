#!/bin/sh
[ -f ~/.claude/.config.json ] || echo '{}' > ~/.claude/.config.json
sudo chown -R $(id -u):$(id -g) /home/vscode/.claude /commandhistory /home/vscode/.config