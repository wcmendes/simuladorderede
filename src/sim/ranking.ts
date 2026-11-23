// Placar do Desafio da máscara: contadores do aluno e agregações do professor.
import { TIPOS, type Tipo } from './mascara';

export type PorTipo = Record<Tipo, { ok: number; total: number }>;

export interface Score {
  ok: number;
  total: number;
  streak: number; // acertos seguidos
  byKind: PorTipo;
}

export function porTipoVazio(): PorTipo {
  return { rede: { ok: 0, total: 0 }, broadcast: { ok: 0, total: 0 }, hosts: { ok: 0, total: 0 }, mesma: { ok: 0, total: 0 } };
}

export function scoreVazio(): Score {
  return { ok: 0, total: 0, streak: 0, byKind: porTipoVazio() };
}

/** Devolve um novo Score com a resposta contabilizada. */
export function aplicarResposta(s: Score, tipo: Tipo, ok: boolean): Score {
  const byKind = porTipoVazio();
  for (const t of TIPOS) byKind[t] = { ...(s.byKind?.[t] ?? { ok: 0, total: 0 }) };
  byKind[tipo].total += 1;
  if (ok) byKind[tipo].ok += 1;
  return { ok: s.ok + (ok ? 1 : 0), total: s.total + 1, streak: ok ? s.streak + 1 : 0, byKind };
}

/** Lê um Score salvo (localStorage ou Firestore), tolerando dados incompletos. */
export function normalizarScore(raw: unknown): Score {
  const v = (raw ?? {}) as Partial<Score>;
  const base = scoreVazio();
  const byKind = porTipoVazio();
  for (const t of TIPOS) byKind[t] = { ok: v.byKind?.[t]?.ok ?? 0, total: v.byKind?.[t]?.total ?? 0 };
  return { ok: v.ok ?? base.ok, total: v.total ?? base.total, streak: v.streak ?? base.streak, byKind };
}

export interface LinhaRanking {
  uid: string;
  name: string;
  ok: number;
  total: number;
  streak: number;
}

/** Mais acertos primeiro; empate pelo menor número de tentativas. */
export function ordenarRanking<T extends { ok: number; total: number; name: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => b.ok - a.ok || a.total - b.total || a.name.localeCompare(b.name, 'pt-BR'));
}

/** Percentual de acerto da turma por tipo de pergunta (null se ninguém respondeu). */
export function percentualPorTipo(scores: Array<{ byKind?: PorTipo }>): Record<Tipo, { ok: number; total: number; pct: number | null }> {
  const out = {} as Record<Tipo, { ok: number; total: number; pct: number | null }>;
  for (const t of TIPOS) {
    let ok = 0;
    let total = 0;
    for (const s of scores) {
      ok += s.byKind?.[t]?.ok ?? 0;
      total += s.byKind?.[t]?.total ?? 0;
    }
    out[t] = { ok, total, pct: total ? Math.round((ok / total) * 100) : null };
  }
  return out;
}
