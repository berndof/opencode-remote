import { Plugin } from "@opencode/plugin/tui"
import { execFile } from "node:child_process"
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { homedir, hostname } from "node:os"
import { promisify } from "node:util"

const run = promisify(execFile)
const OC = `${homedir()}/.local/bin/oc-remote`
const REMOTE_DIR = `${homedir()}/.config/opencode/remote`
const MOUNT_BASE_DIR = `${homedir()}/.cache/oc-remote/mounts`
const LOCAL_MACHINE = hostname()

type Host = { id: string }

type EnvInfo = {
  isRemote: boolean
  label: string
  detail: string
  color: string
}

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

function detectEnvironment(dir: string): EnvInfo {
  // 1. Explicit env var from oc-remote launcher
  if (process.env.OPENCODE_REMOTE_HOST) {
    const h = process.env.OPENCODE_REMOTE_HOST
    const p = process.env.OPENCODE_REMOTE_PORT || "7096"
    return {
      isRemote: true,
      label: `🌐 ${h}`,
      detail: `Servidor remoto: ${h} (porta ${p})`,
      color: "#38bdf8", // bright sky blue
    }
  }

  // 2. Inspect /proc/self/cmdline on Linux for --server
  try {
    if (existsSync("/proc/self/cmdline")) {
      const raw = readFileSync("/proc/self/cmdline", "utf8")
      const parts = raw.split("\0")
      const idx = parts.indexOf("--server")
      if (idx !== -1 && parts[idx + 1]) {
        const srvUrl = parts[idx + 1]
        const portMatch = srvUrl.match(/:(\d+)/)
        const port = portMatch ? portMatch[1] : null

        if (existsSync(REMOTE_DIR)) {
          const envFiles = readdirSync(REMOTE_DIR).filter((f) => f.endsWith(".env"))
          for (const f of envFiles) {
            try {
              const content = readFileSync(`${REMOTE_DIR}/${f}`, "utf8")
              if (port && (content.includes(`LOCAL_PORT=${port}`) || content.includes(`REMOTE_PORT=${port}`))) {
                const hostId = f.replace(".env", "")
                return {
                  isRemote: true,
                  label: `🌐 ${hostId}`,
                  detail: `Servidor remoto: ${hostId} (${srvUrl})`,
                  color: "#38bdf8",
                }
              }
            } catch {}
          }
        }

        return {
          isRemote: true,
          label: `🌐 remoto (${port || "server"})`,
          detail: `Servidor remoto: ${srvUrl}`,
          color: "#38bdf8",
        }
      }
    }
  } catch {}

  // 3. Local SSHFS mount detection
  if (dir && dir.startsWith(MOUNT_BASE_DIR)) {
    const sub = dir.slice(MOUNT_BASE_DIR.length + 1).split("/")[0]
    const hostName = sub || "remoto"
    return {
      isRemote: false,
      label: `💻 local [SSHFS: ${hostName}]`,
      detail: `OpenCode Local montado via SSHFS no servidor ${hostName}`,
      color: "#34d399", // emerald green
    }
  }

  // 4. Direct SSH session on remote machine
  if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT) {
    return {
      isRemote: true,
      label: `🌐 ${LOCAL_MACHINE} (ssh)`,
      detail: `Sessão SSH direta na máquina ${LOCAL_MACHINE}`,
      color: "#f59e0b", // amber
    }
  }

  // 5. Default: local workstation
  return {
    isRemote: false,
    label: `💻 local`,
    detail: `Ambiente local (${LOCAL_MACHINE})`,
    color: "#a1a1aa", // muted gray
  }
}

async function oc(args: string[], timeout = 60_000): Promise<string> {
  try {
    const { stdout, stderr } = await run(OC, args, { timeout, maxBuffer: 1_048_576 })
    return (stdout || "").trim() || (stderr || "").trim()
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    const out = [err.stdout, err.stderr].filter(Boolean).join("\n").trim()
    return out || (err.message ?? String(e))
  }
}

async function pickHost(ctx: any): Promise<string | undefined> {
  const list = getHosts()
  if (list.length === 0) {
    await ctx.ui?.dialog?.alert?.({
      title: "Servidor remoto",
      message: "Nenhum host configurado.\n\nCrie ~/.config/opencode/remote/<host>.env ou execute 'oc-remote init <host>' no terminal.",
    })
    return undefined
  }
  if (list.length === 1) return list[0].id
  const sel = await ctx.ui?.dialog?.select?.({
    title: "Servidor remoto",
    options: list.map((h: Host) => ({
      title: h.id,
      value: h.id,
      description: `~/.config/opencode/remote/${h.id}.env`,
    })),
  })
  return sel ?? undefined
}

