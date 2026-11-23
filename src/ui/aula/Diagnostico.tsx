// Aba "Sem internet?": um PC com defeito sorteado e escondido; o aluno roda comandos e aponta o defeito.
// Com o professor comandando ("Defeito para todos"), o defeito vem da sessão e é o mesmo para a turma.
import { useEffect, useRef, useState } from 'react';
import {
  COMANDOS,
  DEFEITOS,
  PROMPT_WINDOWS,
  ROTULO_DEFEITO,
  feedbackDiagnostico,
  saidaComando,
  sortearDefeito,
  type AulaDiagDoc,
  type Defeito,
  type EventoAula,
  type RespostaAoVivo,
} from '../../sim/aula';

export type EventoDiag = Extract<EventoAula, { atividade: 'diagnostico' }>;

interface Props {
  onResposta?: (ev: EventoDiag, aoVivo?: RespostaAoVivo) => void;
  /** Rodada comandada pelo professor (sessions/{sid}.aulaDiag). */
  aoVivo?: AulaDiagDoc;
  /** O que este aluno já respondeu na rodada ao vivo (sobrevive a recarregar a página). */
  minhaAoVivo?: RespostaAoVivo;
}

interface Linha {
  cmd: string;
  saida: string;
}

export function Diagnostico({ onResposta, aoVivo, minhaAoVivo }: Props) {
  const [defeito, setDefeito] = useState<Defeito>(() => (aoVivo?.ativo ? aoVivo.defeito : sortearDefeito()));
  const [rodadaVivaAplicada, setRodadaVivaAplicada] = useState<number | null>(aoVivo?.ativo ? aoVivo.rodada : null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [usados, setUsados] = useState(0);
  const [escolha, setEscolha] = useState<Defeito | null>(null);
  const [placar, setPlacar] = useState({ ok: 0, total: 0 });
  const termo = useRef<HTMLDivElement>(null);

  const modoVivo = !!aoVivo?.ativo && rodadaVivaAplicada === aoVivo.rodada;

  // Rodada nova do professor: troca o defeito e reinicia o terminal. Se eu já tinha respondido (recarreguei a página), restaura.
  useEffect(() => {
    if (aoVivo?.ativo && aoVivo.rodada !== rodadaVivaAplicada) {
      setRodadaVivaAplicada(aoVivo.rodada);
      setDefeito(aoVivo.defeito);
      setLinhas([]);
      if (minhaAoVivo && minhaAoVivo.rodada === aoVivo.rodada) {
        setEscolha(minhaAoVivo.escolha);
        setUsados(minhaAoVivo.cmds);
      } else {
        setEscolha(null);
        setUsados(0);
      }
    } else if (!aoVivo?.ativo && rodadaVivaAplicada !== null) {
      setRodadaVivaAplicada(null); // a rodada acabou: segue no mesmo PC, agora livre
    }
  }, [aoVivo, rodadaVivaAplicada, minhaAoVivo]);

  useEffect(() => {
    termo.current?.scrollTo({ top: termo.current.scrollHeight });
  }, [linhas]);

  function novo() {
    if (modoVivo) return;
    setDefeito(sortearDefeito(Math.random, defeito));
    setLinhas([]);
    setUsados(0);
    setEscolha(null);
  }

  function rodar(cmd: (typeof COMANDOS)[number]) {
    setUsados((u) => u + 1);
    setLinhas((l) => [...l, { cmd, saida: saidaComando(cmd, defeito) }]);
  }

  function responder(d: Defeito) {
    if (escolha) return;
    setEscolha(d);
    const ok = d === defeito;
    setPlacar((p) => ({ ok: p.ok + (ok ? 1 : 0), total: p.total + 1 }));
    onResposta?.(
      { atividade: 'diagnostico', ok, defeito, cmds: usados },
      modoVivo && aoVivo ? { rodada: aoVivo.rodada, escolha: d, cmds: usados } : undefined,
    );
  }

  const fb = escolha ? feedbackDiagnostico(defeito, escolha, usados) : null;
  const esperando = modoVivo && !!escolha && !aoVivo?.revelado;
  const resumo = aoVivo?.resumo;

  return (
    <section>
      {modoVivo && (
        <div className="au-live" role="status">
          🎯 Defeito do professor: todos os computadores da turma têm o mesmo defeito.
        </div>
      )}
      <div className="au-grid2">
        <div>
          <div className="au-pc">
            <span>💻 PC</span><i>→</i><span>Roteador 192.168.0.1</span><i>→</i><span>Provedor</span><i>→</i><span>Internet 8.8.8.8</span><i>·</i><span>DNS 192.168.0.10</span>
          </div>
          <div className="au-term" ref={termo} aria-live="polite" role="log">
            <span className="p">Microsoft Windows · simulação</span>
            {'\n"Professor, estou sem internet!"\n\n'}
            {linhas.map((l, i) => (
              <span key={i}>
                <span className="p">{PROMPT_WINDOWS}</span>
                {l.cmd}
                {'\n' + l.saida + '\n\n'}
              </span>
            ))}
          </div>
          <div className="au-cmds">
            {COMANDOS.map((c) => (
              <button key={c} type="button" onClick={() => rodar(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="au-card">
          <h2>Este computador está "sem internet"</h2>
          <p style={{ margin: '0 0 8px' }}>
            Rode os comandos <b>de baixo para cima</b>: placa → roteador → internet → DNS. Use o mínimo possível. Onde está o defeito?
          </p>
          <div className="au-pick">
            {DEFEITOS.map((d) => (
              <button key={d} type="button" disabled={!!escolha} className={escolha === d ? 'solid' : ''} onClick={() => responder(d)}>
                {ROTULO_DEFEITO[d]}
              </button>
            ))}
          </div>
          {esperando && (
            <div className="au-fb ok" role="status">
              <b>Resposta enviada: {ROTULO_DEFEITO[escolha!]}.</b>
              <br />
              Aguarde o professor revelar o defeito. Você usou {usados} comando(s).
            </div>
          )}
          {fb && !esperando && (
            <div className={'au-fb ' + (fb.ok ? 'ok' : 'err')} role="status">
              <b>{fb.titulo}</b>
              <br />
              {fb.explicacao}
              <br />
              <span className="au-note">{fb.usados}</span>
              {modoVivo && resumo && (
                <>
                  <br />
                  <span className="au-note">
                    Na turma: {resumo.acertaram} de {resumo.responderam} acertaram
                    {resumo.mediaCmds !== null && `, média de ${String(resumo.mediaCmds).replace('.', ',')} comando(s)`}.
                  </span>
                </>
              )}
            </div>
          )}
          <div className="au-controls" style={{ margin: '12px 0 0' }}>
            <span className="au-score">{placar.ok} de {placar.total}</span>
            <button type="button" disabled={modoVivo} onClick={novo}>Outro computador</button>
          </div>
          <details style={{ marginTop: 12 }}>
            <summary>Como pensar</summary>
            <ol style={{ paddingLeft: 20, margin: '8px 0 0' }}>
              <li><code>ipconfig</code> sem IP ou "mídia desconectada" → cabo ou placa.</li>
              <li><code>ping</code> no gateway falha → problema na rede local ou no roteador.</li>
              <li>Gateway responde, 8.8.8.8 não → problema no provedor.</li>
              <li>8.8.8.8 responde, mas o nome não → DNS.</li>
            </ol>
          </details>
        </div>
      </div>
    </section>
  );
}
