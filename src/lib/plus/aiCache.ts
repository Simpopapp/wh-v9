/**
 * Cache de traduções IA (PRD projeto 11, §2.5 / D6) — v2 (projeto 13, D7/D8).
 * Vive FORA do AppState: `localStorage["pte-plus-ai-cache"]`, versionado, LRU
 * com limites próprios — o backup do usuário nunca inflaciona por causa dele.
 *
 * Projeto 13:
 *  - CHAVE COM CONTEXTO: a chave de frase inclui o contexto da chamada
 *    (enunciado/opções/vizinhos) — contexto diferente nunca reutiliza
 *    tradução de outro contexto;
 *  - VERSÃO 2: entradas v1 são invalidadas pela troca de formato;
 *  - LOAD VALIDADO: entradas fora do schema são descartadas (não crasham);
 *  - LRU DE VERDADE: a LEITURA atualiza a recência (o v1 só atualizava na
 *    gravação — a poda expulsava entradas em uso);
 *  - STORE CENTRAL: os componentes consomem `aiCacheStore` (um único
 *    snapshot em memória com dedupe de instâncias, gravação agendada e
 *    sinalização de falha de persistência) — sem lost update entre cards.
 */
import {
  phraseResultSchema,
  wordResultSchema,
  type AiPhraseResult,
  type AiWordResult,
} from "@/lib/plus/aiSchemas";
import { gradeResultSchema, type AiGradeResult } from "@/lib/plus/aiGradeSchemas";

export const AI_CACHE_KEY = "pte-plus-ai-cache";
/** v3 (projeto 14, D14-1a): inclui correções do grader IA (grades). */
export const AI_CACHE_VERSION = 3;
export const AI_CACHE_LIMITS = { words: 1500, phrases: 600, grades: 300 } as const;

interface CacheEntry<T> {
  result: T;
  at: number;
}

export interface AiCacheState {
  version: number;
  words: Record<string, CacheEntry<AiWordResult>>;
  phrases: Record<string, CacheEntry<AiPhraseResult>>;
  /** v3: correções do grader IA (essay/SWT), chave por input normalizado. */
  grades: Record<string, CacheEntry<AiGradeResult>>;
}

export const emptyAiCache = (): AiCacheState => ({
  version: AI_CACHE_VERSION,
  words: {},
  phrases: {},
  grades: {},
});

/** FNV-1a 32 bits, saída hex — determinístico, testado contra vetores fixos. */
export function hashKey(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Palavra: chave = token + contexto da frase (a frase carrega o sentido). */
export const wordCacheKey = (word: string, sentence: string): string =>
  `w:${word.toLowerCase()}::${hashKey(sentence)}`;

/**
 * Frase: chave = tipo + texto + CONTEXTO (D8). Contexto vazio mantém a
 * forma antiga (compatível com chamadas sem enunciado); com contexto, a
 * chave diverge — a mesma frase em questões/opções diferentes é traduzida
 * de novo em vez de reutilizar tradução de outro contexto.
 */
export const phraseCacheKey = (taskType: string, sentence: string, context?: string): string =>
  `p:${taskType}::${hashKey(sentence)}::${hashKey(context ?? "")}`;

/** Normaliza contexto de cache (contrato do módulo): ordem estável, texto
 * aparado ANTES do prefixo e partes vazias fora da chave (D14-5b). */
export const contextCacheKey = (
  questionText?: string,
  options?: string[],
  neighbors?: string[],
): string => {
  const q = (questionText ?? "").trim();
  const opts = (options ?? [])
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => `o:${o}`);
  const neis = (neighbors ?? [])
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => `n:${n}`);
  return [q, ...opts, ...neis].filter(Boolean).join("¦");
};

/** Carrega o cache tolerando JSON inválido ou versão diferente.
 * v2 → mantém traduções (words/phrases) e começa grades vazio; fora de 2|3
 * recomeça vazio. */
