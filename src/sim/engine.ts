// Motor da simulação: recebe o estado da rede + um comando e devolve
// as linhas de saída, os eventos a gravar e as ações de UI.
import { resolveName, reverseLookup, siteByIp } from './dns';
import { HELP, HelpEntry } from './help';
import {
  DNS_IP,
  DNS_NAME,
  DOMAIN,
  INTERNET_SITES,
  RT_MAC,
  editDistance,
  escapeHtml,
  ipToInt,
  isValidIp,
  netInfo,
} from './net';
import { computePath, hopLatency } from './routing';
import type { Line, Result, SimContext, SimEventDraft } from './types';

const KNOWN = [
  'ipconfig', 'ping', 'tracert', 'nslookup', 'arp', 'route', 'netstat',
  'hostname', 'getmac', 'cls', 'clear', 'help', 'curl', 'navegar', 'site',
];

function out(text = '', delay?: number): Line {
  return { text, delay, kind: 'out' };
}
function hint(text: string): Line {
  return { text, kind: 'hint' };
}
function err(text: string): Line {
  return { text, kind: 'err' };
}

function empty(): Result {
  return { lines: [], events: [], arpAdd: [], actions: [] };
}

/** Ponto de entrada: processa uma linha de comando. */
export function runCommand(ctx: SimContext, input: string): Result {
  const trimmed = input.trim();
  if (!trimmed) return empty();

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // <comando> /? -> ajuda detalhada
  if (args.includes('/?')) {
    const base = cmd === 'clear' ? 'cls' : cmd;
    if (HELP[base]) return { ...empty(), lines: helpDetail(HELP[base]) };
  }

  switch (cmd) {
    case 'ipconfig':
      return ipconfig(ctx, args);
    case 'ping':
      return ping(ctx, args);
    case 'tracert':
      return tracert(ctx, args);
    case 'nslookup':
      return nslookup(ctx, args);
    case 'arp':
      return arp(ctx, args);
    case 'route':
      return route(ctx, args);
    case 'netstat':
      return netstat(ctx, args);
    case 'hostname':
      return { ...empty(), lines: [out(ctx.me.hostname)] };
    case 'getmac':
      return getmac(ctx);
    case 'cls':
    case 'clear':
      return { ...empty(), actions: [{ type: 'clear' }] };
    case 'help':
      return help(args);
    case 'curl':
    case 'navegar':
      return curl(ctx, args, cmd === 'navegar');
    case 'site':
      return site(ctx, args);
    default:
      return unknown(cmd);
  }
}

