// Acesso ao Firestore: sessões, hosts, alocação de IP por transação,
// presença, sites, eventos e respostas da Prática 1.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './app';
import {
  FIRST_HOST_OFFSET,
  hostnameFor,
  ipForOffset,
  randomMac,
  subnetIndexForPc,
  subnetsFor,
} from '../sim/net';
import { NO_FAULTS } from '../sim/types';
import type { Faults, Host, NetMode, Site, SimEvent, SimEventDraft } from '../sim/types';
import type { Nivel, Tipo } from '../sim/mascara';
import { normalizarScore, type Score } from '../sim/ranking';

/** Rodada do Desafio: restringe o tipo e a dificuldade das perguntas de toda a turma. */
export interface RodadaDoc {
  ativa: boolean;
  tipo: Tipo | 'todos';
  nivel: Nivel;
}

export interface SessionDoc {
  code: string;
  createdAt: number;
  ownerUid: string;
  mode: NetMode;
  faults: Faults;
  rodada?: RodadaDoc;
  rankingEpoch?: number; // muda quando o professor zera o ranking
}

const sessionsCol = collection(db, 'sessions');
const sessionRef = (sid: string) => doc(db, 'sessions', sid);
const hostsCol = (sid: string) => collection(db, 'sessions', sid, 'hosts');
const presenceCol = (sid: string) => collection(db, 'sessions', sid, 'presence');
const sitesCol = (sid: string) => collection(db, 'sessions', sid, 'sites');
const eventsCol = (sid: string) => collection(db, 'sessions', sid, 'events');
const answersCol = (sid: string) => collection(db, 'sessions', sid, 'answers');
const scoresCol = (sid: string) => collection(db, 'sessions', sid, 'scores');

/** sessionId = code em minúsculas, para o link ser estável. */
export function sessionIdFromCode(code: string): string {
  return code.trim().toLowerCase();
}

export async function getSession(sid: string): Promise<SessionDoc | null> {
  const snap = await getDoc(sessionRef(sid));
  return snap.exists() ? (snap.data() as SessionDoc) : null;
}

export async function createSession(code: string, mode: NetMode, ownerUid: string): Promise<string> {
  const sid = sessionIdFromCode(code);
  await setDoc(sessionRef(sid), {
    code,
    createdAt: Date.now(),
    ownerUid,
    mode,
    faults: NO_FAULTS,
  } satisfies SessionDoc);
  return sid;
}

export function watchSession(sid: string, cb: (s: SessionDoc | null) => void): Unsubscribe {
  return onSnapshot(sessionRef(sid), (snap) => cb(snap.exists() ? (snap.data() as SessionDoc) : null));
}

export async function setFaults(sid: string, faults: Faults): Promise<void> {
  await updateDoc(sessionRef(sid), { faults });
}

// --- Alocação de IP por transação (nunca repete) ---

interface IpPoolDoc {
  next: Record<string, number>; // subnetIndex -> próximo offset livre
}

/**
 * Entra na sessão: cria (ou recupera) o host do uid.
 * O IP é alocado por transação sobre meta/ipPool.
 */
export async function joinSession(
  sid: string,
  uid: string,
  name: string,
  pc: number,
  mode: NetMode,
): Promise<Host> {
  const existing = await getDoc(doc(hostsCol(sid), uid));
  if (existing.exists()) {
    // Recarregou a página: recupera a mesma máquina.
    return existing.data() as Host;
  }

  const subIdx = subnetIndexForPc(pc, mode);
  const subnet = subnetsFor(mode)[subIdx];
  const poolRef = doc(db, 'sessions', sid, 'meta', 'ipPool');

  const ip = await runTransaction(db, async (tx) => {
    const poolSnap = await tx.get(poolRef);
    const pool: IpPoolDoc = poolSnap.exists() ? (poolSnap.data() as IpPoolDoc) : { next: {} };
    let offset = pool.next[subIdx] ?? FIRST_HOST_OFFSET;
    let candidate = ipForOffset(subnet, offset);
    if (!candidate) throw new Error('Sub-rede cheia: não há mais IPs livres.');
    pool.next = { ...pool.next, [subIdx]: offset + 1 };
    tx.set(poolRef, pool);
    return candidate;
  });

  const host: Host = {
    uid,
    name,
    pc,
    hostname: hostnameFor(name, pc),
    ip,
    mask: subnet.mask,
    gateway: subnet.gateway,
    subnetIndex: subIdx,
    mac: randomMac(),
    createdAt: Date.now(),
    lastSeen: Date.now(),
  };
  await setDoc(doc(hostsCol(sid), uid), host);
  await setDoc(doc(presenceCol(sid), uid), { lastSeen: Date.now() });
  return host;
}

export function watchHosts(sid: string, cb: (hosts: Host[]) => void): Unsubscribe {
  return onSnapshot(hostsCol(sid), (snap) => {
    cb(snap.docs.map((d) => d.data() as Host));
  });
}

export function watchPresence(sid: string, cb: (map: Record<string, number>) => void): Unsubscribe {
  return onSnapshot(presenceCol(sid), (snap) => {
    const map: Record<string, number> = {};
    snap.docs.forEach((d) => {
      map[d.id] = (d.data() as { lastSeen: number }).lastSeen;
    });
    cb(map);
  });
}

