// Tela cheia do aluno durante o quiz ao vivo. Escuta só quiz/state e grava a própria resposta.
// O tempo é medido no navegador do aluno a partir do instante em que a pergunta chegou,
// então relógios diferentes entre os computadores não afetam a pontuação.
import { useEffect, useRef, useState } from 'react';
import { answerQuiz, getQuizAnswer, watchQuizState, type QuizStateDoc } from '../firebase/data';
import { pontos } from '../sim/quiz';

const CORES = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#7b3fbf', '#c2410c'];
const FORMAS = ['▲', '◆', '●', '■', '★', '⬟'];

export function QuizAluno({ sid, uid }: { sid: string; uid: string }) {
  const [st, setSt] = useState<QuizStateDoc | null>(null);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [msResp, setMsResp] = useState(0);
  const [agora, setAgora] = useState(0);
  const [erro, setErro] = useState('');
  const chegouEm = useRef(0);
  const chaveAtual = useRef('');

  useEffect(() => watchQuizState(sid, setSt), [sid]);

  // Nova pergunta: zera a escolha, marca a chegada e confere se já respondi (recarregou a página).
  const chave = st ? `${st.questionIndex}:${st.startedAt}` : '';
  useEffect(() => {
    if (!st || chave === chaveAtual.current) return;
    chaveAtual.current = chave;
    chegouEm.current = performance.now();
    setEscolha(null);
    setMsResp(0);
    setErro('');
    let vivo = true;
    getQuizAnswer(sid, st.questionIndex, uid)
      .then((r) => {
        if (vivo && r) {
          setEscolha(r.choice);
          setMsResp(r.ms);
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  // Relógio da tela (5 vezes por segundo, só enquanto há pergunta aberta).
  const aberta = !!st && st.active && !st.revealed;
  useEffect(() => {
    if (!aberta) return;
    const id = setInterval(() => setAgora(performance.now()), 200);
    return () => clearInterval(id);
  }, [aberta]);

  if (!st || !st.active) return null;

  const decorrido = agora ? Math.max(0, agora - chegouEm.current) : 0;
  const restante = Math.max(0, Math.ceil((st.durationMs - decorrido) / 1000));
  const esgotou = decorrido >= st.durationMs;
  const travado = escolha !== null || esgotou || st.revealed;
  const acertou = st.revealed && escolha !== null && escolha === st.correct;
  const max = Math.max(1, ...(st.counts ?? [0]));

  function escolher(i: number) {
    if (!st || travado) return;
    const ms = Math.max(0, Math.round(performance.now() - chegouEm.current));
    setEscolha(i);
    setMsResp(ms);
    setErro('');
    answerQuiz(sid, st.questionIndex, uid, i, ms).catch(() => {
      setErro('Não consegui registrar a resposta (o tempo acabou ou você já respondeu).');
    });
  }

  return (
    <div className="quiz-aluno" role="dialog" aria-label="Quiz ao vivo">
      <div className="quiz-topo">
        <span>Pergunta {st.questionIndex + 1} de {st.total}</span>
        {!st.revealed && <span className={'quiz-tempo' + (restante <= 5 ? ' fim' : '')}>⏱ {restante}s</span>}
      </div>
      <h1 className="quiz-pergunta">{st.question.texto}</h1>

      <div className="quiz-opcoes">
        {st.question.opcoes.map((o, i) => {
          const certa = st.revealed && i === st.correct;
          const errada = st.revealed && !certa;
          return (
            <button
              key={i}
              type="button"
              className={'quiz-opcao' + (escolha === i ? ' minha' : '') + (certa ? ' certa' : '') + (errada ? ' errada' : '')}
              style={{ background: CORES[i % CORES.length] }}
              disabled={travado}
              onClick={() => escolher(i)}
            >
              <span className="forma">{FORMAS[i % FORMAS.length]}</span>
              <span className="texto">{o}</span>
              {st.revealed && st.counts && (
                <span className="barra-q">
                  <span style={{ width: `${(st.counts[i] / max) * 100}%` }} />
                  <b>{st.counts[i]}</b>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="quiz-rodape" role="status">
        {st.revealed ? (
          escolha === null ? (
            <b>Você não respondeu a tempo. A resposta certa está destacada.</b>
          ) : acertou ? (
            <b className="ok">✔ Acertou! +{pontos(msResp, st.durationMs)} pontos</b>
          ) : (
            <b className="err">✘ Não foi dessa vez. A resposta certa está destacada.</b>
          )
        ) : escolha !== null ? (
          <b>Resposta enviada. Aguarde o professor revelar…</b>
        ) : esgotou ? (
          <b>Tempo esgotado.</b>
        ) : (
          <span>Escolha uma alternativa. Só vale a primeira resposta.</span>
        )}
        {erro && <div className="err">{erro}</div>}
      </div>
    </div>
  );
}