async function pickAction(ctx: any, host: string): Promise<string | undefined> {
  const sel = await ctx.ui?.dialog?.select?.({
    title: `Servidor remoto: ${host}`,
    options: [
      { title: "🔍 Status / diagnóstico", value: "status", description: "SSH, serviço, túnel e autenticação" },
      { title: "💻 Montar Local (SSHFS)", value: "local", description: "Abre o OpenCode local montando o servidor" },
      { title: "🌐 Abrir Web UI", value: "web", description: "Abre a Web UI no browser via túnel" },
      { title: "🔗 Copiar link de acesso", value: "link", description: "Mostra o link /connect#… para colar" },
      { title: "⬆ Subir serviço + túnel", value: "up", description: "Sobe o opencode remoto e o túnel SSH" },
      { title: "⬇ Derrubar túnel", value: "down", description: "Encerra o túnel SSH" },
      { title: "⏹ Desmontar SSHFS", value: "unmount", description: "Desmonta a pasta SSHFS" },
      { title: "📋 Ver comando de conexão", value: "connect", description: "Comando para abrir o TUI neste server" },
    ],
  })
  return sel ?? undefined
}

export default Plugin.define({
  id: "opencode.remote",
  setup(context: any) {
    const dir = context.location?.directory || process.cwd()
    const env = detectEnvironment(dir)
    const shortDir = dir.replace(homedir(), "~")

    // 1. Atualizar o título da janela/aba do terminal (OSC 0 ANSI)
    try {
      if (process.stdout && process.stdout.isTTY) {
        const termTitle = `${env.label} | OpenCode (${shortDir})`
        process.stdout.write(`\x1b]0;${termTitle}\x07`)
      }
    } catch {}

    // 2. Toast informativo na inicialização (apenas quando conectado remotamente)
    if (env.isRemote && context.ui?.toast?.show) {
      try {
        context.ui.toast.show({
          title: `${env.label} CONECTADO`,
          message: `${env.detail}\n📂 ${shortDir}`,
          variant: "info",
          duration: 6000,
        })
      } catch {}
    }

    // 3. Indicador persistente no Prompt Footer (barra de status inferior)
    if (context.ui?.slot) {
      try {
        context.ui.slot({
          append: "prompt.footer.status",
          render: () => (
            <text fg={env.color}>
              {env.label}
            </text>
          ),
        })
      } catch {}
    }

    // 4. Comando de barra /remote e atalho na command palette
    if (context.keymap?.layer) {
      try {
        context.keymap.layer(() => ({
          mode: "global",
          priority: 50,
          commands: [
            {
              id: "remote.manage",
              title: `Servidores Remotos (${env.label})`,
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
      } catch {}
    }

    async function handle(raw: string) {
      const parts = raw.trim().split(/\s+/).filter(Boolean)
      let action: string | undefined
      let host: string | undefined

      if (parts.length === 0) {
        host = await pickHost(context)
        if (!host) return
        action = await pickAction(context, host)
        if (!action) return
      } else if (parts.length === 1) {
        const list = getHosts()
        const isHost = list.some((h) => h.id === parts[0])
        if (isHost) {
          host = parts[0]
          action = await pickAction(context, host)
          if (!action) return
        } else {
          action = parts[0]
          host = await pickHost(context)
          if (!host) return
        }
      } else {
        action = parts[0]
        host = parts[1]
      }

      if (!action || !host) return

      try {
        await context.ui?.toast?.show?.({
          message: `oc-remote ${action} ${host}…`,
          variant: "info",
          duration: 30_000,
        })
      } catch {}

      const out = await dispatch(action, host)
      if (out) {
        await context.ui?.dialog?.alert?.({
          title: `oc-remote ${action}`,
          message: out,
        })
      }
    }

    async function dispatch(action: string, host: string): Promise<string | undefined> {
      try {
        switch (action) {
          case "status": return await oc(["status", host])
          case "up":     return await oc(["up", host])
          case "down":   return await oc(["down", host])
          case "web":    return await oc(["web", host])
          case "unmount": return await oc(["unmount", host])
          case "link": {
            const link = await oc(["link", host])
            return link ? `Copie e cole no navegador:\n\n${link}` : "Sem link disponível"
          }
          case "local":
          case "mount":
            return [
              `Para abrir o OpenCode LOCAL montando o diretório remoto:`,
              `  oc-remote local ${host}`,
              ``,
              `Ou com diretório específico:`,
              `  oc-remote local ${host} ~/projetos`,
            ].join("\n")
          case "connect":
            return [
              `Ambiente atual: ${env.detail}`,
              `Diretório: ${shortDir}`,
              ``,
              `Para abrir um novo terminal neste servidor:`,
              `  oc-remote ${host}`,
            ].join("\n")
          default: return undefined
        }
      } catch (e) {
        return String(e)
      }
    }

    return () => {}
  },
})