// ---------------------------------------------------------------------------
// ipconfig
// ---------------------------------------------------------------------------
function ipconfig(ctx: SimContext, args: string[]): Result {
  const all = args.some((a) => a.toLowerCase() === '/all');
  const me = ctx.me;
  const v6 = ipv6Of(me.mac);
  const lines: Line[] = [out(), out('Adaptador Ethernet Ethernet:'), out()];

  if (ctx.faults.cableDown) {
    lines.push(out('   Estado da mídia. . . . . . . . . . . . . . : mídia desconectada'));
    lines.push(out(`   Sufixo DNS específico de conexão. . . . . . : ${DOMAIN}`));
    if (all) {
      lines.push(
        out('   Descrição . . . . . . . . . . . . . . . . . : Intel(R) Ethernet Connection'),
        out(`   Endereço Físico . . . . . . . . . . . . . . : ${me.mac}`),
        out('   DHCP Habilitado . . . . . . . . . . . . . . : Sim'),
      );
    }
    lines.push(out());
    return { ...empty(), lines };
  }

  if (all) {
    lines.push(
      out(`   Sufixo DNS específico de conexão. . . . . . : ${DOMAIN}`),
      out('   Descrição . . . . . . . . . . . . . . . . . : Intel(R) Ethernet Connection'),
      out(`   Endereço Físico . . . . . . . . . . . . . . : ${me.mac}`),
      out('   DHCP Habilitado . . . . . . . . . . . . . . : Sim'),
      out(`   Endereço IPv6 de link local . . . . . . . . : ${v6}%7(Preferencial)`),
      out(`   Endereço IPv4. . . . . . . . . . . . . . . : ${me.ip}(Preferencial)`),
      out(`   Máscara de Sub-rede . . . . . . . . . . . . : ${me.mask}`),
      out(`   Gateway Padrão. . . . . . . . . . . . . . . : ${me.gateway}`),
      out(`   Servidor DHCP . . . . . . . . . . . . . . . : ${me.gateway}`),
      out(`   Servidores DNS. . . . . . . . . . . . . . . : ${DNS_IP}`),
    );
  } else {
    lines.push(
      out(`   Sufixo DNS específico de conexão. . . . . . : ${DOMAIN}`),
      out(`   Endereço IPv6 de link local . . . . . . . . : ${v6}%7`),
      out(`   Endereço IPv4. . . . . . . . . . . . . . . : ${me.ip}`),
      out(`   Máscara de Sub-rede . . . . . . . . . . . . : ${me.mask}`),
      out(`   Gateway Padrão. . . . . . . . . . . . . . . : ${me.gateway}`),
    );
  }
  lines.push(out());
  return { ...empty(), lines };
}

function ipv6Of(mac: string): string {
  const b = mac.split('-').map((x) => parseInt(x, 16));
  b[0] ^= 0x02;
  const g = (hi: number, lo: number) => ((hi << 8) | lo).toString(16);
  return `fe80::${g(b[0], b[1])}:${g(b[2], 0xff)}:${g(0xfe, b[3])}:${g(b[4], b[5])}`;
}

