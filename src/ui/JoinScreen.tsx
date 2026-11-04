// Tela de entrada do aluno: código da sessão, nome e nº do computador.
import { useState } from 'react';
import { getSession, joinSession, sessionIdFromCode } from '../firebase/data';
import type { Host } from '../sim/types';
import { Footer } from './Footer';

interface Props {
  uid: string;
  initialCode?: string;
  onJoined: (sid: string, host: Host) => void;
}

export function JoinScreen({ uid, initialCode, onJoined }: Props) {
  const [code, setCode] = useState(initialCode ?? '');
  const [name, setName] = useState('');
  const [pc, setPc] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const pcNum = Number(pc);
    if (!code.trim()) return setError('Informe o código da sessão.');
    if (name.trim().split(/\s+/).length < 2) return setError('Digite nome e sobrenome.');
    if (!Number.isInteger(pcNum) || pcNum < 1 || pcNum > 40) return setError('O número do computador deve ser de 1 a 40.');

    setLoading(true);
    try {
      const sid = sessionIdFromCode(code);
      const session = await getSession(sid);
      if (!session) {
        setError('Sessão não encontrada. Confira o código no projetor.');
        setLoading(false);
        return;
      }
      const host = await joinSession(sid, uid, name.trim(), pcNum, session.mode);
      onJoined(sid, host);
    } catch (err) {
      setError('Erro ao entrar: ' + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="center-screen" style={{ flex: 1 }}>
      <form className="card" onSubmit={submit}>
        <h1>LabRedes</h1>
        <p className="sub">Entre na rede simulada da turma</p>
        <div className="field">
          <label htmlFor="code">Código da sessão</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex.: REDES0411" autoCapitalize="characters" />
        </div>
        <div className="field">
          <label htmlFor="name">Nome e sobrenome</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Silva" />
        </div>
        <div className="field">
          <label htmlFor="pc">Número do computador (1 a 40)</label>
          <input id="pc" type="number" min={1} max={40} value={pc} onChange={(e) => setPc(e.target.value)} placeholder="Ex.: 12" />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Entrando...' : 'Entrar na rede'}
        </button>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 14 }}>
          Não pedimos matrícula, e-mail nem senha. A presença é controlada na folha em papel.
        </p>
      </form>
      </div>
      <Footer />
    </div>
  );
}
