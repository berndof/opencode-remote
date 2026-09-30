# opencode-remote 🚀

> Remote host management, SSHFS mounts, tunnels & TUI automation for OpenCode over SSH.

`opencode-remote` (and alias `ocd`) equips OpenCode developers and agents to connect, mount, provision, sync, execute commands on, and tunnel to remote SSH hosts seamlessly.

---

## 🌟 Key Features & Operational Modes

1. **⚡ One-Click Unified Connect (`ocd connect <host>`):**
   - Automatically checks SSH connectivity.
   - Starts the background `opencode serve` daemon on the remote server if needed.
   - Establishes and validates the local SSH port tunnel (`localhost:4096` or custom port).
   - Resolves server authentication token / password (from `~/.config/opencode/remote/<host>.env` or logs).
   - Launches OpenCode TUI directly connected to the remote instance!

2. **📁 SSHFS Mount Mode (`ocd mount <host> <remote_dir>`):**
   - Mounts remote codebases locally under `~/.cache/opencode-remote/mounts/<host>/`.
   - Allows using local LLM models, local MCP servers, and local extensions while directly editing remote files in real time.

3. **🎮 Interactive TUI Plugin & Slash Command (`/remote`):**
   - OpenCode TUI interface for selecting servers, checking status, mounting folders, and toggling SSH services.
   - Persistent prompt footer status indicator (`🌐 host` / `💻 local`).

4. **🔄 Zero-Footprint & SSH Automation Mode:**
   - Execute commands directly on remote hosts via SSH multiplexing.
   - Fast incremental directory synchronization with `rsync`.
   - Check host reachability across all entries in `~/.ssh/config`.

---

## 📦 Quick Installation

### One-Line Installer

```bash
curl -fsSL https://raw.githubusercontent.com/berndof/opencode-remote/main/install.sh | bash
```

### Manual Installation from Repository

```bash
git clone https://github.com/berndof/opencode-remote.git
cd opencode-remote
./install.sh
```

This installs `opencode-remote` with aliases (`ocd`, `oc-remote`) into `~/.local/bin/`, installs the skill into `~/.config/opencode/skills/` and `~/.opencode/skills/`, and deploys the TUI plugin to `~/.config/opencode/plugins/remote/`.

---

## 📖 CLI Commands & Reference

### 1. `ocd connect <host> [--dir <path>] [--port <port>] [--sshfs] [--provision]`
One-click connect: verifies SSH, spins up remote daemon, creates tunnel, resolves token, and connects client:
```bash
ocd connect dev-server
ocd connect dev-server --dir /home/user/my-project --port 7096

# If the remote host lacks OpenCode, it automatically warns and falls back to SSHFS mount:
ocd connect prod-server

# Force direct SSHFS mount mode:
ocd connect prod-server --sshfs /var/www/my-app

# Auto-provision OpenCode headless and sync plugins to remote host:
ocd connect dev-server --provision
```

### 2. `ocd mount <host> <remote_dir> [--as <name>]`
Mounts a remote directory locally via SSHFS:
```bash
ocd mount dev-server /var/www/my-app
ocd mounts            # List active mounts
ocd unmount dev-server # Unmount
```

### 3. `ocd list`
Parses `~/.ssh/config` and tests SSH connectivity concurrently:
```bash
ocd list
ocd list --json
```

### 4. `ocd status <host> [--port 4096]`
Comprehensive health check: SSH connection, remote daemon process, local tunnel state, and server token:
```bash
ocd status dev-server
```

### 5. `ocd exec <host> "<command>"`
Runs commands directly on the remote host:
```bash
ocd exec dev-server "docker ps"
ocd exec dev-server "git status"
```

### 6. `ocd sync <host> <local_dir> <remote_dir>`
Syncs local directory to remote host via `rsync`:
```bash
ocd sync dev-server ./my-app /var/www/my-app --delete
```

### 7. `ocd provision <host>`
Installs OpenCode headlessly on the remote Linux host:
```bash
ocd provision dev-server
```

### 8. `ocd stop <host> [--port 4096]`
Terminates local SSH tunnel process and cleanly shuts down remote `opencode serve` daemon:
```bash
ocd stop dev-server
```

---

## 🤖 OpenCode Skill & TUI Integration

- **Skill:** Available at `skills/opencode-remote/SKILL.md`. Automatically enables agents to perform remote operations safely.
- **TUI Plugin:** Slash command `/remote` (or `/rem`, `/remoto`) opens an interactive menu for server management, SSHFS mounts, and status checks.

---

## 📄 License

MIT License © [berndof](https://github.com/berndof)
