import { useEffect, useRef, useState } from "react";

import { aiCacheStore, gradeCacheKey } from "@/lib/plus/aiCache";
import { gradeLanguageResponse } from "@/lib/plus/ai-grade.functions";
import { aiSessionId } from "@/lib/plus/aiStatus";
import type { AiGradeState } from "./AiGradeFeedback";

const OFF: AiGradeState = { status: "off" };
const LOADING: AiGradeState = { status: "loading" };

const reasonFor = (
  code: "credits" | "rate" | "server" | "network" | "invalid",
  message: string,
): string => {
  if (code === "rate") return "Muitas correções seguidas — aguarde um instante e tente de novo.";
  if (code === "credits") return "Créditos de IA esgotados no momento.";
  if (code === "server") return "A IA está instável neste momento.";
  return message || "Falha temporária na análise.";
};

/**
 * Solicita a análise IA do grader linguístico (projeto 14, D14-1a) quando uma
 * resposta é submetida. Cache v3 primeiro (mesma resposta na mesma questão não
 * gasta chamada); falha → `unavailable` com rótulo honesto (o cliente mantém a
 * avaliação básica determinística).
 */
export function useAiGrade(input: {
  kind: "essay" | "swt";
  taskType: string;
  questionText: string;
  /** Resposta submetida ou null (ainda não submeteu). */
  response: string | null;
  sample?: string | undefined;
}): AiGradeState {
  const [state, setState] = useState<AiGradeState>(OFF);
  const runRef = useRef(0);

  useEffect(() => {
    if (!input.response) {
      runRef.current += 1;
      setState(OFF);
      return;
    }
    const run = ++runRef.current;
    const key = gradeCacheKey(input.kind, input.taskType, input.questionText, input.response);
    const cached = aiCacheStore.getGrade(key);
    if (cached) {
      setState({ status: "ready", result: cached });
      return;
    }
    setState(LOADING);
    gradeLanguageResponse({
      data: {
        kind: input.kind,
        taskType: input.taskType,
        questionText: input.questionText,
        response: input.response,
        ...(input.sample ? { sample: input.sample } : {}),
        sessionId: aiSessionId(),
      },
    })
      .then((res) => {
        if (run !== runRef.current) return; // resposta atrasada de outra submissão
        if (res.ok) {
          aiCacheStore.putGrade(key, res.result);
          setState({ status: "ready", result: res.result });
        } else {
          setState({ status: "unavailable", reason: reasonFor(res.code, res.message) });
        }
      })
      .catch(() => {
        if (run !== runRef.current) return;
        setState({ status: "unavailable", reason: "Falha temporária na análise." });
      });
    // input.response muda por submissão; os demais campos são estáveis por questão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.response]);

  return state;
}
