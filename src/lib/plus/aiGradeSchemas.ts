/**
 * Schemas de saída do grader linguístico IA (projeto 14, D14-1a).
 * Regra D3 (herdada do projeto 11): o schema enviado ao modelo é estrito e SEM
 * bounds — os limites vivem no prompt e são aplicados aqui, em código.
 */
import { z } from "zod";

/** Dimensões avaliadas em respostas escritas (essay / SWT). */
export const GRADE_DIMENSIONS = ["content", "form", "grammar", "vocabulary", "cohesion"] as const;
export type GradeDimension = (typeof GRADE_DIMENSIONS)[number];

export const gradeResultSchema = z.object({
  /** Nota geral 0–100, calibrada com os critérios de escrita do PTE. */
  overall: z.number(),
  dimensions: z.object({
    content: z.number(),
    form: z.number(),
    grammar: z.number(),
    vocabulary: z.number(),
    cohesion: z.number(),
  }),
  /** Resumo do examinador (o que pesou na nota). */
  summary: z.string(),
  /** Erros específicos com trecho EXATO da resposta do aluno. */
  errors: z.array(z.object({ quote: z.string(), issue: z.string(), fix: z.string() })),
  /** UMA ação de treino concreta para a próxima tentativa. */
  nextAction: z.string(),
});
export type AiGradeResult = z.infer<typeof gradeResultSchema>;

export const AI_GRADE_LIMITS = {
  summary: 400,
  maxErrors: 4,
  errorQuote: 200,
  errorIssue: 160,
  errorFix: 200,
  nextAction: 200,
} as const;

const clampScore = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null;

const clampText = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const pick = (obj: unknown, key: string): unknown =>
  obj != null && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;

/**
 * Valida e corta a saída do grader. Nota geral ausente/inválida invalida o
 * resultado (o cliente mantém a avaliação básica determinística — D14-1b:
 * nenhuma nota inventada).
 */
export function clampGradeResult(raw: unknown): AiGradeResult | null {
  const overall = clampScore(pick(raw, "overall"));
  if (overall === null) return null;

  const rawDims = pick(raw, "dimensions");
  const dim = (name: GradeDimension): number => clampScore(pick(rawDims, name)) ?? overall;

  const errors: AiGradeResult["errors"] = [];
  const rawErrors = pick(raw, "errors");
  if (Array.isArray(rawErrors)) {
    for (const e of rawErrors) {
      if (errors.length >= AI_GRADE_LIMITS.maxErrors) break;
      const quote = clampText(pick(e, "quote"), AI_GRADE_LIMITS.errorQuote);
      const issue = clampText(pick(e, "issue"), AI_GRADE_LIMITS.errorIssue);
      const fix = clampText(pick(e, "fix"), AI_GRADE_LIMITS.errorFix);
      if (quote && issue && fix) errors.push({ quote, issue, fix });
    }
  }

  return {
    overall,
    dimensions: {
      content: dim("content"),
      form: dim("form"),
      grammar: dim("grammar"),
      vocabulary: dim("vocabulary"),
      cohesion: dim("cohesion"),
    },
    summary: clampText(pick(raw, "summary"), AI_GRADE_LIMITS.summary),
    errors,
    nextAction: clampText(pick(raw, "nextAction"), AI_GRADE_LIMITS.nextAction),
  };
}
