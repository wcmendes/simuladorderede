// Tela principal do aluno: terminal + abas + notificações.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEvent,
  createSite,
  removeSite,
  saveAnswers,
  saveAula,
  saveScore,
  updateSite,
  watchAnswers,
  watchMyEvents,
} from '../firebase/data';
import { runCommand } from '../sim/engine';
import { SHORTCUT_COMMANDS } from '../sim/help';
import type { Action, Host, SimContext } from '../sim/types';
import { Footer } from './Footer';
import { QuizAluno } from './QuizAluno';
import { DiagBanner, useDiagAluno } from './DiagAluno';
import { classificarComando } from '../sim/diag';
import { Pratica1 } from './Pratica1';
import { SitesTab } from './SitesTab';
import { Terminal, TerminalHandle, TermLine, expandLines } from './Terminal';
import { VmTab } from './VmTab';
import { Mascara } from './mascara/Mascara';
import { Aula } from './aula/Aula';
import { faultsOf, useSessionState } from './useSessionState';
import { scoreByPart } from './praticaDefs';

const COMMAND_NAMES = ['ipconfig', 'ping', 'tracert', 'nslookup', 'arp', 'route', 'netstat', 'hostname', 'getmac', 'cls', 'help', 'curl', 'navegar', 'site'];

interface Toast { id: number; text: string; }
type Tab = 'pratica' | 'sites' | 'vm' | 'mascara' | 'aula';

