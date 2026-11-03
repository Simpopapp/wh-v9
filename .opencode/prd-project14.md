# PRD — Project 14 · Auditoria completa e otimização de impacto (Studie Plus / PTE Master Hub)

Data: 2026-11-03 · Origem: diretriz do usuário registrada em `project14.md`
Auditoria: varredura em enxame (6 exploradores read-only) sobre as 11 rotas + lib,
gates (vitest 545/546, 1 falha pré-existente), varredura Playwright nas 11 rotas
(sem overflow, console limpo) e spot-checks manuais dos achados.

---

## 0. Sumário executivo

O app está sólido na fundação (projeto 13 fechou integridade, simulado retomável,
sessões que executam o plano, IA com caps). A auditoria mostra que o maior
desperdício de potencial está em **quatro eixos**:

1. **Credibilidade da avaliação** — SWT/essay/speaking são heurísticas que se
   apresentam como score. É o ponto fraco nº 1: a nota que o estudante vê não
   mede gramática, coerência ou conteúdo semântico. A diretriz de projeto 13
   (D14) já havia adiado graders linguísticos profundos para este ciclo.
2. **Feedback não acionável** — progresso, score e fila mostram números sem
   dizer "o que faço agora"; amostras pequenas aparecem com a mesma autoridade
   de amostras grandes; a comparação de períodos conta datas futuras.
3. **Perda silenciosa de trabalho no simulado** — a resposta parcial do widget
   em curso não sobrevive a um reload; o fim do tempo não é comunicado na hora;
   "não avaliadas" agrupa causas diferentes em uma linha.
4. **Coerência de identidade e de detalhes** — head/og/manifest dizem
   "PTE Master Hub" enquanto toda a UI diz "Studie Plus"; a chave de tema é
   duplicada como literal; `aria-current` existe na TabBar mas não nos links do
   topo; há 1 teste falhando (pruneVocab, timeout) já na baseline.

A estratégia é a da diretriz: **otimizar, não acumular**. Nenhum recurso novo
nasce sem motivo real; cada fase abaixo ataca uma fraqueza com evidência.

## 1. Diretriz e princípios de decisão

- **Auditar antes de construir** (feito — seção 2).
- **Otimização > adição**: melhoria só entra com impacto justificado na
  utilidade real do recurso.
- **Masterizar pontos fortes**: o que já funciona (motor de sessão, retomada,
  política oral unificada, TranslationSheet, cache IA v2, tokens do design
  system) recebe refinamento, nunca reescrita.
- **Offline em segundo plano**: zero recursos novos de modo offline; apenas
  regressão zero (não tocar sw.js/gen-sw-assets além do necessário).
- **Honestidade de rótulo é produto**: quando uma nota é proxy/heurística, isso
  é dito na tela; quando passa a ser avaliação linguística real (IA), a fonte é
  dita também.
- Dúvidas do enxame: decidir e registrar aqui (nunca perguntar ao usuário).

## 2. Evidência da auditoria (achados que ancoram as fases)

Formato: achado → evidência → impacto → fase.

### 2.1 Avaliação linguística (maior impacto)
- **A1.** Essay grader é estrutura superficial: faixa de palavras, nº de
  parágrafos, até 10 keywords do modelo por presença textual, conectores
  contados mas nem sequer somados ao score. Sem gramática, argumentação,
  coerência ou léxico em contexto. `src/lib/pte/essay.ts:49-91`.
- **A2.** SWT grader mede cobertura lexical de keywords, faixa de palavras e
  nº de frases; nada de gramática/coerência/relevância semântica.
  `src/lib/pte/summary.ts:84-161`.
- **A3.** Speaking alinha transcrição↔texto (determinístico, bem feito) mas o
  rótulo "fluência" é WPM/pausas; não há pronúncia/prosódia. Honestidade já
  existe parcialmente (`ScorePanel` ressalva otimismo). `src/lib/scoring.ts:213-259`.
- **A4.** Feedback discursivo não diz erro específico nem ação concreta
  (auditores 2 e 5 convergem). Impacto: estudante corrige às cegas. → F1/F2.

### 2.2 Feedback não acionável / amostras
- **A5.** Comparação de períodos inclui tentativas com datas futuras nas
  janelas; médias sem amostra comparável. `src/lib/progress-analytics.ts:24-39`.
