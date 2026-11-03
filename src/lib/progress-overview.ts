// Fase 5 (projeto 13, PRD §4.5): derivações do Progresso em UMA passada.
// /progress antes derivava ~12 coisas em memos separados, todos dependendo do
// AppState inteiro; aqui tudo é calculado em uma única função pura — o
// componente consome um único memo, e o teste conta as passagens de computeStats.
import { getMeta, type TaskType } from "@/lib/pte";
import { diagnoseAttempts } from "@/lib/pte/diagnostics";
import {
  estimateBySkill,
  overallEstimate,
  readinessBySection,
  weakestSection,
} from "@/lib/pte/readiness";
import { periodComparison, weeklyTypeAverages } from "@/lib/progress-analytics";
import { renderReportMarkdown, weeklyReport } from "@/lib/pte/report";
import {
  computeStats,
  computeStreak,
  dailyAverages,
  isMasteredStat,
  type AppState,
} from "@/lib/storage";

export function buildProgressOverview(app: AppState, now: number = Date.now()) {
  // Uma única passada pelo log de tentativas alimenta todas as seções.
  const stats = computeStats(app);

  const series = dailyAverages(app, 14);
  const chartPoints = series
    .map((d, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * 100;
      const y = d.score === null ? null : 100 - d.score;
      return { x, y, score: d.score, day: d.day };
    })
    .filter((p): p is { x: number; y: number; score: number; day: string } => p.y !== null);

  const topicScores = (() => {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const [qid, s] of stats) {
      const topic = getMeta(qid)?.topic;
      if (!topic || topic === "sem tópico" || s.bestContent === null) continue;
      const cur = acc.get(topic) ?? { sum: 0, n: 0 };
      acc.set(topic, { sum: cur.sum + s.bestContent, n: cur.n + 1 });
    }
    return [...acc.entries()]
      .map(([topic, { sum, n }]) => ({ topic, avg: Math.round(sum / n), n }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
  })();

  // Diagnóstico por task type: média da última tentativa, dominadas e revisões vencidas.
  const byType = (() => {
    const acc = new Map<
      TaskType,
      { n: number; sum: number; mastered: number; due: number; errors: number }
    >();
    for (const [qid, s] of stats) {
      const t = getMeta(qid)?.taskType;
      if (!t) continue;
      const cur = acc.get(t) ?? { n: 0, sum: 0, mastered: 0, due: 0, errors: 0 };
      cur.n += 1;
      cur.sum += s.lastScore ?? 0;
      if (isMasteredStat(s, t)) cur.mastered += 1;
      if (s.dueAt <= now) cur.due += 1;
      if ((s.lastScore ?? 100) < 70) cur.errors += 1;
      acc.set(t, cur);
    }
    return [...acc.entries()]
      .map(([t, v]) => ({ t, ...v, avg: Math.round(v.sum / v.n) }))
      .sort((a, b) => a.avg - b.avg);
  })();

  // Questões já tentadas que ainda precisam de treino (sem revelar o texto de tipos auditivos).
  const weak = [...stats.entries()]
    .filter(([, s]) => (s.bestContent ?? 0) < 90)
    .sort((a, b) => (a[1].bestContent ?? 0) - (b[1].bestContent ?? 0))
    .slice(0, 10)
    .flatMap(([qid, s]) => {
      const m = getMeta(qid);
      return m ? [{ meta: m, best: s.bestContent ?? 0 }] : [];
    });

  const streak = computeStreak(app);
  const recent = [...app.attempts].sort((a, b) => b.ts - a.ts).slice(0, 20);
  const diagnostics = diagnoseAttempts(app.attempts);
  const comparison = periodComparison(app.attempts);
  const weekly = weeklyTypeAverages(app.attempts, 6).slice(0, 6);
  const readiness = readinessBySection(app);
  const weakSection = weakestSection(readiness);
  const estimates = estimateBySkill(app);
  const overall = overallEstimate(app);

  // Relatório semanal: derivado do estado atual, sem ocupar localStorage.
  const report = weeklyReport(app, Date.now(), stats);
  const reportMarkdown = renderReportMarkdown(report);

  return {
    stats,
    series,
    chartPoints,
    topicScores,
    byType,
    weak,
    streak,
    recent,
    diagnostics,
    comparison,
    weekly,
    readiness,
    weakSection,
    estimates,
    overall,
    report,
    reportMarkdown,
  };
}

export type ProgressOverview = ReturnType<typeof buildProgressOverview>;
