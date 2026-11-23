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
import { normalizarScore, porTipoVazio, type Score } from '../sim/ranking';
import type { AulaDiagDoc, AulaScore, RespostaAoVivo } from '../sim/aula';
import type { RespostaQuiz } from '../sim/quiz';
import type { Falha, RespostaDiag } from '../sim/diag';

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
  diag?: { ativo: boolean; rodada: number }; // desafio de diagnóstico (a falha em si não é gravada aqui)
  aulaDiag?: AulaDiagDoc; // "Defeito para todos" da aba Sem internet? da Aula interativa
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

/** Código da sessão padrão: o professor entra e ela já existe; o aluno já vê o código preenchido. */
export const CODIGO_PADRAO = 'AULA';

/**
 * Abre a sessão padrão: cria se não existe, reaproveita se é deste navegador (mesmo uid).
 * Devolve null se ela pertence a outro navegador (só o dono pode alterá-la).
 */
export async function abrirSessaoPadrao(uid: string, mode: NetMode = '/25'): Promise<string | null> {
  const sid = sessionIdFromCode(CODIGO_PADRAO);
  const s = await getSession(sid);
  if (!s) return createSession(CODIGO_PADRAO, mode, uid);
  return s.ownerUid === uid ? sid : null;
}

/** Nº do computador quando o aluno não informa: segue a ordem de chegada (1 a 40, volta ao 1 depois do 40). */
export async function proximoPc(sid: string): Promise<number> {
  const snap = await getDocs(hostsCol(sid));
  return (snap.size % 40) + 1;
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

/**
 * O professor muda o nº do computador de um aluno. A sub-rede sai da mesma regra da entrada.
 * Se a sub-rede muda, o aluno recebe um IP novo pela mesma transação do pool (o contador do pool
 * só cresce, então o IP antigo nunca é reaproveitado e não há repetição). Se a sub-rede é a mesma,
 * o IP fica e só o número e o hostname mudam.
 */
export async function moverHost(sid: string, uid: string, novoPc: number, mode: NetMode): Promise<Host> {
  if (!Number.isInteger(novoPc) || novoPc < 1 || novoPc > 40) throw new Error('O número do computador deve ser de 1 a 40.');
  const hostRef = doc(hostsCol(sid), uid);
  const poolRef = doc(db, 'sessions', sid, 'meta', 'ipPool');
  const subIdx = subnetIndexForPc(novoPc, mode);
  const subnet = subnetsFor(mode)[subIdx];

  return runTransaction(db, async (tx) => {
    const hostSnap = await tx.get(hostRef);
    if (!hostSnap.exists()) throw new Error('Aluno não encontrado.');
    const host = hostSnap.data() as Host;
    const hostname = hostnameFor(host.name, novoPc);

    if (host.subnetIndex === subIdx && host.mask === subnet.mask && host.gateway === subnet.gateway) {
      tx.update(hostRef, { pc: novoPc, hostname });
      return { ...host, pc: novoPc, hostname };
    }

    const poolSnap = await tx.get(poolRef);
    const pool: IpPoolDoc = poolSnap.exists() ? (poolSnap.data() as IpPoolDoc) : { next: {} };
    const offset = pool.next[subIdx] ?? FIRST_HOST_OFFSET;
    const ip = ipForOffset(subnet, offset);
    if (!ip) throw new Error('Sub-rede cheia: não há mais IPs livres.');
    tx.set(poolRef, { next: { ...pool.next, [subIdx]: offset + 1 } });
    const novo = { pc: novoPc, hostname, subnetIndex: subIdx, ip, mask: subnet.mask, gateway: subnet.gateway };
    tx.update(hostRef, novo);
    return { ...host, ...novo };
  });
}

/** O aluno atualiza o IP do próprio site depois de ser movido de sub-rede. */
export async function updateSiteIp(sid: string, name: string, ip: string): Promise<void> {
  await updateDoc(doc(sitesCol(sid), name), { ip });
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
  /** Placar da Aula interativa (portas, diagnóstico, nuvem), quando o aluno já usou as abas. */
  aula: Partial<AulaScore>;
  /** Última resposta do aluno no "Defeito para todos". */
  aoVivo?: RespostaAoVivo;
}

/** Uma gravação por resposta do aluno (nunca em loop). */
export async function saveScore(sid: string, uid: string, name: string, score: Score): Promise<void> {
  // merge: não apaga os campos da Aula interativa (portas, diagnostico, nuvem) gravados no mesmo documento.
  await setDoc(
    doc(scoresCol(sid), uid),
    {
      name: name.slice(0, 80),
      ok: score.ok,
      total: score.total,
      streak: score.streak,
      byKind: score.byKind,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

/**
 * Placar da Aula interativa, no mesmo documento do ranking (sessions/{sid}/scores/{uid}).
 * Uma gravação por resposta. Se o aluno ainda não jogou o Desafio, cria o documento com os
 * campos que as regras exigem (ok/total/streak zerados), sem mexer no placar da máscara.
 */
export async function saveAula(sid: string, uid: string, name: string, score: AulaScore, aoVivo?: RespostaAoVivo): Promise<void> {
  const ref = doc(scoresCol(sid), uid);
  const existe = (await getDoc(ref)).exists();
  const base = existe ? {} : { name: name.slice(0, 80), ok: 0, total: 0, streak: 0, byKind: porTipoVazio(), updatedAt: Date.now() };
  await setDoc(
    ref,
    {
      ...base,
      portas: score.portas,
      nuvem: score.nuvem,
      diagnostico: score.diagnostico,
      ...(aoVivo ? { aoVivo } : {}),
    },
    { merge: true },
  );
}

export function watchScores(sid: string, cb: (scores: ScoreDoc[]) => void): Unsubscribe {
  return onSnapshot(scoresCol(sid), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Partial<ScoreDoc>;
        const raw = d.data() as { portas?: AulaScore['portas']; nuvem?: AulaScore['nuvem']; diagnostico?: AulaScore['diagnostico']; aoVivo?: RespostaAoVivo };
        return {
          ...normalizarScore(data),
          uid: d.id,
          name: data.name ?? 'Aluno',
          updatedAt: data.updatedAt ?? 0,
          aula: { portas: raw.portas, nuvem: raw.nuvem, diagnostico: raw.diagnostico },
          aoVivo: raw.aoVivo,
        };
      }),
    );
  });
}