- **A6.** Prontidão por seção admite baixa confiança <10 tentativas, mas o
  aviso não acompanha cada pontuação; diagnóstico por tópico tem `n` calculado
  (`progress-overview.ts:36-47`) e não é exibido. `src/routes/progress.tsx:171-180`.
- **A7.** Streak/tópicos/relatório aparecem sem ação de estudo correspondente;
  métrica sem "próximo passo". `src/routes/progress.tsx:410-746`.
- **A8.** Cota pedida vs fila efetiva do plano diário não é exposta; fallback
  `dueShort/freshShort` existe (`src/lib/session.ts:473-492`) mas o usuário não
  vê insuficiência por tipo. `src/routes/session.tsx:429-430`.
- **A9.** Motivo do skip não é persistido; pular o último item encerra a sessão
  sem contar o item no resumo. `src/lib/session.ts:535-555`.
- **A10.** `QuestionRow` classifica estado pelo melhor conteúdo mas pinta a cor
  pela última nota — sinais contraditórios possíveis. `src/components/QuestionRow.tsx:40-61`.
- **A11.** `ScorePanel` mostra fluência etc. sem uma próxima ação concreta.
  `src/components/ScorePanel.tsx:38-63`.

### 2.3 Simulado
- **A12.** Resposta parcial do widget em curso não é persistida no draft
  (reload durante uma questão perde o rascunho). `src/components/exam/ExamRunner.tsx:418,1041-1043`.
- **A13.** Tempo esgotado: disparo depende de tick de 500 ms e a UI não
  comunica na hora que submeteu por tempo. `src/components/exam/ExamRunner.tsx:1111-1130`.
- **A14.** "Não avaliadas" agrupa falha técnica/vazio/timeout na mesma frase
  (`ExamRunner.tsx:1258-1270`); a política oral (`oralPolicy.ts:38-80`) já
  distingue as causas — falta propagar a contagem por causa.
- **A15.** Teste de microfone valida acesso, não ASR; primeira questão oral
  ainda pode falhar sem aviso do que acontece. `src/routes/exam.tsx:381-480`.
- **A16.** Revisão pós-exame exclui resultados avaliados sem resposta textual;
  cobertura de resposta/referência varia por widget. `ExamRunner.tsx:1204-1209,1002-1004`.
- **A17.** FIB do exame é inline-inputs com autosave por questão concluída —
  a pendência "FIB drag-and-drop" do projeto 13 não corresponde a este widget;
  prioridade real aqui é A12. `ExamRunner.tsx:410-442`.

### 2.4 Vocabulário
- **A18.** Busca não cobre sentidos acumulados (`src/lib/plus/vocab.ts:658-687`);
  sentidos só aparecem na revisão (`vocabulary.tsx:769-775`).
- **A19.** Rótulo "Revisar hoje" inclui não-vencidos quando há limite; não diz
  quantos vencidos entraram. `src/routes/vocabulary.tsx:270-271`.
- **A20.** Seção/origem depende das fontes retidas (máx. 6); origem antiga
  desaparece do filtro. `src/lib/plus/vocab.ts:55-66`.

### 2.5 Infra IA e detalhes de UX
- **A21.** Erros 429 e 5xx recebem a mesma classificação/mensagem; retry em
  "rate" pode estourar o deadline de 15 s. `src/server/gateway.ts:59-106,137-149`.
- **A22.** `contextCacheKey` não apara nem normaliza texto como o contrato do
  módulo descreve; `saveAiCache` captura a falha internamente, tornando o
  `catch` externo ineficaz. `src/lib/plus/aiCache.ts:46-79,112-121`.
- **A23.** Focus trap do TranslationSheet inclui elementos ocultos/inativos;
  restauração de `inert` pode apagar atributo pré-existente.
  `src/components/plus/TranslationSheet.tsx:25-26,89-124`.
- **A24.** `aria-current="page"` só na TabBar; links ativos do topo mudam só
  classes. `TopNav.tsx:39-50` vs `TabBar.tsx:17-26`.
- **A25.** Marca divergente: head/og/manifest = "PTE Master Hub"; UI = "Studie
  Plus". `index.tsx:34-43`, `__root.tsx:95-106`, `public/manifest.webmanifest`.
