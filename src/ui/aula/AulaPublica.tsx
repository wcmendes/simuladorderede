// Página /aula: a Aula interativa aberta pelo link, sem código nem número de computador.
// O aluno que informa nome e sobrenome entra na sessão única (código AULA) e o professor passa a ver
// o que ele faz. Quem não informa o nome usa as abas normalmente, sem registro.
import { useEffect, useState } from 'react';
import {
  CODIGO_PADRAO,
  getSession,
  heartbeat,
  joinSession,
  proximoPc,
  saveAula,
  sessionIdFromCode,
  watchSession,
  type SessionDoc,
} from '../../firebase/data';
import type { Host } from '../../sim/types';
import { Aula } from './Aula';

const CHAVE_NOME = 'labredes-aula-nome';
const SID = sessionIdFromCode(CODIGO_PADRAO);

export function AulaPublica({ uid }: { uid: string | null }) {
  const [nome, setNome] = useState(() => localStorage.getItem(CHAVE_NOME) ?? '');
  const [campo, setCampo] = useState(nome);
  const [host, setHost] = useState<Host | null>(null);
  const [sessao, setSessao] = useState<SessionDoc | null>(null);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  // Acompanha a sessão única: o professor pode resetar (apagar) e recriar a qualquer momento.
  useEffect(() => {
    if (!uid) return;
    return watchSession(SID, (s) => {
      setSessao(s);
      if (!s) setHost(null);
    });
  }, [uid]);

  async function entrar(n: string) {
    if (!uid || entrando) return;
    if (n.trim().split(/\s+/).length < 2) return setErro('Digite nome e sobrenome.');
    setEntrando(true);
    setErro('');
    try {
      const s = await getSession(SID);
      if (!s) {
        setErro('A aula ainda não foi aberta pelo professor. Você pode usar as abas sem entrar.');
        return;
      }
      const h = await joinSession(SID, uid, n.trim(), await proximoPc(SID), s.mode);
      localStorage.setItem(CHAVE_NOME, n.trim());
      setNome(n.trim());
      setHost(h);
    } catch (e) {
      setErro('Não consegui entrar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEntrando(false);
    }
  }

  // Já tinha entrado antes (ou o professor resetou e recriou a sessão): volta sozinho com o nome salvo.
  useEffect(() => {
    if (uid && sessao && !host && nome && !entrando) void entrar(nome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, sessao, host, nome]);

  // Batimento: o professor conta quem está online.
  useEffect(() => {
    if (!uid || !host) return;
    heartbeat(SID, uid).catch(() => {});
    const id = setInterval(() => heartbeat(SID, uid).catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, [uid, host]);

  return (
    <>
      {!host && (
        <form
          style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
          onSubmit={(e) => {
            e.preventDefault();
            void entrar(campo);
          }}
        >
          <span style={{ fontSize: 14 }}>Quer que o professor veja o seu progresso? Entre com seu nome:</span>
          <input value={campo} onChange={(e) => setCampo(e.target.value)} placeholder="Nome e sobrenome" aria-label="Nome e sobrenome" style={{ minWidth: 200 }} />
          <button className="btn" type="submit" disabled={!uid || entrando}>{entrando ? 'Entrando...' : 'Entrar'}</button>
          {erro && <span className="error-msg" style={{ margin: 0 }}>{erro}</span>}
        </form>
      )}
      {host && (
        <div style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '8px 16px', fontSize: 14 }}>
          Você está na turma como <b>{host.name}</b>. O professor vê os seus acertos.
        </div>
      )}
      <Aula
        usarHash
        sessao={
          host && uid
            ? {
                sid: SID,
                uid,
                epoch: `${sessao?.createdAt ?? 0}:${sessao?.rankingEpoch ?? 0}`,
                aulaDiag: sessao?.aulaDiag,
                salvar: (score, aoVivo) => saveAula(SID, uid, host.name, score, aoVivo),
              }
            : undefined
        }
      />
    </>
  );
}
