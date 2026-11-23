// Resolução de nomes: sites da turma, PCs (direto e reverso) e sites da internet.
import { DOMAIN, INTERNET_SITES, isValidIp } from './net';
import type { SimContext } from './types';

export interface Resolved {
  ip: string;
  fqdn: string; // nome completo com domínio
  kind: 'pc' | 'site' | 'internet' | 'dns';
}

const DNS_SELF = { ip: '172.16.0.2', fqdn: 'dns.lab.local', kind: 'dns' as const };

/** Normaliza um alvo: adiciona .turma.lab quando apropriado. */
export function resolveName(ctx: SimContext, raw: string): Resolved | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;

  // Sites da internet (nome exato)
  if (INTERNET_SITES[q]) {
    return { ip: INTERNET_SITES[q].ip, fqdn: q, kind: 'internet' };
  }
  if (q === 'dns.lab.local') return DNS_SELF;

  const short = q.endsWith('.' + DOMAIN) ? q.slice(0, -(DOMAIN.length + 1)) : q;

  // Site da turma
  const site = ctx.sites.find((s) => s.name === short);
  if (site) return { ip: site.ip, fqdn: `${site.name}.${DOMAIN}`, kind: 'site' };

  // Host da turma pelo hostname (PC-joao-12)
  const host = ctx.hosts.find((h) => h.hostname.toLowerCase() === short);
  if (host) return { ip: host.ip, fqdn: `${host.hostname}.${DOMAIN}`, kind: 'pc' };

  return null;
}

/** DNS reverso: IP -> nome. */
export function reverseLookup(ctx: SimContext, ip: string): Resolved | null {
  if (!isValidIp(ip)) return null;
  const host = ctx.hosts.find((h) => h.ip === ip);
  if (host) return { ip, fqdn: `${host.hostname}.${DOMAIN}`, kind: 'pc' };
  const site = ctx.sites.find((s) => s.ip === ip);
  if (site) return { ip, fqdn: `${site.name}.${DOMAIN}`, kind: 'site' };
  for (const [name, info] of Object.entries(INTERNET_SITES)) {
    if (info.ip === ip) return { ip, fqdn: name, kind: 'internet' };
  }
  if (ip === DNS_SELF.ip) return DNS_SELF;
  return null;
}

export function siteByIp(ctx: SimContext, ip: string) {
  const site = ctx.sites.find((s) => s.ip === ip);
  if (site) return { title: site.title, body: site.body, fqdn: `${site.name}.${DOMAIN}`, external: false };
  for (const [name, info] of Object.entries(INTERNET_SITES)) {
    if (info.ip === ip) return { title: info.title, body: info.body, fqdn: name, external: true };
  }
  return null;
}
