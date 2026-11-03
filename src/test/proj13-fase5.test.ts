// Projeto 13 — Fase 5: offline real e performance (PRD §4.5).
// Regras testadas: /vocabulary no precache · download falho não reporta sucesso ·
// derivações do Progresso em UMA passada (contagem de computeStats) ·
// seletores finos (settings/bookmarks/stats) · paginação do vocabulário.

import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { metaByType } from "@/lib/pte";
import * as storage from "@/lib/storage";
import {
  emptyState,
  recordAttempt,
  toggleBookmark,
  updateSettings,
  useBookmarks,
  useSettings,
  useStats,
} from "@/lib/storage";
import { buildProgressOverview } from "@/lib/progress-overview";
import { downloadForOffline, OFFLINE_ROUTES, useOfflineStatus } from "@/lib/offline";
import { sliceVocabPage, VOCAB_PAGE_SIZE, type VocabListItem } from "@/lib/plus/vocab";

vi.mock("@/lib/pte/catalog", () => ({
  ALL_TASK_TYPES: ["read_aloud"],
  loadTypeQuestions: vi.fn(async () => []),
}));

const qid = () => metaByType("read_aloud")[0]!.id;

beforeEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Fase 5 · precache e rotas offline", () => {
  it("OFFLINE_ROUTES inclui /vocabulary e as 11 rotas do app", () => {
    expect(OFFLINE_ROUTES).toContain("/vocabulary");
    expect(new Set(OFFLINE_ROUTES).size).toBe(11);
  });

  it("download com rota 404/500 NÃO reporta sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    );
    const failed = await downloadForOffline();
    expect(failed).toBeGreaterThan(0);
    const status = readOfflineStatus();
    expect(status.error).not.toBeNull();
    expect(status.lastDownloadAt).toBeNull();
    expect(status.downloading).toBe(false);
  });

  it("download com tudo ok registra sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
    const failed = await downloadForOffline();
    expect(failed).toBe(0);
    const status = readOfflineStatus();
    expect(status.error).toBeNull();
    expect(status.lastDownloadAt).not.toBeNull();
  });
});

/** Leitura do snapshot do status offline fora do React. */
function readOfflineStatus() {
  // useOfflineStatus é um hook; para asserções simples, lemos o módulo via renderHook.
  const { result } = renderHook(() => useOfflineStatus());
  return result.current;
}

describe("Fase 5 · Progresso em uma passada", () => {
  it("buildProgressOverview chama computeStats exatamente UMA vez", () => {
    const spy = vi.spyOn(storage, "computeStats");
    const app = emptyState();
    const overview = buildProgressOverview(app);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(overview).toHaveProperty("series");
    expect(overview).toHaveProperty("chartPoints");
    expect(overview).toHaveProperty("topicScores");
    expect(overview).toHaveProperty("byType");
    expect(overview).toHaveProperty("weak");
    expect(overview).toHaveProperty("streak");
    expect(overview).toHaveProperty("recent");
    expect(overview).toHaveProperty("diagnostics");
    expect(overview).toHaveProperty("comparison");
    expect(overview).toHaveProperty("weekly");
    expect(overview).toHaveProperty("readiness");
    expect(overview).toHaveProperty("weakSection");
    expect(overview).toHaveProperty("estimates");
    expect(overview).toHaveProperty("overall");
    expect(overview).toHaveProperty("report");
    expect(overview).toHaveProperty("reportMarkdown");
    spy.mockRestore();
  });
});

describe("Fase 5 · seletores finos do store", () => {
  it("useSettings reflete updateSettings sem depender do estado inteiro", () => {
    const { result } = renderHook(() => useSettings());
    const before = result.current;
    act(() => {
      updateSettings({ targetScore: 79 });
    });
    expect(result.current.targetScore).toBe(79);
    expect(result.current).not.toBe(before);
  });

  it("useBookmarks reflete toggleBookmark", () => {
    const { result } = renderHook(() => useBookmarks());
    expect(result.current).toHaveLength(0);
    act(() => {
      toggleBookmark(qid());
    });
    expect(result.current).toContain(qid());
  });

  it("useStats recalcula após nova tentativa (cache invalidado por escrita)", () => {
    const { result } = renderHook(() => useStats());
    expect(result.current.has(qid())).toBe(false);
    act(() => {
      recordAttempt({ qid: qid(), ts: Date.now(), score: 80, contentScore: 80 });
    });
    expect(result.current.has(qid())).toBe(true);
  });
});

describe("Fase 5 · paginação do vocabulário", () => {
  // sliceVocabPage só pagina — os itens podem ser stubs tipados.
  const stub = (key: string) => ({ kind: "word", key }) as unknown as VocabListItem;

  it("lista longa rende em páginas de 300 com 'Mostrar mais'", () => {
    const items = Array.from({ length: 350 }, (_, i) => stub(`w${i}`));
    const { page, remaining } = sliceVocabPage(items, VOCAB_PAGE_SIZE);
    expect(page).toHaveLength(VOCAB_PAGE_SIZE);
    expect(remaining).toBe(50);
  });

  it("lista curta não pagina", () => {
    const { page, remaining } = sliceVocabPage([stub("a")], VOCAB_PAGE_SIZE);
    expect(page).toHaveLength(1);
    expect(remaining).toBe(0);
  });
});
