# opencode-remote 🚀

> Seamless remote development with [OpenCode](https://opencode.ai) over secure SSH tunnels, with automated background service lifecycle management and native TUI integration.

---

## 🎯 The Problem

When running OpenCode on remote development servers (AWS EC2, Lightsail, Hetzner, homelabs, or cloud VMs):
- You must manually open SSH tunnels (`ssh -L 7096:127.0.0.1:7096 ...`).
- If the remote headless server isn't running, you have to SSH in to start `opencode service start`.
- You need to track and authenticate with random service passwords across sessions.
- OpenCode's local client needs specific flags (`--server http://127.0.0.1:7096`) and the remote directory path.
- When networks drop, stale tunnels block local ports.

**opencode-remote** solves this completely. One command sets up SSH multiplexing, starts the remote service if needed, opens and verifies the tunnel, authenticates, and connects your local OpenCode TUI or opens the Web UI.

---

## ✨ Features

- **⚡ Instant TUI Connection:** Run `oc-remote <host>` or `ocd <host>` to attach your local OpenCode TUI to any remote server.
- **📁 Custom Remote Folders:** Pass directories or flags directly: `oc-remote <host> ~/projects/api -c`.
- **🌐 Web UI Launcher:** Run `oc-remote web <host>` to generate a pairing token and launch the web interface in your local browser.
- **🛡️ Robust Tunneling:** SSH socket multiplexing (`ControlMaster`) ensures instantaneous reconnects and clean teardowns without orphan ports.
- **🔄 Auto-Service Recovery:** Checks remote service health; if stopped or killed, it launches `opencode service start` remotely.
- **🔍 Diagnostics:** `oc-remote status <host>` gives a full health check (SSH, service, port, /api/info HTTP 200).
- **⌨️ OpenCode TUI Plugin:** Adds `/remote` slash command and Command Palette actions inside your local OpenCode sessions.
- **🔐 Multi-Host & Secure:** Isolated configs in `~/.config/opencode/remote/<host>.env` with `chmod 600` permissions.

---

## 📦 Quick Installation

### One-line installer (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/berndof/opencode-remote/main/install.sh | bash
```

Or from a local clone:

```bash
git clone https://github.com/berndof/opencode-remote.git
cd opencode-remote
./install.sh
```

The installer:
1. Places `oc-remote` into `~/.local/bin/oc-remote`.
2. Creates `~/.config/opencode/remote/` for your host profiles.
3. Installs the TUI plugin into `~/.config/opencode/cli-plugins/remote.ts`.
4. Enables the plugin in `~/.config/opencode/cli.json`.

---

## 🚀 Quickstart

### 1. Prepare your remote server

On your remote machine:

```bash
# 1. Install OpenCode (if not already installed)
curl -fsSL https://opencode.ai/install | bash

# 2. Start the background service
~/.opencode/bin/opencode service start

# 3. View your service password
~/.opencode/bin/opencode service get password
```

### 2. Configure a host locally

Run the interactive setup:

```bash
oc-remote init portal-dev
```

Or create `~/.config/opencode/remote/portal-dev.env` manually:

```bash
# ~/.config/opencode/remote/portal-dev.env (chmod 600)
SSH_HOST=portal-dev
LOCAL_PORT=7096
REMOTE_PORT=7096
REMOTE_OPENCODE=/home/username/.opencode/bin/opencode
REMOTE_DIRECTORY=/home/username
OPENCODE_PASSWORD=your_service_password_here
```

### 3. Verify connection

```bash
oc-remote status portal-dev
```

You should see:
```text
OpenCode Remote Diagnostics
host        portal-dev
ssh         ok
service     active  http://127.0.0.1:7096
tunnel      LISTENING  127.0.0.1:7096 (managed by oc-remote)
auth/api    200 OK (authenticated successfully)
launch      oc-remote portal-dev
```

---

## 💻 CLI Usage

| Command | Description |
|---|---|
| `oc-remote <host>` | Connect local TUI to default remote directory |
| `oc-remote <host> <dir>` | Connect local TUI to a specific directory on remote host |
| `oc-remote <host> -c` | Connect and continue the last session on remote host |
| `oc-remote web <host>` | Open remote Web UI in your local browser |
| `oc-remote link <host>` | Print one-time pairing auth URL |
| `oc-remote status <host>` | Full diagnostic check (SSH, service, port, auth) |
| `oc-remote up <host>` | Ensure remote service is started and tunnel is active |
| `oc-remote down <host>` | Close the SSH tunnel |
| `oc-remote list` | List all configured remote hosts |
| `oc-remote init <host>` | Interactive configuration wizard |

### Shell alias tip

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
alias ocd='oc-remote'
```

Then simply run:

```bash
ocd portal-dev ~/Workspace/my-project
```

---

## 🎨 OpenCode TUI Integration

Once installed, the TUI plugin provides the `/remote` command inside OpenCode:

1. Type `/remote` in any session prompt (or search `Remote Servers` in `Ctrl+P` Command Palette).
2. Select your configured server.
3. Choose an action:
   - 🔍 **Status / Diagnostics**: Runs the diagnostic healthcheck.
   - 🌐 **Open Web UI**: Launches your browser directly to the paired remote interface.
   - 🔗 **Copy Pairing Link**: Copies the one-time `/connect#...` auth URL.
   - ⬆ **Start Service & Tunnel**: Ensures the remote environment is ready in background.
   - ⬇ **Stop Tunnel**: Drops the SSH tunnel when you are done.

---

## ⚙️ Recommended SSH Configuration

To make reconnects instant and prevent network dropouts from freezing tunnels, add this to your `~/.ssh/config`:

```sshconfig
Host *
    ServerAliveInterval 30
    ServerAliveCountMax 3
    ControlMaster auto
    ControlPath ~/.ssh/cm-%r@%h:%p
    ControlPersist 10m
```

---

## 🔒 Security

- **No open public ports**: OpenCode service only binds to `127.0.0.1` on the remote server. All communication goes through encrypted SSH tunnels.
- **Local config permissions**: Host configurations in `~/.config/opencode/remote/*.env` are kept with strict `chmod 600` permissions.
- **Isolated tunnels**: Tunnel control sockets are scoped per host in `~/.cache/oc-remote/`.

---

## 📄 License

MIT © [berndof](https://github.com/berndof)
