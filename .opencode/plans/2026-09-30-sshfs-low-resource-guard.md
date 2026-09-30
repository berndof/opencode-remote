---
status: completed
session: ses_f0bc76bbaffe0VMnYyzzj2sL4W
title: "Garantir Baixo Uso de Recursos do Servidor em Modo SSHFS (Low-Resource Guard)"
updated: 2026-09-30
---

# Plano: Otimização de Baixo Uso de Recursos Remotos em Modo SSHFS (Low-Resource Guard)

## Objetivo
Garantir que, ao conectar via SSHFS (seja no fallback automático ou via `--sshfs`), o `opencode-remote` minimize ao máximo o consumo de **CPU**, **RAM**, **I/O de Disco** e **banda de rede** no servidor remoto (especialmente crítico em ambientes de produção como `portal-prod`).

---

## Análise de Gargalos & Otimizações

1. **Escrita Inútil em Disco Remoto (`noatime` / `no_rofd_flush`):**
   - **Problema:** Cada leitura/listagem de arquivos atualiza o `atime` no filesystem do servidor, gerando escritas desnecessárias no disco remoto.
   - **Solução:** Ativar `no_rofd_flush` e garantir flags de cache que impeçam escritas de metadados em leituras.

2. **Sobrecarga de CPU no Servidor (Ciphers & Compressão):**
   - **Problema:** Compressão SSH (`gzip`) gera picos de CPU no servidor ao transferir múltiplos arquivos. Ciphers legados pesam em CPUs virtuais.
   - **Solução:** `compression=no` e priorização de ciphers ultra-leves acelerados por hardware (`chacha20-poly1305@openssh.com,aes128-gcm@openssh.com`).

3. **Tempestade de Requisições SFTP (`stat()`, `readdir()`, `getattr()`):**
   - **Problema:** Ferramentas de busca/linguagem locais (LSPs, linters, git) disparam milhares de chamadas `stat` repetitivas sobre o canal SFTP.
   - **Solução:** 
     - Ativar `kernel_cache`, `auto_cache`, `dir_cache=yes`.
     - Configurar `dcache_timeout=120`, `dcache_stat_timeout=120`, `dcache_dir_timeout=120`.
     - `entry_timeout=120`, `attr_timeout=120`, `negative_timeout=30` (elimina consultas repetidas para arquivos inexistentes).
     - `dcache_max_size=20000` (mantém metadados em cache na RAM da máquina local).

4. **Isolamento de Processos Remotos (Zero Daemon Overhead):**
   - No modo SSHFS, **nenhum daemon ou processo OpenCode/Node/Python roda no servidor remoto** — apenas a thread padrão e segura do subsistema `sftp-server` do OpenSSH.
   - Todo processamento pesado de IA, indexação local e execução de plugins ocorre 100% na máquina local.

5. **Exibições & Alertas Claros ao Usuário:**
   - Exibir badge indicativo: `🛡️ [Low-Resource Mode Active]` informando que as otimizações de proteção ao servidor remoto estão ativas.

---

## Checklist de Implementação

- [x] Atualizar `mount_sshfs_target` em [`bin/opencode-remote`](file:///home/bernardo/Workspace/opencode-remote/bin/opencode-remote) com as flags otimizadas de baixo consumo de recursos remotos.
- [x] Adicionar suporte a customização de opções de montagem via config do host (`sshfs_opts`).
- [x] Adicionar mensagem/banner informativo no log destacando o modo seguro de baixo impacto.
- [x] Testar montagem e comportamento com `opencode-remote connect portal-prod` / `ocd connect portal-prod`.
- [x] Executar `./install.sh` para sincronizar os binários locais (`~/.local/bin/ocd` e `~/.local/bin/opencode-remote`).
- [x] Fazer commit e push no repositório Git.