- **A26.** Script de pré-pintura repete o literal `"ptehub:theme"` apesar do
  comentário alegar fonte única (`__root.tsx:140-145`, `theme.ts:12`); fallback
  de `matchMedia` ausente retorna claro. `theme.ts:33-39`.
- **A27.** `ProgressRing` fixa `role="timer"` e espalha `rest` depois — um
  `role` do consumidor é sobrescrito silenciosamente. `ProgressRing.tsx:13-34`.
- **A28.** Baseline vermelha: `proj13-fase3.test.ts` "pruneVocab protege
  favoritos" falha por timeout de 5 s (teste roda `MAX_VOCAB_ITEMS+5` saves).
- **A29.** Meta description global omite "leitura" e repete "escuta".
  `__root.tsx:97-106`.
- **A30.** Atalhos de topo no mobile sem rótulo visível. `TopNav.tsx:69-86`.

## 3. Arquitetura das soluções (o COMO)

### 3.1 Graders linguísticos profundos (F1) — decisão central
- **Avaliação por IA, server-only**: nova server function
  `gradeLanguageResponse` em `src/lib/plus/ai-grade.functions.ts`, handler que
  importa `@/server/gateway` (SDK/gateway só no servidor — mesmo padrão de
  `ai-translate.functions.ts`). Cliente só chama a função; nada de IA no bundle.
- **Gateway**: Lovable AI Gateway (chat completions), resposta em JSON
  estruturado com Zod: dimensões (conteúdo, gramática, vocabulário, coesão,
  forma), score por dimensão 0–90 escalado ao domínio do PTE, 1-3 erros
  específicos com trecho citado e correção, 1 ação de treino concreta.
  Fallback determinístico: se a IA falhar/timeout, cai no grader heurístico
  atual e o rótulo diz "avaliação básica".
- **Rotulagem honesta**: todo score ganha fonte explícita — "avaliação IA" vs
  "avaliação básica (heurística)" — no ScorePanel e na revisão do exame.
  Speaking continua determinístico e rotulado como proxy (não muda de natureza;
  só ganha rótulo e ação).
- **Cache**: reutiliza o contrato do cache IA v2 (chave por task type +
  hash do input normalizado) para não gastar chamadas repetidas.
- **Caps**: Zod nos payloads, rate limit existente reutilizado, timeout
  respeitado, sem PII.
- Superfícies consumidoras: practice (essay, SWT, SST), exam (essay/SWT),
  revisão pós-exame. Retoma/idempotência: o score IA entra no `Attempt` como
  fonte marcada, então merge de backup continua idempotente (id determinístico
  não muda).

### 3.2 Feedback acionável (F2)
- `progress-analytics.ts`: janelas de comparação filtram `date <= hoje` e
  exigem `n >= 3` por janela para comparar; sem amostra, mostra "amostra
  insuficiente" em vez de comparação frágil.
- `progress-overview.ts` → UI: cada score de seção/tópico exibe `n`
  ("12 tentativas") e, abaixo de 10, o aviso de confiança no próprio bloco.
- Novo util puro `nextAction.ts` (lib): dado o overview, produz 1 recomendação
  primária (seção/tipo prioritário + contagem sugerida + qids de pior
  desempenho) consumida por /progress e Home. Nenhuma métrica sem ação.
- Sessão: resumo expõe "pedidos vs na fila" por tipo (usando os counts do
  plano) e persiste o motivo do skip no draft; itens pulados/reagendados
  aparecem no resumo com ação de retomar.
- `QuestionRow`: cor e estado passam a sair do MESMO critério (última nota +
  limiar + vencimento), função pura `rowState(attempt)` com testes.

### 3.3 Simulado (F3)
- **Autosave parcial**: o widget em curso grava rascunho da resposta por qid no
  examDraft (novo campo `partial`); ao retomar, o widget restaura o que estava
  digitado/marcado. Puro e versionado no AppState (migração v8).
- **Tempo esgotado explícito**: quando o deadline dispara, a UI entra em estado
  "tempo encerrado" com aviso claro "sua resposta foi enviada automaticamente"
  (uma renderização dedicada, não dependente do tick).
- **Não avaliadas por causa**: contagem por causa (falha técnica / vazio /
  tempo / não avaliável) propagada da política oral para o resumo.
