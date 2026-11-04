// Definição das perguntas da Prática 1 e sua correção contra o host simulado.
import {
  INTERNET_SITES,
  maskToPrefix,
} from '../sim/net';
import { matchIp, matchNumber, matchText, norm } from '../sim/pratica';
import { expectedForHost, splitNetwork, b2Row } from '../sim/pratica';
import type { Host } from '../sim/types';

export interface QField {
  key: string;
  label: string;
  placeholder?: string;
}

export interface Question {
  id: string;
  title: string;
  command?: string; // comando sugerido para o botão "▶ Rodar"
  tip?: string;
  fields: QField[];
  part: 'A' | 'B' | 'C';
}

export const QUESTIONS: Question[] = [
  {
    id: 'A1', part: 'A', title: 'A1 — ipconfig /all', command: 'ipconfig /all',
    tip: "Procure as linhas 'Endereço IPv4', 'Máscara de Sub-rede', 'Gateway Padrão', 'Servidores DNS' e 'Endereço Físico'.",
    fields: [
      { key: 'A1_ipv4', label: 'Endereço IPv4' },
      { key: 'A1_mask', label: 'Máscara de Sub-rede' },
      { key: 'A1_gateway', label: 'Gateway Padrão' },
      { key: 'A1_dns', label: 'Servidor DNS' },
      { key: 'A1_mac', label: 'Endereço Físico (MAC)' },
      { key: 'A1_ipv6', label: 'Possui IPv6? (sim/não)' },
      { key: 'A1_dhcp', label: 'DHCP habilitado? (sim/não)' },
    ],
  },
  {
    id: 'A2', part: 'A', title: 'A2 — ping', command: 'ping 8.8.8.8',
    tip: 'Rode também "ping www.edufor.edu.br" para achar o IP dele.',
    fields: [
      { key: 'A2_avg', label: 'Tempo médio do ping a 8.8.8.8 (ms)' },
      { key: 'A2_lost', label: 'Pacotes perdidos' },
      { key: 'A2_eduforip', label: 'IP de www.edufor.edu.br' },
      { key: 'A2_service', label: 'Se o ping por nome falha mas por IP funciona, qual serviço está com problema?' },
    ],
  },
  {
    id: 'A3', part: 'A', title: 'A3 — tracert -d 8.8.8.8', command: 'tracert -d 8.8.8.8',
    tip: 'Conte as linhas numeradas. O primeiro salto é o seu gateway?',
    fields: [
      { key: 'A3_hops', label: 'Quantidade de saltos' },
      { key: 'A3_first', label: 'IP do primeiro salto' },
      { key: 'A3_isgw', label: 'O primeiro salto é o gateway? (sim/não)' },
    ],
  },
  {
    id: 'A4', part: 'A', title: 'A4 — nslookup www.edufor.edu.br', command: 'nslookup www.edufor.edu.br',
    tip: "Veja o 'Servidor' que respondeu e o 'Address' retornado.",
    fields: [
      { key: 'A4_server', label: 'Servidor DNS que respondeu' },
      { key: 'A4_ip', label: 'IP retornado' },
    ],
  },
  {
    id: 'A5', part: 'A', title: 'A5 — arp -a', command: 'arp -a',
    tip: 'Pingue um colega da sua sub-rede primeiro, depois rode arp -a.',
    fields: [
      { key: 'A5_ip1', label: 'IP (par 1)' },
      { key: 'A5_mac1', label: 'MAC (par 1)' },
      { key: 'A5_ip2', label: 'IP (par 2)' },
      { key: 'A5_mac2', label: 'MAC (par 2)' },
    ],
  },
  {
    id: 'A6', part: 'A', title: 'A6 — route print', command: 'route print',
    tip: 'Olhe a linha 0.0.0.0 0.0.0.0.',
    fields: [{ key: 'A6_gw', label: 'Gateway da rota padrão' }],
  },
  {
    id: 'A7', part: 'A', title: 'A7 — netstat -an', command: 'netstat -an',
    tip: 'Escolha uma conexão ESTABELECIDA e veja a porta externa.',
    fields: [
      { key: 'A7_conn', label: 'Uma conexão ESTABELECIDA (IP:porta)' },
      { key: 'A7_proto', label: 'Protocolo da porta (ex.: 443 = ?)' },
    ],
  },
  {
    id: 'B1', part: 'B', title: 'B1 — Seu endereço',
    tip: 'Calcule a partir do seu próprio IP e máscara (veja no topo da tela).',
    fields: [
      { key: 'B1_cidr', label: 'CIDR (ex.: /25)' },
      { key: 'B1_network', label: 'Endereço de rede' },
      { key: 'B1_broadcast', label: 'Broadcast' },
      { key: 'B1_first', label: 'Primeiro host válido' },
      { key: 'B1_last', label: 'Último host válido' },
      { key: 'B1_hosts', label: 'Quantidade de hosts' },
    ],
  },
  {
    id: 'B2', part: 'B', title: 'B2 — Tabela de endereços',
    tip: 'Para cada endereço, calcule máscara, rede, broadcast e nº de hosts.',
    fields: [
      { key: 'B2a_mask', label: '192.168.10.37/24 — Máscara' },
      { key: 'B2a_net', label: '192.168.10.37/24 — Rede' },
      { key: 'B2a_bc', label: '192.168.10.37/24 — Broadcast' },
      { key: 'B2a_hosts', label: '192.168.10.37/24 — Hosts' },
      { key: 'B2b_mask', label: '192.168.10.200/25 — Máscara' },
      { key: 'B2b_net', label: '192.168.10.200/25 — Rede' },
      { key: 'B2b_bc', label: '192.168.10.200/25 — Broadcast' },
      { key: 'B2b_hosts', label: '192.168.10.200/25 — Hosts' },
      { key: 'B2c_mask', label: '192.168.10.70/26 — Máscara' },
      { key: 'B2c_net', label: '192.168.10.70/26 — Rede' },
      { key: 'B2c_bc', label: '192.168.10.70/26 — Broadcast' },
      { key: 'B2c_hosts', label: '192.168.10.70/26 — Hosts' },
      { key: 'B2d_mask', label: '10.0.5.20/16 — Máscara' },
      { key: 'B2d_net', label: '10.0.5.20/16 — Rede' },
      { key: 'B2d_bc', label: '10.0.5.20/16 — Broadcast' },
      { key: 'B2d_hosts', label: '10.0.5.20/16 — Hosts' },
    ],
  },
  {
    id: 'B3', part: 'B', title: 'B3 — Dividir 192.168.20.0/24 em 4 sub-redes',
    tip: 'Cada sub-rede vira /26.',
    fields: [
      { key: 'B3_1net', label: 'Sub-rede 1 — Rede/CIDR' },
      { key: 'B3_1bc', label: 'Sub-rede 1 — Broadcast' },
      { key: 'B3_2net', label: 'Sub-rede 2 — Rede/CIDR' },
      { key: 'B3_2bc', label: 'Sub-rede 2 — Broadcast' },
      { key: 'B3_3net', label: 'Sub-rede 3 — Rede/CIDR' },
      { key: 'B3_3bc', label: 'Sub-rede 3 — Broadcast' },
      { key: 'B3_4net', label: 'Sub-rede 4 — Rede/CIDR' },
      { key: 'B3_4bc', label: 'Sub-rede 4 — Broadcast' },
    ],
  },
  {
    id: 'C', part: 'C', title: 'C — Máquina Virtual',
    tip: 'Preencha depois de criar e ligar a VM na aba VirtualBox.',
    fields: [
      { key: 'C_enp0s3', label: 'IP da enp0s3 (NAT)' },
      { key: 'C_enp0s8', label: 'IP da enp0s8 (Host-only)' },
      { key: 'C_pinggoogle', label: 'O ping para google.com funcionou? (sim/não)' },
    ],
  },
];

