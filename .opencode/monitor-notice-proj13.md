# Aviso pendente ao monitor (OpenCode) — projeto 13

- Data: 2026-11-03 (UTC) · Status: monitor indisponível nesta sandbox (conforme a
  obs. do Plan.md — "PULAR O QUE DEPENDER DO MONITOR"). O remix seguiu direto
  para a execução de project13 (pilares completos: planejamento · PRD · roadmap,
  com recortes s1–s7 em `.opencode/work/sub/13/`). Para ativar o monitor:
  reinstalar dependências (ver `.opencode/AVISO-OPENCODE.txt`), subir
  `opencode serve --port 4096 --hostname 127.0.0.1` (workspace `/dev-server`) e
  entregar a mensagem abaixo.
- **Mensagem a entregar quando o monitor estiver no ar:**
  "remix finalizado (+roadmap-proj13 completo: Fases 0–6)"

## Resumo para o monitor

- Projeto 13 (integridade de dados, confiança da avaliação e entrada intencional)
  concluído neste remix, Fases 0–6 do roadmap-proj13, todos os gates verdes:
  - Fase 0: fundação de integridade — merge de backup idempotente (`Attempt.id`
    determinístico + dedupe/snapshots reconciliados por evidência), import/undo
    honesto, TranslationSheet v2 (trap de foco), atalhos que respeitam modal,
    `lang="pt-BR"`, skip link + foco pós-navegação, IA com caps/rate limit/timeout
    e cache IA v2 (consultado antes da checagem de disponibilidade).
  - Fase 1: simulado confiável — `examDraft` retomável, erro recuperável, timer
    por deadline absoluto, política oral unificada (`oralPolicy.ts`), "não
    avaliadas" no resumo, revisão pós-exame acionável.
  - Fase 2: sessões executam o plano — cotas por IDs, qid validado, pular/
    reagendar, duração estimada == fila, conclusão acionável.
  - Fase 3: vocabulário diário — filtros/limite, reaprendizado na sessão,
    favoritos protegidos, sentidos acumulados, draft leve de retomada.
  - Fase 4: entrada intencional (S4–S10) — /practice com hub próprio, Home de
    retorno, sessão com recomendação única, simulado com pré-início, progresso
    organizado, ajustes com categorias + tema Claro/Escuro/Sistema pré-pintura,
    navegação com labels/chrome "em tarefa"/microinterações.
  - Fase 5: offline real e performance — precache GERADO PELO BUILD
    (`scripts/gen-sw-assets.mjs` → `dist/client/sw-assets.json`, 119 assets,
    41 chunks de motores), sw.js v5 com instalação exigindo shell completo e
    retenção por versão, `rel="manifest"`, `downloadForOffline` valida
    `response.ok` e inclui /vocabulary, painel offline honesto por recurso,
    lazy do ExamRunner, seletores finos do store, Progresso em 1 passada,
    paginação do vocabulário (300 + "Mostrar mais").
  - Fase 6 (fechamento): varredura de consistência (sem cores hardcode fora de
    `chart.tsx` utilitário), honestidade rotulada confirmada nos painéis, E2E
    versionado dos fluxos críticos (`scripts/e2e/fluxos_criticos.py`, 16/16 ok —
    prática→tradução com IA real→vocabulário→sessão; simulado retomado após
    reload; merge do MESMO backup 2× estável), correção de hidratação em
    /settings (hasUndoBackup lido pós-mount), AGENTS.md da raiz atualizado.
- Gates finais: vitest 546/546 · tsgo limpo · build OK com precache gerado ·
  lint 0 erros (11 warnings preexistentes) · Playwright varredura 390×844 nas
  11 rotas: overflow 0 · axe 0 · console limpo.
- **Pendências herdadas / só conclusivas no build publicado:**
  - Teste de SW/offline de ponta a ponta (cold start sem rede, instalação do
    precache, retenção de cache) só é conclusivo após PUBLICAR — no dev o
    registro do SW é ignorado por design.
  - FIB drag-and-drop e graders linguísticos profundos (essay/gramática)
    ficaram para o ciclo seguinte (PRD D14).
  - `useOfflineStatus` inicializa `supported` via efeito; se um dia o painel
    offline migrar para SSR-data, revisar a pré-pintura do estado.
