// Painel do professor: criar sessão, QR, lista de alunos, falhas, feed, moderação.
import { useEffect, useMemo, useState } from 'react';
import {
  abrirSessaoPadrao,
  CODIGO_PADRAO,
  createSession,
  endSession,
  removeHost,
  removeSite,
  setFaults,
  watchAllAnswers,
  watchFeed,
  type AnswersDoc,
} from '../firebase/data';
import { PROF_PIN } from '../firebase/app';
import { gatewayList } from '../sim/net';
import type { Faults, NetMode, SimEvent } from '../sim/types';
import { Footer } from './Footer';
import { RankingTab } from './prof/RankingTab';
import { QuizTab } from './prof/QuizTab';
import { DiagTab } from './prof/DiagTab';
import { QrCode } from './QrCode';
import { faultsOf, useSessionState } from './useSessionState';

export function ProfessorApp({ uid }: { uid: string }) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [sid, setSid] = useState<string | null>(() => localStorage.getItem('labredes-prof-sid'));
  const [auto, setAuto] = useState(true); // abre a sessão padrão sozinho, uma vez
  const [aviso, setAviso] = useState('');

  if (!authed) {
    return (
      <div className="center-screen">
        <div className="card">
          <h1>Painel do Professor</h1>
          <p className="sub">Digite o PIN para continuar</p>
          <div className="field">
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" />
          </div>
          <button className="btn" style={{ width: '100%' }} onClick={() => setAuthed(pin === PROF_PIN)}>Entrar</button>
          {pin && pin !== PROF_PIN && <div className="error-msg">PIN incorreto.</div>}
        </div>
      </div>
    );
  }

  const guardar = (s: string) => { localStorage.setItem('labredes-prof-sid', s); setSid(s); };

  if (!sid && auto) {
    return (
      <SessaoPadrao
        uid={uid}
        onReady={guardar}
        onFalha={(msg) => { setAviso(msg); setAuto(false); }}
      />
    );
  }

  if (!sid) return <CreateSession uid={uid} aviso={aviso} onCreated={guardar} />;

  return <Dashboard sid={sid} onEnded={() => { localStorage.removeItem('labredes-prof-sid'); setAuto(false); setAviso(''); setSid(null); }} />;
}

function genCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c = '';
  for (let i = 0; i < 4; i++) c += letters[Math.floor(Math.random() * letters.length)];
  const d = new Date();
  return `${c}${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Entra direto na sessão padrão (código AULA), sem passar pelo formulário. */
function SessaoPadrao({ uid, onReady, onFalha }: { uid: string; onReady: (sid: string) => void; onFalha: (msg: string) => void }) {
  useEffect(() => {
    let vivo = true;
    abrirSessaoPadrao(uid)
      .then((sid) => {
        if (!vivo) return;
        if (sid) onReady(sid);
        else onFalha(`A sessão ${CODIGO_PADRAO} foi criada em outro navegador e só ele pode controlá-la. Crie uma sessão com outro código.`);
      })
      .catch((e) => vivo && onFalha('Não consegui abrir a sessão padrão: ' + (e instanceof Error ? e.message : String(e))));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  return <div className="center-screen"><div className="card"><h1>Painel do Professor</h1><p className="sub">Abrindo a sessão padrão...</p></div></div>;
}

function CreateSession({ uid, aviso, onCreated }: { uid: string; aviso?: string; onCreated: (sid: string) => void }) {
  const [code, setCode] = useState(genCode);
  const [mode, setMode] = useState<NetMode>('/25');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const sid = await createSession(code, mode, uid);
      onCreated(sid);
    } catch (e) {
      alert('Erro ao criar sessão: ' + (e instanceof Error ? e.message : e));
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="card">
        <h1>Nova sessão</h1>
        <p className="sub">Defina o código e o modo de rede</p>
        {aviso && <div className="error-msg" style={{ marginBottom: 10 }}>{aviso}</div>}
        <div className="field">
          <label>Código da sessão</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </div>
        <div className="field">
          <label>Modo de rede</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as NetMode)}>
            <option value="/24">/24 — 1 sub-rede</option>
            <option value="/25">/25 — 2 sub-redes (padrão)</option>
            <option value="/26">/26 — 4 sub-redes</option>
          </select>
        </div>
        <button className="btn" style={{ width: '100%' }} disabled={busy} onClick={create}>
          {busy ? 'Criando...' : 'Criar e projetar'}
        </button>
      </div>
    </div>
  );
}

function Dashboard({ sid, onEnded }: { sid: string; onEnded: () => void }) {
  const state = useSessionState(sid);
  const faults = faultsOf(state.session);
  const [feed, setFeed] = useState<SimEvent[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswersDoc>>({});
  const [showQr, setShowQr] = useState(true);
  const [aba, setAba] = useState<'painel' | 'ranking' | 'quiz' | 'diag'>('painel');

  useEffect(() => {
    const u1 = watchFeed(sid, setFeed);
    const u2 = watchAllAnswers(sid, setAnswers);
    return () => { u1(); u2(); };
  }, [sid]);

  const link = useMemo(() => {
    const base = location.origin + location.pathname;
    return `${base}#/?code=${(state.session?.code ?? sid).toUpperCase()}`;
  }, [state.session, sid]);

  const mode = state.session?.mode ?? '/25';
  const gateways = gatewayList(mode);
  const onlineUids = new Set(state.onlineHosts.map((h) => h.uid));

  async function updateFault(patch: Partial<Faults>) {
    await setFaults(sid, { ...faults, ...patch });
  }

  function toggleGateway(idx: number) {
    const set = new Set(faults.gatewayDown);
    set.has(idx) ? set.delete(idx) : set.add(idx);
    updateFault({ gatewayDown: [...set] });
  }

  if (showQr) {
    return (
      <div className="center-screen">
        <div className="qr-fullscreen">
          <QrCode value={link} size={360} />
          <div className="code">{(state.session?.code ?? sid).toUpperCase()}</div>
          <div className="link">{link}</div>
          <p style={{ color: 'var(--muted)' }}>Modo {mode} · {gateways.length} sub-rede(s)</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => setShowQr(false)}>Ir para o painel →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="prof-layout">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Sessão {(state.session?.code ?? sid).toUpperCase()}</h1>
        <span style={{ color: 'var(--muted)' }}>modo {mode}</span>
        <button className="btn secondary" onClick={() => setShowQr(true)}>Mostrar QR Code</button>
        <button
          className="btn danger"
          style={{ marginLeft: 'auto' }}
          onClick={async () => {
            if (confirm('Encerrar a sessão apaga TODOS os dados (alunos, sites, respostas). Confirmar?')) {
              await endSession(sid);
              onEnded();
            }
          }}
        >
          Encerrar sessão
        </button>
      </div>

      <div className="prof-tabs">
        <button className={aba === 'painel' ? 'active' : ''} onClick={() => setAba('painel')}>Painel</button>
        <button className={aba === 'ranking' ? 'active' : ''} onClick={() => setAba('ranking')}>Ranking</button>
        <button className={aba === 'quiz' ? 'active' : ''} onClick={() => setAba('quiz')}>Quiz</button>
        <button className={aba === 'diag' ? 'active' : ''} onClick={() => setAba('diag')}>Diagnóstico</button>
      </div>

      {aba === 'ranking' && <RankingTab sid={sid} rodada={state.session?.rodada} aulaDiag={state.session?.aulaDiag} online={state.onlineHosts.length} />}
      {aba === 'diag' && <DiagTab sid={sid} session={state.session} hosts={state.hosts} online={state.onlineHosts.length} />}
      {aba === 'quiz' && <QuizTab sid={sid} hosts={state.hosts} online={state.onlineHosts.length} />}

      {aba === 'painel' && (
      <div className="prof-grid">
        <div className="prof-section">
          <h2>Alunos online ({state.onlineHosts.length})</h2>
          <table className="students">
            <thead>
              <tr><th>Nome</th><th>PC</th><th>Host</th><th>IP</th><th>Sub</th><th>P1</th><th>Site</th><th></th></tr>
            </thead>
            <tbody>
              {state.hosts.map((h) => {
                const online = onlineUids.has(h.uid);
                const ans = answers[h.uid];
                const site = state.sites.find((s) => s.ownerUid === h.uid);
                return (
                  <tr key={h.uid} style={{ opacity: online ? 1 : 0.45 }}>
                    <td>{h.name}</td>
                    <td>{h.pc}</td>
                    <td>{h.hostname}</td>
                    <td>{h.ip}</td>
                    <td>{h.subnetIndex + 1}</td>
                    <td>{ans?.score ?? 0}%</td>
                    <td>{site ? '🌐' : '—'}</td>
                    <td>
                      <button className="btn secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => confirm(`Remover ${h.name}?`) && removeHost(sid, h.uid)}>
                        remover
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="prof-section">
          <h2>Falhas na rede (tempo real)</h2>
          <div className="fault-row">
            <Toggle on={faults.dnsDown} onClick={() => updateFault({ dnsDown: !faults.dnsDown })} />
            <span>DNS fora do ar</span>
          </div>
          <div className="fault-row">
            <Toggle on={faults.ispDown} onClick={() => updateFault({ ispDown: !faults.ispDown })} />
            <span>Link do provedor caído</span>
          </div>
          <div className="fault-row">
            <Toggle on={!!faults.cableDown} onClick={() => updateFault({ cableDown: !faults.cableDown })} />
            <span>Cabo/placa de rede desconectado</span>
          </div>
          {gateways.map((gw, i) => (
            <div className="fault-row" key={i}>
              <Toggle on={faults.gatewayDown.includes(i)} onClick={() => toggleGateway(i)} />
              <span>Gateway da sub-rede {i + 1} fora ({gw})</span>
            </div>
          ))}
          <div className="fault-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <span>Perda de pacotes: <b>{faults.lossPct}%</b></span>
            <input type="range" min={0} max={50} value={faults.lossPct} onChange={(e) => updateFault({ lossPct: Number(e.target.value) })} />
          </div>
        </div>

        <div className="prof-section">
          <h2>Feed ao vivo</h2>
          <div className="feed">
            {feed.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhuma interação ainda.</p>}
            {feed.map((e) => (
              <div className="ev" key={e.id}>
                {icon(e.type)} <b>{e.fromHost}</b> {verb(e.type)} <b>{e.toHost}</b> {e.ok ? '✓' : '✗'}
                <span style={{ color: 'var(--muted)', fontSize: 11 }}> · {new Date(e.at).toLocaleTimeString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="prof-section">
          <h2>Sites da turma ({state.sites.length})</h2>
          <table className="students">
            <tbody>
              {state.sites.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}.turma.lab</td>
                  <td>{s.ip}</td>
                  <td>{s.title}</td>
                  <td>
                    <button className="btn secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => confirm(`Apagar o site ${s.name}?`) && removeSite(sid, s.name)}>
                      apagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Footer />
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div className={'switch' + (on ? ' on' : '')} onClick={onClick} role="switch" aria-checked={on} tabIndex={0}>
      <div className="knob" />
    </div>
  );
}

function icon(t: SimEvent['type']) {
  return t === 'ping' ? '📶' : t === 'curl' ? '🌐' : t === 'ssh' ? '🔐' : t === 'tracert' ? '🛤️' : '🔎';
}
function verb(t: SimEvent['type']) {
  return t === 'ping' ? 'pingou' : t === 'curl' ? 'visitou o site de' : t === 'ssh' ? 'conectou via SSH em' : t === 'tracert' ? 'rastreou' : 'consultou';
}
