// Desafio de diagnóstico no lado do aluno: contador de comandos e seletor de resposta.
import { useCallback, useEffect, useState } from 'react';
import { answerDiag, getDiagAnswer } from '../firebase/data';
import { FALHAS, ROTULO_FALHA, falhaAtiva, type Falha } from '../sim/diag';
import type { Faults } from '../sim/types';

interface DiagDoc {
  ativo: boolean;
  rodada: number;
}

export function useDiagAluno(sid: string, uid: string, diag: DiagDoc | undefined, faults: Faults) {
  const ativo = !!diag?.ativo;
  const rodada = diag?.rodada ?? 0;
  const chave = `labredes-diag:${sid}:${rodada}`;
  const [cmds, setCmds] = useState(0);
  const [resposta, setResposta] = useState<Falha | null>(null);
  const [erro, setErro] = useState('');

  // Nova rodada: retoma a contagem salva e confere se já respondi (recarregou a página).
  useEffect(() => {
    if (!ativo) return;
    setCmds(Number(localStorage.getItem(chave)) || 0);
    setResposta(null);
    setErro('');
    let vivo = true;
    getDiagAnswer(sid, rodada, uid)
      .then((r) => vivo && r && setResposta(r.choice))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [ativo, rodada, sid, uid, chave]);

  const contar = useCallback(() => {
    setCmds((c) => {
      localStorage.setItem(chave, String(c + 1));
      return c + 1;
    });
  }, [chave]);

  function enviar(choice: Falha) {
    if (resposta) return;
    setResposta(choice);
    setErro('');
    answerDiag(sid, rodada, uid, choice, cmds).catch(() => {
      setResposta(null);
      setErro('Não consegui registrar a resposta (a rodada acabou ou você já respondeu).');
    });
  }

  const acertou = resposta !== null && resposta === falhaAtiva(faults);
  return { ativo, cmds, resposta, acertou, erro, contar, enviar };
}

export type DiagAluno = ReturnType<typeof useDiagAluno>;

export function DiagBanner({ d }: { d: DiagAluno }) {
  const [sel, setSel] = useState<Falha | ''>('');
  if (!d.ativo) return null;
  return (
    <div className="diag-banner" role="region" aria-label="Desafio de diagnóstico">
      <div>
        <b>🔧 Desafio de diagnóstico:</b> a rede tem um problema escondido. Descubra qual usando só <code>ping</code>, <code>nslookup</code>, <code>tracert</code> e <code>ipconfig</code>.
        <span className="diag-cmds"> Comandos usados: <b>{d.cmds}</b> (menos é melhor)</span>
      </div>
      {d.resposta ? (
        <div className={d.acertou ? 'diag-ok' : 'diag-err'}>
          Você respondeu <b>{ROTULO_FALHA[d.resposta]}</b>: {d.acertou ? '✔ acertou!' : '✘ não foi essa. O professor vai revelar no fim.'}
        </div>
      ) : (
        <div className="diag-resp">
          <span>O problema está no:</span>
          {FALHAS.map((f) => (
            <button key={f} type="button" className={sel === f ? 'sel' : ''} onClick={() => setSel(f)}>
              {ROTULO_FALHA[f].split(' (')[0]}
            </button>
          ))}
          <button type="button" className="btn" disabled={!sel} onClick={() => sel && d.enviar(sel)}>Responder</button>
        </div>
      )}
      {d.erro && <div className="diag-err">{d.erro}</div>}
    </div>
  );
}