export function loadAiCache(storage: Pick<Storage, "getItem"> = localStorage): AiCacheState {
  try {
    const raw = storage.getItem(AI_CACHE_KEY);
    if (!raw) return emptyAiCache();
    const parsed = JSON.parse(raw) as AiCacheState;
    if (parsed?.version !== 2 && parsed?.version !== AI_CACHE_VERSION) return emptyAiCache();
    // D8: validação por schema ao carregar — entrada fora do schema é
    // descartada (cache corrompido não vira UI quebrada).
    const words: Record<string, CacheEntry<AiWordResult>> = {};
    for (const [k, e] of Object.entries(parsed.words ?? {})) {
      if (!e || typeof e !== "object") continue;
      const r = wordResultSchema.safeParse((e as CacheEntry<AiWordResult>).result);
      if (r.success && typeof (e as CacheEntry<AiWordResult>).at === "number") {
        words[k] = { result: r.data, at: (e as CacheEntry<AiWordResult>).at };
      }
    }
    const phrases: Record<string, CacheEntry<AiPhraseResult>> = {};
    for (const [k, e] of Object.entries(parsed.phrases ?? {})) {
      if (!e || typeof e !== "object") continue;
      const r = phraseResultSchema.safeParse((e as CacheEntry<AiPhraseResult>).result);
      if (r.success && typeof (e as CacheEntry<AiPhraseResult>).at === "number") {
        phrases[k] = { result: r.data, at: (e as CacheEntry<AiPhraseResult>).at };
      }
    }
    const grades: Record<string, CacheEntry<AiGradeResult>> = {};
    for (const [k, e] of Object.entries(parsed.grades ?? {})) {
      if (!e || typeof e !== "object") continue;
      const r = gradeResultSchema.safeParse((e as CacheEntry<AiGradeResult>).result);
      if (r.success && typeof (e as CacheEntry<AiGradeResult>).at === "number") {
        grades[k] = { result: r.data, at: (e as CacheEntry<AiGradeResult>).at };
      }
    }
    return { version: AI_CACHE_VERSION, words, phrases, grades };
  } catch {
    return emptyAiCache();
  }
}

/** Grava e PROPAGA a falha (D14-5b): quota/privacidade não é silenciada aqui —
 * o chamador (scheduleSave/flushAiCache) decide sinalizar `persistFailed`. */
export function saveAiCache(
  state: AiCacheState,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(AI_CACHE_KEY, JSON.stringify(state));
}

/** Despeja as entradas mais antigas até respeitar os limites de LRU. */
export function cachePrune(
  state: AiCacheState,
  limits: { words: number; phrases: number; grades: number } = AI_CACHE_LIMITS,
): AiCacheState {
  const pruneRecord = <T>(record: Record<string, CacheEntry<T>>, limit: number) => {
    const entries = Object.entries(record);
    if (entries.length <= limit) return record;
    const ordered = entries.sort((a, b) => (a[1]?.at ?? 0) - (b[1]?.at ?? 0));
    return Object.fromEntries(ordered.slice(entries.length - limit));
  };
  return {
    version: AI_CACHE_VERSION,
    words: pruneRecord(state.words, limits.words),
    phrases: pruneRecord(state.phrases, limits.phrases),
    grades: pruneRecord(state.grades, limits.grades),
  };
}

/** Leituras puras de cache: `getWord`/`getPhrase` devolvem o resultado ou null. */
export function getWord(state: AiCacheState, key: string): AiWordResult | null {
  return state.words[key]?.result ?? null;
}

export function getPhrase(state: AiCacheState, key: string): AiPhraseResult | null {
  return state.phrases[key]?.result ?? null;
}

/** Gravação (em memória) com timestamp; chame `saveAiCache` para persistir. */
export function putWord(state: AiCacheState, key: string, result: AiWordResult): AiCacheState {
  return cachePrune({ ...state, words: { ...state.words, [key]: { result, at: Date.now() } } });
}

