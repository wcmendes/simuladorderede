// Caminhos de rede (saltos) usados por tracert e pelo TTL do ping.
import {
  BACKBONE_IP,
  CAMPUS_IP,
  DNS_IP,
  INTERNET_IPS,
  PROVIDER_IP,
  sameNetwork,
} from './net';
import type { Faults, Host, SimContext } from './types';

export interface Hop {
  ip: string | null; // null = timeout (* * *)
  label: string; // nome do roteador/host ao lado do IP
}

export interface PathResult {
  hops: Hop[];
  reachable: boolean; // destino final respondeu
  destTtlBase: number; // 128 Windows, 64 Linux, 117 internet
}

function hostByIp(ctx: SimContext, ip: string): Host | undefined {
  return ctx.hosts.find((h) => h.ip === ip);
}

/** Classifica o destino em categorias de caminho. */
function destKind(ctx: SimContext, destIp: string): 'self' | 'lab-same' | 'lab-other' | 'dns' | 'internet' | 'router' | 'unknown' {
  const me = ctx.me;
  if (destIp === me.ip) return 'self';
  if (destIp === DNS_IP) return 'dns';
  if (INTERNET_IPS.has(destIp)) return 'internet';
  if (destIp === CAMPUS_IP || destIp === PROVIDER_IP || destIp === BACKBONE_IP || destIp === me.gateway) return 'router';

  const peer = hostByIp(ctx, destIp);
  if (peer) {
    return sameNetwork(me.ip, destIp, labPrefix(ctx)) ? 'lab-same' : 'lab-other';
  }
  return 'unknown';
}

function labPrefix(ctx: SimContext): number {
  return Number(ctx.mode.slice(1));
}

function gatewayIsDown(faults: Faults, subnetIndex: number): boolean {
  return faults.gatewayDown.includes(subnetIndex);
}

function routerLabel(ip: string): string {
  switch (ip) {
    case CAMPUS_IP:
      return 'RT-CAMPUS';
    case PROVIDER_IP:
      return 'RT-PROVEDOR';
    case BACKBONE_IP:
      return 'RT-BACKBONE';
    case DNS_IP:
      return 'dns.lab.edufor';
    default:
      return '';
  }
}

function labelFor(ctx: SimContext, ip: string): string {
  if (ip === ctx.me.gateway) return 'RT-LAB';
  const r = routerLabel(ip);
  if (r) return r;
  const peer = hostByIp(ctx, ip);
  if (peer) return peer.hostname + '.turma.lab';
  return internetLabel(ip);
}

/**
 * Calcula a rota da máquina atual (ctx.me) até destIp.
 * Considera as falhas ativas (gateway, provedor).
 */
export function computePath(ctx: SimContext, destIp: string): PathResult {
  const kind = destKind(ctx, destIp);
  const gw = ctx.me.gateway;

  if (kind === 'self') {
    return { hops: [{ ip: destIp, label: labelFor(ctx, destIp) }], reachable: true, destTtlBase: 128 };
  }

  if (kind === 'unknown') {
    // IP sem host: timeout.
    return { hops: [{ ip: null, label: '' }], reachable: false, destTtlBase: 128 };
  }

  if (kind === 'lab-same') {
    // Entrega direta: uma linha, o próprio destino.
    const peer = hostByIp(ctx, destIp)!;
    return { hops: [{ ip: destIp, label: peer.hostname + '.turma.lab' }], reachable: true, destTtlBase: peerTtlBase(peer) };
  }

  // Tudo o mais passa pelo gateway da sub-rede.
  if (gatewayIsDown(ctx.faults, ctx.me.subnetIndex)) {
    // tracert para no primeiro salto.
    return { hops: [{ ip: null, label: '' }], reachable: false, destTtlBase: 128 };
  }

  const hops: Hop[] = [{ ip: gw, label: 'RT-LAB' }];

  if (kind === 'lab-other') {
    const peer = hostByIp(ctx, destIp)!;
    hops.push({ ip: destIp, label: peer.hostname + '.turma.lab' });
    return { hops, reachable: true, destTtlBase: peerTtlBase(peer) };
  }

  if (kind === 'router' && destIp === gw) {
    return { hops: [{ ip: gw, label: 'RT-LAB' }], reachable: true, destTtlBase: 128 };
  }

  // Daqui: precisa subir para o RT-CAMPUS.
  hops.push({ ip: CAMPUS_IP, label: 'RT-CAMPUS' });

  if (kind === 'dns') {
    hops.push({ ip: DNS_IP, label: 'dns.lab.edufor' });
    return { hops, reachable: true, destTtlBase: 64 };
  }

  if (kind === 'router' && destIp === CAMPUS_IP) {
    return { hops, reachable: true, destTtlBase: 128 };
  }

  // Internet: depende do link do provedor.
  if (ctx.faults.ispDown) {
    // Para depois do 10.0.0.1.
    return { hops, reachable: false, destTtlBase: 117 };
  }

  hops.push({ ip: PROVIDER_IP, label: 'RT-PROVEDOR' });
  if (kind === 'router' && destIp === PROVIDER_IP) {
    return { hops, reachable: true, destTtlBase: 117 };
  }
  hops.push({ ip: BACKBONE_IP, label: 'RT-BACKBONE' });
  if (kind === 'router' && destIp === BACKBONE_IP) {
    return { hops, reachable: true, destTtlBase: 117 };
  }

  // 1 ou 2 saltos de timeout "* * *" antes do destino.
  const timeouts = 1 + Math.floor(ctx.rng() * 2);
  for (let i = 0; i < timeouts; i++) hops.push({ ip: null, label: '' });

  hops.push({ ip: destIp, label: internetLabel(destIp) });
  return { hops, reachable: true, destTtlBase: 117 };
}

function internetLabel(ip: string): string {
  // Procura o nome do site da internet pelo IP.
  // Import tardio evita ciclo; usamos a tabela direto.
  const sites: Record<string, string> = {
    '200.150.20.10': 'www.edufor.edu.br',
    '142.250.79.36': 'www.google.com',
    '8.8.8.8': 'dns.google',
    '161.148.164.31': 'www.gov.br',
  };
  return sites[ip] ?? ip;
}

/** Hosts da turma são Windows (128); VMs Linux usariam 64. */
function peerTtlBase(_peer: Host): number {
  return 128;
}

/** Latência por salto: 1-3ms no laboratório, 5-15ms depois do provedor. */
export function hopLatency(ctx: SimContext, hopIp: string | null): number {
  if (hopIp === null) return 0;
  const afterProvider = hopIp === PROVIDER_IP || hopIp === BACKBONE_IP || INTERNET_IPS.has(hopIp);
  if (afterProvider) return 5 + Math.floor(ctx.rng() * 11);
  return 1 + Math.floor(ctx.rng() * 3);
}

export { labelFor };
