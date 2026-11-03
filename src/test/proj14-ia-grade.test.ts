// Projeto 14 — Fase 1 (D14-1a/b): grader linguístico IA — schemas, caps,
// cache v3 e fonte da nota no Attempt.
import { beforeEach, describe, expect, it } from "vitest";

import { clampGradeResult, AI_GRADE_LIMITS, gradeResultSchema } from "@/lib/plus/aiGradeSchemas";
import { buildGradePrompt } from "@/lib/plus/aiGradePrompts";
import { gradeLanguageInputSchema } from "@/lib/plus/ai-grade.functions";
import {
  AI_CACHE_VERSION,
  emptyAiCache,
  getGrade,
  gradeCacheKey,
  loadAiCache,
  putGrade,
  putWord,
  wordCacheKey,
} from "@/lib/plus/aiCache";

const okGrade = {
  overall: 84.6,
  dimensions: {
    content: 88,
    form: 90,
    grammar: 70,
    vocabulary: 80.4,
    cohesion: 75,
  },
  summary: "Boa argumentação, mas gramática pesou na nota.",
  errors: [{ quote: "he don't likes", issue: "Concordância", fix: "he doesn't like" }],
  nextAction: "Revise terceira pessoa no presente.",
};

describe("Projeto 14 · clampGradeResult (D14-1b: nenhuma nota inventada)", () => {
  it("valida e corta uma saída completa", () => {
    const g = clampGradeResult(okGrade);
    expect(g).toEqual({
      overall: 85,
      dimensions: { content: 88, form: 90, grammar: 70, vocabulary: 80, cohesion: 75 },
      summary: okGrade.summary,
      errors: okGrade.errors,
      nextAction: okGrade.nextAction,
    });
  });

  it("overall ausente ou não-numérico invalida o resultado", () => {
    expect(clampGradeResult({ ...okGrade, overall: "alta" })).toBeNull();
    expect(clampGradeResult({ dimensions: okGrade.dimensions })).toBeNull();
  });

  it("notas fora de 0–100 são cortadas; dimensão ausente herda o overall", () => {
    const g = clampGradeResult({
      ...okGrade,
      overall: 142,
      dimensions: { ...okGrade.dimensions, grammar: -5 },
    });
    expect(g!.overall).toBe(100);
    expect(g!.dimensions.grammar).toBe(0);
    const g2 = clampGradeResult({ overall: 60, dimensions: {} });
    expect(g2!.dimensions.content).toBe(60);
  });

  it("erros: máximo 4 e textos cortados; itens sem conteúdo são descartados", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      quote: `q${i}`,
      issue: `i${i}`,
      fix: `f${i}`,
    }));
    const g = clampGradeResult({ ...okGrade, errors: many });
    expect(g!.errors).toHaveLength(AI_GRADE_LIMITS.maxErrors);
    const sliced = clampGradeResult({
      ...okGrade,
      errors: [
        { quote: "x".repeat(500), issue: "i", fix: "f" },
        { quote: "q", issue: "i" },
      ],
    });
    expect(sliced!.errors[0]!.quote).toHaveLength(AI_GRADE_LIMITS.errorQuote);
    expect(sliced!.errors).toHaveLength(1);
  });

  it("schema enviado ao modelo é estrito e aceita a saída do clamp", () => {
    expect(gradeResultSchema.safeParse(clampGradeResult(okGrade)).success).toBe(true);
  });
});

describe("Projeto 14 · tetos de entrada do grader (D14-1a)", () => {
  const base = {
    kind: "essay",
    taskType: "write_essay",
    questionText: "Some prompt.",
    response: "Some answer.",
  };

  it("resposta do aluno: aceita no teto (8000) e rejeita acima", () => {
    expect(
      gradeLanguageInputSchema.safeParse({ ...base, response: "a".repeat(8000) }).success,
    ).toBe(true);
    expect(
      gradeLanguageInputSchema.safeParse({ ...base, response: "a".repeat(8001) }).success,
    ).toBe(false);
  });

  it("kind restrito a essay|swt; sample com teto próprio; sessionId fora da faixa é rejeitada", () => {
    expect(gradeLanguageInputSchema.safeParse({ ...base, kind: "mcq" }).success).toBe(false);
    expect(gradeLanguageInputSchema.safeParse({ ...base, sample: "a".repeat(8001) }).success).toBe(
      false,
    );
    expect(gradeLanguageInputSchema.safeParse({ ...base, sessionId: "curta" }).success).toBe(false);
    expect(gradeLanguageInputSchema.safeParse({ ...base, sessionId: "s".repeat(64) }).success).toBe(
      true,
    );
  });
});

