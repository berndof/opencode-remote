import { execFile } from "node:child_process"
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { homedir, hostname } from "node:os"
import { promisify } from "node:util"

const run = promisify(execFile)

const OC = existsSync(`${homedir()}/.local/bin/opencode-remote`)
  ? `${homedir()}/.local/bin/opencode-remote`
  : existsSync(`${homedir()}/.local/bin/oc-remote`)
  ? `${homedir()}/.local/bin/oc-remote`
  : "opencode-remote"

const REMOTE_DIR = `${homedir()}/.config/opencode/remote`
const CONFIG_FILE = `${homedir()}/.config/opencode/remote.json`
const MOUNT_BASE_DIRS = [
  `${homedir()}/.cache/oc-remote/mounts`,
  `${homedir()}/.cache/opencode-remote/mounts`,
]
const LOCAL_MACHINE = hostname()

type Host = { id: string }

type EnvInfo = {
  isRemote: boolean
  label: string
  detail: string
  color: string
}

type RemotePluginConfig = {
  footer: "always" | "remote-only"
}

function loadConfig(): RemotePluginConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = JSON.parse(readFileSync(CONFIG_FILE, "utf8"))
      return {
        footer: data.footer === "remote-only" ? "remote-only" : "always",
      }
    }
  } catch {}
  return { footer: "always" }
}

function saveConfig(config: RemotePluginConfig) {
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8")
  } catch {}
}

