/**
 * D14-2c: próximo passo acionável (Home + /progress).
 * Prioridade: 1) vocabulário vencido; 2) task type mais fraco com amostra
 * comparável (≥ 3 tentativas com score) e média < 90 — a ação abre a questão
 * com pior melhor conteúdo desse tipo. Puro; não substitui a retomada de
 * sessão/exame do Home, complementa quando não há nada para retomar.
 */
import { TYPE_META, metaByType } from "@/lib/pte";
import { vocabDueCount } from "@/lib/plus/vocab";
import { buildProgressOverview } from "@/lib/progress-overview";
import { type AppState, computeStats } from "@/lib/storage";

export interface NextAction {
  kind: "vocab" | "practice";
  title: string;
  detail: string;
  /** qid mais fraco quando kind === "practice" (abre direto a prática). */
  qid?: string;
  count: number;
}

export function buildNextAction(app: AppState, now = Date.now()): NextAction | null {
  const due = vocabDueCount(app.vocabulary, now);
  if (due > 0) {
    return {
      kind: "vocab",
      count: due,
      title: `Revisar ${due} ${due === 1 ? "item vencido" : "itens vencidos"}`,
      detail: "A fila de revisão espaçada do vocabulário está pronta para hoje.",
    };
  }

  const overview = buildProgressOverview(app, now);
  const weakest = overview.byType
    .filter((r) => r.n >= 3 && r.avg < 90)
    .sort((a, b) => a.avg - b.avg)[0];
  if (!weakest) return null;

  const stats = computeStats(app);
  let qid: string | undefined;
  let worst = Infinity;
  for (const m of metaByType(weakest.t)) {
    const best = stats.get(m.id)?.bestContent;
    if (best == null) continue; // nunca tentada não é "fraca medida"
    if (best < worst) {
      worst = best;
      qid = m.id;
    }
  }

  return {
    kind: "practice",
    count: weakest.n,
    ...(qid ? { qid } : {}),
    title: `Treinar ${TYPE_META[weakest.t].label}`,
    detail: `${weakest.n} tentativas · média ${weakest.avg}% — o tipo mais fraco com amostra suficiente.`,
  };
}
