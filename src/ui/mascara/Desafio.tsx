// Sub-aba "Desafio": perguntas aleatórias com correção na hora. Dentro de uma sessão,
// cada resposta grava o placar do aluno (uma gravação por resposta).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ROTULO_NIVEL,
  ROTULO_TIPO,
  conferir,
  explicacao,
  gerarPergunta,
  toStr,
  type Nivel,
  type Pergunta,
  type Tipo,
} from '../../sim/mascara';
import { aplicarResposta, normalizarScore, scoreVazio, type Score } from '../../sim/ranking';

export interface RodadaAtiva {
  ativa: boolean;
  tipo: Tipo | 'todos';
  nivel: Nivel;
}

export interface SessaoDesafio {
  sid: string;
  uid: string;
  name: string;
  epoch?: number; // muda quando o professor zera o ranking
  rodada?: RodadaAtiva;
  salvarScore: (score: Score) => Promise<void>;
}

const Mono = ({ children }: { children: ReactNode }) => <span className="mx-mono">{children}</span>;

function lerLocal(chave: string): Score {
  try {
    return normalizarScore(JSON.parse(localStorage.getItem(chave) || 'null'));
  } catch {
    return scoreVazio();
  }
}

function Enunciado({ p }: { p: Pergunta }) {
  if (p.tipo === 'rede') return <>Qual é o endereço de rede de <Mono>{toStr(p.ip)}/{p.c}</Mono>?</>;
  if (p.tipo === 'broadcast') return <>Qual é o broadcast de <Mono>{toStr(p.ip)}/{p.c}</Mono>?</>;
  if (p.tipo === 'hosts') return <>Quantos computadores cabem numa rede <Mono>/{p.c}</Mono>?</>;
  return (
    <>
      <Mono>{toStr(p.ip)}</Mono> e <Mono>{toStr(p.outro!)}</Mono>, os dois com <Mono>/{p.c}</Mono>. Mesma rede? (sim ou não)
    </>
  );
}

export function Desafio({ sessao }: { sessao?: SessaoDesafio }) {
  const chave = sessao ? `mascara-score:${sessao.sid}:${sessao.epoch ?? 0}` : 'mascara-score';
  const [score, setScore] = useState<Score>(() => lerLocal(chave));
  const [p, setP] = useState<Pergunta | null>(null);
  const [resp, setResp] = useState('');
  const [fb, setFb] = useState<{ ok: boolean } | null>(null);
  const [erro, setErro] = useState('');
  const campo = useRef<HTMLInputElement>(null);

  const rodada = sessao?.rodada?.ativa ? sessao.rodada : undefined;
  const tipoRodada = rodada?.tipo ?? 'todos';
  const nivelRodada = rodada?.nivel ?? 'todos';

  // O placar local pertence a (sessão, época do ranking). Se mudar, recarrega.
  useEffect(() => {
    setScore(lerLocal(chave));
  }, [chave]);

  function nova() {
    setP(gerarPergunta(Math.random, { tipo: tipoRodada, nivel: nivelRodada }));
    setResp('');
    setFb(null);
    setErro('');
    campo.current?.focus({ preventScroll: true });
  }

  // Pergunta nova na primeira vez e sempre que a rodada do professor muda.
  useEffect(() => {
    nova();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoRodada, nivelRodada]);

  function conferirResposta(e: React.FormEvent) {
    e.preventDefault();
    if (!p || fb || !resp.trim()) return; // uma resposta por pergunta
    const ok = conferir(p, resp);
    const novo = aplicarResposta(score, p.tipo, ok);
    setScore(novo);
    setFb({ ok });
    try {
      localStorage.setItem(chave, JSON.stringify(novo));
    } catch {
      /* sem armazenamento local: segue sem salvar */
    }
    if (sessao) {
      sessao.salvarScore(novo).catch(() => setErro('Não consegui enviar o seu placar ao professor. Tente a próxima pergunta.'));
    }
  }

  return (
    <section>
      {rodada && (
        <div className="mx-rodada">
          🎯 Rodada do professor: {rodada.tipo === 'todos' ? 'todos os tipos' : `só ${ROTULO_TIPO[rodada.tipo].toLowerCase()}`} · {ROTULO_NIVEL[rodada.nivel]}
        </div>
      )}
      <div className="mx-grid2">
        <div className="mx-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="mx-note">{p ? ROTULO_TIPO[p.tipo] : ''}</span>
            <span className="mx-score">
              {score.ok} de {score.total}
              {score.streak >= 2 && <span title="acertos seguidos"> · 🔥 {score.streak}</span>}
            </span>
          </div>
          <div className="mx-q">{p && <Enunciado p={p} />}</div>
          <form className="mx-controls" style={{ margin: 0 }} onSubmit={conferirResposta}>
            <div>
              <label htmlFor="mx-ans">Sua resposta</label>
              <input id="mx-ans" ref={campo} type="text" autoComplete="off" value={resp} disabled={!!fb} onChange={(e) => setResp(e.target.value)} />
            </div>
            <button className="solid" type="submit" disabled={!!fb}>Conferir</button>
            <button type="button" onClick={nova}>Outra pergunta</button>
          </form>
          {p && (
            <div className={'mx-fb ' + (fb ? 'show ' + (fb.ok ? 'ok' : 'err') : '')} role="status">
              <b>{fb?.ok ? 'Certo!' : `Ainda não. Resposta: ${p.resposta}`}</b>
              <br />
              {explicacao(p)}
            </div>
          )}
          {erro && <p className="mx-note" style={{ color: 'var(--red)' }}>{erro}</p>}
        </div>
        <div className="mx-steps">
          <h2>O truque do salto</h2>
          <ol>
            <li>Ache o bloco do IP onde a máscara <b>deixa de ser 255</b>.</li>
            <li><b>Salto</b> = 256 − valor da máscara nesse bloco. Ex.: /26 → máscara .192 → salto 64.</li>
            <li>As redes andam de salto em salto: 0, 64, 128, 192.</li>
            <li><b>Rede</b> = o múltiplo do salto logo abaixo do IP. <b>Broadcast</b> = próxima rede − 1.</li>
            <li><b>Hosts</b> = 2<sup>n</sup> − 2, n = 32 − o número do "/".</li>
          </ol>
          <p className="mx-note" style={{ margin: '12px 0 0' }}>
            Respostas aceitas: o endereço completo (192.168.10.64) ou só um número quando a pergunta pedir.
          </p>
        </div>
      </div>
    </section>
  );
}
