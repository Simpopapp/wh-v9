/**
 * Builders puros do prompt do grader linguístico IA (projeto 14, D14-1a).
 * Sem rede, sem segredos: todo o comportamento é coberto por teste de unidade.
 */
import type { ModelMessage } from "ai";

import { AI_GRADE_LIMITS } from "@/lib/plus/aiGradeSchemas";

export type GradeKind = "essay" | "swt";

const INSTRUCTIONS = [
  "Você é um examinador didático do PTE Academic (escrita).",
  "Responda SEMPRE com JSON válido no schema pedido, em português do Brasil.",
  "Baseie a avaliação APENAS nos textos fornecidos — nada de conhecimento externo sobre o tema.",
  "As notas vão de 0 a 100 e seguem os critérios de escrita do PTE (conteúdo, forma,",
  "gramática, vocabulário e coesão). Seja rigoroso e consistente: resposta mediana fica em 55-75.",
  "Cada erro citado em `errors` usa um trecho EXATO e curto copiado da resposta do aluno.",
  "Uma resposta boa pode ter `errors` vazio — nunca invente erro para preencher.",
].join(" ");

const KIND_BRIEF: Record<GradeKind, string[]> = {
  essay: [
    "Forma: redação de 200 a 300 palavras, com introdução, 2 parágrafos de argumento e conclusão.",
    "Conteúdo: responde ao enunciado com posição clara e argumentação desenvolvida.",
    "Coesão: parágrafos conectados, conectivos acadêmicos, progressão de ideias.",
    "Forma deve punar redação fora da zona de palavras (form baixo).",
  ],
  swt: [
    "Forma: UMA frase de 5 a 75 palavras (pontuação final única; vírgulas são permitidas).",
    "Conteúdo: captura a ideia principal e a ressalva/nuance do texto.",
    "Coesão: a frase lê-se como um período único e bem amarrado.",
  ],
};

/**
 * Prompt do grader. A resposta modelo é referência do banco (quando existe):
 * orienta o juízo de conteúdo, mas a nota mede a resposta do ALUNO.
 */
export function buildGradePrompt(input: {
  kind: GradeKind;
  taskType: string;
  questionText: string;
  response: string;
  sample?: string | undefined;
}): { instructions: string; messages: ModelMessage[] } {
  const parts = [
    `Tipo de questão: ${input.taskType} (${input.kind === "essay" ? "Write Essay" : "Summarize Written Text"}).`,
    ...KIND_BRIEF[input.kind],
    "",
    `ENUNCIADO:\n${input.questionText}`,
  ];
  if (input.sample && input.sample.trim()) {
    parts.push(`\nRESPOSTA MODELO (referência do banco, para calibrar conteúdo):\n${input.sample}`);
  }
  parts.push(
    `\nRESPOSTA DO ALUNO (avalie isto):\n${input.response}`,
    "",
    "Produza um objeto JSON exatamente com estes campos:",
    "- overall: nota geral 0–100 da resposta do aluno;",
    "- dimensions.content / dimensions.form / dimensions.grammar / dimensions.vocabulary / dimensions.cohesion: 0–100 cada;",
    `- summary: resumo do examinador — o que pesou na nota (máx. ${AI_GRADE_LIMITS.summary} caracteres);`,
    `- errors: de 0 a ${AI_GRADE_LIMITS.maxErrors} itens, cada um { quote, issue, fix } — quote é um trecho EXATO da resposta do aluno, issue é o que está errado e fix é a correção (quote máx. ${AI_GRADE_LIMITS.errorQuote}, issue máx. ${AI_GRADE_LIMITS.errorIssue}, fix máx. ${AI_GRADE_LIMITS.errorFix});`,
    `- nextAction: UMA ação de treino concreta para a próxima tentativa (máx. ${AI_GRADE_LIMITS.nextAction}).`,
  );
  return { instructions: INSTRUCTIONS, messages: [{ role: "user", content: parts.join("\n") }] };
}
