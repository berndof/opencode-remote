---
name: opencode-remote
description: Comprehensive tool and guidelines for OpenCode agents to interact with, provision, sync, execute commands on, and tunnel to remote SSH hosts.
---

# OpenCode Remote Host Skill (`opencode-remote` / `ocd`)

This skill equips OpenCode agents with capabilities to interact with remote hosts via SSH. It supports three main operational modes:
1. **Unified Remote Client (`connect`):** Launch the OpenCode client connected to a remote host in a single command (`ocd connect <host>`). Automatically checks/starts `opencode serve`, provisions the SSH tunnel, resolves server password/token, and connects.
2. **SSHFS Mount Mode (Local Brain, Remote Files):** Mount remote directories locally so the agent and user can leverage local models, MCPs, and plugins on remote files.
3. **Zero-Footprint Mode (SSH Controller):** Run commands, check statuses, and sync codebase directories using standard SSH and `rsync`.

---

## Commands & Usage

All commands are accessible via `opencode-remote` CLI installed in `~/.local/bin/opencode-remote` (and `ocd` alias).

### 1. One-Click Unified Connect (Recommended)
Automatically verifies SSH, starts remote daemon if needed, establishes local tunnel, resolves server password, and connects OpenCode client.
- If the remote host does not have OpenCode installed, automatically falls back to mounting via SSHFS with a clear warning:
```bash
ocd connect <host>
# Force direct SSHFS mount mode (local OpenCode + remote files):
ocd connect portal-prod --sshfs /var/www/portal
# Auto-provision OpenCode headless and sync plugins to remote host:
ocd connect portal-dev --provision
# Custom directory or port:
ocd connect portal-dev --dir /home/bernardo --port 7096
```

### 2. List Available Remote Hosts & Check Connectivity
Parses `~/.ssh/config` and concurrently tests SSH connectivity.
```bash
opencode-remote list
opencode-remote list --json
```

### 3. Inspect Remote Host, Tunnel & Auth Status
Checks SSH connectivity, remote `opencode serve` process, local tunnel state, and server password:
```bash
opencode-remote status <host>
```

### 4. Start Remote OpenCode Serve Daemon
Launches `opencode serve --port <port>` as a background daemon on the target host (respects password in `~/.config/opencode/remote/<host>.env`):
```bash
opencode-remote serve <host> [--port 4096] [--password <secret>]
```

### 5. Establish Local SSH Tunnel
Sets up local SSH port forwarding (`localhost:<local_port>` -> `127.0.0.1:<remote_port>` on remote host):
```bash
opencode-remote tunnel <host> [--port 4096]
```

### 6. Stop Services & Tunnels Cleanly
Terminates local SSH tunnel process and cleanly stops remote `opencode serve` daemon:
```bash
opencode-remote stop <host> [--port 4096]
```

### 7. Execute Remote Commands
Runs commands directly on target host via SSH multiplexing/session:
```bash
opencode-remote exec <host> "<command>"
```

### 8. Sync Directories (`rsync`)
Synchronizes local directory to target remote host, ignoring `.git` and `node_modules`:
```bash
opencode-remote sync <host> <local_dir> <remote_dir> [--delete] [--dry-run]
```

### 9. Provision OpenCode Headless
Installs OpenCode on remote machine using standard headless installation scripts:
```bash
opencode-remote provision <host>
```

---

### 10. SSHFS Mount Mode (edit remote files with local config)
```bash
opencode-remote mount <host> <remote_dir> [--as NAME]
opencode-remote mounts
opencode-remote unmount <host|path>
```
Mounts remote directory under `~/.cache/opencode-remote/mounts/<host>/` (legacy fallback `~/.cache/oc-remote/mounts/`), allowing the user to run local `opencode` inside the mountpoint with local plugins, MCP servers, and settings while directly editing remote files. Requires `sshfs` binary. Active mount state is tracked in `~/.opencode-remote/mounts.json`.

### 11. Footer Indicator Configuration
`~/.config/opencode/remote.json` `{footer: "always"|"remote-only"}` — `always` shows 🌐 host or 💻 local persistently under prompt; `remote-only` hides it on local. Toggle via `/remote` in TUI.

---

## Agent Guidelines & Best Practices

1. **Explicit Confirmation First:** NEVER initiate an SSH connection or remote command execution without first asking the user for explicit confirmation.
2. **Session Lifecycle & Reusability:**
   - Once permitted, reuse the connection socket via SSH Multiplexing (`ControlMaster`) to avoid negotiating a brand new session on every command during investigation/batch tasks.
   - Do NOT leave sessions lingering indefinitely: once the inspection/gathering is done, cleanly terminate the background master socket.
3. **Quick Connect:** When launching or guiding remote sessions, recommend `ocd connect <host>` as the single-step command.
4. **Authentication:** Server password is automatically loaded from `~/.config/opencode/remote/<host>.env` or extracted from `~/.opencode-serve.log`. For web access, the username is `opencode` and the password is the server password.
5. **Port Binding:** Remote `opencode serve` is strictly bound to `127.0.0.1` on remote host and accessed securely through the SSH tunnel.