// ---------------------------------------------------------------------------
// ping
// ---------------------------------------------------------------------------
function ping(ctx: SimContext, args: string[]): Result {
  const positional = args.filter((a) => !a.startsWith('-'));
  const target = positional[0];
  if (!target) {
    return { ...empty(), lines: [hint('Uso: ping <IP ou nome>. Exemplo: ping 8.8.8.8')] };
  }
  let count = 4;
  const nIdx = args.findIndex((a) => a.toLowerCase() === '-n');
  if (nIdx >= 0 && args[nIdx + 1]) {
    const n = parseInt(args[nIdx + 1], 10);
    if (!isNaN(n) && n > 0) count = Math.min(n, 10);
  }

  const byIp = isValidIp(target);
  let destIp: string;
  let display: string;

  if (byIp) {
    destIp = target;
    const rev = reverseLookup(ctx, target);
    display = `${target}`;
    void rev;
  } else {
    if (ctx.faults.dnsDown || ctx.faults.cableDown) {
      return {
        ...empty(),
        lines: [
          out(`A solicitação ping não pôde encontrar o host ${target}. Verifique o nome e tente novamente.`),
          ...dnsHintLines(),
        ],
      };
    }
    const res = resolveName(ctx, target);
    if (!res) {
      return {
        ...empty(),
        lines: [out(`A solicitação ping não pôde encontrar o host ${target}. Verifique o nome e tente novamente.`)],
      };
    }
    destIp = res.ip;
    display = `${res.fqdn} [${res.ip}]`;
  }

  const path = computePath(ctx, destIp);
  const lines: Line[] = [out(`Disparando ${display} com 32 bytes de dados:`)];

  if (ctx.faults.cableDown) {
    for (let i = 0; i < count; i++) lines.push(out('PING: falha geral.', 600));
    lines.push(out(), out(`Estatísticas do Ping para ${destIp}:`));
    lines.push(out(`    Pacotes: Enviados = ${count}, Recebidos = 0, Perdidos = ${count} (100% de perda),`));
    return { ...empty(), lines };
  }

  const peer = ctx.hosts.find((h) => h.ip === destIp && h.uid !== ctx.me.uid);
  const events: SimEventDraft[] = [];
  const arpAdd: string[] = [];

  // Perda de pacotes aplicada a todos os pings bem-sucedidos.
  const times: number[] = [];
  let received = 0;

  for (let i = 0; i < count; i++) {
    const lost = !path.reachable || ctx.rng() * 100 < ctx.faults.lossPct;
    if (lost) {
      lines.push(out('Esgotado o tempo limite do pedido.', 600));
    } else {
      received++;
      const rtt = totalLatency(ctx, path);
      times.push(rtt);
      const ttl = path.destTtlBase - (path.hops.length - 1);
      lines.push(out(`Resposta de ${destIp}: bytes=32 tempo=${rtt}ms TTL=${ttl}`, 600));
    }
  }

  // Estatísticas no formato do Windows.
  const lostCount = count - received;
  const lostPct = Math.round((lostCount / count) * 100);
  lines.push(out());
  lines.push(out(`Estatísticas do Ping para ${destIp}:`));
  lines.push(out(`    Pacotes: Enviados = ${count}, Recebidos = ${received}, Perdidos = ${lostCount} (${lostPct}% de perda),`));
  if (times.length > 0) {
    const min = Math.min(...times);
    const max = Math.max(...times);
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    lines.push(out('Aproximar um número redondo de vezes em milissegundos:'));
    lines.push(out(`    Mínimo = ${min}ms, Máximo = ${max}ms, Média = ${avg}ms`));
  }

  // Dica de contexto quando falha por causa de falha ativa.
  if (!path.reachable && !byIp) lines.push(...dnsHintLines());
  else if (!path.reachable && byIp) lines.push(hint('Dica: o destino não respondeu. Ele existe? O caminho até lá está no ar? Tente tracert.'));

  // Evento + ARP só para interação entre alunos (mesma sub-rede entra no cache ARP).
  if (peer && received > 0) {
    events.push({
      type: 'ping', fromIp: ctx.me.ip, fromHost: ctx.me.hostname,
      toIp: peer.ip, toHost: peer.hostname, ok: true,
    });
    if (peer.subnetIndex === ctx.me.subnetIndex) arpAdd.push(peer.ip);
  }

  return { lines, events, arpAdd, actions: [] };
}

function totalLatency(ctx: SimContext, path: ReturnType<typeof computePath>): number {
  let sum = 0;
  for (const h of path.hops) sum += hopLatency(ctx, h.ip);
  return Math.max(1, sum);
}

function dnsHintLines(): Line[] {
  return [hint('Dica: tente o mesmo destino pelo IP. Se funcionar, o problema é…')];
}

