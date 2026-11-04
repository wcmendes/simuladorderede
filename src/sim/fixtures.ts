// Fábrica de hosts e contexto para testes e para a UI.
import {
  FIRST_HOST_OFFSET,
  hostnameFor,
  ipForOffset,
  randomMac,
  subnetIndexForPc,
  subnetsFor,
} from './net';
import type { Host, NetMode, SimContext } from './types';
import { NO_FAULTS } from './types';

let seedCounter = 1;
export function seededRng(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Cria um host de teste a partir do nº do computador. */
export function makeHost(name: string, pc: number, mode: NetMode, offset = FIRST_HOST_OFFSET): Host {
  const subIdx = subnetIndexForPc(pc, mode);
  const subnet = subnetsFor(mode)[subIdx];
  const ip = ipForOffset(subnet, offset)!;
  return {
    uid: `uid-${name}-${pc}`,
    name,
    pc,
    hostname: hostnameFor(name, pc),
    ip,
    mask: subnet.mask,
    gateway: subnet.gateway,
    subnetIndex: subIdx,
    mac: randomMac(seededRng(seedCounter++)),
    createdAt: Date.now(),
    lastSeen: Date.now(),
  };
}

export function makeContext(opts: {
  me: Host;
  hosts?: Host[];
  mode: NetMode;
  faults?: Partial<typeof NO_FAULTS>;
  sites?: SimContext['sites'];
  arpCache?: string[];
  rng?: () => number;
}): SimContext {
  const hosts = opts.hosts ?? [opts.me];
  return {
    me: opts.me,
    hosts: hosts.includes(opts.me) ? hosts : [opts.me, ...hosts],
    sites: opts.sites ?? [],
    faults: { ...NO_FAULTS, ...(opts.faults ?? {}) },
    mode: opts.mode,
    arpCache: opts.arpCache ?? [],
    now: Date.now(),
    rng: opts.rng ?? seededRng(7),
  };
}
