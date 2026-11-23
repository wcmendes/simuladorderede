// Cálculos de máscara de rede (porte do protótipo). Funções puras, sem DOM e sem Firebase.

export const toInt = (s: string): number | null => {
  const p = String(s).trim().split('.');
  if (p.length !== 4) return null;
  let v = 0;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x) || +x > 255) return null;
    v = v * 256 + +x;
  }
  return v >>> 0;
};

export const toStr = (v: number): string => [24, 16, 8, 0].map((s) => (v >>> s) & 255).join('.');

export const maskOf = (c: number): number => (c === 0 ? 0 : (0xffffffff << (32 - c)) >>> 0);

export interface Info {
  m: number; // máscara
  net: number; // endereço de rede
  bc: number; // broadcast
  n: number; // bits de host
  hosts: number;
  first: number;
  last: number;
}

export const info = (ip: number, c: number): Info => {
  const m = maskOf(c);
  const net = (ip & m) >>> 0;
  const bc = (net | (~m >>> 0)) >>> 0;
  const n = 32 - c;
  return { m, net, bc, n, hosts: 2 ** n - 2, first: (net + 1) >>> 0, last: (bc - 1) >>> 0 };
};

export const octs = (v: number): number[] => [24, 16, 8, 0].map((s) => (v >>> s) & 255);
export const bin = (x: number): string => x.toString(2).padStart(8, '0');
/** Índice (0 a 3) do bloco onde a máscara "corta". */
export const cutOct = (c: number): number => Math.min(3, Math.floor(c / 8));
export const fmt = (n: number): string => n.toLocaleString('pt-BR');

export const NOMES_BLOCO = ['1º', '2º', '3º', '4º'];

/** "192.168.20.0/24" -> { ip, c }. */
export function parseCidr(s: string): { ip: number; c: number } | null {
  const partes = s.trim().split('/');
  if (partes.length !== 2) return null;
  const ip = toInt(partes[0]);
  if (ip === null || !/^\d{1,2}$/.test(partes[1].trim())) return null;
  return { ip, c: Number(partes[1]) };
}

// --- Passo a passo (o "truque do salto") ---

export interface Passos {
  c: number;
  n: number;
  mascara: number;
  k: number; // bloco cortado
  mk: number; // valor da máscara nesse bloco
  ipk: number; // valor do IP nesse bloco
  netk: number; // valor da rede nesse bloco
  salto: number; // 256 - mk
  proxima: number; // netk + salto
  fechado: boolean; // c múltiplo de 8: nenhum bloco é cortado
  blocosCheios: number; // c / 8 quando fechado
  hosts: number;
  rede: number;
  bc: number;
}

export function passos(ip: number, c: number): Passos {
  const r = info(ip, c);
  const k = cutOct(c);
  const mk = octs(r.m)[k];
  const salto = 256 - mk;
  const netk = octs(r.net)[k];
  return {
    c,
    n: r.n,
    mascara: r.m,
    k,
    mk,
    ipk: octs(ip)[k],
    netk,
    salto,
    proxima: netk + salto,
    fechado: c % 8 === 0,
    blocosCheios: Math.floor(c / 8),
    hosts: r.hosts,
    rede: r.net,
    bc: r.bc,
  };
}

// --- Mesma rede? ---

export function mesmaRede(a: number, b: number, c: number): boolean {
  return info(a, c).net === info(b, c).net;
}

/** Posição (0 a 31) do primeiro bit de rede que difere entre A e B; -1 se todos iguais. */
export function primeiroBitDiferente(a: number, b: number, c: number): number {
  for (let i = 0; i < c; i++) {
    if (((a >>> (31 - i)) & 1) !== ((b >>> (31 - i)) & 1)) return i;
  }
  return -1;
}

// --- Dividir em sub-redes ---

export interface Divisao {
  c: number;
  novoC: number;
  add: number;
  partes: number;
  tamanho: number;
  base: number;
  subredes: Info[];
}

/** Divide a rede (ip/c) em `partes` (potência de 2). Devolve null se sobrar menos de 2 hosts. */
export function dividir(ip: number, c: number, partes: number): Divisao | null {
  const add = Math.log2(partes);
  if (!Number.isInteger(add)) return null;
  const novoC = c + add;
  if (novoC > 30) return null;
  const base = info(ip, c).net;
  const tamanho = 2 ** (32 - novoC);
  const subredes = Array.from({ length: partes }, (_, i) => info((base + i * tamanho) >>> 0, novoC));
  return { c, novoC, add, partes, tamanho, base, subredes };
}

