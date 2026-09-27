#!/usr/bin/env bash
#
# opencode-remote installer
# https://github.com/berndof/opencode-remote
#
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/berndof/opencode-remote/main"
LOCAL_BIN="${HOME}/.local/bin"
SKILLS_DIR="${HOME}/.opencode/skills/opencode-remote"

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

mkdir -p "$LOCAL_BIN" "$SKILLS_DIR"

# 2. Install opencode-remote binary
info "Installing opencode-remote executable to $LOCAL_BIN/opencode-remote..."
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/bin/opencode-remote" ]; then
  cp "$SCRIPT_DIR/bin/opencode-remote" "$LOCAL_BIN/opencode-remote"
else
  curl -fsSL "$REPO_RAW/bin/opencode-remote" -o "$LOCAL_BIN/opencode-remote"
fi
chmod +x "$LOCAL_BIN/opencode-remote"
ln -sf "$LOCAL_BIN/opencode-remote" "$LOCAL_BIN/oc-remote"
success "Installed opencode-remote and created alias oc-remote in $LOCAL_BIN."

# 3. Install OpenCode Skill definition
info "Installing opencode-remote skill definition to $SKILLS_DIR/SKILL.md..."
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/.opencode/skills/opencode-remote/SKILL.md" ]; then
  cp "$SCRIPT_DIR/.opencode/skills/opencode-remote/SKILL.md" "$SKILLS_DIR/SKILL.md"
elif [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/skills/opencode-remote/SKILL.md" ]; then
  cp "$SCRIPT_DIR/skills/opencode-remote/SKILL.md" "$SKILLS_DIR/SKILL.md"
else
  curl -fsSL "$REPO_RAW/.opencode/skills/opencode-remote/SKILL.md" -o "$SKILLS_DIR/SKILL.md" 2>/dev/null || true
fi
success "Installed skill definition."

# 4. Verify PATH
if [[ ":$PATH:" != *":$LOCAL_BIN:"* ]]; then
  warn "$LOCAL_BIN is not in your PATH."
  echo "  Add it to your shell profile (~/.bashrc or ~/.zshrc):"
  echo "    export PATH=\"$LOCAL_BIN:\$PATH\""
fi

printf "\n\033[1;32m==> Installation complete!\033[0m\n\n"
echo "Available commands:"
echo "  opencode-remote list                        # List SSH hosts & test connectivity"
echo "  opencode-remote exec <host> \"<command>\"     # Run remote command"
echo "  opencode-remote sync <host> <local> <remote> # Sync files via rsync"
echo "  opencode-remote provision <host>            # Install OpenCode headless on remote"
echo "  opencode-remote serve <host> [--port 4096]  # Start remote opencode serve daemon"
echo "  opencode-remote tunnel <host> [--port 4096] # Open local SSH port forward"
echo "  opencode-remote status <host>               # Check host & tunnel status"
echo "  opencode-remote stop <host>                 # Teardown local tunnel & remote daemon"
echo ""
