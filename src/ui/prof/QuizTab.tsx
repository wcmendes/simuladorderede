// Aba "Quiz" do professor: cola as perguntas, conduz a rodada e mostra o ranking geral.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  reiniciarQuiz,
  setQuizState,
  watchQuizAnswers,
  watchQuizState,
  type QuizStateDoc,
} from '../../firebase/data';
import {
  DURACAO_MS,
  contagem,
  embaralhar,
  parseQuiz,
  rankingQuiz,
  type QuizPergunta,
  type RespostaQuiz,
} from '../../sim/quiz';
import { REVISAO_NOME, REVISAO_REDES } from '../../sim/quizPronto';
import type { Host } from '../../sim/types';
import { Projetor } from './Projetor';

const CHAVE_TEXTO = 'labredes-quiz-texto';
const CHAVE_SET = 'labredes-quiz-set';
const CORES = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#7b3fbf', '#c2410c'];

function lerSet(): QuizPergunta[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_SET) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function QuizTab({ sid, hosts, online }: { sid: string; hosts: Host[]; online: number }) {
  const [texto, setTexto] = useState(() => localStorage.getItem(CHAVE_TEXTO) ?? '');
  const [perguntas, setPerguntas] = useState<QuizPergunta[]>(lerSet);
  const [misturar, setMisturar] = useState(true);
  const [erros, setErros] = useState<string[]>([]);
  const [st, setSt] = useState<QuizStateDoc | null>(null);
  const [respostas, setRespostas] = useState<RespostaQuiz[]>([]);
  const [projetor, setProjetor] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const revelando = useRef('');

  useEffect(() => {
    const u1 = watchQuizState(sid, setSt);
    const u2 = watchQuizAnswers(sid, setRespostas);
    return () => { u1(); u2(); };
  }, [sid]);

  function carregar(origem: string) {
    const r = parseQuiz(origem);
    setErros(r.erros);
    if (r.perguntas.length === 0) return;
    const set = misturar ? embaralhar(r.perguntas) : r.perguntas;
    setPerguntas(set);
    localStorage.setItem(CHAVE_TEXTO, origem);
    localStorage.setItem(CHAVE_SET, JSON.stringify(set));
  }

  function carregarRevisao() {
    setTexto(REVISAO_REDES);
    carregar(REVISAO_REDES);
  }

  const aberta = !!st && st.active && !st.revealed;
  const atual = st ? perguntas[st.questionIndex] : undefined;

  async function iniciar(indice: number) {
    const p = perguntas[indice];
    if (!p) return;
    setOcupado(true);
    try {
      await setQuizState(sid, {
        active: true,
        questionIndex: indice,
        total: perguntas.length,
        startedAt: Date.now(),
        durationMs: DURACAO_MS,
        revealed: false,
        question: { texto: p.texto, opcoes: p.opcoes },
      });
    } finally {
      setOcupado(false);
    }
  }

  async function revelar() {
    if (!st || !atual || st.revealed) return;
    setOcupado(true);
    try {
      await setQuizState(sid, {
        ...st,
        revealed: true,
        correct: atual.correta,
        counts: contagem(atual.opcoes.length, respostas, st.questionIndex),
      });
    } finally {
      setOcupado(false);
    }
  }

  // Quando o tempo acaba, revela sozinho (com 1,5 s de folga para as últimas respostas chegarem).
  useEffect(() => {
    if (!aberta) return;
    const id = setInterval(() => {
      setAgora(Date.now());
      const chave = `${st!.questionIndex}:${st!.startedAt}`;
      if (Date.now() - st!.startedAt >= st!.durationMs + 1500 && revelando.current !== chave) {
        revelando.current = chave;
        revelar();
      }
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, st?.startedAt, respostas]);

  async function encerrar() {
    if (st) await setQuizState(sid, { ...st, active: false });
  }

  async function reiniciar() {
    if (!confirm('Reiniciar o quiz apaga todas as respostas e o placar. Confirmar?')) return;
    await reiniciarQuiz(sid);
  }

  const proximo = st ? st.questionIndex + 1 : 0;
  const acabou = !!st && st.revealed && proximo >= perguntas.length;
  const ateIndice = st ? (st.revealed ? st.questionIndex : st.questionIndex - 1) : -1;

  const nomes = useMemo(() => new Map(hosts.map((h) => [h.uid, h.name])), [hosts]);
  const ranking = useMemo(() => rankingQuiz(perguntas, respostas, ateIndice), [perguntas, respostas, ateIndice]);
  const doAtual = st ? respostas.filter((r) => r.q === st.questionIndex) : [];
  const contAtual = atual ? contagem(atual.opcoes.length, respostas, st!.questionIndex) : [];
  const maxCont = Math.max(1, ...contAtual);
  const restante = st && aberta ? Math.max(0, Math.ceil((st.durationMs - (agora - st.startedAt)) / 1000)) : 0;

  return (
    <div className="prof-grid">
      <div className="prof-section">
        <h2>Perguntas</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Uma pergunta por bloco, separados por linha em branco. A primeira linha é a pergunta, as seguintes são as alternativas e a correta começa com <b>*</b>.
        </p>
        <textarea
          className="quiz-texto"
          rows={10}
          value={texto}
          placeholder={'Qual camada do OSI cuida do endereço IP?\n*Rede\nEnlace\nTransporte\nAplicação'}
          onChange={(e) => setTexto(e.target.value)}
        />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0', fontSize: 14 }}>
          <input type="checkbox" checked={misturar} onChange={(e) => setMisturar(e.target.checked)} />
          Embaralhar as alternativas ao carregar
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => carregar(texto)} disabled={!texto.trim()}>Carregar do texto</button>
          <button className="btn secondary" onClick={carregarRevisao}>Carregar "{REVISAO_NOME}"</button>
        </div>
        {erros.map((e, i) => <div key={i} className="error-msg">{e}</div>)}
        <p style={{ fontSize: 13, color: perguntas.length ? 'var(--ok)' : 'var(--muted)' }}>
          {perguntas.length ? `✔ ${perguntas.length} pergunta(s) carregada(s).` : 'Nenhuma pergunta carregada.'}
        </p>
      </div>

      <div className="prof-section">
        <h2>Condução</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="btn" disabled={ocupado || perguntas.length === 0 || aberta || acabou} onClick={() => iniciar(proximo)}>
            {st ? 'Próxima pergunta' : 'Iniciar quiz'}
          </button>
          <button className="btn secondary" disabled={ocupado || !aberta} onClick={revelar}>Revelar</button>
          <button className="btn secondary" disabled={!st || !st.active} onClick={encerrar}>Encerrar quiz</button>
          <button className="btn danger" disabled={!st && respostas.length === 0} onClick={reiniciar}>Reiniciar</button>
        </div>

        {!st && <p style={{ color: 'var(--muted)' }}>Carregue as perguntas e clique em "Iniciar quiz". Os alunos da sessão veem a pergunta ao mesmo tempo.</p>}

        {st && atual && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}>
              <span>Pergunta {st.questionIndex + 1} de {perguntas.length}{!st.active && ' · encerrado'}</span>
              <span>{aberta ? `⏱ ${restante}s` : st.revealed ? 'revelada' : ''}</span>
            </div>
            <h3 style={{ margin: '6px 0 10px' }}>{atual.texto}</h3>
            {atual.opcoes.map((o, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ fontWeight: st.revealed && i === atual.correta ? 700 : 400, color: st.revealed && i === atual.correta ? 'var(--ok)' : undefined }}>
                    {st.revealed && i === atual.correta ? '✔ ' : ''}{o}
                  </span>
                  <span>{contAtual[i]}</span>
                </div>
                <div className="barra"><div style={{ width: `${(contAtual[i] / maxCont) * 100}%`, background: CORES[i % CORES.length] }} /></div>
              </div>
            ))}
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              Responderam: <b>{doAtual.length}</b> de {online} online
            </p>
            {acabou && <p style={{ color: 'var(--ok)' }}>Fim do quiz. Abra o ranking no modo projetor.</p>}
          </>
        )}
      </div>

      <div className="prof-section" style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Ranking geral ({ranking.length})</h2>
          <button className="btn secondary" style={{ marginLeft: 'auto' }} onClick={() => setProjetor(true)}>Modo projetor</button>
        </div>
        {ranking.length === 0 && <p style={{ color: 'var(--muted)' }}>O placar aparece depois da primeira pergunta revelada.</p>}
        <table className="students">
          <thead><tr><th>#</th><th>Aluno</th><th>Pontos</th><th>Acertos</th></tr></thead>
          <tbody>
            {ranking.map((l, i) => (
              <tr key={l.uid}><td>{i + 1}</td><td>{nomes.get(l.uid) ?? 'Aluno'}</td><td><b>{l.pontos}</b></td><td>{l.acertos}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {projetor && (
        <Projetor
          titulo="Ranking do Quiz"
          itens={ranking.map((l) => ({
            nome: nomes.get(l.uid) ?? 'Aluno',
            valor: `${l.pontos.toLocaleString('pt-BR')} pts`,
            detalhe: `${l.acertos} ${l.acertos === 1 ? 'acerto' : 'acertos'}`,
          }))}
          onClose={() => setProjetor(false)}
        />
      )}
    </div>
  );
}
