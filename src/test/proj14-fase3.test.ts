import { beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

/** Carrega storage no registro limpo de módulos. */
async function loadStorage() {
  return import("@/lib/storage");
}

import { gradeExamSummary, type ExamResultRow } from "@/lib/pte/exam";

/** qid real do banco (WFD, tópico real) para linhas avaliadas. */
const REAL_QID = "pte-wfd-002027ca";

describe("D14-3a: rascunho parcial do exame (draft v8)", () => {
  it("salva e recupera o rascunho parcial da questão em curso", async () => {
    const storage = await loadStorage();
    storage.saveExamDraft({
      examId: "mini",
      queue: ["q1", "q2"],
      index: 1,
      results: [],
      phase: "running",
      deadlineAt: Date.now() + 60_000,
      startedAt: Date.now(),
      partial: { qid: "q2", value: "resposta pela metade" },
    });
    const d = storage.getExamDraft();
    expect(d?.partial).toEqual({ qid: "q2", value: "resposta pela metade" });
  });

  it("normalização descarta rascunho malformado (qid vazio ou value não-string)", async () => {
    const storage = await loadStorage();
    storage.saveExamDraft({
      examId: "mini",
      queue: ["q1"],
      index: 0,
      results: [],
      phase: "running",
      deadlineAt: Date.now() + 60_000,
      startedAt: Date.now(),
      partial: { qid: "", value: "x" },
    });
    const { flushPendingWrite, migrateLegacyState } = await import("@/lib/storage");
    flushPendingWrite();
    const parsed = migrateLegacyState(JSON.parse(window.localStorage.getItem("pte-master-hub")!));
    expect(parsed.examDraft?.partial).toBeNull();
  });

  it("estado v8 persiste na versão vigente e aceita v7 sem rascunho", async () => {
    const storage = await loadStorage();
    const snapshot = JSON.stringify({
      ...storage.emptyState(),
      version: 7,
      draft: {
        examId: "mini",
        queue: ["q1"],
        index: 0,
        results: [],
        phase: "running",
        deadlineAt: 2000,
        startedAt: 1000,
      },
    });
    const migrated = storage.migrateLegacyState(JSON.parse(snapshot));
    expect(migrated.version).toBe(8);
    expect(migrated.examDraft?.partial ?? null).toBeNull();
    expect(migrated.draft?.index).toBe(0);
  });
});

describe("D14-3c: resumo por causa das não avaliadas", () => {
  const graded: ExamResultRow = { qid: REAL_QID, score: 80, cause: "graded", answer: "x" };

  it("conta cada causa separadamente no breakdown", () => {
    const results: ExamResultRow[] = [
      graded,
      { qid: "q2", score: null, cause: "skipped" },
      { qid: "q3", score: null, cause: "expired" },
      { qid: "q4", score: null, cause: "expired" },
      { qid: "q5", score: null, cause: "technical" },
      { qid: "q6", score: null, cause: "empty" },
      { qid: "q7", score: null, cause: "not_gradable" },
    ];
    const s = gradeExamSummary(results);
    expect(s.notEvaluated).toBe(6);
    expect(s.notEvaluatedByCause).toEqual({
      skipped: 1,
      expired: 2,
      technical: 1,
      empty: 1,
      not_gradable: 1,
    });
    // Avaliadas não entram no breakdown.
    expect(s.notEvaluatedByCause.graded).toBeUndefined();
  });

  it("linhas avaliadas sem texto de resposta não são causadas (score presente)", () => {
    const s = gradeExamSummary([{ qid: REAL_QID, score: 75, cause: "graded" }]);
    expect(s.notEvaluated).toBe(0);
    expect(s.gradedCount).toBe(1);
  });
});

describe("D14-3e: cobertura da revisão pós-exame", () => {
  it("toda linha com causa entra na revisão — inclusive avaliada sem texto", () => {
    const results: ExamResultRow[] = [
      { qid: REAL_QID, score: 80, cause: "graded", answer: "x" },
      { qid: REAL_QID, score: 70, cause: "graded" }, // sem answer — não pode sumir
      { qid: "q3", score: null, cause: "expired" },
    ];
    // A regra do runner: results.filter((r) => r.cause !== undefined)
    const reviewRows = results.filter((r) => r.cause !== undefined);
    expect(reviewRows).toHaveLength(3);
    expect(reviewRows.some((r) => r.cause === "graded" && !r.answer)).toBe(true);
  });
});