// ---------------------------------------------------------------------------
// tracert
// ---------------------------------------------------------------------------
function tracert(ctx: SimContext, args: string[]): Result {
  const noResolve = args.some((a) => a.toLowerCase() === '-d');
  const target = args.filter((a) => !a.startsWith('-'))[0];
  if (!target) {
    return { ...empty(), lines: [hint('Uso: tracert <IP ou nome>. Exemplo: tracert www.google.com')] };
  }

  const byIp = isValidIp(target);
  let destIp: string;
  let display: string;

  if (byIp) {
    destIp = target;
    display = target;
  } else {
    if (ctx.faults.dnsDown || ctx.faults.cableDown) {
      return { ...empty(), lines: [out(`Não é possível resolver o sistema de destino ${target}.`), ...dnsHintLines()] };
    }
    const res = resolveName(ctx, target);
    if (!res) return { ...empty(), lines: [out(`Não é possível resolver o sistema de destino ${target}.`)] };
    destIp = res.ip;
    display = `${res.fqdn} [${res.ip}]`;
  }

  const path = computePath(ctx, destIp);
  const lines: Line[] = [
    out(`Rastreando a rota para ${display}`),
    out('com no máximo 30 saltos:'),
    out(),
  ];

  if (ctx.faults.cableDown) {
    lines.push(out('  1  Falha geral.', 500), out(), out('Rastreamento concluído.'));
    return { ...empty(), lines };
  }

  const events: SimEventDraft[] = [];
  path.hops.forEach((hop, i) => {
    const n = String(i + 1).padStart(3, ' ');
    if (hop.ip === null) {
      lines.push(out(`${n}     *        *        *     Esgotado o tempo limite do pedido.`, 500));
    } else {
      const t = () => `${String(hopLatency(ctx, hop.ip)).padStart(2, ' ')} ms`;
      const name = !noResolve && hop.label ? `${hop.label} [${hop.ip}]` : hop.ip;
      lines.push(out(`${n}    ${t()}    ${t()}    ${t()}  ${name}`, 500));
    }
  });

  lines.push(out());
  lines.push(out('Rastreamento concluído.'));

  if (!path.reachable) {
    if (!byIp) lines.push(...dnsHintLines());
    else lines.push(hint('Dica: o rastreamento parou antes do destino. Algum salto do caminho está fora do ar.'));
  }

  const peer = ctx.hosts.find((h) => h.ip === destIp && h.uid !== ctx.me.uid);
  if (peer && path.reachable) {
    events.push({ type: 'tracert', fromIp: ctx.me.ip, fromHost: ctx.me.hostname, toIp: peer.ip, toHost: peer.hostname, ok: true });
  }

  return { ...empty(), lines, events };
}

// ---------------------------------------------------------------------------
// nslookup
// ---------------------------------------------------------------------------
function nslookup(ctx: SimContext, args: string[]): Result {
  const target = args[0];
  if (!target) {
    return { ...empty(), lines: [hint('Uso: nslookup <nome ou IP>. Exemplo: nslookup www.edufor.edu.br')] };
  }

  if (ctx.faults.dnsDown || ctx.faults.cableDown) {
    return {
      ...empty(),
      lines: [
        out(`Servidor:  UnKnown`),
        out(`Address:  ${DNS_IP}`),
        out(),
        out('Tempo limite da solicitação DNS esgotado.'),
        out(`*** O servidor não pode encontrar ${target}: Timed out`),
      ],
    };
  }

  const header: Line[] = [out(`Servidor:  ${DNS_NAME}`), out(`Address:  ${DNS_IP}`), out()];

  if (isValidIp(target)) {
    const rev = reverseLookup(ctx, target);
    if (!rev) {
      return { ...empty(), lines: [...header, out(`*** ${DNS_NAME} não encontrou ${target}: Non-existent domain`)] };
    }
    return { ...empty(), lines: [...header, out(`Nome:    ${rev.fqdn}`), out(`Address:  ${target}`)] };
  }

  const res = resolveName(ctx, target);
  if (!res) {
    const short = target.replace(/\.turma\.lab$/i, '');
    return { ...empty(), lines: [...header, out(`*** ${DNS_NAME} não encontrou ${short}: Non-existent domain`)] };
  }

  const lines: Line[] = [...header];
  if (res.kind === 'internet') lines.push(out('Não é resposta autoritativa:'));
  lines.push(out(`Nome:    ${res.fqdn}`), out(`Address:  ${res.ip}`));
  return { ...empty(), lines };
}

