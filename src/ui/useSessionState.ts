// Hook que assina o estado da sessão no Firestore e monta o SimContext.
import { useEffect, useRef, useState } from 'react';
import {
  heartbeat,
  watchHosts,
  watchPresence,
  watchSession,
  watchSites,
  type SessionDoc,
} from '../firebase/data';
import { ONLINE_WINDOW_MS } from '../sim/net';
import { NO_FAULTS } from '../sim/types';
import type { Host, Site } from '../sim/types';

export interface SessionState {
  session: SessionDoc | null;
  hosts: Host[];
  onlineHosts: Host[];
  sites: Site[];
  presence: Record<string, number>;
}

export function useSessionState(sid: string, myUid?: string): SessionState {
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [presence, setPresence] = useState<Record<string, number>>({});
  const beatRef = useRef(0);

  useEffect(() => {
    if (!sid) return;
    const unsubs = [
      watchSession(sid, setSession),
      watchHosts(sid, setHosts),
      watchSites(sid, setSites),
      watchPresence(sid, setPresence),
    ];
    return () => unsubs.forEach((u) => u());
  }, [sid]);

  // Batimento a cada 60s (dentro do plano gratuito).
  useEffect(() => {
    if (!sid || !myUid) return;
    const tick = () => {
      const now = Date.now();
      if (now - beatRef.current >= 60_000) {
        beatRef.current = now;
        heartbeat(sid, myUid).catch(() => {});
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [sid, myUid]);

  const now = Date.now();
  const hostsWithPresence = hosts.map((h) => ({ ...h, lastSeen: presence[h.uid] ?? h.lastSeen }));
  const onlineHosts = hostsWithPresence.filter((h) => now - (h.lastSeen ?? 0) < ONLINE_WINDOW_MS);
  // Sites só valem se o dono está online.
  const onlineUids = new Set(onlineHosts.map((h) => h.uid));
  const activeSites = sites.filter((s) => onlineUids.has(s.ownerUid));

  return { session, hosts: hostsWithPresence, onlineHosts, sites: activeSites, presence };
}

export function faultsOf(session: SessionDoc | null) {
  return session?.faults ?? NO_FAULTS;
}