/** Corrige um campo contra o host simulado. Devolve true/false/undefined (não corrigível). */
export function checkField(key: string, value: string, me: Host, arpPairs: Array<{ ip: string; mac: string }>): boolean | undefined {
  if (!norm(value)) return undefined;
  const prefix = maskToPrefix(me.mask);
  const b1 = expectedForHost(me);

  switch (key) {
    // A1
    case 'A1_ipv4': return matchIp(value, me.ip);
    case 'A1_mask': return matchIp(value, me.mask);
    case 'A1_gateway': return matchIp(value, me.gateway);
    case 'A1_dns': return matchIp(value, '172.16.0.2');
    case 'A1_mac': return norm(value).replace(/[:-]/g, '') === me.mac.toLowerCase().replace(/[:-]/g, '');
    case 'A1_ipv6': return matchText(value, 'sim');
    case 'A1_dhcp': return matchText(value, 'sim');
    // A2
    case 'A2_eduforip': return matchIp(value, INTERNET_SITES['www.edufor.edu.br'].ip);
    case 'A2_service': return matchText(value, 'dns');
    case 'A2_lost': return matchNumber(value, 0);
    case 'A2_avg': return matchNumber(value, 15, 40); // tempo varia; tolerância larga
    // A3
    case 'A3_first': return matchIp(value, me.gateway);
    case 'A3_isgw': return matchText(value, 'sim');
    case 'A3_hops': return matchNumber(value, 5, 1); // internet: ~5-6 saltos
    // A4
    case 'A4_server': return norm(value).includes('dns.lab.edufor') || norm(value).includes('172.16.0.2');
    case 'A4_ip': return matchIp(value, INTERNET_SITES['www.edufor.edu.br'].ip);
    // A5
    case 'A5_ip1':
    case 'A5_ip2': return arpPairs.some((p) => matchIp(value, p.ip));
    case 'A5_mac1':
    case 'A5_mac2': return arpPairs.some((p) => norm(value).replace(/[:-]/g, '') === p.mac.toLowerCase().replace(/[:-]/g, ''));
    // A6
    case 'A6_gw': return matchIp(value, me.gateway);
    // A7
    case 'A7_proto': return matchText(value, 'https') || matchText(value, 'http');
    case 'A7_conn': return /:\d+/.test(value);
    // B1
    case 'B1_cidr': return norm(value).replace('/', '').replace('cidr', '').trim() === String(prefix);
    case 'B1_network': return matchIp(value, b1.network);
    case 'B1_broadcast': return matchIp(value, b1.broadcast);
    case 'B1_first': return matchIp(value, b1.first);
    case 'B1_last': return matchIp(value, b1.last);
    case 'B1_hosts': return matchNumber(value, b1.hosts);
  }

  // B2
  if (key.startsWith('B2')) return checkB2(key, value);
  // B3
  if (key.startsWith('B3')) return checkB3(key, value);
  // C
  if (key === 'C_enp0s3') return matchIp(value, '10.0.2.15');
  if (key === 'C_enp0s8') return matchIp(value, '192.168.56.101');
  if (key === 'C_pinggoogle') return matchText(value, 'sim');

  return undefined;
}