describe("Projeto 14 · prompt do grader", () => {
  it("inclui enunciado, resposta do aluno e resumo da forma do tipo", () => {
    const p = buildGradePrompt({
      kind: "essay",
      taskType: "write_essay",
      questionText: "Should plastic be banned?",
      response: "My essay text.",
      sample: "Model answer.",
    });
    expect(p.messages[0]!.content).toContain("Should plastic be banned?");
    expect(p.messages[0]!.content).toContain("My essay text.");
    expect(p.messages[0]!.content).toContain("Model answer.");
    expect(p.messages[0]!.content).toContain("200 a 300 palavras");

    const p2 = buildGradePrompt({
      kind: "swt",
      taskType: "swt",
      questionText: "Text...",
      response: "One sentence.",
    });
    expect(p2.messages[0]!.content).toContain("UMA frase de 5 a 75 palavras");
  });

  it("é determinístico para a mesma entrada", () => {
    const a = buildGradePrompt({
      kind: "essay",
      taskType: "write_essay",
      questionText: "Q",
      response: "R",
    });
    const b = buildGradePrompt({
      kind: "essay",
      taskType: "write_essay",
      questionText: "Q",
      response: "R",
    });
    expect(a.messages[0]!.content).toBe(b.messages[0]!.content);
  });
});

describe("Projeto 14 · cache v3 de correções", () => {
  beforeEach(() => window.localStorage.clear());

  it("gradeCacheKey é determinístico e distingue entradas", () => {
    const k1 = gradeCacheKey("essay", "write_essay", "Q", "R");
    expect(k1).toBe(gradeCacheKey("essay", "write_essay", "Q", "R"));
    expect(k1).not.toBe(gradeCacheKey("swt", "swt", "Q", "R"));
    expect(k1).not.toBe(gradeCacheKey("essay", "write_essay", "Q", "R2"));
  });

  it("putGrade + loadAiCache preserva a correção validada (roundtrip)", () => {
    const g = clampGradeResult(okGrade)!;
    let s = emptyAiCache();
    s = putGrade(s, gradeCacheKey("essay", "write_essay", "Q", "R"), g);
    window.localStorage.setItem("pte-plus-ai-cache", JSON.stringify(s));
    const loaded = loadAiCache();
    expect(getGrade(loaded, gradeCacheKey("essay", "write_essay", "Q", "R"))).toEqual(g);
  });

  it("cache v2 (sem grades) mantém traduções e abre grades vazio", () => {
    const v2: {
      version: number;
      words: Record<string, unknown>;
      phrases: Record<string, unknown>;
    } = {
      version: 2,
      words: {},
      phrases: {},
    };
    const word = {
      word: "scarce",
      literal: "escasso",
      inSentence: { translation: "t", why: "w" },
      synonym: { common: "rare", verdict: "right", explanation: "e" },
    };
    v2.words[wordCacheKey("scarce", "S.")] = { result: word, at: 1 };
    window.localStorage.setItem("pte-plus-ai-cache", JSON.stringify(v2));
    const loaded = loadAiCache();
    expect(loaded.version).toBe(AI_CACHE_VERSION);
    expect(loaded.words[wordCacheKey("scarce", "S.")]).toBeDefined();
    expect(Object.keys(loaded.grades)).toHaveLength(0);
  });

  it("putGrade pod pelo limite de grades", () => {
    const g = clampGradeResult(okGrade)!;
    let s = emptyAiCache();
    for (let i = 0; i < 305; i++) {
      s = putGrade(s, gradeCacheKey("essay", "write_essay", "Q", `R${i}`), g);
    }
    expect(Object.keys(s.grades).length).toBeLessThanOrEqual(300);
    expect(getGrade(s, gradeCacheKey("essay", "write_essay", "Q", "R304"))).toEqual(g);
  });

  it("entrada de grade fora do schema é descartada ao carregar", () => {
    const bad = {
      version: 3,
      words: {},
      phrases: {},
      grades: { k: { result: { overall: "alta" }, at: 1 } },
    };
    window.localStorage.setItem("pte-plus-ai-cache", JSON.stringify(bad));
    expect(Object.keys(loadAiCache().grades)).toHaveLength(0);
  });

  it("putWord continua funcionando na v3", () => {
    let s = emptyAiCache();
    s = putWord(s, wordCacheKey("scarce", "S."), {
      word: "scarce",
      literal: "escasso",
      inSentence: { translation: "t", why: "w" },
      synonym: { common: "rare", verdict: "right", explanation: "e" },
    });
    expect(s.words[wordCacheKey("scarce", "S.")]).toBeDefined();
  });
});
