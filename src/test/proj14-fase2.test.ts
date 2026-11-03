// F2 (D14-2b/2c/2e) — testes das funções puras do feedback acionável:
// buildNextAction (recomendação primária), statusOf (cor e estado do mesmo
// critério) e n exibido junto aos scores de tópico.
import { describe, expect, it } from "vitest";

import { statusOf } from "@/components/QuestionRow";
import { allMeta, firstIdOfType, TYPE_META } from "@/lib/pte";
import { buildNextAction } from "@/lib/next-action";
import { buildProgressOverview } from "@/lib/progress-overview";
import { emptyState, type AppState, type Attempt, type QuestionStat } from "@/lib/storage";
import type { VocabWord } from "@/lib/plus/vocab";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);
const DAY = 86_400_000;

/** ids reais do banco (byType/tópico dependem de getMeta) — 3 questões de wfd. */
const WFD_IDS = allMeta
  .filter((m) => m.taskType === "wfd")
  .slice(0, 3)
  .map((m) => m.id);
/** tópico real do banco (topicScores exclui "sem tópico" por design). */
const TOPIC_META = allMeta.find((m) => m.topic && m.topic !== "sem tópico")!;

function attempt(qid: string, daysAgo: number, score: number): Attempt {
  return {
    qid,
    ts: NOW - daysAgo * DAY,
    taskType: "wfd",
    mode: "manual",
    contentScore: score,
    score,
    wpm: null,
    durationMs: 1000,
  };
}

function stat(patch: Partial<QuestionStat> = {}): QuestionStat {
  return {
    attempts: 1,
    bestContent: null,
    bestWpm: null,
    lastAttemptAt: NOW,
    lastScore: null,
    strongAttempts: 0,
    box: 1,
    dueAt: 0,
    ...patch,
  };
}

function app(attempts: Attempt[], patch: Partial<AppState> = {}): AppState {
  return { ...emptyState(), attempts, ...patch };
}

const dueWord: VocabWord = {
  word: "eloquent",
  literal: "eloquente",
  savedAt: NOW,
  lastSeenAt: NOW,
  seenCount: 1,
  sources: [],
  box: 0,
  dueAt: 0, // vencido
};

describe("buildNextAction (D14-2c)", () => {
  it("prioriza vocabulário vencido sobre treino", () => {
    const a = app([attempt(WFD_IDS[0]!, 1, 60)], {
      vocabulary: { words: { eloquent: dueWord }, phrases: {} },
    });
    const next = buildNextAction(a, NOW);
    expect(next?.kind).toBe("vocab");
    expect(next?.count).toBe(1);
    expect(next?.title).toContain("1 item vencido");
  });

  it("recomenda o task type mais fraco com amostra comparável (n>=3, média<90)", () => {
    const a = app([
      attempt(WFD_IDS[0]!, 1, 60),
      attempt(WFD_IDS[1]!, 2, 70),
      attempt(WFD_IDS[2]!, 3, 80),
    ]);
    const next = buildNextAction(a, NOW);
    expect(next?.kind).toBe("practice");
    expect(next?.count).toBe(3);
    expect(next?.title).toContain(TYPE_META["wfd"]!.label);
    expect(next?.detail).toMatch(/média/);
    // a ação abre a questão com pior melhor conteúdo desse tipo
    expect(next?.qid).toBe(WFD_IDS[0]);
  });

  it("não recomenda treino quando tudo está na faixa forte (média >= 90)", () => {
    const a = app([
      attempt(WFD_IDS[0]!, 1, 95),
      attempt(WFD_IDS[1]!, 2, 95),
      attempt(WFD_IDS[2]!, 3, 95),
    ]);
    expect(buildNextAction(a, NOW)).toBeNull();
  });
});

describe("statusOf (D14-2e) — cor e estado do mesmo critério", () => {
  it("sem tentativa → rótulo neutro", () => {
    const s = statusOf(undefined, "wfd", NOW);
    expect(s.label).toBe("não tentada");
  });

  it("conteúdo fraco → rótulo e cor vermelha do MESMO critério", () => {
    const s = statusOf(stat({ bestContent: 40, lastScore: 40 }), "wfd", NOW);
    expect(s.label).toContain("melhor 40%");
    expect(s.dot).toContain("destructive");
    expect(s.pill).toContain("destructive");
  });

  it("conteúdo médio (70–89) → amarelo, coerente com o rótulo", () => {
    const s = statusOf(stat({ bestContent: 85, lastScore: 85 }), "wfd", NOW);
    expect(s.label).toContain("melhor 85%");
    expect(s.dot).toContain("warning");
    expect(s.pill).toContain("warning");
  });
});

describe("progress overview (D14-2b) — n junto ao score de tópico", () => {
  it("topicScores expõe n (nº de questões) para cada tópico", () => {
    const overview = buildProgressOverview(app([attempt(TOPIC_META.id, 1, 60)]), NOW);
    expect(overview.topicScores.length).toBeGreaterThan(0);
    for (const t of overview.topicScores) {
      expect(typeof t.n).toBe("number");
      expect(t.n).toBeGreaterThanOrEqual(1);
    }
    const row = overview.topicScores.find((t) => t.topic === TOPIC_META.topic);
    expect(row?.n).toBe(1);
  });

  it("usa um qid real do banco (sanidade do fixture)", () => {
    expect(firstIdOfType("wfd")).toBeTruthy();
  });
});
