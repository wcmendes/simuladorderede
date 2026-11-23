// Painel do professor para a Aula interativa: acerto da turma por atividade e o botão
// "Defeito para todos" (mesmo defeito do diagnóstico para todos os alunos, com revelação).
import { useEffect, useMemo, useRef, useState } from 'react';
import { setAulaDiag, type ScoreDoc } from '../../firebase/data';
import {
  DEFEITOS,
  ROTULO_DEFEITO,
  resumoAoVivo,
  resumoTurma,
  sortearDefeito,
  type AulaDiagDoc,
} from '../../sim/aula';

const fmtPct = (p: number | null) => (p === null ? '—' : `${p}%`);

function Barra({ rotulo, ok, total, pct }: { rotulo: string; ok: number; total: number; pct: number | null }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>{rotulo}</span>
        <span>{fmtPct(pct)} <span style={{ color: 'var(--muted)' }}>({ok}/{total})</span></span>
      </div>
      <div className="barra"><div style={{ width: `${pct ?? 0}%` }} /></div>
    </div>
  );
}

interface Props {
  sid: string;
  scores: ScoreDoc[];
  online: number;
  aulaDiag?: AulaDiagDoc;
}

export function AulaAoVivo({ sid, scores, online, aulaDiag }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const revelando = useRef<number | null>(null);

  const resumo = useMemo(() => resumoTurma(scores.map((s) => s.aula)), [scores]);
  const ativo = !!aulaDiag?.ativo;
  const vivo = useMemo(
    () => (aulaDiag ? resumoAoVivo(scores.map((s) => s.aoVivo), aulaDiag.rodada, aulaDiag.defeito) : null),
    [scores, aulaDiag],
  );

  async function iniciar() {
    setOcupado(true);
    try {
      const defeito = sortearDefeito(Math.random, aulaDiag?.defeito);
      await setAulaDiag(sid, { ativo: true, rodada: Date.now(), defeito, revelado: false });
    } finally {
      setOcupado(false);
    }
  }

  async function revelar() {
    if (!aulaDiag || !vivo) return;
    setOcupado(true);
    try {
      await setAulaDiag(sid, { ...aulaDiag, revelado: true, resumo: vivo });
    } finally {
      setOcupado(false);
    }
  }

  async function encerrar() {
    if (!aulaDiag) return;
    setOcupado(true);
    try {
      await setAulaDiag(sid, { ...aulaDiag, ativo: false });
    } finally {
      setOcupado(false);
    }
  }

  // Revela sozinho quando todos os alunos online responderam.
  useEffect(() => {
    if (!aulaDiag || !vivo || !aulaDiag.ativo || aulaDiag.revelado) return;
    if (online > 0 && vivo.responderam >= online && revelando.current !== aulaDiag.rodada) {
      revelando.current = aulaDiag.rodada;
      setAulaDiag(sid, { ...aulaDiag, revelado: true, resumo: vivo }).catch(() => {
        revelando.current = null;
      });
    }
  }, [aulaDiag, vivo, online, sid]);

  return (
    <div className="prof-section">
      <h2>Aula interativa</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
        Acerto da turma nas abas Portas, Sem internet? e Nuvem (cada resposta conta uma vez).
      </p>
      <Barra rotulo="Portas" {...resumo.portas} />
      <Barra rotulo="Sem internet? (diagnóstico)" {...resumo.diagnostico} />
      <Barra rotulo="Nuvem" {...resumo.nuvem} />
      <p style={{ fontSize: 13 }}>
        Média de comandos no diagnóstico: <b>{resumo.diagnostico.mediaCmds === null ? '—' : String(resumo.diagnostico.mediaCmds).replace('.', ',')}</b>
        <br />
        Defeito que a turma mais erra:{' '}
        <b>{resumo.maisErrado ? `${ROTULO_DEFEITO[resumo.maisErrado]} (${resumo.porDefeito[resumo.maisErrado].erros} erro(s))` : '—'}</b>
      </p>
      <table className="students">
        <thead><tr><th>Defeito</th><th>Respostas</th><th>Erros</th></tr></thead>
        <tbody>
          {DEFEITOS.map((d) => (
            <tr key={d}><td>{ROTULO_DEFEITO[d]}</td><td>{resumo.porDefeito[d].total}</td><td>{resumo.porDefeito[d].erros}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 22 }}>Diagnóstico ao vivo</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
        Sorteia o <b>mesmo defeito</b> para todos os alunos na aba "Sem internet?". Quando todos os alunos online respondem
        (ou você clica em Revelar), a turma vê o defeito certo, quantos acertaram e a média de comandos.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" disabled={ocupado} onClick={iniciar}>{ativo ? 'Sortear outro defeito' : 'Defeito para todos'}</button>
        <button className="btn secondary" disabled={ocupado || !ativo || !!aulaDiag?.revelado} onClick={revelar}>Revelar</button>
        <button className="btn secondary" disabled={ocupado || !ativo} onClick={encerrar}>Encerrar</button>
      </div>
      {ativo && aulaDiag && vivo && (
        <div style={{ marginTop: 10, fontSize: 14 }}>
          ● Rodada em andamento. Responderam <b>{vivo.responderam}</b> de {online} online.
          {aulaDiag.revelado ? (
            <div>
              Defeito: <b style={{ color: 'var(--ok)' }}>{ROTULO_DEFEITO[aulaDiag.defeito]}</b> · {vivo.acertaram} acertaram
              {vivo.mediaCmds !== null && ` · média de ${String(vivo.mediaCmds).replace('.', ',')} comando(s)`}
            </div>
          ) : (
            <div style={{ color: 'var(--muted)' }}>O defeito fica escondido até a revelação.</div>
          )}
        </div>
      )}
    </div>
  );
}