export async function setAulaDiag(sid: string, aulaDiag: AulaDiagDoc): Promise<void> {
  await updateDoc(sessionRef(sid), { aulaDiag });
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

// --- Desafio de diagnóstico ---

const diagAnswersCol = (sid: string) => collection(db, 'sessions', sid, 'diagAnswers');

export async function setDiag(sid: string, diag: { ativo: boolean; rodada: number }): Promise<void> {
  await updateDoc(sessionRef(sid), { diag });
}

export async function answerDiag(sid: string, round: number, uid: string, choice: Falha, cmds: number): Promise<void> {
  await setDoc(doc(diagAnswersCol(sid), `${round}_${uid}`), { uid, round, choice, cmds });
}

export async function getDiagAnswer(sid: string, round: number, uid: string): Promise<{ choice: Falha; cmds: number } | null> {
  const snap = await getDoc(doc(diagAnswersCol(sid), `${round}_${uid}`));
  return snap.exists() ? (snap.data() as { choice: Falha; cmds: number }) : null;
}

export function watchDiagAnswers(sid: string, cb: (r: RespostaDiag[]) => void): Unsubscribe {
  return onSnapshot(diagAnswersCol(sid), (snap) => cb(snap.docs.map((d) => d.data() as RespostaDiag)));
}

// --- Quiz ao vivo ---
// quiz/state: único documento que o aluno escuta. As respostas ficam em quizAnswers/{q}_{uid}
// (só o professor lê a coleção inteira e agrega).

export interface QuizStateDoc {
  active: boolean;
  questionIndex: number;
  total: number;
  startedAt: number;
  durationMs: number;
  revealed: boolean;
  question: { texto: string; opcoes: string[] };
  correct?: number; // só depois de revelar
  counts?: number[]; // só depois de revelar
}

const quizStateRef = (sid: string) => doc(db, 'sessions', sid, 'quiz', 'state');
const quizAnswersCol = (sid: string) => collection(db, 'sessions', sid, 'quizAnswers');

export function watchQuizState(sid: string, cb: (s: QuizStateDoc | null) => void): Unsubscribe {
  return onSnapshot(quizStateRef(sid), (snap) => cb(snap.exists() ? (snap.data() as QuizStateDoc) : null));
}

export async function setQuizState(sid: string, state: QuizStateDoc): Promise<void> {
  await setDoc(quizStateRef(sid), state);
}

/** O id fixo (pergunta_uid) com regra "só criar" impede responder duas vezes. */
export async function answerQuiz(sid: string, q: number, uid: string, choice: number, ms: number): Promise<void> {
  await setDoc(doc(quizAnswersCol(sid), `${q}_${uid}`), { uid, q, choice, ms });
}

export async function getQuizAnswer(sid: string, q: number, uid: string): Promise<{ choice: number; ms: number } | null> {
  const snap = await getDoc(doc(quizAnswersCol(sid), `${q}_${uid}`));
  return snap.exists() ? (snap.data() as { choice: number; ms: number }) : null;
}

export function watchQuizAnswers(sid: string, cb: (r: RespostaQuiz[]) => void): Unsubscribe {
  return onSnapshot(quizAnswersCol(sid), (snap) => cb(snap.docs.map((d) => d.data() as RespostaQuiz)));
}

export async function reiniciarQuiz(sid: string): Promise<void> {
  await apagarColecao(quizAnswersCol(sid));
  await deleteDoc(quizStateRef(sid)).catch(() => {});
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
    collection(db, 'sessions', sid, 'quizAnswers'), collection(db, 'sessions', sid, 'quiz'), diagAnswersCol(sid),
  ];
  for (const col of colecoes) await apagarColecao(col);
  await deleteDoc(doc(db, 'sessions', sid, 'meta', 'ipPool')).catch(() => {});
  await deleteDoc(sessionRef(sid)).catch(() => {});
}

export { serverTimestamp, sessionsCol };
