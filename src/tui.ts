import { Plugin } from "@opencode/plugin/tui"
import { execFile } from "node:child_process"
import { readdirSync } from "node:fs"
import { homedir } from "node:os"
import { promisify } from "node:util"

const run = promisify(execFile)
const OC = `${homedir()}/.local/bin/oc-remote`
const REMOTE_DIR = `${homedir()}/.config/opencode/remote`

type Host = { id: string }

function getHosts(): Host[] {
  try {
    return readdirSync(REMOTE_DIR)
      .filter((f) => f.endsWith(".env"))
      .map((f) => ({ id: f.slice(0, -4) }))
      .sort((a, b) => a.id.localeCompare(b.id))
  } catch {
    return []
  }
}

async function oc(args: string[], timeout = 60_000): Promise<string> {
  try {
    const { stdout, stderr } = await run(OC, args, { timeout, maxBuffer: 1_048_576 })
    return (stdout || "").trim() || (stderr || "").trim()
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    const out = [err.stdout, err.stderr].filter(Boolean).join("\n").trim()
    return out || err.message ?? String(e)
  }
}

async function pickHost(ctx: any): Promise<string | undefined> {
  const list = getHosts()
  if (list.length === 0) {
    await ctx.ui.dialog.alert({
      title: "Remote Servers",
      message: "No remote hosts configured yet.\n\nRun 'oc-remote init <host>' in your terminal to set one up.",
    })
    return undefined
  }
  if (list.length === 1) return list[0].id
  const sel = await ctx.ui.dialog.select<string>({
    title: "Select Remote Host",
    options: list.map((h: Host) => ({
      title: h.id,
      value: h.id,
      description: `~/.config/opencode/remote/${h.id}.env`,
    })),
  })
  return sel ?? undefined
}

async function pickAction(ctx: any, host: string): Promise<string | undefined> {
  const sel = await ctx.ui.dialog.select<string>({
    title: `Remote Server: ${host}`,
    options: [
      { title: "🔍 Status / Diagnostics", value: "status", description: "Test SSH, remote service, tunnel, and credentials" },
      { title: "🌐 Open Web UI", value: "web", description: "Open remote Web UI in browser via secure SSH tunnel" },
      { title: "🔗 Copy Pairing Link", value: "link", description: "Display one-time authentication link" },
      { title: "⬆ Start Service & Tunnel", value: "up", description: "Ensure remote background service and SSH tunnel are active" },
      { title: "⬇ Stop Tunnel", value: "down", description: "Tear down the SSH tunnel" },
      { title: "📋 View Connect Command", value: "connect", description: "Command to attach a new TUI window to this server" },
    ],
  })
  return sel ?? undefined
}

export default Plugin.define({
  id: "opencode.remote",
  setup(context: any) {
    context.keymap.layer(() => ({
      mode: "global",
      priority: 50,
      commands: [
        {
          id: "remote.manage",
          title: "Remote Servers (oc-remote)",
          group: "Remote",
          palette: true,
          slash: { name: "remote", aliases: ["rem"], arguments: true },
          enabled: () => true,
          suggested: true,
          run: (input: string) => handle(input ?? ""),
        },
      ],
      bindings: [],
    }))

    async function handle(raw: string) {
      const parts = raw.trim().split(/\s+/).filter(Boolean)
      let action: string
      let host: string

      if (parts.length === 0) {
        host = await pickHost(context)
        if (!host) return
        action = await pickAction(context, host)
        if (!action) return
      } else if (["status", "up", "down", "web", "link", "connect"].includes(parts[0])) {
        action = parts[0]
        if (parts.length > 1) {
          host = parts[1]
        } else {
          host = await pickHost(context)
          if (!host) return
        }
      } else {
        host = parts[0]
        action = await pickAction(context, host)
        if (!action) return
      }

      await context.ui.toast.show({ message: `oc-remote ${action} ${host}…`, duration: 25_000 })
      const out = await dispatch(action, host)
      if (out) {
        await context.ui.dialog.alert({ title: `oc-remote ${action}: ${host}`, message: out })
      }
    }

    async function dispatch(action: string, host: string): Promise<string | undefined> {
      try {
        switch (action) {
          case "status":
            return await oc(["status", host])
          case "up":
            return await oc(["up", host])
          case "down":
            return await oc(["down", host])
          case "web":
            return await oc(["web", host])
          case "link": {
            const link = await oc(["link", host])
            return link ? `Copy and paste into your browser:\n\n${link}` : "No link generated"
          }
          case "connect":
            return [
              `To attach an OpenCode TUI window to this server, run:`,
              ``,
              `  oc-remote ${host}`,
              ``,
              `Or open a specific remote directory:`,
              `  oc-remote ${host} /path/on/remote`,
              ``,
              `Note: The local TUI process remains local and renders the remote sessions via WebSocket.`,
            ].join("\n")
          default:
            return undefined
        }
      } catch (e) {
        return String(e)
      }
    }

    return () => {}
  },
})
