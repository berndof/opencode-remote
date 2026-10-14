---
name: opencode-remote
description: Comprehensive tool and guidelines for OpenCode agents to interact with, provision, sync, execute commands on, and tunnel to remote SSH hosts.
---

# OpenCode Remote Host Skill (`opencode-remote` / `ocd`)

This skill equips OpenCode agents with capabilities to interact with remote hosts via SSH. It supports three main operational modes:
1. **Unified Remote Client (`connect`):** Launch the OpenCode client connected to a remote host in a single command (`ocd connect <host>`). Automatically checks/starts `opencode serve` (with HTTP health probing and auto-repair), provisions the SSH tunnel (with automatic port collision avoidance), resolves server password/token, and connects. Falls back to SSHFS mount mode automatically if OpenCode is not installed on the remote host.
2. **SSHFS Mount Mode with Low-Resource Guard (Local Brain, Remote Files):** Mount remote directories locally with aggressive client-side caching and zero remote daemons so the agent and user can leverage local models, MCPs, and plugins on remote files.
3. **Zero-Footprint Mode (SSH Controller):** Run commands, check statuses, authorize SSH keys, and sync codebase directories using standard SSH (`ControlMaster` multiplexing) and `rsync`.

---

## Commands & Usage

All commands are accessible via `opencode-remote` CLI installed in `~/.local/bin/opencode-remote` (and aliases `ocd`, `oc-remote`).

### 1. One-Click Unified Connect (Recommended)
Automatically verifies SSH, starts remote daemon if needed, establishes local tunnel, resolves server password, and connects OpenCode client.
- If the remote host does not have OpenCode installed, automatically falls back to mounting via SSHFS with a clear warning:
```bash
ocd connect <host>
# Force direct SSHFS mount mode (local OpenCode + remote files):
ocd connect portal-prod --sshfs /var/www/portal [--unmount-on-exit]
# Auto-provision OpenCode headless and sync plugins to remote host:
ocd connect portal-dev --provision
# Custom directory, port, or tunnel persistence:
ocd connect portal-dev --dir /home/bernardo --port 7096 --keep-tunnel
```

### 2. List Available Remote Hosts & Check Connectivity
Parses `~/.ssh/config` and concurrently tests SSH connectivity:
```bash
opencode-remote list [--json] [--timeout 3]
```

### 3. Inspect Remote Host, Tunnel & Auth Status
Checks SSH connectivity, remote `opencode serve` HTTP health (`RUNNING` / `HUNG` / `STOPPED`), local tunnel state, and server password. Omit `<host>` to check all known hosts concurrently:
```bash
opencode-remote status
opencode-remote status <host> [--port 4096]
```

### 4. Authorize SSH Public Key (`copy-key`)
Installs local SSH public key on the remote host via `ssh-copy-id` for passwordless authentication:
```bash
opencode-remote copy-key <host> [-i ~/.ssh/id_ed25519.pub]
```

### 5. Start / Restart Remote OpenCode Serve Daemon
Launches `opencode serve --port <port>` in `$HOME` as a background daemon on the target host (respects `REMOTE_OPENCODE` and password in `~/.config/opencode/remote/<host>.env`):
```bash
opencode-remote serve <host> [--port 4096] [--password <secret>] [--restart]
```

### 6. Establish Local SSH Tunnel
Sets up local SSH port forwarding (`localhost:<local_port>` -> `127.0.0.1:<remote_port>` on remote host), auto-allocating the next free local port if the default port is busy:
```bash
opencode-remote tunnel <host> [--port 4096]
```

### 7. Stop Services & Tunnels Cleanly
Terminates local SSH tunnel process, cleanly stops remote `opencode serve` daemon, and closes the cached `ControlMaster` socket:
```bash
opencode-remote stop <host> [--port 4096]
```

### 8. Execute Remote Commands
Runs commands directly on target host via SSH multiplexing:
```bash
opencode-remote exec <host> "<command>"
opencode-remote exec <host> -- git status -sb
```

### 9. Sync Directories (`rsync`)
Synchronizes local directory to target remote host, ignoring `.git` and `node_modules`:
```bash
opencode-remote sync <host> <local_dir> <remote_dir> [--delete] [--dry-run]
```

### 10. Provision OpenCode Headless
Installs OpenCode on remote machine using standard headless installation scripts and syncs local plugins, skills, and configs:
```bash
opencode-remote provision <host> [--no-sync]
```

### 11. SSHFS Mount Mode (edit remote files with local config)
```bash
opencode-remote mount <host> <remote_dir> [--as NAME]
opencode-remote mounts
opencode-remote unmount <host|path>
```
Mounts remote directory under `~/.cache/opencode-remote/mounts/<host>/` with **Low-Resource Guard** (`compression=no`, lightweight ciphers, kernel/dcache metadata caching), allowing the user to run local `opencode` inside the mountpoint with local plugins, MCP servers, and settings while directly editing remote files. Active mount state is tracked in `~/.opencode-remote/mounts.json`.

### 12. Footer Indicator Configuration
`~/.config/opencode/remote.json` `{footer: "always"|"remote-only"}` — `always` shows `🌐 host`, `💻 local [SSHFS: host]`, or `💻 local` persistently under prompt; `remote-only` hides it on local. Toggle via `/remote` in TUI.

---

## Agent Guidelines & Best Practices

1. **Explicit Confirmation First:** NEVER initiate an SSH connection or remote command execution without first asking the user for explicit confirmation.
2. **Session Lifecycle & Reusability:**
   - Once permitted, reuse the connection socket via SSH Multiplexing (`ControlMaster`) to avoid negotiating a brand new session on every command during investigation/batch tasks.
   - Do NOT leave sessions lingering indefinitely: once the inspection/gathering is done, cleanly terminate the background master socket.
3. **Quick Connect:** When launching or guiding remote sessions, recommend `ocd connect <host>` as the single-step command.
4. **Authentication:** Server password is automatically loaded from `~/.config/opencode/remote/<host>.env` or extracted from `~/.opencode-serve.log`. For web access, the username is `opencode` and the password is the server password.
5. **Port Binding:** Remote `opencode serve` is strictly bound to `127.0.0.1` on remote host and accessed securely through the SSH tunnel.
