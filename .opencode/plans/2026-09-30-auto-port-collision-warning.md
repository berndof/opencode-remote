---
status: completed
session: ses_f0bc76bbaffe0VMnYyzzj2sL4W
title: "Auto-alocação de portas locais com Warning para Conexões Múltiplas"
updated: 2026-09-30
---

# Plano: Detecção e Auto-alocação de Portas Locais com Aviso

## 1. Contexto & Diagnóstico
Atualmente, o `opencode-remote` utiliza por padrão a porta local `4096` para o túnel SSH (`localhost:4096 -> remote:4096`).
Quando um usuário abre uma segunda conexão simultânea para outro host sem especificar `--port`, o túnel SSH falha ou colide na porta `4096`, resultando em falso positivo de daemon inativo, reinicialização desnecessária do daemon remoto e falha de autenticação do cliente OpenCode.

## 2. Solução Proposta
1. **Detecção de Conflito de Porta Local (`is_local_port_in_use`)**:
   - Implementar verificação de disponibilidade de porta local via socket TCP (`socket.bind`).
   - Verificar se a porta já pertence a um túnel ativo e saudável para o *mesmo* host (reutilização) ou a *outro* host/processo.

2. **Auto-alocação com Emissão de Warning (`find_available_local_port`)**:
   - Se a porta padrão (ou configurada) estiver ocupada por outra sessão/processo e o usuário não passou `--port` explicitamente:
     - Encontrar automaticamente a próxima porta local disponível (ex: 4097, 4098, ...).
     - Emitir um aviso visual (`[Warning] Porta local 4096 ocupada...`).
     - Configurar o túnel local apontando para a porta remota (`localhost:<nova_porta> -> remote:<remote_port>`).
   - Se o usuário especificou `--port` explicitamente e houver colisão com outro processo, emitir aviso/erro claro.

3. **Compatibilidade e Metadados**:
   - Persistir `local_port` e `remote_port` em `~/.opencode-remote/tunnels/<host>.json`.
   - Garantir que `cmd_connect`, `cmd_tunnel`, `cmd_status` e `cmd_stop` suportem portas locais e remotas desacopladas.
   - Garantir fechamento correto do túnel local específico ao encerrar a sessão.

## 3. Checklist de Execução
- [x] Implementar utilitários de checagem e busca de portas locais (`is_local_port_in_use`, `find_available_local_port`) em `bin/opencode-remote`.
- [x] Atualizar `cmd_connect` para resolver colisões de porta local automaticamente e emitir warning informativo.
- [x] Atualizar `cmd_tunnel` para suportar fallback automático de porta local com warning.
- [x] Ajustar `cmd_status` e `cmd_stop` para refletir portas locais dinâmicas.
- [x] Testar cenários de concorrência com portas simuladas em uso.
