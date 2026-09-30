---
status: completed
session: ses_f0bc76bbaffe0VMnYyzzj2sL4W
title: "Implementar SSHFS Fallback com Warning e Auto-Provisioning no opencode-remote connect"
updated: 2026-09-30
---

# Plano de Implementação: SSHFS Fallback e Auto-Provisioning no `connect`

## Contexto e Objetivo
Quando o usuário tenta conectar a um host remoto sem o OpenCode instalado (`ERR:NO_BINARY`), o comportamento padrão atual é falhar a inicialização.
O novo comportamento desejado:
1. **Fallback padrão para SSHFS com Warning:**
   - Se o binário `opencode` não existir no host remoto (e não for passada a flag `--provision`), avisar o usuário com warning:
     `⚠️  [Warning] OpenCode não instalado em '<host>'. Usando fallback para montagem local via SSHFS.`
   - Montar o diretório remoto (especificado via `--dir`, `--sshfs`, config `.env` ou diretório home remoto padrão) em `~/.cache/opencode-remote/mounts/<host>/<dir_name>`.
   - Abrir o cliente local `opencode` diretamente apontando para esse diretório montado localmente.
2. **Flag `--sshfs` / `--mount` explícita no `connect`:**
   - Permitir forçar o modo SSHFS diretamente (`ocd connect <host> --sshfs [remote_dir]`).
3. **Flag `--provision` / Auto-Provisioning:**
   - Se passado `--provision` (ou se solicitado), executar o fluxo de provisionamento do OpenCode remoto, sincronizar extensões/plugins/configurações e em seguida iniciar o daemon remoto normalmente.

---

## Checklist de Tarefas

- [x] **1. Função Auxiliar de Provisionamento + Sync de Plugins/Configs (`provision_remote_host`):**
  - Implementar instalação do binário remoto (`opencode`).
  - Sincronizar configurações locais (`~/.config/opencode/` - plugins/skills) para o host remoto se existirem.
  - Retornar status de sucesso/falha de forma modular para ser reutilizado tanto pelo `cmd_provision` quanto pelo `cmd_connect --provision`.

- [x] **2. Função Auxiliar de Conexão Local via SSHFS (`connect_via_sshfs`):**
  - Checar e garantir instalação de `sshfs` local.
  - Resolver diretório remoto de trabalho (`--sshfs`, `--dir`, `remote_directory` da config ou home do usuário remoto).
  - Montar diretório usando a infraestrutura existente de `cmd_mount`.
  - Iniciar a instância local do `opencode <mountpoint>` mantendo o título do terminal como `opencode: <host> (sshfs)`.
  - Tratar desmontagem limpa ao sair da sessão (se não configurado para manter).

- [x] **3. Integração do Fluxo no `cmd_connect` e `cmd_serve`:**
  - Adicionar suporte aos argumentos `--sshfs` (com caminho opcional ou booleano), `--provision` e `--no-sshfs-fallback`.
  - Se `--sshfs` estiver presente: desviar imediatamente para `connect_via_sshfs`.
  - Na verificação de `opencode serve` remoto (etapa 2 do `connect`), se retornar `ERR:NO_BINARY`:
    - Se `--provision` estiver ativo: disparar provisionamento e tentar iniciar o `serve`.
    - Caso contrário (comportamento padrão): emitir **warning em destaque** e chavear automaticamente para `connect_via_sshfs`.

- [x] **4. Testes e Atualização do Binário Instalado:**
  - Executar testes de sintaxe e simulações com flags `--sshfs`, `--provision` e detecção de fallback.
  - Rodar `install.sh` para atualizar `~/.local/bin/opencode-remote` e `~/.local/bin/ocd`.

