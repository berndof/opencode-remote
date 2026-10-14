# opencode-remote 🚀

> Remote host management, SSHFS mounts, tunnels & TUI automation for OpenCode over SSH.

`opencode-remote` (and aliases `ocd`, `oc-remote`) equips OpenCode developers and agents to connect, mount, provision, sync, execute commands on, and tunnel to remote SSH hosts seamlessly.

---

## 🌟 Key Features & Operational Modes

1. **⚡ One-Click Unified Connect (`ocd connect <host>`):**
   - Checks SSH connectivity (with interactive in-memory password fallback + `ControlMaster` reuse if no SSH key is installed).
   - Performs a real HTTP health probe of the remote `opencode serve` daemon (auto-restarting hung daemons or starting it in `$HOME` if stopped).
   - Automatic **SSHFS Fallback**: if the remote server doesn't have OpenCode installed, automatically mounts the remote directory via SSHFS and runs your local OpenCode against it (or installs OpenCode remotely when `--provision` is passed).
   - Establishes and validates the local SSH port tunnel (`localhost:4096` by default, with automatic port collision detection and free-port allocation when connecting to multiple hosts simultaneously).
   - Resolves server authentication token/password (from `~/.opencode-serve.log` or `~/.config/opencode/remote/<host>.env`) and launches OpenCode TUI directly connected!

2. **🛡️ SSHFS Mount Mode with Low-Resource Guard (`ocd mount <host> <remote_dir>`):**
   - Mounts remote codebases locally under `~/.cache/opencode-remote/mounts/<host>/`.
   - Applies **Low-Resource Guard** (`compression=no`, hardware-accelerated ciphers, aggressive kernel/dcache metadata caching) to protect remote CPU, RAM, and disk I/O with zero remote daemons.
   - Allows using local LLM models, local MCP servers, and local plugins while editing remote files in real time.

3. **🎮 Interactive TUI Plugin & Slash Command (`/remote`):**
   - OpenCode TUI interface (`/remote`, `/rem`, `/remoto`) for selecting servers, checking status, mounting/unmounting SSHFS folders, syncing, provisioning, and toggling SSH services.
   - Persistent prompt footer status indicator (`🌐 host` / `💻 local [SSHFS: host]` / `💻 local`).

4. **🔄 Zero-Footprint & SSH Automation Mode:**
   - Execute commands directly on remote hosts via SSH multiplexing (`ControlMaster`).
   - Fast incremental directory synchronization with `rsync`.
   - Concurrent reachability & service health checks across all entries in `~/.ssh/config` and `~/.config/opencode/remote/*.env`.

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

### 1. `ocd connect <host> [options] [-- <extra_opencode_args>]`
One-click connect: verifies SSH, spins up remote daemon, creates tunnel, resolves token, and launches OpenCode client:
```bash
ocd connect dev-server
ocd connect dev-server --dir /home/user/my-project --port 7096

# If the remote host lacks OpenCode, it automatically warns and falls back to SSHFS mount:
ocd connect prod-server

# Force direct SSHFS mount mode (with optional auto-unmount on exit):
ocd connect prod-server --sshfs /var/www/my-app --unmount-on-exit

# Auto-provision OpenCode headless and sync local plugins/skills to remote host:
ocd connect dev-server --provision

# Keep the SSH tunnel open in the background after exiting OpenCode (default closes on exit):
ocd connect dev-server --keep-tunnel
```

### 2. `ocd status [host] [--port 4096]`
Comprehensive health check: SSH connection, remote daemon HTTP health (`RUNNING` / `HUNG` / `STOPPED`), local tunnel state, and server password. Omit `<host>` to inspect all configured hosts in parallel:
```bash
ocd status              # Overview table for all hosts
ocd status dev-server   # Detailed 4-step diagnostic for a single host
```

### 3. `ocd list [--json] [--timeout 3]`
Parses `~/.ssh/config` and tests SSH connectivity concurrently:
```bash
ocd list
ocd list --json
```

### 4. `ocd copy-key <host> [-i <identity_file>]`
Authorizes your local SSH public key on the remote host via `ssh-copy-id` for passwordless login:
```bash
ocd copy-key dev-server
ocd copy-key dev-server -i ~/.ssh/id_ed25519.pub
```

### 5. `ocd mount <host> <remote_dir> [--as <name>]` / `ocd mounts` / `ocd unmount <host|path>`
Mounts a remote directory locally via SSHFS with Low-Resource Guard:
```bash
ocd mount dev-server /var/www/my-app
ocd mounts              # List active SSHFS mounts and status
ocd unmount dev-server  # Unmount cleanly (supports fusermount3, fusermount, umount)
```

### 6. `ocd serve <host> [--port 4096] [--password <secret>] [--restart]`
Starts or recycles the headless `opencode serve` daemon on the remote host:
```bash
ocd serve dev-server --restart
```

### 7. `ocd tunnel <host> [--port 4096]` / `ocd stop <host> [--port 4096]`
Manages the background local SSH port-forwarding tunnel and remote daemon:
```bash
ocd tunnel dev-server
ocd stop dev-server     # Stops local tunnel, remote daemon, and ControlMaster socket
```

### 8. `ocd exec <host> "<command>"`
Runs commands directly on the remote host (reusing `ControlMaster` session):
```bash
ocd exec dev-server "docker ps"
ocd exec dev-server -- git status -sb
```

### 9. `ocd sync <host> <local_dir> <remote_dir> [--delete] [--dry-run]`
Syncs local directory to remote host via `rsync` (excluding `.git` and `node_modules`):
```bash
ocd sync dev-server ./my-app /var/www/my-app --delete
```

### 10. `ocd provision <host> [--no-sync]`
Installs OpenCode headlessly on the remote Linux host and syncs local plugins, skills, and agents:
```bash
ocd provision dev-server
```

---

## ⚙️ Per-Host Configuration (`~/.config/opencode/remote/<host>.env`)

Optional per-host overrides can be placed in `~/.config/opencode/remote/<host>.env` (see [`templates/example.env`](templates/example.env)):
- `SSH_HOST`: Underlying SSH alias or `user@hostname`
- `LOCAL_PORT` / `REMOTE_PORT`: Custom local/remote ports (default `4096`)
- `REMOTE_OPENCODE`: Explicit path to remote `opencode` binary
- `REMOTE_DIRECTORY`: Default remote directory to open on `connect`
- `OPENCODE_PASSWORD`: Custom server password
- `CLOSE_TUNNEL_ON_EXIT`: `true` (default) or `false`
- `SSHFS_OPTS`: Custom comma-separated `sshfs -o` options

---

## 🤖 OpenCode Skill & TUI Integration

- **Skill:** Available at `skills/opencode-remote/SKILL.md`. Automatically enables agents to perform remote operations safely.
- **TUI Plugin:** Slash command `/remote` (or `/rem`, `/remoto`) opens an interactive menu for server management, SSHFS mounts, and status checks.

---

## 📄 License

MIT License © [berndof](https://github.com/berndof)
