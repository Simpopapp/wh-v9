/**
 * Server function do grader linguístico IA (projeto 14, D14-1a). O módulo entra
 * no grafo do cliente, mas só o corpo dos handlers é retirado do bundle: as
 * importações de servidor (`@/server/gateway`) são dinâmicas, dentro do handler
 * — mesmo padrão de `ai-translate.functions.ts`; nada de IA no bundle do cliente.
 *
 * Contrato com o cliente (D14-1b): falha de IA devolve `ok:false` e o cliente
 * mantém a avaliação básica determinística, com rótulo honesto — nunca nota
 * inventada, nunca tela quebrada.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildGradePrompt, type GradeKind } from "@/lib/plus/aiGradePrompts";
import { gradeResultSchema } from "@/lib/plus/aiGradeSchemas";

export type AiGradeError = {
  ok: false;
  code: "credits" | "rate" | "server" | "network" | "invalid";
  message: string;
};
export type AiGradeResponse =
  { ok: true; result: import("zod").infer<typeof gradeResultSchema>; source: "ai" } | AiGradeError;

/** Tetos de entrada: limitam custo, parsing e superfície de prompt injection. */
export const gradeLanguageInputSchema = z.object({
  kind: z.enum(["essay", "swt"]),
  taskType: z.string().min(1).max(80),
  /** Enunciado da questão (prompt/texto-fonte). */
  questionText: z.string().min(1).max(6000),
  /** Resposta do aluno (essay até ~800 palavras; SWT até ~75). */
  response: z.string().min(1).max(8000),
  /** Resposta modelo do banco, referência de conteúdo (opcional). */
  sample: z.string().max(8000).optional(),
  /** Sessão anônima do cliente (chave do rate limit) — não é identidade. */
  sessionId: z.string().min(8).max(64).optional(),
});

const RATE_MESSAGE = "Muitas correções seguidas — aguarde alguns instantes.";

export const gradeLanguageResponse = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => gradeLanguageInputSchema.parse(input))
  .handler(async ({ data }): Promise<AiGradeResponse> => {
    const { checkRateLimit } = await import("@/server/rate-limit");
    if (!checkRateLimit(data.sessionId).ok) {
      return { ok: false, code: "rate", message: RATE_MESSAGE };
    }
    const { callGatewayObject } = await import("@/server/gateway");
    const prompt = buildGradePrompt({
      kind: data.kind as GradeKind,
      taskType: data.taskType,
      questionText: data.questionText,
      response: data.response,
      sample: data.sample,
    });
    const result = await callGatewayObject({
      instructions: prompt.instructions,
      messages: prompt.messages,
      schema: gradeResultSchema,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, result: result.data, source: "ai" };
  });
