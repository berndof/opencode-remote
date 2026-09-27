---
name: opencode-remote
description: Comprehensive tool and guidelines for OpenCode agents to interact with, provision, sync, execute commands on, and tunnel to remote SSH hosts.
---

# OpenCode Remote Host Skill (`opencode-remote`)

This skill equips OpenCode agents with capabilities to interact with remote hosts via SSH. It supports two main operational modes:
1. **Zero-Footprint Mode (SSH Controller):** Run commands, check statuses, and sync codebase directories using standard SSH and `rsync` without installing remote dependencies.
2. **Remote OpenCode Provisioner Mode:** Provision OpenCode headlessly on remote machines, manage remote `opencode serve` daemons, and open secure SSH tunnels (`localhost:4096`).

---

## Commands & Usage

All commands are accessible via `opencode-remote` CLI installed in `~/.local/bin/opencode-remote`.

### 1. List Available Remote Hosts & Check Connectivity
Parses `~/.ssh/config` and concurrently tests SSH connectivity.
```bash
opencode-remote list
opencode-remote list --json
```

### 2. Execute Remote Commands
Runs commands directly on target host via SSH multiplexing/session.
```bash
opencode-remote exec <host> "<command>"
# Example:
opencode-remote exec portal-dev "docker ps"
```

### 3. Sync Directories (`rsync`)
Synchronizes local directory to target remote host, ignoring `.git` and `node_modules`.
```bash
opencode-remote sync <host> <local_dir> <remote_dir>
# Options: --delete, --dry-run
# Example:
opencode-remote sync portal-dev ./my-app /var/www/my-app --delete
```

### 4. Provision OpenCode Headless
Installs OpenCode on remote machine using standard headless installation scripts.
```bash
opencode-remote provision <host>
```

### 5. Start Remote OpenCode Serve Daemon
Launches `opencode serve --port 4096` as a background daemon on the target host.
```bash
opencode-remote serve <host> [--port 4096]
```

### 6. Establish Local SSH Tunnel
Sets up local SSH port forwarding (`localhost:4096` -> `127.0.0.1:4096` on remote host).
```bash
opencode-remote tunnel <host> [--port 4096]
```

### 7. Inspect Remote Host & Tunnel Status
Checks SSH connectivity, remote `opencode serve` process, and local tunnel state.
```bash
opencode-remote status <host> [--port 4096]
```

### 8. Stop Services & Tunnels Cleanly
Terminates local SSH tunnel process and cleanly stops remote `opencode serve` daemon.
```bash
opencode-remote stop <host> [--port 4096]
```

---

## Agent Guidelines & Best Practices

1. **Host Verification:** Always run `opencode-remote list` first to check if target host is `ONLINE`.
2. **Security:** Never hardcode credentials. All connection parameters rely on standard SSH configuration (`~/.ssh/config` and SSH keys).
3. **Port Binding:** Remote `opencode serve` is strictly bound to `127.0.0.1` on remote host and accessed securely through SSH tunnel.