- **Honestidade do teste de microfone**: rótulo passa a dizer que valida
  acesso ao microfone, não o reconhecimento; explica o que acontece com
  resposta oral sem transcrição (política oral já define).
- **Revisão**: cobertura de resposta/referência uniformizada (escolhas mostram
  a opção marcada; vazias continuam "—" mas contadas).

### 3.4 Vocabulário (F4)
- Busca passa a incluir sentidos acumulados (função pura no `vocab.ts` com
  teste).
- Rótulo da fila limitada diz quantos vencidos entraram ("Revisar hoje — 7
  vencidos de 20").
- Origem: quando a fonte mais antiga sai do teto de 6, o filtro de seção usa a
  origem registrada no item (campo persistido), não a lista viva.

### 3.5 Infra IA e detalhes (F5)
- Gateway: 429, 5xx e timeout têm classificações e mensagens distintas; retry
  só em 5xx e somente se sobrar folga no deadline.
- Cache: `contextCacheKey` apara/normaliza conforme o contrato do módulo;
  `saveAiCache` deixa a falha propagar para o chamador (catch externo volta a
  funcionar).
- TranslationSheet: focusables filtram `disabled`/`aria-hidden`/ocultos;
  restauração de `inert` preserva valor pré-existente.
- F0 cobre: aria-current no TopNav, marca unificada "Studie Plus" (head, og,
  manifest — título e descrição corrigidos), chave de tema importada do
  literal duplicado (const injetada na string do script), fallback
  `matchMedia`, `ProgressRing` com role do consumidor respeitado, meta
  description correta (A25/A26/A27/A29/A30).

## 4. Escopo por fase (decisões D14-x) e critérios de aceite

### F0 · Baseline verde + coerência transversal (sem recurso novo)
- **D14-0a** Teste `pruneVocab protege favoritos` volta a passar (diagnosticar:
  é o teste que gera 4000+ saves em loop, ou regressão real em
  `pruneVocab`/`saveVocabWord`; corrigir a causa, não mascarar).
- **D14-0b** Marca unificada "Studie Plus" em head/og/manifest/meta; descrição
  global cobre as 4 habilidades.
- **D14-0c** Chave de tema sem literal duplicado (fonte única real);
  `matchMedia` ausente tratado.
- **D14-0d** `aria-current="page"` nos links do topo; atalhos mobile com
  `aria-label`.
- **D14-0e** `ProgressRing` respeita `role` do consumidor (default `timer`).
- Aceite: vitest 546/546 · tsgo limpo · build OK · lint 0 erros · axe 0 nas
  rotas tocadas · console limpo.

### F1 · Graders linguísticos profundos com IA (flagship)
- **D14-1a** `gradeLanguageResponse` server-only (essay + SWT), Zod no input e
  no output, caps/rate-limit/timeout, cache v2 por input normalizado.
- **D14-1b** Score com dimensões (conteúdo/gramática/vocabulário/coesão) +
  erros citados + 1 ação de treino; fallback heurístico com rótulo honesto.
- **D14-1c** ScorePanel/revisão mostram a fonte da nota ("avaliação IA" vs
  "avaliação básica"); speaking rotulado proxy com ação concreta.
- **D14-1d** Attempt registra a fonte do score; merge de backup idempotente
  preservado (ids determinísticos intactos).
- **D14-1e** Paridade prática/exame: mesmos graders e mesmos rótulos nas duas
  superfícies.
- Aceite: vitest (novos testes de contrato + fallback + cache + caps) · payload
  cap testado · fallback testado offline de IA · E2E do fluxo essay com IA real.

### F2 · Feedback acionável (progresso, sessão, score)
- **D14-2a** Comparação de períodos: datas futuras fora; `n>=3` por janela;
  "amostra insuficiente" quando não há comparável.
- **D14-2b** `n` visível junto a cada score de seção/tópico + aviso de
  confiança <10 tentativas no próprio bloco.
- **D14-2c** `nextAction.ts` puro + recomendação primária em /progress e Home
  (seção/tipo, contagem sugerida, qids fracos), ligada a início de treino.
- **D14-2d** Sessão: "pedidos vs na fila" por tipo no resumo; motivo do skip
  persistido; pulados/reagendados no resumo com ação.
- **D14-2e** `rowState()` puro: cor e estado do QuestionRow do mesmo critério.
- **D14-2f** ScorePanel com próxima ação concreta para qualquer score exibido.
- Aceite: testes de cada função pura nova/alterada · 390×844 sem overflow ·
  axe 0 · fluxo "ver recomendação → iniciar treino" E2E.

### F3 · Simulado sem perdas silenciosas
- **D14-3a** Autosave parcial por qid no examDraft (migração v8) + restauração
  nos widgets MCQ/FIB/hiw/speaking/writing.
- **D14-3b** Estado "tempo encerrado" explícito com aviso de envio automático.
- **D14-3c** "Não avaliadas" por causa (contagem por causa da política oral).
- **D14-3d** Rótulo honesto do teste de microfone + consequência de resposta
  oral sem transcrição.
- **D14-3e** Revisão: resposta/referência coerentes em todos os widgets.
- Aceite: teste de retomada com resposta parcial pré-submissão · E2E reload em
  meio à questão (E2E de projeto 13 estendido) · resumo por causa com contagem.

### F4 · Vocabulário coerente
- **D14-4a** Busca cobre sentidos acumulados (teste).
- **D14-4b** Fila limitada rotula vencidos incluídos.
- **D14-4c** Filtro de seção usa origem persistida (não a lista viva de fontes).
- Aceite: testes das 3 mudanças · regressão da página 390×844.

### F5 · Infra IA + detalhes de acessibilidade
- **D14-5a** Classificação distinta 429 / 5xx / timeout; retry com folga de
  deadline (teste).
- **D14-5b** `contextCacheKey` normalizado conforme contrato; falha de
  `saveAiCache` observável (teste).
- **D14-5c** TranslationSheet: focusables visíveis/ativos; `inert` pré-existente
  preservado (teste).
- Aceite: vitest · axe 0 nas rotas tocadas · console limpo.

### F6 · Fechamento AAA
- **D14-6a** E2E versionado estendido (essay com IA real, retomada de exame com
  resposta parcial, recomendação→treino) em `scripts/e2e/`.
- **D14-6b** Varredura de consistência final (sem cor hardcode fora de
  `chart.tsx`; rótulos honestos confirmados; 11 rotas 390×844 sem overflow,
  axe 0, console limpo).
- **D14-6c** Gates completos: vitest 100% · tsgo · build com precache · lint 0
  erros.
- **D14-6d** AGENTS.md atualizado (decisões estruturais desta fase) + aviso ao
  monitor quando disponível.

## 5. Fora de escopo
- Recursos novos de modo offline (diretriz explícita).
- FIB drag-and-drop como widget novo (o FIB real é inline; A17 documentado).
- TTS/ASR próprios (não substituir Web Speech; rotulagem honesta resolve).
- Reescrita do motor de sessão, do store ou do TranslationSheet (refino apenas).
- Novos recursos de produto (nada entra sem motivo real já registrado acima).

## 6. Riscos e mitigação
- **Custo/latência da IA na grade**: cache v2 + caps + fallback heurístico
  sempre disponível.
- **Migração AppState v8**: só campo novo (examDraft.partial), merge de backup
  testado para manter idempotência.
- **Regressão no simulado retomável**: E2E de projeto 13 reexecutado na F3.
- **Colisão de hash no cache IA (FNV-1a 32-bit)**: manter tamanho limitado do
  cache e normalização (F5); trocar para 64-bit somente se necessário.

## 7. Gates (seção 19 do Plan.md)
Por fase: `bunx vitest run` 100% · `tsgo` limpo · `bun run build` · lint 0
erros · Playwright nas rotas tocadas (console limpo, axe 0, 390×844 sem
overflow) · E2E de fluxos críticos na F6. Marcar `[x]` no roadmap só com gates
verdes e evidência real.

---

## 8. Registro de decisões tomadas na execução (nunca perguntar ao usuário)
- **D14-1f (F1)**: o score registrado no `Attempt`/progresso é SEMPRE o básico
  determinístico (gradeSource: "heuristic"); a análise IA é painel complementar
  com rótulo próprio ("Análise IA detalhada · avaliação IA"), nunca substitui
  silenciosamente o score registrado — integridade do progresso (projeto 13)
  tem precedência.
- **D14-1g (F1)**: no exame, a análise IA é SOB DEMANDA na revisão pós-exame
  (botão "Analisar com IA", cache v3 primeiro); o fluxo cronometrado nunca
  espera gateway.
- **D14-5d (F5)**: `saveAiCache` propaga a falha de gravação (D14-5b) — os
  chamadores (scheduleSave/flushAiCache) sinalizam `persistFailed`; o teste
  antigo de engolir o erro foi atualizado para o contrato novo.
- **Evidência E2E (F1)**: essay real no dev — painel "Análise IA detalhada · 46,
  avaliação IA · score registrado no progresso: 41 (básico)", com resumo,
  erros citados e "Próximo passo". Console limpo.
- **F2 retomado de remix interrompido**: parte de F2 (analytics honesto,
  nextAction, skipReasons, statusOf, speechNextStep) já existia no código.
  Auditoria item a item confirmou o que faltava: n de tópico na UI, consumo
  do nextAction na Home e testes (criados em `src/test/proj14-fase2.test.ts`).
- **D14-2h (F2)**: na Home, o cartão da rotina mostra o `buildNextAction`
  (vocabulário vencido → tipo mais fraco) SEMPRE que o plano do dia está
  vazio — inclusive quando há retomada no hero (o hero complementa; um
  próximo passo real vale mais que um vazio educado). Sem duplicação com o
  cartão de vocabulário em estado normal, pois o fallback só existe sem plano.

## Fase 3 (D14-3a..f) — registrado
- **D14-3a**: `ExamDraft.partial` (opcional, `{qid, value}`, normalizado como null em
  entrada inválida) + `STATE_VERSION = 8` (migração aceita v1..v8). Autosave com
  debounce de 400ms no runner; restauração nos widgets de texto (SST/SWT/ditado/
  essay), FIB inputs, HIW, múltipla escolha, reorder e FIB dropdown — via
  `initialPartial`/`onPartialChange` com parse defensivo (`parsePartialJson`).
  **D14-3f**: fala fora da restauração — gravação não é retomável como rascunho.
- **D14-3b**: `timeUp`/`timeUpRef` no runner — estado explícito "Tempo encerrado —
  sua resposta foi enviada automaticamente" ANTES do autoenvio (1,6s de folga),
  não dependente do tick do relógio; reseta a cada questão.
- **D14-3c**: resumo mostra breakdown por causa (`notEvaluatedByCause`, rótulos
  CAUSE_LABEL) em vez de frase genérica combinada.
- **D14-3d**: /exam explicita que o teste de microfone valida ACESSO, não ASR, e
  que resposta oral sem transcrição não é avaliada nem entra na média.
- **D14-3e**: revisão pós-exame exibe TODAS as linhas com causa (`r.cause !==
  undefined`) — avaliadas sem texto mostram "—" em vez de sumir.
- **Infra**: `BACKUP_VERSIONS` (backup.ts e storage.ts) aceita envelope v8; probe
  A2 futuro atualizado para v9. Gates: vitest 584/584 · tsgo · build · lint 0 ·
  Playwright (retomada + autoenvio + resumo por causa).
- **Correção F4**: importo de `vocabStudyIncludedDue` corrigido para `@/lib/plus/vocab`.

- **D14-6e (F6)**: selos âmbar sobre `bg-warning/10` migraram para o token novo
  `--warning-ink` (`src/styles.css`, light+dark) — `text-warning` nesse fundo
  falha contraste AA (axe: color-contrast no chip "Quase no alvo"). Exceções de
  cor fora do design system documentadas: `error-page.ts` (documento standalone)
  e assets SVG de dados.
- **D14-6f (F6)**: E2E versionado da F6 em `scripts/e2e/proj14_f6.py` (45
  verificações, saída JSON, exit 1 em falha): essay com IA real e fallback
  rotulado, retomada de Simulado Writing com rascunho parcial restaurado,
  recomendação "Próximo passo" → prática do ponto fraco, varredura 390×844 nas
  11 rotas (overflow 0 · console limpo · axe 0). Última execução: 45/45 ok.
- **Evidência E2E (F6)**: essay IA real confirmado em execução anterior
  (painel "Análise IA detalhada · avaliação IA · score registrado no progresso",
  "Próximo passo"); execução final usou o fallback rotulado ("Análise IA
  indisponível agora · avaliação básica determinística") — ambos os caminhos
  cobertos pelo script.
