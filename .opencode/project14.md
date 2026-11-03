# Project 14 — Auditoria completa e otimização de impacto (Studie Plus / PTE Master Hub)

## Contexto
Remix ativado em 2026-11-03 (UTC). O projeto 13 (integridade de dados, simulado confiável,
sessões que executam o plano, vocabulário diário, entrada intencional, offline real) foi
concluído — roadmap-proj13 100% fechado. Este projeto 14 nasce do pedido do usuário:
avaliar o app por completo e otimizar o que existe.

## Diretriz do usuário (fonte de verdade do escopo)
> Avaliar o app por completo, estudar os pontos fracos e fortes, os propósitos de cada
> recurso e planejar melhorias robustas em todos os aspectos que de fato terão impacto
> significativo na utilidade real de cada recurso. A ideia não é lotar de recursos
> inúteis, mas sim otimizar o que já temos, identificando pontos fracos e tornando-os
> pontos fortes e masterizando os pontos fortes que já temos. Recursos novos devem ter
> um motivo real, útil e bem planejado para melhorar o app.
> (obs: menos foco em desenvolver recursos do "modo offline" — o app não tem o
> propósito de ser usado offline; isso é um recurso, não o foco central do app.)

## Direção
1. **Auditar antes de construir**: varredura completa das superfícies (Home, /practice,
   /session, /exam, /progress, /vocabulary, /listening, /reading, /speaking, /writing,
   /settings, tradução IA) — propósito de cada recurso, utilidade real, atritos,
   bugs e incoerências.
2. **Otimização > adição**: cada melhoria precisa justificar o impacto na utilidade
   real. Recursos novos só com motivo real e bem planejado.
3. **Masterizar pontos fortes**: o que já funciona bem recebe refinamento, não reescrita.
4. **Offline em segundo plano**: não desenvolver novos recursos de modo offline;
   manter o que existe funcionando (regressão zero).
5. Portanto: a PRD nasce da auditoria — primeiro mapear fraquezas/forças com evidência
   (código + gates + uso), depois planejar fases de correção/refino por impacto.