// ---------------------------------------------------------------------------
// arp -a
// ---------------------------------------------------------------------------
function arp(ctx: SimContext, args: string[]): Result {
  if (!args.some((a) => a.toLowerCase() === '-a')) {
    return { ...empty(), lines: [hint('Uso: arp -a (mostra a tabela ARP da rede local).')] };
  }
  const me = ctx.me;
  const lines: Line[] = [
    out(),
    out(`Interface: ${me.ip} --- 0x7`),
    out('  Endereço IP           Endereço físico      Tipo'),
  ];

  // Gateway sempre presente.
  lines.push(out(`  ${pad(me.gateway)}${pad(RT_MAC, 21)}dinâmico`));

  // Colegas da mesma sub-rede já "vistos".
  for (const ip of ctx.arpCache) {
    const peer = ctx.hosts.find((h) => h.ip === ip);
    if (peer && peer.subnetIndex === me.subnetIndex && peer.uid !== me.uid) {
      lines.push(out(`  ${pad(peer.ip)}${pad(peer.mac.toLowerCase(), 21)}dinâmico`));
    }
  }

  // Broadcast e multicast padrão.
  const net = netInfo(me.ip, Number(ctx.mode.slice(1)));
  lines.push(out(`  ${pad(net.broadcast)}${pad('ff-ff-ff-ff-ff-ff', 21)}estático`));
  lines.push(out(`  ${pad('224.0.0.22')}${pad('01-00-5e-00-00-16', 21)}estático`));
  lines.push(out(`  ${pad('239.255.255.250')}${pad('01-00-5e-7f-ff-fa', 21)}estático`));
  lines.push(out());
  return { ...empty(), lines };
}

function pad(s: string, n = 22): string {
  return s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length);
}

// ---------------------------------------------------------------------------
// route print
// ---------------------------------------------------------------------------
function route(ctx: SimContext, args: string[]): Result {
  if (args[0] && args[0].toLowerCase() !== 'print') {
    return { ...empty(), lines: [hint('Uso: route print (mostra a tabela de roteamento).')] };
  }
  const me = ctx.me;
  const net = netInfo(me.ip, Number(ctx.mode.slice(1)));
  const col = (s: string) => s.padEnd(19);
  const lines: Line[] = [
    out('==========================================================================='),
    out('Rotas Ativas:'),
    out(`${col('Destino de Rede')}${col('Máscara de Rede')}${col('Gateway')}${col('Interface')}Métrica`),
    out(`${col('0.0.0.0')}${col('0.0.0.0')}${col(me.gateway)}${col(me.ip)}25`),
    out(`${col('127.0.0.0')}${col('255.0.0.0')}${col('Em vínculo')}${col('127.0.0.1')}331`),
    out(`${col('127.0.0.1')}${col('255.255.255.255')}${col('Em vínculo')}${col('127.0.0.1')}331`),
    out(`${col(net.network)}${col(me.mask)}${col('Em vínculo')}${col(me.ip)}281`),
    out(`${col(me.ip)}${col('255.255.255.255')}${col('Em vínculo')}${col(me.ip)}281`),
    out(`${col(net.broadcast)}${col('255.255.255.255')}${col('Em vínculo')}${col(me.ip)}281`),
    out('==========================================================================='),
  ];
  return { ...empty(), lines };
}

// ---------------------------------------------------------------------------
// netstat -an
// ---------------------------------------------------------------------------
function netstat(ctx: SimContext, args: string[]): Result {
  if (!args.some((a) => a.toLowerCase().includes('a'))) {
    return { ...empty(), lines: [hint('Uso: netstat -an (lista as conexões de rede).')] };
  }
  const me = ctx.me;
  const col = (s: string) => s.padEnd(24);
  const lines: Line[] = [
    out(),
    out('Conexões ativas'),
    out(),
    out(`  ${col('Proto')}${col('Endereço local')}${col('Endereço externo')}Estado`),
    out(`  ${col('TCP')}${col(me.ip + ':49832')}${col('142.250.79.36:443')}ESTABELECIDA`),
    out(`  ${col('TCP')}${col(me.ip + ':49833')}${col('200.150.20.10:443')}ESTABELECIDA`),
    out(`  ${col('UDP')}${col(me.ip + ':53210')}${col('172.16.0.2:53')}`),
    out(`  ${col('TCP')}${col('0.0.0.0:135')}${col('0.0.0.0:0')}ESCUTANDO`),
    out(`  ${col('TCP')}${col('0.0.0.0:445')}${col('0.0.0.0:0')}ESCUTANDO`),
  ];
  // Se o aluno publicou site, escuta a porta 80.
  const hasSite = ctx.sites.some((s) => s.ownerUid === me.uid);
  if (hasSite) lines.push(out(`  ${col('TCP')}${col('0.0.0.0:80')}${col('0.0.0.0:0')}ESCUTANDO`));
  lines.push(out());
  return { ...empty(), lines };
}

