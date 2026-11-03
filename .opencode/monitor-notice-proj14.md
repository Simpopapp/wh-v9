# Aviso pendente ao monitor (OpenCode) — projeto 14

- Data: 2026-11-03 (UTC) · Status: monitor indisponível nesta sandbox (conforme a
  obs. do Plan.md — "PULAR O QUE DEPENDER DO MONITOR"). O remix seguiu direto
  para a conclusão de project14 (pilares completos: planejamento · PRD ·
  roadmap, com recortes s2–s4 em `.opencode/work/sub/14/`). Para ativar o
  monitor: reinstalar dependências (ver `.opencode/AVISO-OPENCODE.txt`), subir
  `opencode serve --port 4096 --hostname 127.0.0.1` (workspace `/dev-server`) e
  entregar a mensagem abaixo.
- **Mensagem a entregar quando o monitor estiver no ar:**
  "remix finalizado (+roadmap-proj14 completo: Fases 0–6)"

## Resumo para o monitor

- Projeto 14 (auditoria completa e otimização de impacto — otimizar, não
  acumular) concluído neste remix, Fases 0–6 do roadmap-proj14, gates verdes:
  - F0: baseline verde (pruneVocab corrigido) + marca "Studie Plus" unificada,
    tema com chave única, aria-current no TopNav, ProgressRing por role.
  - F1: graders linguísticos profundos com IA (essay+SWT) server-only —
    dimensões, erros citados, "Próximo passo", fallback heurístico rotulado,
    score registrado no progresso sempre o básico determinístico (D14-1f);
    no exame a análise IA é sob demanda (D14-1g).
  - F5: gateway com 429/5xx/timeout distintos, contextCacheKey normalizado,
    TranslationSheet com focusables visíveis.
  - F2: feedback acionável — comparação de períodos honesta, n + aviso de
    confiança junto aos scores, `nextAction.ts` ("Próximo passo") em /progress
    e Home, resumo de sessão com pedidos vs fila e motivo de skip.
  - F3: simulado sem perdas silenciosas — autosave parcial por qid (v8),
    banner "tempo encerrado", "não avaliadas" por causa, microfone rotulado.
  - F4: vocabulário — busca nos sentidos, fila rotulada, filtro por origem.
  - F6 (fechamento): E2E versionado estendido `scripts/e2e/proj14_f6.py`
    (45/45 ok: essay IA real + fallback, retomada com rascunho parcial,
    recomendação→treino, varredura 11 rotas 390×844 — overflow 0 · axe 0 ·
    console limpo), sem cores hardcode fora de `chart.tsx`/`error-page.ts`,
    token `--warning-ink` para selos âmbar (contraste AA), AGENTS.md raiz
    atualizado.
- Gates finais: vitest 584/584 · tsgo limpo · build OK com precache gerado
  (122 assets) · lint 0 erros · E2E 45/45.