export function StudentApp({ sid, me }: { sid: string; me: Host }) {
  const state = useSessionState(sid, me.uid);
  const faults = faultsOf(state.session);
  const mode = state.session?.mode ?? '/25';
  const diag = useDiagAluno(sid, me.uid, state.session?.diag, faults);

  const [lines, setLines] = useState<TermLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('pratica');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [arpCache, setArpCache] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [realMode, setRealMode] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [browser, setBrowser] = useState<{ url: string; title: string; body: string } | null>(null);
  const [tour, setTour] = useState(() => !localStorage.getItem('labredes-tour'));

  const termRef = useRef<TerminalHandle>(null);
  const idRef = useRef(1);
  const seenEvents = useRef(new Set<string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const answersLoaded = useRef(false);

  // Mensagem de boas-vindas.
  useEffect(() => {
    const first = me.name.split(/\s+/)[0];
    pushLines([
      { text: `Bem-vindo, ${first}! Você é o ${me.hostname}, com IP ${me.ip}.`, kind: 'out' },
      { text: 'Digite help para ver os comandos, ou siga a aba Prática 1 à direita.', kind: 'hint' },
      { text: 'Primeiro comando sugerido: ipconfig /all', kind: 'hint' },
      { text: '', kind: 'out' },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega respostas salvas.
  useEffect(() => {
    const unsub = watchAnswers(sid, me.uid, (a) => {
      // Semeia os campos a partir do que já estava salvo, só na primeira carga.
      if (a && !answersLoaded.current) {
        answersLoaded.current = true;
        setFields(a.fields ?? {});
        setRealMode(a.realMode ?? false);
        setChecklist(a.checklist ?? {});
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, me.uid]);

  // Notificações de eventos recebidos.
  useEffect(() => {
    const unsub = watchMyEvents(sid, me.ip, (events) => {
      for (const ev of events) {
        if (!ev.id || seenEvents.current.has(ev.id)) continue;
        seenEvents.current.add(ev.id);
        // Ignora eventos antigos (mais de 20s) na primeira carga.
        if (Date.now() - ev.at > 20_000) continue;
        if (ev.type === 'ping') toast(`📶 Ping recebido de ${ev.fromIp} (${ev.fromHost})`);
        else if (ev.type === 'curl') toast(`🌐 Visita de ${ev.fromIp} (${ev.fromHost}) ao seu site`);
        else if (ev.type === 'ssh') toast(`🔐 Conexão SSH de ${ev.fromIp} (${ev.fromHost})`);
        // Ping recebido também vira entrada ARP se for da mesma sub-rede.
        if (ev.type === 'ping') {
          const peer = state.onlineHosts.find((h) => h.ip === ev.fromIp);
          if (peer && peer.subnetIndex === me.subnetIndex) {
            setArpCache((c) => (c.includes(ev.fromIp) ? c : [...c, ev.fromIp]));
          }
        }
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, me.ip, state.onlineHosts]);

  // Rodada do professor: avisa e leva o aluno ao Desafio.
  const rodadaAtiva = !!state.session?.rodada?.ativa;
  const rodadaAnterior = useRef(false);
  useEffect(() => {
    if (rodadaAtiva && !rodadaAnterior.current) {
      toast('🎯 O professor abriu uma rodada do Desafio de máscara!');
      setTab('mascara');
    }
    rodadaAnterior.current = rodadaAtiva;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodadaAtiva]);

  function toast(text: string) {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }

  function pushLines(src: { text: string; kind?: 'out' | 'hint' | 'err' }[]) {
    const { terms } = expandLines(src.map((s) => ({ text: s.text, kind: s.kind })), idRef.current);
    idRef.current += terms.length;
    setLines((l) => [...l, ...terms]);
  }

  const ctx: SimContext = useMemo(
    () => ({
      me,
      hosts: state.onlineHosts.length ? state.onlineHosts : [me],
      sites: state.sites,
      faults,
      mode,
      arpCache,
      now: Date.now(),
      rng: Math.random,
    }),
    [me, state.onlineHosts, state.sites, faults, mode, arpCache],
  );

  const handleActions = useCallback(
    async (actions: Action[]) => {
      for (const a of actions) {
        if (a.type === 'clear') setLines([]);
        else if (a.type === 'siteCreate') await createSite(sid, a.name, me.uid, me.ip).catch((e) => pushLines([{ text: String(e), kind: 'err' }]));
        else if (a.type === 'siteRemove') {
          const mine = state.sites.find((s) => s.ownerUid === me.uid);
          if (mine) await removeSite(sid, mine.name).catch(() => {});
        } else if (a.type === 'siteEdit') setTab('sites');
        else if (a.type === 'browse') {
          setBrowser({ url: a.url, title: a.title, body: a.body });
          setTab('sites');
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sid, me, state.sites],
  );

  async function execute(cmd: string) {
    // Eco do comando.
    const echo: TermLine = { id: idRef.current++, text: cmd, kind: 'cmd' };
    setLines((l) => [...l, echo]);
    if (!cmd.trim()) return;

    // Desafio de diagnóstico: só ping, nslookup, tracert e ipconfig, e cada um conta.
    if (diag.ativo && !diag.resposta) {
      const tipo = classificarComando(cmd);
      if (tipo === 'bloqueado') {
        pushLines([{ text: 'Desafio de diagnóstico: use só ping, nslookup, tracert e ipconfig.', kind: 'hint' }]);
        return;
      }
      if (tipo === 'conta') diag.contar();
    }

    setBusy(true);
    const result = runCommand(ctx, cmd);

    // Impressão com delay por linha.
    for (const line of result.lines) {
      if (line.delay) await sleep(line.delay);
      const term: TermLine = { id: idRef.current++, text: line.text, kind: (line.kind ?? 'out') as TermLine['kind'] };
      setLines((l) => [...l, term]);
    }

    // ARP local.
    if (result.arpAdd.length) setArpCache((c) => Array.from(new Set([...c, ...result.arpAdd])));

    // Eventos no Firestore.
    for (const ev of result.events) {
      await addEvent(sid, ev).catch(() => {});
    }

    await handleActions(result.actions);
    setBusy(false);
    termRef.current?.focus();
  }

  function runFromGuide(command: string) {
    termRef.current?.setInput(command);
    setTimeout(() => execute(command), 50);
  }

  // Salva respostas com debounce de 2s.
  const arpPairs = useMemo(
    () =>
      arpCache
        .map((ip) => state.onlineHosts.find((h) => h.ip === ip))
        .filter((h): h is Host => !!h)
        .map((h) => ({ ip: h.ip, mac: h.mac })),
    [arpCache, state.onlineHosts],
  );

  function updateField(key: string, value: string) {
    const next = { ...fields, [key]: value };
    setFields(next);
    scheduleSave(next, realMode, checklist);
  }

  function scheduleSave(f: Record<string, string>, rm: boolean, cl: Record<string, boolean>) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const parts = scoreByPart(f, me, arpPairs);
      const totalOk = parts.A.ok + parts.B.ok + parts.C.ok;
      const totalAll = parts.A.total + parts.B.total + parts.C.total;
      const score = totalAll ? Math.round((totalOk / totalAll) * 100) : 0;
      saveAnswers(sid, me.uid, { fields: f, realMode: rm, checklist: cl, score }).catch(() => {});
    }, 2000);
  }

  function toggleRealMode() {
    const rm = !realMode;
    setRealMode(rm);
    scheduleSave(fields, rm, checklist);
  }

  function setChecklistItem(id: string, done: boolean) {
    setChecklist((c) => {
      if (c[id] === done) return c;
      const next = { ...c, [id]: done };
      scheduleSave(fields, realMode, next);
      return next;
    });
  }

  function pickToken(token: string) {
    termRef.current?.insertAtCursor(token);
  }

  const subnetLabel = `${state.session ? `Sub-rede ${me.subnetIndex + 1}` : me.subnetIndex + 1}`;

  return (
    <div className="student-layout">
      <div className="topbar">
        <span className="brand">LabRedes</span>
        <span className="tag"><b>{me.name}</b></span>
        <span className="tag">host <b>{me.hostname}</b></span>
        <span className="tag">IP <b>{me.ip}</b> / {me.mask}</span>
        <span className="tag">gateway <b>{me.gateway}</b></span>
        <span className="tag">{subnetLabel}</span>
        <a href="/inicio" style={{ marginLeft: 'auto', fontSize: 13 }}>Início</a>
        <a href="#/ajuda" target="_blank" style={{ fontSize: 13 }}>Ajuda</a>
      </div>

      <div className={'student-body' + (tab === 'mascara' || tab === 'aula' ? ' wide-side' : '')}>
        <div className="term-pane">
          <DiagBanner d={diag} />
          <div className="shortcut-bar">
            {SHORTCUT_COMMANDS.map((c) => (
              <button key={c} onClick={() => termRef.current?.setInput(c)} title="Clique para preencher o comando">
                {c.trim()}
              </button>
            ))}
          </div>
          <Terminal
            ref={termRef}
            prompt="C:\Users\aluno> "
            lines={lines}
            onSubmit={execute}
            commandNames={COMMAND_NAMES}
            onPickToken={pickToken}
            busy={busy}
          />
          <PeersBar hosts={state.onlineHosts} me={me} onPick={pickToken} />
        </div>

        <div className="side-pane">
          <div className="tabs">
            <button className={tab === 'pratica' ? 'active' : ''} onClick={() => setTab('pratica')}>Prática 1</button>
            <button className={tab === 'sites' ? 'active' : ''} onClick={() => setTab('sites')}>Sites da turma</button>
            <button className={tab === 'vm' ? 'active' : ''} onClick={() => setTab('vm')}>VirtualBox</button>
            <button className={tab === 'mascara' ? 'active' : ''} onClick={() => setTab('mascara')}>Máscara</button>
            <button className={tab === 'aula' ? 'active' : ''} onClick={() => setTab('aula')}>Aula interativa</button>
          </div>
          <div className={'tab-content' + (tab === 'mascara' || tab === 'aula' ? ' flush' : '')}>
            {tab === 'pratica' && (
              <Pratica1
                me={me}
                fields={fields}
                realMode={realMode}
                arpPairs={arpPairs}
                checklist={checklist}
                onChange={updateField}
                onToggleRealMode={toggleRealMode}
                onRun={runFromGuide}
              />
            )}
            {tab === 'sites' && (
              <>
                {browser && (
                  <div className="browser-panel">
                    <div className="bar">🌐 {browser.url}</div>
                    <div className="page">
                      <h1>{browser.title}</h1>
                      <p>{browser.body}</p>
                    </div>
                  </div>
                )}
                <SitesTab
                  me={me}
                  sites={state.sites}
                  onEdit={(t, b) => {
                    const mine = state.sites.find((s) => s.ownerUid === me.uid);
                    if (mine) updateSite(sid, mine.name, t.slice(0, 60), b.slice(0, 280)).catch(() => {});
                  }}
                  onRemove={() => {
                    const mine = state.sites.find((s) => s.ownerUid === me.uid);
                    if (mine) removeSite(sid, mine.name).catch(() => {});
                  }}
                  onPickToken={pickToken}
                />
              </>
            )}
            {tab === 'vm' && <VmTab me={me} onChecklist={setChecklistItem} />}
            <div hidden={tab !== 'aula'}>
              <Aula
                sessao={{
                  sid,
                  uid: me.uid,
                  epoch: `${state.session?.createdAt ?? 0}:${state.session?.rankingEpoch ?? 0}`,
                  aulaDiag: state.session?.aulaDiag,
                  salvar: (score, aoVivo) => saveAula(sid, me.uid, me.name, score, aoVivo),
                }}
              />
            </div>
            {tab === 'mascara' && (
              <Mascara
                sessao={{
                  sid,
                  uid: me.uid,
                  name: me.name,
                  epoch: state.session?.rankingEpoch,
                  rodada: state.session?.rodada,
                  salvarScore: (score) => saveScore(sid, me.uid, me.name, score),
                }}
              />
            )}
          </div>
        </div>
      </div>

      <Footer />

      <QuizAluno sid={sid} uid={me.uid} />

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.text}</div>
        ))}
      </div>

      {tour && (
        <div className="tour-overlay">
          <div className="tour-box">
            <h3>Bem-vindo ao LabRedes</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              • À esquerda você <b>digita os comandos</b>.<br />
              • À direita está a sua <b>tarefa</b> (Prática 1).<br />
              • No canto aparecem os <b>avisos dos colegas</b>.
            </p>
            <div className="actions">
              <button className="btn" onClick={() => { localStorage.setItem('labredes-tour', '1'); setTour(false); }}>Começar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PeersBar({ hosts, me, onPick }: { hosts: Host[]; me: Host; onPick: (t: string) => void }) {
  const bySubnet = new Map<number, Host[]>();
  for (const h of hosts) {
    if (!bySubnet.has(h.subnetIndex)) bySubnet.set(h.subnetIndex, []);
    bySubnet.get(h.subnetIndex)!.push(h);
  }
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: 10, maxHeight: 160, overflowY: 'auto', background: 'var(--panel)' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Colegas online</div>
      {[...bySubnet.keys()].sort().map((idx) => (
        <div key={idx} className="peers-group">
          <h4>Sub-rede {idx + 1}</h4>
          {bySubnet.get(idx)!.map((h) => (
            <div className="peer-item" key={h.uid}>
              <div className="dot" />
              <span className="term-link" onClick={() => onPick(h.ip)}>
                {h.hostname} {h.uid === me.uid ? '(você)' : ''} — {h.ip}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
