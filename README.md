# opencode-remote 🚀

> Remote host management and automation CLI tool for OpenCode.

`opencode-remote` enables OpenCode agents and developers to list, provision, synchronize, execute commands on, and tunnel to remote SSH hosts seamlessly.

---

## 🚀 Features & Operational Modes

`opencode-remote` supports two primary operational workflows:

1. **Zero-Footprint Mode (SSH Controller):**
   - Execute remote commands over SSH.
   - Synchronize local codebase directories with target remote hosts via `rsync`.
   - Inspect SSH host availability concurrently.

2. **Remote OpenCode Provisioner & Daemon Mode:**
   - Headlessly provision OpenCode on remote Linux hosts.
   - Launch background `opencode serve` daemons.
   - Establish secure SSH local port forwarding (`localhost:4096`).
   - Monitor connection health, service states, and active local tunnels.
   - Cleanly terminate services and local port forwards.

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

This installs `opencode-remote` (and alias `oc-remote`) into `~/.local/bin/` and registers the OpenCode skill definition in `~/.opencode/skills/opencode-remote/SKILL.md`.

---

## 📖 CLI Commands & Reference

### 1. `opencode-remote list`
Parses `~/.ssh/config` and concurrently tests SSH connectivity to all configured hosts.

```bash
# Standard table output
opencode-remote list

# JSON format output for agent integration
opencode-remote list --json

# Custom SSH timeout in seconds
opencode-remote list --timeout 5
```

### 2. `opencode-remote exec <host> <command...>`
Executes remote commands on target host using SSH session.

```bash
opencode-remote exec dev-server "docker ps"
opencode-remote exec dev-server "uname -a"
```

### 3. `opencode-remote sync <host> <local_dir> <remote_dir>`
Synchronizes local directory to target remote host via `rsync` (excludes `.git` and `node_modules` by default).

```bash
# Basic sync
opencode-remote sync dev-server ./my-app /var/www/my-app

# Sync with --delete and --dry-run flags
opencode-remote sync dev-server ./my-app /var/www/my-app --delete --dry-run
```

### 4. `opencode-remote provision <host>`
Installs OpenCode headlessly on target remote machine if not already installed.

```bash
opencode-remote provision dev-server
```

### 5. `opencode-remote serve <host> [--port 4096]`
Launches `opencode serve --port <port>` as a background daemon on the remote host (logs to `~/.opencode-serve.log`).

```bash
opencode-remote serve dev-server --port 4096
```

### 6. `opencode-remote tunnel <host> [--port 4096]`
Sets up background SSH local port forwarding (`localhost:<port>` -> `127.0.0.1:<port>` on remote host).

```bash
opencode-remote tunnel dev-server --port 4096
```

### 7. `opencode-remote status <host> [--port 4096]`
Displays connection diagnostic report:
1. SSH host reachability
2. Remote `opencode serve` daemon status
3. Local SSH tunnel state and PID

```bash
opencode-remote status dev-server
```

### 8. `opencode-remote stop <host> [--port 4096]`
Terminates local SSH tunnel process and cleanly stops remote `opencode serve` process.

```bash
opencode-remote stop dev-server
```

---

## 🤖 OpenCode Skill Integration

This repository includes an OpenCode Skill definition at `.opencode/skills/opencode-remote/SKILL.md`.

When enabled, OpenCode agents can automatically invoke `opencode-remote` to manage remote environments, sync files, and verify connection health before executing tasks.

---

## 📄 License

MIT License © [berndof](https.github.com/berndof)
