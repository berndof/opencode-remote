#!/usr/bin/env bash
#
# opencode-remote installer
# https://github.com/berndof/opencode-remote
#
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/berndof/opencode-remote/main"
LOCAL_BIN="${HOME}/.local/bin"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
REMOTE_CONF_DIR="${CONFIG_DIR}/remote"
CLI_PLUGIN_DIR="${CONFIG_DIR}/cli-plugins"
CLI_JSON="${CONFIG_DIR}/cli.json"

info() { printf '\033[36m•\033[0m %s\n' "$*"; }
success() { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m! warning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

printf "\n\033[1;35m==> Installing opencode-remote...\033[0m\n\n"

# 1. Determine execution source (local repo or piped curl)
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

mkdir -p "$LOCAL_BIN" "$REMOTE_CONF_DIR" "$CLI_PLUGIN_DIR"

# 2. Install oc-remote binary
info "Installing oc-remote executable to $LOCAL_BIN/oc-remote..."
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/bin/oc-remote" ]; then
  cp "$SCRIPT_DIR/bin/oc-remote" "$LOCAL_BIN/oc-remote"
else
  curl -fsSL "$REPO_RAW/bin/oc-remote" -o "$LOCAL_BIN/oc-remote"
fi
chmod +x "$LOCAL_BIN/oc-remote"
success "Installed oc-remote."

# 3. Install OpenCode TUI plugin (CLI plugin)
info "Installing OpenCode TUI plugin to $CLI_PLUGIN_DIR/remote.ts..."
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/src/tui.ts" ]; then
  cp "$SCRIPT_DIR/src/tui.ts" "$CLI_PLUGIN_DIR/remote.ts"
elif [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/src/tui.tsx" ]; then
  cp "$SCRIPT_DIR/src/tui.tsx" "$CLI_PLUGIN_DIR/remote.ts"
else
  curl -fsSL "$REPO_RAW/src/tui.ts" -o "$CLI_PLUGIN_DIR/remote.ts"
fi
success "Installed plugin to $CLI_PLUGIN_DIR/remote.ts."

# 4. Copy configuration template if none exist
if [ ! -f "$REMOTE_CONF_DIR/example.env" ]; then
  info "Providing template configuration at $REMOTE_CONF_DIR/example.env..."
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/templates/example.env" ]; then
    cp "$SCRIPT_DIR/templates/example.env" "$REMOTE_CONF_DIR/example.env"
  else
    curl -fsSL "$REPO_RAW/templates/example.env" -o "$REMOTE_CONF_DIR/example.env"
  fi
fi

# 5. Configure ~/.config/opencode/cli.json to register the CLI plugin
info "Configuring OpenCode CLI plugins in $CLI_JSON..."
python3 - << 'PYEOF' || true
import json, os

cli_path = os.path.expanduser("~/.config/opencode/cli.json")
data = {}
if os.path.exists(cli_path):
    try:
        with open(cli_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = {}

plugins = data.get("plugins", [])
plugin_ref = "./cli-plugins/remote.ts"
if plugin_ref not in plugins:
    plugins.append(plugin_ref)
    data["plugins"] = plugins
    with open(cli_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
PYEOF
success "Updated $CLI_JSON."

# 6. Verify PATH
if [[ ":$PATH:" != *":$LOCAL_BIN:"* ]]; then
  warn "$LOCAL_BIN is not in your PATH."
  echo "  Add it to your shell profile (~/.bashrc or ~/.zshrc):"
  echo "    export PATH=\"$LOCAL_BIN:\$PATH\""
fi

printf "\n\033[1;32m==> Installation complete!\033[0m\n\n"
echo "Next steps:"
echo "  1. Configure your remote server:"
echo "     oc-remote init <hostname>"
echo ""
echo "  2. Test the connection and remote service:"
echo "     oc-remote status <hostname>"
echo ""
echo "  3. Connect to your remote environment:"
echo "     oc-remote <hostname>               # default directory"
echo "     oc-remote <hostname> ~/projects/api # specific directory"
echo "     oc-remote web <hostname>           # open in web browser"
echo ""
echo "  4. Inside OpenCode TUI, type '/remote' to manage remote servers."
echo ""
