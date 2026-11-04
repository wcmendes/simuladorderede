// Utilitários de endereçamento IPv4 e topologia do laboratório.
import type { NetMode } from './types';

export const LAB_BASE = '192.168.10.0';
export const DNS_IP = '172.16.0.2';
export const DNS_NAME = 'dns.lab.edufor';
export const CAMPUS_IP = '10.0.0.1';
export const LAB_UPLINK_IP = '10.0.0.2';
export const PROVIDER_IP = '200.150.10.1';
export const BACKBONE_IP = '187.16.216.1';
export const DOMAIN = 'turma.lab';
export const RT_MAC = '00-1a-2b-3c-4d-5e';
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export const INTERNET_SITES: Record<string, { ip: string; title: string; body: string }> = {
  'www.edufor.edu.br': { ip: '200.150.20.10', title: 'Faculdade EDUFOR', body: 'Bem-vindo ao portal da Faculdade EDUFOR, em São Luís/MA.' },
  'www.google.com': { ip: '142.250.79.36', title: 'Google', body: 'Pesquisar na web.' },
  'dns.google': { ip: '8.8.8.8', title: 'Google Public DNS', body: 'Servidor DNS público do Google.' },
  'www.gov.br': { ip: '161.148.164.31', title: 'Portal gov.br', body: 'Portal do Governo Federal.' },
};

export const INTERNET_IPS = new Set(Object.values(INTERNET_SITES).map((s) => s.ip));

export function isValidIp(s: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return false;
  return m.slice(1).every((p) => Number(p) <= 255 && String(Number(p)) === p);
}

export function ipToInt(ip: string): number {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export function prefixToMask(prefix: number): string {
  const m = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return intToIp(m);
}

/** Devolve o prefixo (0..32) ou -1 se a máscara não for contígua. */
export function maskToPrefix(mask: string): number {
  if (!isValidIp(mask)) return -1;
  const n = ipToInt(mask);
  let ones = 0;
  while (ones < 32 && (n & (1 << (31 - ones))) !== 0) ones++;
  const rebuilt = ones === 0 ? 0 : (0xffffffff << (32 - ones)) >>> 0;
  return rebuilt === n ? ones : -1;
}

export interface NetInfo {
  prefix: number;
  mask: string;
  network: string;
  broadcast: string;
  first: string;
  last: string;
  hosts: number;
}

export function netInfo(ip: string, prefix: number): NetInfo {
  const mask = ipToInt(prefixToMask(prefix));
  const network = (ipToInt(ip) & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const hosts = prefix >= 31 ? 0 : 2 ** (32 - prefix) - 2;
  return {
    prefix,
    mask: intToIp(mask),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    first: hosts > 0 ? intToIp(network + 1) : intToIp(network),
    last: hosts > 0 ? intToIp(broadcast - 1) : intToIp(broadcast),
    hosts,
  };
}

export function sameNetwork(a: string, b: string, prefix: number): boolean {
  return netInfo(a, prefix).network === netInfo(b, prefix).network;
}

export interface Subnet {
  index: number;
  network: string;
  prefix: number;
  mask: string;
  gateway: string;
  broadcast: string;
}

export function prefixOfMode(mode: NetMode): number {
  return Number(mode.slice(1));
}

export function subnetsFor(mode: NetMode): Subnet[] {
  const prefix = prefixOfMode(mode);
  const size = 2 ** (32 - prefix);
  const count = 256 / size;
  const base = ipToInt(LAB_BASE);
  return Array.from({ length: count }, (_, i) => {
    const info = netInfo(intToIp(base + i * size), prefix);
    return {
      index: i,
      network: info.network,
      prefix,
      mask: info.mask,
      gateway: intToIp(ipToInt(info.network) + 1),
      broadcast: info.broadcast,
    };
  });
}

/** Distribui os computadores 1..40 pelas sub-redes, em faixas contíguas. */
export function subnetIndexForPc(pc: number, mode: NetMode): number {
  const count = subnetsFor(mode).length;
  const perSubnet = Math.ceil(40 / count);
  return Math.min(Math.floor((pc - 1) / perSubnet), count - 1);
}

/** O primeiro IP de aluno é gateway + 9 (ex.: .10 na primeira sub-rede). */
export const FIRST_HOST_OFFSET = 10;

export function ipForOffset(subnet: Subnet, offset: number): string | null {
  const ip = ipToInt(subnet.network) + offset;
  if (ip >= ipToInt(subnet.broadcast)) return null;
  return intToIp(ip);
}

export function gatewayList(mode: NetMode): string[] {
  return subnetsFor(mode).map((s) => s.gateway);
}

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function hostnameFor(fullName: string, pc: number): string {
  const first = stripAccents(fullName.trim().split(/\s+/)[0] ?? 'aluno')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `PC-${first || 'aluno'}-${String(pc).padStart(2, '0')}`;
}

export function randomMac(rng: () => number = Math.random): string {
  const b = () => Math.floor(rng() * 256).toString(16).padStart(2, '0').toUpperCase();
  return `08-00-27-${b()}-${b()}-${b()}`;
}

/** IPv6 de link local derivado do MAC (EUI-64), como o Windows mostra. */
export function ipv6LinkLocal(mac: string): string {
  const b = mac.split(/[-:]/).map((x) => parseInt(x, 16));
  b[0] ^= 0x02;
  const g = (hi: number, lo: number) => ((hi << 8) | lo).toString(16);
  return `fe80::${g(b[0], b[1])}:${g(b[2], 0xff)}:${g(0xfe, b[3])}:${g(b[4], b[5])}`;
}

export function normalizeMac(mac: string): string {
  return mac.trim().toLowerCase().replace(/:/g, '-');
}

/** Distância de edição (Levenshtein) para sugerir "Você quis dizer". */
export function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
