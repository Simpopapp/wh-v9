# Roadmap — Project 14 (auditoria e otimização de impacto)

Dependência: F0 → F1/F5 podem correr em ondas paralelas; F2/F3/F4 independentes
entre si (após F0); F6 fecha. Execução: gates da seção 19 do Plan.md por fase.

## Fase 0 · Baseline verde + coerência transversal
- [x] D14-0a Corrigir teste pruneVocab (causa real, não mascarar) — vitest 546/546
- [x] D14-0b Marca "Studie Plus" unificada (head/og/manifest/meta) — build OK
- [x] D14-0c Tema: chave única real + fallback matchMedia — tsgo limpo
- [x] D14-0d aria-current no TopNav + aria-label nos atalhos mobile — axe 0
- [x] D14-0e ProgressRing respeita role do consumidor — vitest
- Gates: vitest 546/546 · tsgo · build · lint 0 · axe 0 rotas tocadas

## Fase 1 · Graders linguísticos profundos com IA (server-only)
- [x] D14-1a gradeLanguageResponse (essay+SWT) com Zod/caps/rate-limit/timeout/cache
- [x] D14-1b Dimensões + erros citados + ação; fallback heurístico rotulado
- [x] D14-1c ScorePanel/revisão com fonte da nota (IA vs básica); speaking rotulado
- [x] D14-1d Fonte do score no Attempt; merge idempotente preservado
- [x] D14-1e Paridade prática/exame dos graders e rótulos
- Gates: vitest (contrato+fallback+cache+caps) · tsgo · build · E2E essay c/ IA real

## Fase 5 · Infra IA + acessibilidade (paralelizável com F1)
- [x] D14-5a Gateway: 429/5xx/timeout distintos; retry com folga
- [x] D14-5b contextCacheKey normalizado; falha de saveAiCache observável
- [x] D14-5c TranslationSheet: focusables visíveis; inert preservado
- Gates: vitest · tsgo · build · axe 0

## Fase 2 · Feedback acionável (progresso/sessão/score)
- [x] D14-2a Comparação de períodos honesta (sem futuro, n>=3) — progress-analytics.test.ts
- [x] D14-2b n + aviso de confiança junto a cada score — readiness "poucos dados", byType "Tentadas", tópicos "N questões · amostra pequena"
- [x] D14-2c nextAction.ts + recomendação em /progress e Home — Home: cartão "Próximo passo" quando o plano do dia está vazio (D14-2h); proj14-fase2.test.ts
- [x] D14-2d Resumo: pedidos vs fila; motivo de skip; retomada de pulados — session.ts skipReasons + session.tsx resumo
- [x] D14-2e QuestionRow cor/estado do mesmo critério — statusOf() puro testado
- [x] D14-2f ScorePanel com próxima ação — "Próximo passo" (speechNextStep)
- Gates: vitest 573/573 · tsgo OK · build OK · lint 0 · E2E recomendação→treino (/progress e Home → /practice?q=fraca, Playwright)

## Fase 3 · Simulado sem perdas silenciosas
- [x] D14-3a Autosave parcial por qid (migração v8) + restauração nos widgets (texto/FIB/HIW/múltipla/ordem/dropdown; fala fora por D14-3f) — proj14-fase3.test.ts
- [x] D14-3b Estado "tempo encerrado" explícito — banner dedicado antes do autoenvio
- [x] D14-3c Não avaliadas por causa — breakdown no resumo (proj14-fase3.test.ts)
- [x] D14-3d Rótulo honesto do teste de microfone — /exam confirma acesso, não ASR
- [x] D14-3e Revisão com resposta/referência coerentes — todas as linhas com causa aparecem ("—" quando sem texto)
- Gates: vitest 584/584 · tsgo OK · build OK · lint 0 · E2E: retomada restaura rascunho + prazo vencido autoenvia com causa "Tempo esgotado" (Playwright); D14-3f: restauração de fala deliberadamente fora (gravação não é retomável)

## Fase 4 · Vocabulário coerente
- [x] D14-4a Busca cobre sentidos acumulados — vocab.ts (search inclui senses)
- [x] D14-4b Fila limitada rotula vencidos incluídos — vocabStudyIncludedDue + rótulo na revisão
- [x] D14-4c Filtro de seção por origem persistida — originType nos words
- Gates: vitest 584/584 · tsgo OK · build OK · lint 0 (importo do helper corrigido para @/lib/plus/vocab)

## Fase 6 · Fechamento AAA
- [x] D14-6a E2E estendido (essay IA, retomada parcial, recomendação→treino) — `scripts/e2e/proj14_f6.py`, 45/45 ok
- [x] D14-6b Varredura de consistência final (11 rotas, rótulos honestos) — 390×844 overflow 0 · axe 0 · console limpo; token `--warning-ink` (D14-6e)
- [x] D14-6c Gates completos (vitest 100% · tsgo · build · lint 0) — vitest 584/584 · build com precache 122 assets
- [x] D14-6d AGENTS.md + aviso ao monitor quando disponível — AGENTS.md raiz atualizado; `.opencode/monitor-notice-proj14.md` pendente (monitor indisponível)
- Gates: todos os anteriores + varredura final verde — E2E 45/45 · vitest 584/584 · tsgo · lint 0 · build OK