/** Batimento: atualiza lastSeen no máximo a cada 60s (controlado pelo chamador). */
export async function heartbeat(sid: string, uid: string): Promise<void> {
  await setDoc(doc(presenceCol(sid), uid), { lastSeen: Date.now() });
}

// --- Sites ---

export function watchSites(sid: string, cb: (sites: Site[]) => void): Unsubscribe {
  return onSnapshot(sitesCol(sid), (snap) => {
    cb(snap.docs.map((d) => ({ name: d.id, ...(d.data() as Omit<Site, 'name'>) })));
  });
}

export async function createSite(sid: string, name: string, ownerUid: string, ip: string): Promise<void> {
  await setDoc(doc(sitesCol(sid), name), {
    ownerUid,
    ip,
    title: `Site de ${name}`,
    body: 'Edite este site com o comando: site editar',
    createdAt: Date.now(),
  });
}

export async function updateSite(sid: string, name: string, title: string, body: string): Promise<void> {
  await updateDoc(doc(sitesCol(sid), name), { title, body });
}

export async function removeSite(sid: string, name: string): Promise<void> {
  await deleteDoc(doc(sitesCol(sid), name));
}

// --- Eventos ---

export async function addEvent(sid: string, draft: SimEventDraft): Promise<void> {
  await setDoc(doc(eventsCol(sid)), { ...draft, at: Date.now() });
}

/** Eventos recebidos pelo próprio aluno (notificações). */
export function watchMyEvents(sid: string, myIp: string, cb: (events: SimEvent[]) => void): Unsubscribe {
  const q = query(eventsCol(sid), where('toIp', '==', myIp), orderBy('at', 'desc'), limit(10));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SimEvent, 'id'>) })));
  });
}

/** Feed do professor. */
export function watchFeed(sid: string, cb: (events: SimEvent[]) => void): Unsubscribe {
  const q = query(eventsCol(sid), orderBy('at', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SimEvent, 'id'>) })));
  });
}

// --- Respostas da Prática 1 ---

export interface AnswersDoc {
  fields: Record<string, string>;
  realMode: boolean;
  checklist: Record<string, boolean>;
  updatedAt: number;
  score: number;
}

export async function saveAnswers(sid: string, uid: string, data: Partial<AnswersDoc>): Promise<void> {
  await setDoc(doc(answersCol(sid), uid), { ...data, updatedAt: Date.now() }, { merge: true });
}

export function watchAnswers(sid: string, uid: string, cb: (a: AnswersDoc | null) => void): Unsubscribe {
  return onSnapshot(doc(answersCol(sid), uid), (snap) => {
    cb(snap.exists() ? (snap.data() as AnswersDoc) : null);
  });
}

export function watchAllAnswers(sid: string, cb: (map: Record<string, AnswersDoc>) => void): Unsubscribe {
  return onSnapshot(answersCol(sid), (snap) => {
    const map: Record<string, AnswersDoc> = {};
    snap.docs.forEach((d) => (map[d.id] = d.data() as AnswersDoc));
    cb(map);
  });
}

// --- Ranking do Desafio da máscara ---

export interface ScoreDoc extends Score {
  uid: string;
  name: string;
  updatedAt: number;
}

/** Uma gravação por resposta do aluno (nunca em loop). */
export async function saveScore(sid: string, uid: string, name: string, score: Score): Promise<void> {
  await setDoc(doc(scoresCol(sid), uid), {
    name: name.slice(0, 80),
    ok: score.ok,
    total: score.total,
    streak: score.streak,
    byKind: score.byKind,
    updatedAt: Date.now(),
  });
}

export function watchScores(sid: string, cb: (scores: ScoreDoc[]) => void): Unsubscribe {
  return onSnapshot(scoresCol(sid), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Partial<ScoreDoc>;
        return { ...normalizarScore(data), uid: d.id, name: data.name ?? 'Aluno', updatedAt: data.updatedAt ?? 0 };
      }),
    );
  });
}

export async function setRodada(sid: string, rodada: RodadaDoc): Promise<void> {
  await updateDoc(sessionRef(sid), { rodada });
}

/** Zera o ranking: muda a época (os alunos reiniciam o placar local) e apaga os placares. */
export async function zerarRanking(sid: string): Promise<void> {
  await updateDoc(sessionRef(sid), { rankingEpoch: Date.now() });
  await apagarColecao(scoresCol(sid));
}

async function apagarColecao(col: ReturnType<typeof collection>): Promise<void> {
  const snap = await getDocs(col);
  // Firestore limita o batch a 500 operações.
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// --- Moderação / encerramento ---

export async function removeHost(sid: string, uid: string): Promise<void> {
  await deleteDoc(doc(hostsCol(sid), uid));
  await deleteDoc(doc(presenceCol(sid), uid)).catch(() => {});
}

/** Apaga todas as subcoleções da sessão (botão "Encerrar sessão"). */
export async function endSession(sid: string): Promise<void> {
  const colecoes = [
    hostsCol(sid), presenceCol(sid), sitesCol(sid), eventsCol(sid), answersCol(sid), scoresCol(sid),
    collection(db, 'sessions', sid, 'quizAnswers'), collection(db, 'sessions', sid, 'quiz'),
  ];
  for (const col of colecoes) await apagarColecao(col);
  await deleteDoc(doc(db, 'sessions', sid, 'meta', 'ipPool')).catch(() => {});
  await deleteDoc(sessionRef(sid)).catch(() => {});
}

export { serverTimestamp, sessionsCol };