// ---------------------------------------------------------------------------
// getmac
// ---------------------------------------------------------------------------
function getmac(ctx: SimContext): Result {
  return {
    ...empty(),
    lines: [
      out(),
      out('Endereço Físico     Nome de Transporte'),
      out('=================== =========================================================='),
      out(`${ctx.me.mac}   \\Device\\Tcpip_{${fakeGuid(ctx)}}`),
      out(),
    ],
  };
}

function fakeGuid(ctx: SimContext): string {
  const h = Math.abs(ipToInt(ctx.me.ip)).toString(16).padStart(8, '0');
  return `${h}-1a2b-3c4d-5e6f-${h}abcd`;
}

// ---------------------------------------------------------------------------
// curl / navegar
// ---------------------------------------------------------------------------
function curl(ctx: SimContext, args: string[], browse: boolean): Result {
  const target = args.filter((a) => !a.startsWith('-'))[0];
  if (!target) {
    const ex = browse ? 'navegar www.edufor.edu.br' : 'curl www.edufor.edu.br';
    return { ...empty(), lines: [hint(`Uso: ${browse ? 'navegar' : 'curl'} <IP ou nome>. Exemplo: ${ex}`)] };
  }

  let ip: string;
  if (isValidIp(target)) {
    ip = target;
  } else {
    if (ctx.faults.dnsDown || ctx.faults.cableDown) {
      return { ...empty(), lines: [out(`curl: (6) Could not resolve host: ${target}`), ...dnsHintLines()] };
    }
    const res = resolveName(ctx, target);
    if (!res) return { ...empty(), lines: [out(`curl: (6) Could not resolve host: ${target}`)] };
    ip = res.ip;
  }

  if (ctx.faults.cableDown) {
    return { ...empty(), lines: [out(`curl: (7) Failed to connect to ${target} port 80: Network is unreachable`)] };
  }

  const page = siteByIp(ctx, ip);
  // Precisa de caminho até o IP.
  const path = computePath(ctx, ip);
  if (!page || !path.reachable) {
    return { ...empty(), lines: [out(`curl: (7) Failed to connect to ${target} port 80: Connection refused`)] };
  }

  const events: SimEventDraft[] = [];
  const peer = ctx.hosts.find((h) => h.ip === ip && h.uid !== ctx.me.uid);
  if (peer) {
    events.push({ type: 'curl', fromIp: ctx.me.ip, fromHost: ctx.me.hostname, toIp: peer.ip, toHost: peer.hostname, ok: true });
  }

  const safeTitle = escapeHtml(page.title);
  const safeBody = escapeHtml(page.body);
  const lines: Line[] = [
    out(`<!DOCTYPE html>`),
    out(`<html><head><title>${safeTitle}</title></head>`),
    out(`<body><h1>${safeTitle}</h1><p>${safeBody}</p></body></html>`),
  ];

  const actions: Result['actions'] = browse
    ? [{ type: 'browse', url: page.fqdn, title: page.title, body: page.body }]
    : [];

  return { lines, events, arpAdd: [], actions };
}

