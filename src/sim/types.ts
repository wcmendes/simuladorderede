// Tipos compartilhados do motor de simulação (TypeScript puro, sem Firebase).

export type NetMode = '/24' | '/25' | '/26';

export interface Faults {
  dnsDown: boolean;
  ispDown: boolean;
  gatewayDown: number[]; // índices de sub-rede com o gateway fora do ar
  lossPct: number; // 0 a 50
}

export const NO_FAULTS: Faults = { dnsDown: false, ispDown: false, gatewayDown: [], lossPct: 0 };

export interface Host {
  uid: string;
  name: string;
  pc: number;
  hostname: string;
  ip: string;
  mask: string;
  gateway: string;
  subnetIndex: number;
  mac: string; // 08-00-27-XX-XX-XX
  createdAt: number;
  lastSeen?: number; // ms; vem da coleção presence
}

export interface Site {
  name: string; // sem sufixo, ex.: padaria-do-ze
  ownerUid: string;
  ip: string;
  title: string;
  body: string;
  createdAt: number;
}

export type EventType = 'ping' | 'tracert' | 'nslookup' | 'curl' | 'ssh';

export interface SimEventDraft {
  type: EventType;
  fromIp: string;
  fromHost: string;
  toIp: string;
  toHost: string;
  ok: boolean;
}

export interface SimEvent extends SimEventDraft {
  id?: string;
  at: number;
}

export interface Line {
  text: string;
  delay?: number; // ms de espera antes de imprimir a linha
  kind?: 'out' | 'hint' | 'err';
}

export type Action =
  | { type: 'clear' }
  | { type: 'siteCreate'; name: string }
  | { type: 'siteEdit' }
  | { type: 'siteRemove' }
  | { type: 'browse'; url: string; title: string; body: string };

export interface Result {
  lines: Line[];
  events: SimEventDraft[];
  arpAdd: string[];
  actions: Action[];
}

export interface SimContext {
  me: Host;
  hosts: Host[]; // todos os hosts conhecidos da sessão (inclui o próprio)
  sites: Site[];
  faults: Faults;
  mode: NetMode;
  arpCache: string[]; // IPs de colegas já "vistos" (ping bem-sucedido)
  now: number;
  rng: () => number;
}
