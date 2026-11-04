// Correção das respostas da Prática 1 (Partes A e B). Motor puro.
import { intToIp, ipToInt, isValidIp, maskToPrefix, netInfo, prefixToMask } from './net';
import type { Host } from './types';

export function norm(s: string): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Compara ignorando maiúsculas/espaços. Aceita variações de sim/não. */
export function matchText(answer: string, expected: string): boolean {
  const a = norm(answer);
  const e = norm(expected);
  if (a === e) return true;
  const yes = ['sim', 's', 'yes', 'y', 'true', 'verdadeiro'];
  const no = ['não', 'nao', 'n', 'no', 'false', 'falso'];
  if (yes.includes(e)) return yes.includes(a);
  if (no.includes(e)) return no.includes(a);
  return false;
}

export function matchIp(answer: string, expected: string): boolean {
  return norm(answer).replace(/\s/g, '') === expected.trim();
}

/** Tolerância numérica (para tempo médio de ping etc.). */
export function matchNumber(answer: string, expected: number, tol = 0): boolean {
  const n = parseFloat(norm(answer).replace(',', '.').replace(/[^\d.-]/g, ''));
  if (isNaN(n)) return false;
  return Math.abs(n - expected) <= tol;
}

// --- Parte B: cálculos de endereçamento ---

export interface SubnetAnswer {
  cidr: string; // ex.: "/25" ou "25"
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  hostCount: string;
}

export interface SubnetExpected {
  prefix: number;
  network: string;
  broadcast: string;
  first: string;
  last: string;
  hosts: number;
}

export function expectedForIpPrefix(ip: string, prefix: number): SubnetExpected {
  const info = netInfo(ip, prefix);
  return {
    prefix,
    network: info.network,
    broadcast: info.broadcast,
    first: info.first,
    last: info.last,
    hosts: info.hosts,
  };
}

/** Calcula o esperado a partir do IP e da máscara do host (B1). */
export function expectedForHost(host: Pick<Host, 'ip' | 'mask'>): SubnetExpected {
  const prefix = maskToPrefix(host.mask);
  return expectedForIpPrefix(host.ip, prefix);
}

function cidrMatches(answer: string, prefix: number): boolean {
  const a = norm(answer).replace(/\//g, '').replace('cidr', '').trim();
  return a === String(prefix);
}

export interface B1Fields {
  cidr?: string;
  network?: string;
  broadcast?: string;
  firstHost?: string;
  lastHost?: string;
  hostCount?: string;
}

export interface B1Check {
  cidr: boolean;
  network: boolean;
  broadcast: boolean;
  firstHost: boolean;
  lastHost: boolean;
  hostCount: boolean;
  allCorrect: boolean;
}

export function checkB1(fields: B1Fields, exp: SubnetExpected): B1Check {
  const cidr = cidrMatches(fields.cidr ?? '', exp.prefix);
  const network = matchIp(fields.network ?? '', exp.network);
  const broadcast = matchIp(fields.broadcast ?? '', exp.broadcast);
  const firstHost = matchIp(fields.firstHost ?? '', exp.first);
  const lastHost = matchIp(fields.lastHost ?? '', exp.last);
  const hostCount = matchNumber(fields.hostCount ?? '', exp.hosts);
  return {
    cidr, network, broadcast, firstHost, lastHost, hostCount,
    allCorrect: cidr && network && broadcast && firstHost && lastHost && hostCount,
  };
}

/** Para a tabela B2: dado IP/prefixo, devolve máscara, rede, broadcast, hosts. */
export function b2Row(ip: string, prefix: number) {
  const info = netInfo(ip, prefix);
  return { mask: info.mask, network: info.network, broadcast: info.broadcast, hosts: info.hosts };
}

/** Para B3: divide uma rede em `count` sub-redes iguais. */
export function splitNetwork(baseIp: string, basePrefix: number, count: number) {
  if (!isValidIp(baseIp)) return [];
  const bits = Math.ceil(Math.log2(count));
  const newPrefix = basePrefix + bits;
  const size = 2 ** (32 - newPrefix);
  const start = ipToInt(netInfo(baseIp, basePrefix).network);
  return Array.from({ length: count }, (_, i) => {
    const net = start + i * size;
    const info = netInfo(intToIp(net), newPrefix);
    return {
      cidr: `${info.network}/${newPrefix}`,
      network: info.network,
      first: info.first,
      last: info.last,
      broadcast: info.broadcast,
      mask: prefixToMask(newPrefix),
      hosts: info.hosts,
    };
  });
}