const B2_DEF: Record<string, { ip: string; prefix: number }> = {
  a: { ip: '192.168.10.37', prefix: 24 },
  b: { ip: '192.168.10.200', prefix: 25 },
  c: { ip: '192.168.10.70', prefix: 26 },
  d: { ip: '10.0.5.20', prefix: 16 },
};

function checkB2(key: string, value: string): boolean {
  const m = /^B2([a-d])_(mask|net|bc|hosts)$/.exec(key);
  if (!m) return false;
  const row = b2Row(B2_DEF[m[1]].ip, B2_DEF[m[1]].prefix);
  switch (m[2]) {
    case 'mask': return matchIp(value, row.mask);
    case 'net': return matchIp(value, row.network);
    case 'bc': return matchIp(value, row.broadcast);
    case 'hosts': return matchNumber(value, row.hosts);
  }
  return false;
}

function checkB3(key: string, value: string): boolean {
  const subs = splitNetwork('192.168.20.0', 24, 4);
  const m = /^B3_([1-4])(net|bc)$/.exec(key);
  if (!m) return false;
  const sub = subs[Number(m[1]) - 1];
  if (m[2] === 'net') {
    const v = norm(value).replace(/\s/g, '');
    return v === sub.cidr || matchIp(value, sub.network);
  }
  return matchIp(value, sub.broadcast);
}

/** Pontuação por parte (0..1) considerando só campos corrigíveis e preenchidos. */
export function scoreByPart(fields: Record<string, string>, me: Host, arpPairs: Array<{ ip: string; mac: string }>) {
  const parts = { A: { ok: 0, total: 0 }, B: { ok: 0, total: 0 }, C: { ok: 0, total: 0 } };
  for (const q of QUESTIONS) {
    for (const f of q.fields) {
      const r = checkField(f.key, fields[f.key] ?? '', me, arpPairs);
      if (r === undefined) continue;
      parts[q.part].total++;
      if (r) parts[q.part].ok++;
    }
  }
  return parts;
}
