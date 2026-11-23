// "Rede quebrada": uma falha escondida que o aluno precisa descobrir só com
// ping, nslookup, tracert e ipconfig. Funções puras.
import { NO_FAULTS, type Faults } from './types';

export type Falha = 'dns' | 'gateway' | 'provedor' | 'cabo';
export const FALHAS: Falha[] = ['dns', 'gateway', 'provedor', 'cabo'];

export const ROTULO_FALHA: Record<Falha, string> = {
  dns: 'DNS',
  gateway: 'Gateway',
  provedor: 'Provedor (link da internet)',
  cabo: 'Cabo/placa de rede',
};

/** Faltas completas com só a falha escolhida ligada. `subredes` = quantas sub-redes a sessão tem. */
export function aplicarFalha(falha: Falha, subredes: number): Faults {
  return {
    ...NO_FAULTS,
    dnsDown: falha === 'dns',
    ispDown: falha === 'provedor',
    gatewayDown: falha === 'gateway' ? Array.from({ length: subredes }, (_, i) => i) : [],
    cableDown: falha === 'cabo',
  };
}

/** Qual falha está ligada agora (null se nenhuma; a primeira, se houver mais de uma). */
export function falhaAtiva(f: Faults): Falha | null {
  if (f.cableDown) return 'cabo';
  if (f.dnsDown) return 'dns';
  if (f.gatewayDown.length > 0) return 'gateway';
  if (f.ispDown) return 'provedor';
  return null;
}

/** Sorteia uma falha diferente da anterior (para duas rodadas seguidas não repetirem). */
export function sortearFalha(rng: () => number, anterior?: Falha | null): Falha {
  const opcoes = FALHAS.filter((f) => f !== anterior);
  return opcoes[Math.floor(rng() * opcoes.length)];
}

/** Comandos que contam no desafio. Os demais comandos de rede ficam bloqueados. */
export const COMANDOS_DIAG = ['ping', 'nslookup', 'tracert', 'ipconfig'];
const LIVRES = ['help', 'cls', 'clear', 'hostname'];

export function classificarComando(linha: string): 'conta' | 'livre' | 'bloqueado' | 'vazio' {
  const cmd = linha.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (!cmd) return 'vazio';
  if (COMANDOS_DIAG.includes(cmd)) return 'conta';
  if (LIVRES.includes(cmd)) return 'livre';
  return 'bloqueado';
}

export interface RespostaDiag {
  uid: string;
  round: number;
  choice: Falha;
  cmds: number;
}

export interface LinhaDiag {
  uid: string;
  acertos: number;
  comandos: number; // soma dos comandos usados nas rodadas que acertou
  rodadas: number;
}

/**
 * Mais acertos primeiro; empate pelo menor número de comandos (diagnóstico mais direto).
 * Comandos gastos em rodadas erradas não "premiam" ninguém: só contam as certas.
 */
export function rankingDiag(respostas: RespostaDiag[], gabarito: Record<number, Falha>): LinhaDiag[] {
  const por = new Map<string, LinhaDiag>();
  for (const r of respostas) {
    if (!(r.round in gabarito)) continue;
    const l = por.get(r.uid) ?? { uid: r.uid, acertos: 0, comandos: 0, rodadas: 0 };
    l.rodadas += 1;
    if (r.choice === gabarito[r.round]) {
      l.acertos += 1;
      l.comandos += r.cmds;
    }
    por.set(r.uid, l);
  }
  return [...por.values()].sort((a, b) => b.acertos - a.acertos || a.comandos - b.comandos);
}
