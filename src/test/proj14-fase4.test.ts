// F4 (D14-4a/4b/4c) — vocabulário coerente: busca cobre sentidos acumulados,
// fila limitada rotula vencidos incluídos, origem persistida sobrevive ao teto
// de fontes.
import { describe, expect, it } from "vitest";

import {
  filterVocab,
  flattenVocab,
  saveVocabWord,
  sectionOfType,
  vocabStudyIncludedDue,
  type VocabStore,
} from "@/lib/plus/vocab";

const TS = 1_762_142_400_000;
const SOURCE_READ = { type: "read_aloud", qid: "pte-ra-001" };
const SOURCE_WRITE = { type: "summarize_written_text", qid: "pte-swt-001" };

function store(): VocabStore {
  return { words: {}, phrases: {} };
}

describe("filterVocab — busca cobre sentidos acumulados (D14-4a)", () => {
  it("acha o sentido anterior acumulado, não só o par exibido", () => {
    let s = store();
    s = saveVocabWord(s, {
      word: "bank",
      literal: "banco financeiro",
      ts: TS,
      source: SOURCE_READ,
    });
    s = saveVocabWord(s, {
      word: "bank",
      literal: "orla do rio",
      ts: TS + 1000,
      source: SOURCE_READ,
    });
    // "banco financeiro" virou sentido acumulado — a busca deve encontrá-lo
    const hits = filterVocab(flattenVocab(s), { query: "banco financeiro" });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.en).toBe("bank");
    // e o texto EN segue buscando
    expect(filterVocab(flattenVocab(s), { query: "bank" })).toHaveLength(1);
  });

  it("busca também a nota contextual dos sentidos", () => {
    let s = store();
    s = saveVocabWord(s, {
      word: "issue",
      literal: "edição",
      contextual: "número de revista",
      ts: TS,
    });
    s = saveVocabWord(s, { word: "issue", literal: "problema", ts: TS + 1000 });
    expect(filterVocab(flattenVocab(s), { query: "número de revista" })).toHaveLength(1);
  });
});

describe("vocabStudyIncludedDue (D14-4b)", () => {
  it("vencidos entram primeiro: incluídos = min(poolDue, size)", () => {
    expect(vocabStudyIncludedDue(7, 20)).toBe(7);
    expect(vocabStudyIncludedDue(30, 10)).toBe(10); // fila menor que os vencidos
    expect(vocabStudyIncludedDue(0, 10)).toBe(0);
    expect(vocabStudyIncludedDue(-1, 10)).toBe(0); // nunca negativo
  });
});

describe("originType persistido (D14-4c)", () => {
  it("grava a origem da 1ª tradução e mantém após re-traduções", () => {
    let s = store();
    s = saveVocabWord(s, { word: "resilient", literal: "resiliente", ts: TS, source: SOURCE_READ });
    s = saveVocabWord(s, {
      word: "resilient",
      literal: "resiliente",
      ts: TS + 1,
      source: SOURCE_WRITE,
    });
    const item = flattenVocab(s)[0]!;
    expect(item.originType).toBe("read_aloud");
    // fontes vivas já mesclaram as duas; a origem persistida não muda
    expect(item.sources.length).toBe(2);
  });

  it("a seção da origem persistida sobrevive ao teto de fontes retidas", () => {
    let s = store();
    s = saveVocabWord(s, { word: "resilient", literal: "resiliente", ts: TS, source: SOURCE_READ });
    // simula a poda pelas fontes mais recentes (teto 6, todas de writing)
    const item = flattenVocab(s)[0]!;
    const pruned = {
      ...item,
      sources: Array.from({ length: 6 }, (_, i) => ({
        type: "summarize_written_text",
        qid: `pte-swt-00${i}`,
      })),
    };
    // união do item: fontes vivas + origem persistida
    const types = [
      ...new Set([
        ...pruned.sources.map((x) => x.type),
        ...(pruned.originType ? [pruned.originType] : []),
      ]),
    ];
    expect(types).toContain("read_aloud");
    expect(sectionOfType("read_aloud")).toBe("speaking");
  });
});