// ---------------------------------------------------------------------------
// site criar/editar/remover
// ---------------------------------------------------------------------------
function site(ctx: SimContext, args: string[]): Result {
  const sub = (args[0] || '').toLowerCase();
  const mine = ctx.sites.find((s) => s.ownerUid === ctx.me.uid);

  if (sub === 'criar') {
    const name = (args[1] || '').toLowerCase();
    if (!name) return { ...empty(), lines: [hint('Uso: site criar <nome>. Exemplo: site criar padaria')] };
    if (!/^[a-z0-9-]{3,20}$/.test(name)) {
      return { ...empty(), lines: [err('Nome inválido. Use de 3 a 20 caracteres: letras minúsculas, números e hífen.')] };
    }
    if (ctx.sites.some((s) => s.name === name)) {
      return { ...empty(), lines: [err(`Já existe um site com o nome "${name}" nesta sessão. Escolha outro.`)] };
    }
    if (mine) {
      return { ...empty(), lines: [err(`Você já tem um site (${mine.name}.turma.lab). Use "site remover" antes de criar outro.`)] };
    }
    return {
      ...empty(),
      lines: [out(`Site ${name}.${DOMAIN} criado, apontando para ${ctx.me.ip}.`), hint('Edite o conteúdo com "site editar". Peça a um colega para achá-lo com "nslookup".')],
      actions: [{ type: 'siteCreate', name }],
    };
  }

  if (sub === 'editar') {
    if (!mine) return { ...empty(), lines: [err('Você ainda não tem um site. Crie com "site criar <nome>".')] };
    return { ...empty(), lines: [out('Abrindo o editor do site...')], actions: [{ type: 'siteEdit' }] };
  }

  if (sub === 'remover') {
    if (!mine) return { ...empty(), lines: [err('Você não tem um site para remover.')] };
    return { ...empty(), lines: [out(`Site ${mine.name}.${DOMAIN} removido.`)], actions: [{ type: 'siteRemove' }] };
  }

  return { ...empty(), lines: [hint('Uso: site criar <nome> | site editar | site remover')] };
}

// ---------------------------------------------------------------------------
// help
// ---------------------------------------------------------------------------
function help(args: string[]): Result {
  if (args[0]) {
    const base = args[0].toLowerCase();
    const key = base === 'clear' ? 'cls' : base;
    if (HELP[key]) return { ...empty(), lines: helpDetail(HELP[key]) };
    return { ...empty(), lines: [out(`Não há ajuda para "${args[0]}". Digite help para ver os comandos.`)] };
  }

  const lines: Line[] = [out(), out('Comandos disponíveis:'), out()];
  for (const entry of Object.values(HELP)) {
    lines.push(out(`  ${entry.name.padEnd(10)} ${entry.summary.padEnd(50)} ${entry.example}`));
  }
  lines.push(out());
  lines.push(hint('Digite "help <comando>" (ou "<comando> /?") para ver detalhes e exemplos.'));
  return { ...empty(), lines };
}

function helpDetail(e: HelpEntry): Line[] {
  const lines: Line[] = [
    out(),
    out(`${e.name.toUpperCase()}`),
    out(`  Para que serve: ${e.purpose}`),
    out(`  Como usar:      ${e.usage}`),
    out('  Exemplos:'),
  ];
  for (const ex of e.examples) lines.push(out(`    ${ex}`));
  if (e.observe) lines.push(out(`  Observe:        ${e.observe}`));
  lines.push(out(`  Camada:         ${e.layer}`));
  lines.push(out());
  return lines;
}

// ---------------------------------------------------------------------------
// comando desconhecido
// ---------------------------------------------------------------------------
function unknown(cmd: string): Result {
  const lines: Line[] = [
    out(`'${cmd}' não é reconhecido como um comando interno ou externo, um programa operável ou um arquivo em lotes.`),
  ];
  // Sugestão pelo comando mais parecido.
  let best = '';
  let bestD = Infinity;
  for (const k of KNOWN) {
    const d = editDistance(cmd, k);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  if (bestD > 0 && bestD <= 2) lines.push(hint(`Você quis dizer: ${best}?`));
  return { ...empty(), lines };
}

export { INTERNET_SITES };