export function putPhrase(state: AiCacheState, key: string, result: AiPhraseResult): AiCacheState {
  return cachePrune({ ...state, phrases: { ...state.phrases, [key]: { result, at: Date.now() } } });
}

/** Chave de cache do grader: tipo + enunciado + resposta do aluno (normalizada
 * pelo hash — a mesma resposta na mesma questão reutiliza a correção). */
export const gradeCacheKey = (
  kind: "essay" | "swt",
  taskType: string,
  questionText: string,
  response: string,
): string => `g:${kind}::${hashKey(taskType)}::${hashKey(questionText)}::${hashKey(response)}`;

export function getGrade(state: AiCacheState, key: string): AiGradeResult | null {
  return state.grades[key]?.result ?? null;
}

export function putGrade(state: AiCacheState, key: string, result: AiGradeResult): AiCacheState {
  return cachePrune({ ...state, grades: { ...state.grades, [key]: { result, at: Date.now() } } });
}

// ---------- store central (projeto 13, D7/D8) ----------

let mem: AiCacheState | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let persistFailed = false;

const SAVE_DELAY_MS = 2_000;

function ensureState(): AiCacheState {
  if (!mem) mem = loadAiCache();
  return mem;
}

function scheduleSave(): void {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!mem) return;
    try {
      saveAiCache(mem);
      persistFailed = false;
    } catch {
      // quota/privacidade: o cache continua em memória; a UI sinaliza.
      persistFailed = true;
    }
  }, SAVE_DELAY_MS);
}

export function flushAiCache(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!mem) return;
  try {
    saveAiCache(mem);
    persistFailed = false;
  } catch {
    persistFailed = true;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushAiCache);
  window.addEventListener("visibilitychange", flushAiCache);
}

/**
 * Store central do cache: leitura ATUALIZA recência (LRU real), escrita é
 * deduplicada entre componentes e a persistência é agendada uma única vez.
 */
export const aiCacheStore = {
  getWord(key: string): AiWordResult | null {
    const s = ensureState();
    const e = s.words[key];
    if (!e) return null;
    if (e.at !== Date.now()) {
      e.at = Date.now(); // leitura conta como uso (LRU real, D8)
      scheduleSave();
    }
    return e.result;
  },
  getPhrase(key: string): AiPhraseResult | null {
    const s = ensureState();
    const e = s.phrases[key];
    if (!e) return null;
    if (e.at !== Date.now()) {
      e.at = Date.now();
      scheduleSave();
    }
    return e.result;
  },
  putWord(key: string, result: AiWordResult): void {
    const s = ensureState();
    mem = cachePrune({ ...s, words: { ...s.words, [key]: { result, at: Date.now() } } });
    scheduleSave();
  },
  putPhrase(key: string, result: AiPhraseResult): void {
    const s = ensureState();
    mem = cachePrune({ ...s, phrases: { ...s.phrases, [key]: { result, at: Date.now() } } });
    scheduleSave();
  },
  getGrade(key: string): AiGradeResult | null {
    const s = ensureState();
    const e = s.grades[key];
    if (!e) return null;
    if (e.at !== Date.now()) {
      e.at = Date.now();
      scheduleSave();
    }
    return e.result;
  },
  putGrade(key: string, result: AiGradeResult): void {
    const s = ensureState();
    mem = cachePrune({ ...s, grades: { ...s.grades, [key]: { result, at: Date.now() } } });
    scheduleSave();
  },
  /** Para testes: estado atual (sem tocar no storage). */
  peek(): AiCacheState {
    return ensureState();
  },
  /** Para testes: recomeça do zero (limpa memória e timer). */
  reset(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    mem = null;
    persistFailed = false;
  },
  /** Falha de persistência desde a última gravação bem-sucedida. */
  isPersisted(): boolean {
    return !persistFailed;
  },
};
