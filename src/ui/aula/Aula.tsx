// "Aula interativa": 4 abas (TCP × UDP, Portas, Sem internet?, Nuvem). Funciona sozinha em /aula
// (cada aba tem o seu hash) e dentro de uma sessão, onde os acertos vão para o ranking da turma.
import { useCallback, useEffect, useState } from 'react';
import './aula.css';
import {
  aplicarEvento,
  aulaVazia,
  normalizarAula,
  type AulaDiagDoc,
  type AulaScore,
  type EventoAula,
  type RespostaAoVivo,
} from '../../sim/aula';
import { Diagnostico, type EventoDiag } from './Diagnostico';
import { Nuvem } from './Nuvem';
import { Portas } from './Portas';
import { TcpUdp } from './TcpUdp';

export type AbaAula = 'tcp-udp' | 'portas' | 'diagnostico' | 'nuvem';

const ABAS: Array<[AbaAula, string, string]> = [
  ['tcp-udp', 'TCP × UDP', 'Mande os mesmos 10 pacotes por TCP e por UDP e compare.'],
  ['portas', 'Portas', 'Cada serviço mora numa porta. Encaixe cada um no lugar certo.'],
  ['diagnostico', 'Sem internet?', 'Um computador sem internet: descubra o defeito com os comandos certos.'],
  ['nuvem', 'Nuvem', 'IaaS, PaaS ou SaaS? Classifique serviços que você usa todo dia.'],
];

export interface SessaoAula {
  sid: string;
  uid: string;
  epoch?: number; // muda quando o professor zera o ranking
  aulaDiag?: AulaDiagDoc;
  /** Uma gravação por resposta. */
  salvar: (score: AulaScore, aoVivo?: RespostaAoVivo) => Promise<void>;
}

function abaDoHash(): AbaAula {
  const h = location.hash.replace(/^#/, '');
  return ABAS.some(([id]) => id === h) ? (h as AbaAula) : 'tcp-udp';
}

function lerJson<T>(chave: string, vazio: T, ler: (raw: unknown) => T): T {
  try {
    return ler(JSON.parse(localStorage.getItem(chave) || 'null'));
  } catch {
    return vazio;
  }
}

interface Props {
  sessao?: SessaoAula;
  /** true em /aula: a aba vem do hash da URL. Dentro da sessão a aba fica só no estado. */
  usarHash?: boolean;
}

export function Aula({ sessao, usarHash = false }: Props) {
  const [aba, setAba] = useState<AbaAula>(() => (usarHash ? abaDoHash() : 'tcp-udp'));
  const chave = sessao ? `aula-score:${sessao.sid}:${sessao.epoch ?? 0}` : '';
  const chaveVivo = sessao ? `aula-ao-vivo:${sessao.sid}` : '';
  const [score, setScore] = useState<AulaScore>(() => (chave ? lerJson(chave, aulaVazia(), normalizarAula) : aulaVazia()));
  const [minhaAoVivo, setMinhaAoVivo] = useState<RespostaAoVivo | undefined>(() =>
    chaveVivo ? lerJson<RespostaAoVivo | undefined>(chaveVivo, undefined, (r) => (r as RespostaAoVivo | null) ?? undefined) : undefined,
  );
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!usarHash) return;
    const on = () => setAba(abaDoHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [usarHash]);

  // O placar local pertence a (sessão, época do ranking). Se mudar, recarrega.
  useEffect(() => {
    if (chave) setScore(lerJson(chave, aulaVazia(), normalizarAula));
  }, [chave]);

  const registrar = useCallback(
    (ev: EventoAula, aoVivo?: RespostaAoVivo) => {
      if (!sessao) return; // fora da sessão o placar não é guardado
      const novo = aplicarEvento(score, ev);
      setScore(novo);
      try {
        localStorage.setItem(chave, JSON.stringify(novo));
        if (aoVivo) {
          localStorage.setItem(chaveVivo, JSON.stringify(aoVivo));
        }
      } catch {
        /* sem armazenamento local: segue sem salvar */
      }
      if (aoVivo) setMinhaAoVivo(aoVivo);
      setErro('');
      sessao.salvar(novo, aoVivo).catch(() => setErro('Não consegui enviar o seu placar ao professor. Tente a próxima resposta.'));
    },
    [sessao, score, chave, chaveVivo],
  );

  const atual = ABAS.find(([id]) => id === aba)!;

  return (
    <div className="au">
      <div className="au-wrap">
        <h1>Aula interativa de Redes</h1>
        <p className="au-lead">{atual[2]}</p>
        <nav className="au-tabs" aria-label="Seções da aula interativa">
          {ABAS.map(([id, rotulo]) =>
            usarHash ? (
              <a key={id} href={'#' + id} aria-current={aba === id ? 'page' : undefined}>
                {rotulo}
              </a>
            ) : (
              <button key={id} type="button" aria-current={aba === id ? 'page' : undefined} onClick={() => setAba(id)}>
                {rotulo}
              </button>
            ),
          )}
        </nav>
        {erro && <p className="au-note" style={{ color: 'var(--red)' }}>{erro}</p>}
        <div hidden={aba !== 'tcp-udp'}><TcpUdp /></div>
        <div hidden={aba !== 'portas'}><Portas onResposta={(ok) => registrar({ atividade: 'portas', ok })} /></div>
        <div hidden={aba !== 'diagnostico'}>
          <Diagnostico
            aoVivo={sessao?.aulaDiag}
            minhaAoVivo={minhaAoVivo}
            onResposta={(ev: EventoDiag, vivo) => registrar(ev, vivo)}
          />
        </div>
        <div hidden={aba !== 'nuvem'}><Nuvem onResposta={(ok) => registrar({ atividade: 'nuvem', ok })} /></div>
      </div>
    </div>
  );
}
