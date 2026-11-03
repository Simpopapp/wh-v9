import { AlertCircle, Sparkles } from "lucide-react";

import type { AiGradeResult } from "@/lib/plus/aiGradeSchemas";
import { cn } from "@/lib/utils";

const DIMENSIONS: { key: keyof AiGradeResult["dimensions"]; label: string }[] = [
  { key: "content", label: "Conteúdo" },
  { key: "form", label: "Forma" },
  { key: "grammar", label: "Gramática" },
  { key: "vocabulary", label: "Vocabulário" },
  { key: "cohesion", label: "Coesão" },
];

const tone = (n: number): string =>
  n >= 80 ? "text-success" : n >= 60 ? "text-warning" : "text-destructive";
const barTone = (n: number): string =>
  n >= 80 ? "bg-success" : n >= 60 ? "bg-warning" : "bg-destructive";

type AiGradeState =
  | { status: "off" }
  | { status: "loading" }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; result: AiGradeResult };

/**
 * Análise IA detalhada do grader linguístico (projeto 14, D14-1b/D14-1c).
 * Complemento com rótulo honesto: a nota registrada no progresso continua
 * sendo a avaliação básica determinística — esta análise NUNCA a substitui
 * silenciosamente, e falha de IA mantém o rótulo de indisponível.
 */
export function AiGradeFeedback({
  state,
  recordedScore,
}: {
  state: AiGradeState;
  /** Nota registrada no progresso (avaliação básica) — exibida para contexto. */
  recordedScore: number | null;
}) {
  if (state.status === "off") return null;

  if (state.status === "loading") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Análise IA detalhada…
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Avaliando gramática, vocabulário e coesão — alguns segundos.
        </p>
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <AlertCircle className="size-4" aria-hidden />
          Análise IA indisponível agora
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {state.reason} A nota abaixo é da avaliação básica determinística.
        </p>
      </div>
    );
  }

  const g = state.result;
  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-card md:p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Análise IA detalhada
        </p>
        <span className="font-serif text-3xl font-semibold tabular-nums text-primary">
          {g.overall}
        </span>
        <span className="text-xs text-muted-foreground">
          avaliação IA · score registrado no progresso: {recordedScore ?? "—"} (básico)
        </span>
      </div>

      {g.summary ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground">{g.summary}</p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
        {DIMENSIONS.map(({ key, label }) => {
          const v = g.dimensions[key];
          return (
            <div key={key} className="min-w-0">
              <dt className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>{label}</span>
                <span className={cn("font-semibold tabular-nums", tone(v))}>{v}</span>
              </dt>
              <dd className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", barTone(v))}
                  style={{ width: `${v}%` }}
                  aria-hidden
                />
              </dd>
            </div>
          );
        })}
      </dl>

      {g.errors.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {g.errors.map((e, i) => (
            <li key={i} className="rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm">
              <p className="font-serif italic leading-snug text-foreground/90">“{e.quote}”</p>
              <p className="mt-1 text-xs text-destructive">{e.issue}</p>
              <p className="mt-0.5 text-xs text-success">→ {e.fix}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Nenhum erro pontual destacado nesta análise.
        </p>
      )}

      {g.nextAction ? (
        <p className="mt-4 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          Próximo passo: {g.nextAction}
        </p>
      ) : null}
    </div>
  );
}

export type { AiGradeState };