// --- Desafio ---

export type Tipo = 'rede' | 'broadcast' | 'hosts' | 'mesma';
export const TIPOS: Tipo[] = ['rede', 'broadcast', 'hosts', 'mesma'];
export const ROTULO_TIPO: Record<Tipo, string> = {
  rede: 'Endereço de rede',
  broadcast: 'Broadcast',
  hosts: 'Quantidade de hosts',
  mesma: 'Mesma rede?',
};

export type Nivel = 'todos' | 'facil' | 'medio';
export const ROTULO_NIVEL: Record<Nivel, string> = {
  todos: 'Todos os níveis (/16 a /27)',
  facil: 'Fácil (/24 e /16)',
  medio: 'Médio (/25 a /27)',
};

const PREFIXOS_PADRAO = [24, 24, 25, 25, 26, 26, 27, 16];

export function prefixosDoNivel(nivel: Nivel): number[] {
  if (nivel === 'facil') return [24, 16];
  if (nivel === 'medio') return [25, 26, 27];
  return PREFIXOS_PADRAO;
}

export interface Pergunta {
  tipo: Tipo;
  ip: number;
  c: number;
  outro?: number; // segundo IP (tipo "mesma")
  resposta: string;
}

const BASES: Array<[number, number]> = [
  [192, 168],
  [10, 0],
  [172, 16],
];

export function gerarPergunta(
  rng: () => number,
  opcoes: { tipo?: Tipo | 'todos'; nivel?: Nivel } = {},
): Pergunta {
  const rnd = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const prefixos = prefixosDoNivel(opcoes.nivel ?? 'todos');
  const [b0, b1] = BASES[rnd(0, BASES.length - 1)];
  const c = prefixos[rnd(0, prefixos.length - 1)];
  const ip = toInt(`${b0}.${b1}.${rnd(0, 30)}.${rnd(1, 254)}`)!;
  const r = info(ip, c);
  const tipo: Tipo = !opcoes.tipo || opcoes.tipo === 'todos' ? TIPOS[rnd(0, TIPOS.length - 1)] : opcoes.tipo;

  if (tipo === 'rede') return { tipo, ip, c, resposta: toStr(r.net) };
  if (tipo === 'broadcast') return { tipo, ip, c, resposta: toStr(r.bc) };
  if (tipo === 'hosts') return { tipo, ip, c, resposta: String(r.hosts) };
  const outro = (ip ^ (1 << rnd(0, 10))) >>> 0;
  return { tipo, ip, c, outro, resposta: mesmaRede(ip, outro, c) ? 'sim' : 'não' };
}

export function conferir(p: Pergunta, texto: string): boolean {
  const r = info(p.ip, p.c);
  if (p.tipo === 'rede') return toInt(texto) === r.net;
  if (p.tipo === 'broadcast') return toInt(texto) === r.bc;
  if (p.tipo === 'hosts') {
    const digitos = String(texto).replace(/\D/g, '');
    return digitos !== '' && Number(digitos) === r.hosts;
  }
  const t = String(texto).trim().toLowerCase().replace('nao', 'não');
  return t === p.resposta;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = (n: number): string => [...String(n)].map((d) => SUP[+d]).join('');

/** Explicação em texto puro, pelo truque do salto. */
export function explicacao(p: Pergunta): string {
  const r = info(p.ip, p.c);
  if (p.tipo === 'hosts') return `/${p.c} deixa ${32 - p.c} bits de host: 2${sup(32 - p.c)} − 2 = ${fmt(r.hosts)}.`;
  const s = passos(p.ip, p.c);
  const base = s.fechado
    ? `Com /${p.c}, os ${s.blocosCheios} primeiros blocos são a rede.`
    : `Máscara ${toStr(r.m)}: salto = 256 − ${s.mk} = ${s.salto}. O IP tem ${s.ipk} no ${s.k + 1}º bloco; a rede começa em ${s.netk}.`;
  if (p.tipo === 'rede') return `${base} Rede: ${toStr(r.net)}.`;
  if (p.tipo === 'broadcast') return `${base} Broadcast: ${toStr(r.bc)} (o último antes da próxima rede).`;
  const ro = info(p.outro!, p.c);
  return `Rede de A: ${toStr(r.net)} · rede de B: ${toStr(ro.net)}. ${
    r.net === ro.net ? 'Iguais: mesma rede.' : 'Diferentes: precisam do roteador.'
  }`;
}