function getHosts(): Host[] {
  const hosts = new Set<string>()
  try {
    if (existsSync(REMOTE_DIR)) {
      readdirSync(REMOTE_DIR)
        .filter((f) => f.endsWith(".env") && f !== "example.env")
        .forEach((f) => hosts.add(f.slice(0, -4)))
    }
  } catch {}

  try {
    const sshConfig = `${homedir()}/.ssh/config`
    if (existsSync(sshConfig)) {
      const lines = readFileSync(sshConfig, "utf8").split("\n")
      for (const line of lines) {
        const match = line.trim().match(/^Host\s+([^*?!\s]+)$/i)
        if (match && match[1] && match[1] !== "github.com") {
          hosts.add(match[1])
        }
      }
    }
  } catch {}

  return Array.from(hosts)
    .map((id) => ({ id }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function detectEnvironment(dir: string): EnvInfo {
  // 1. Explicit env var from remote launcher
  if (process.env.OPENCODE_REMOTE_HOST) {
    const h = process.env.OPENCODE_REMOTE_HOST
    const p = process.env.OPENCODE_REMOTE_PORT || "4096"
    return {
      isRemote: true,
      label: `🌐 ${h}`,
      detail: `Servidor remoto: ${h} (porta ${p})`,
      color: "#38bdf8",
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
          for (const f of readdirSync(REMOTE_DIR)) {
            if (f.endsWith(".env") && f !== "example.env") {
              const content = readFileSync(`${REMOTE_DIR}/${f}`, "utf8")
              if (
                port &&
                (content.includes(`LOCAL_PORT=${port}`) ||
                  content.includes(`REMOTE_PORT=${port}`))
              ) {
                const hostId = f.replace(".env", "")
                return {
                  isRemote: true,
                  label: `🌐 ${hostId}`,
                  detail: `Servidor remoto: ${hostId} (${srvUrl})`,
                  color: "#38bdf8",
                }
              }
            }
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
  for (const baseDir of MOUNT_BASE_DIRS) {
    if (dir.startsWith(baseDir)) {
      const sub = dir.slice(baseDir.length + 1).split("/")[0]
      const hostName = sub || "remoto"
      return {
        isRemote: false,
        label: `💻 local [SSHFS: ${hostName}]`,
        detail: `OpenCode Local montado via SSHFS no servidor ${hostName}`,
        color: "#34d399",
      }
    }
  }

  // 4. Direct SSH session on remote machine
  if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT) {
    return {
      isRemote: true,
      label: `🌐 ${LOCAL_MACHINE} (ssh)`,
      detail: `Sessão SSH direta na máquina ${LOCAL_MACHINE}`,
      color: "#f59e0b",
    }
  }

  // 5. Default: local workstation
  return {
    isRemote: false,
    label: `💻 local`,
    detail: `Ambiente local (${LOCAL_MACHINE})`,
    color: "#a1a1aa",
  }
}

async function oc(args: string[], timeout = 120_000): Promise<string> {
  try {
    const { stdout, stderr } = await run(OC, args, {
      timeout,
      maxBuffer: 1_048_576,
    })
    return (stdout || "").trim() || (stderr || "").trim()
  } catch (e: any) {
    const out = [e.stdout, e.stderr].filter(Boolean).join("\n").trim()
    return out || e.message || String(e)
  }
}

/**
 * OpenCode V2 TUI plugin contract:
 *   export default { id: string, setup: (context) => Promise<void> }
 * The host validates `id` + `setup` (V2 validator rejects a `tui:` export).
 */
let layerOn = false

export default {
  id: "opencode.remote",
  setup: async (api: any) => {
    const config = loadConfig()
    const dir =
      api?.location?.directory ||
      api?.state?.path?.directory ||
      api?.state?.path?.worktree ||
      process.cwd()
    const env = detectEnvironment(dir)
    const shortDir = dir.replace(homedir(), "~")

    const showToast = (opts: {
      title?: string
      message: string
      variant?: "info" | "warning" | "error" | "success"
      duration?: number
    }) => {
      try {
        if (typeof api?.ui?.toast?.show === "function") {
          api.ui.toast.show(opts)
        } else if (typeof api?.ui?.toast === "function") {
          api.ui.toast(opts)
        }
      } catch {}
    }

    const showAlert = async (title: string, message: string) => {
      try {
        if (api?.ui?.dialog?.alert) {
          await api.ui.dialog.alert({ title, message })
          return
        }
      } catch {}
      showToast({ title, message: message.slice(0, 300), variant: "info", duration: 10000 })
    }

    type Choice = { title: string; value: string; description?: string }

    const selectFrom = async (title: string, choices: Choice[]): Promise<string | undefined> => {
      try {
        if (api?.ui?.dialog?.select) {
          return await api.ui.dialog.select({ title, options: choices })
        }
      } catch {}
      // No dialog API available: fall back to the first choice.
      return choices[0]?.value
    }

    const promptFrom = async (title: string, placeholder?: string): Promise<string | undefined> => {
      try {
        if (api?.ui?.dialog?.prompt) {
          return await api.ui.dialog.prompt({ title, placeholder })
        }
      } catch {}
      return undefined
    }

    // 1. Terminal window title (OSC 0)
    try {
      if (process.stdout && process.stdout.isTTY) {
        const termTitle = `${env.label} | OpenCode (${shortDir})`
        process.stdout.write(`\x1b]0;${termTitle}\x07`)
      }
    } catch {}

    // 2. Startup toast
    showToast({
      title: env.isRemote ? `${env.label} CONECTADO` : `OpenCode: ${env.label}`,
      message: `${env.detail}\n📂 ${shortDir}`,
      variant: "info",
      duration: env.isRemote ? 6000 : 3000,
    })

    const dispatch = async (action: string, host: string): Promise<string | undefined> => {
      try {
        switch (action) {
          case "status":
            return await oc(["status", host])
          case "serve":
          case "up": {
            // Bring the remote daemon up and open the local tunnel in one step.
            const served = await oc(["serve", host])
            const tunneled = await oc(["tunnel", host])
            return `${served}\n\n${tunneled}`
          }
          case "tunnel":
            return await oc(["tunnel", host])
          case "stop":
          case "down":
            return await oc(["stop", host])
          case "sync": {
            const remoteDir = await promptFrom(
              `rsync: diretório remoto de destino (${host})`,
              "/var/www/app"
            )
            if (!remoteDir) return "Sync cancelado: nenhum diretório remoto informado."
            return await oc(["sync", host, dir, remoteDir])
          }
          case "mount": {
            const remoteDir = await promptFrom(
              `SSHFS: qual diretório no servidor montar via sshfs? (${host})`,
              "/var/www/app"
            )
            if (!remoteDir) return "Montagem cancelada: diretório remoto não informado."
            return await oc(["mount", host, remoteDir])
          }
          case "unmount":
            return await oc(["unmount", host])
          case "list":
            return await oc(["list"])
          case "provision":
            return await oc(["provision", host])
          case "connect":
            return [
              `Host: ${host}`,
              `Diretório local: ${shortDir}`,
              ``,
              `🚀 Para abrir o OpenCode conectado a este host em 1 único comando:`,
              `   ocd connect ${host}`,
              `   (ou: opencode-remote connect ${host})`,
              ``,
              `O comando unificado automaticamente:`,
              `  1. Inicia o 'opencode serve' no servidor remoto`,
              `  2. Abre e valida o túnel SSH local`,
              `  3. Detecta a senha e autentica o cliente`,
              `  4. Abre o OpenCode TUI já conectado!`,
              ``,
              `Verificação: ocd status ${host}`,
              `Encerrar:    ocd stop ${host}`,
            ].join("\n")
          default:
            return await oc([action, host])
        }
      } catch (e) {
        return String(e)
      }
    }

    const executeAction = async (action: string, host: string) => {
      showToast({
        title: `opencode-remote ${action}`,
        message: `Executando ${action} para ${host}…`,
        variant: "info",
        duration: 8000,
      })

      const out = await dispatch(action, host)
      if (out) {
        await showAlert(`opencode-remote ${action} (${host})`, out)
      }
    }

    const promptConfigFooter = async () => {
      const current = config.footer === "always" ? "Sempre visível" : "Apenas quando remoto"
      const choice = await selectFrom(`Status do footer (atual: ${current})`, [
        {
          title: "Mostrar sempre (always)",
          value: "always",
          description: "🌐 host quando remoto, 💻 local no desktop",
        },
        {
          title: "Apenas quando remoto (remote-only)",
          value: "remote-only",
          description: "Oculta o indicador quando você está na máquina local",
        },
      ])
      if (!choice) return
      config.footer = choice as "always" | "remote-only"
      if (typeof api.kv?.set === "function") {
        api.kv.set("remote.footer", choice)
      }
      saveConfig(config)
      showToast({
        title: "Configuração salva",
        message: `Exibição no footer: ${config.footer}`,
        variant: "success",
        duration: 4000,
      })
    }

    const promptAction = async (host: string) => {
      const choice = await selectFrom(`Servidor remoto: ${host}`, [
        {
          title: "🔍 Status / diagnóstico",
          value: "status",
          description: "SSH, serviço remoto, túnel local e porta",
        },
        {
          title: "⬆ Subir serviço + túnel (serve)",
          value: "serve",
          description: "Sobe `opencode serve` no host e abre o túnel SSH",
        },
        {
          title: "🚇 Abrir túnel SSH (tunnel)",
          value: "tunnel",
          description: "Apenas o túnel de porta (serviço já precisa estar no ar)",
        },
        {
          title: "📁 Montar pasta do servidor aqui (SSHFS)",
          value: "mount",
          description: "Mágica: Use o servidor remoto editando arquivos localmente",
        },
        {
          title: "❌ Desmontar pasta (unmount)",
          value: "unmount",
          description: "Desmonta a conexão local SSHFS",
        },
        {
          title: "🔄 Sincronizar arquivos (sync)",
          value: "sync",
          description: "rsync do diretório atual para o host",
        },
        {
          title: "⬇ Parar serviço / túnel (stop)",
          value: "stop",
          description: "Encerra o túnel e o serviço nesta porta",
        },
        {
          title: "📋 Lista de hosts (list)",
          value: "list",
          description: "Connectividade de todos os hosts do ~/.ssh/config",
        },
        {
          title: "⚙️ Configurar exibição no footer",
          value: "config-footer",
          description: `Atual: ${config.footer === "always" ? "Sempre visível" : "Apenas quando remoto"}`,
        },
        {
          title: "⚡ Conectar em 1 comando (connect)",
          value: "connect",
          description: "Instruções do comando rápido unificado `ocd connect`",
        },
      ])

      if (!choice) return
      if (choice === "config-footer") {
        await promptConfigFooter()
        return
      }
      await executeAction(choice, host)
    }

    const openRemoteMenu = async () => {
      const hosts = getHosts()
      if (hosts.length === 0) {
        await showAlert(
          "Servidor Remoto",
          "Nenhum host configurado.\n\nAdicione hosts em ~/.ssh/config ou crie ~/.config/opencode/remote/<host>.env"
        )
        return
      }

      if (hosts.length === 1) {
        await promptAction(hosts[0].id)
        return
      }

      const host = await selectFrom("Selecionar Servidor Remoto", [
        ...hosts.map((h) => ({
          title: h.id,
          value: h.id,
          description: `Host remoto: ${h.id}`,
        })),
        {
          title: "⚙️ Configurar exibição no footer",
          value: "__config_footer__",
          description: `Atual: ${config.footer === "always" ? "Sempre visível" : "Apenas quando remoto"}`,
        },
      ])
      if (!host) return
      if (host === "__config_footer__") {
        await promptConfigFooter()
        return
      }
      await promptAction(host)
    }

    const handle = async (raw?: string) => {
      const parts = (raw ?? "").trim().split(/\s+/).filter(Boolean)
      if (parts.length === 0) {
        await openRemoteMenu()
        return
      }

      const first = parts[0]
      if (["config", "configure", "footer"].includes(first)) {
        await promptConfigFooter()
        return
      }

      if (
        ["status", "serve", "tunnel", "stop", "sync", "list", "provision", "connect", "up", "down"].includes(first)
      ) {
        if (parts.length > 1) {
          await executeAction(first, parts[1])
        } else {
          const hosts = getHosts()
          if (hosts.length === 1) {
            await executeAction(first, hosts[0].id)
          } else {
            await openRemoteMenu()
          }
        }
        return
      }

      // `/remote portal-dev` -> menu of actions for that host
      await promptAction(first)
    }

    // 3. Persistent indicator under the prompt (prompt.footer.status slot)
    let offFooter: (() => void) | undefined
    try {
      offFooter = api?.ui?.slot?.({
        append: "prompt.footer.status",
        render: () => {
          const currentFooter = typeof api.kv?.get === "function" ? api.kv.get("remote.footer", config.footer) : config.footer
          if (currentFooter === "remote-only" && !env.isRemote) {
            return null
          }
          return <text fg={env.color}>{env.label}</text>
        },
      })
    } catch (e) {
      showToast({
        title: "opencode.remote",
        message: `Falha ao registrar o indicador no footer: ${String(e)}`,
        variant: "warning",
        duration: 8000,
      })
    }

    // 4. Slash commands + command palette (keymap overlay mounted on the app slot)
    let offApp: (() => void) | undefined
    try {
      offApp = api?.ui?.slot?.({
        append: "app",
        render: () => {
          if (layerOn) return null
          layerOn = true
          api.keymap.layer(() => ({
            mode: "global",
            priority: 50,
            commands: [
              {
                id: "remote.manage",
                title: `Servidores Remotos (${env.label})`,
                group: "Remote",
                palette: true,
                suggested: true,
                enabled: () => true,
                slash: {
                  name: "remote",
                  aliases: ["rem", "remoto"],
                  arguments: true,
                },
                run: (input?: string) => {
                  handle(input)
                },
              },
            ],
            bindings: ["remote.manage"],
          }))
          return null
        },
      })
    } catch (e) {
      showToast({
        title: "opencode.remote",
        message: `Falha ao registrar /remote: ${String(e)}`,
        variant: "warning",
        duration: 8000,
      })
    }

    return () => {
      try {
        offApp?.()
      } catch {}
      try {
        offFooter?.()
      } catch {}
      layerOn = false
    }
  },
}

