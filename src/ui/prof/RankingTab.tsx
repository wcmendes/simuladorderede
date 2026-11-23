// Aba "Ranking" do professor: placar do Desafio da máscara, rodada e modo projetor.
import { useEffect, useMemo, useState } from 'react';
import { setRodada, watchScores, zerarRanking, type RodadaDoc, type ScoreDoc } from '../../firebase/data';
import { ROTULO_NIVEL, ROTULO_TIPO, TIPOS, type Nivel, type Tipo } from '../../sim/mascara';
import { ordenarRanking, percentualPorTipo } from '../../sim/ranking';
import { acertosAula, normalizarAula, type AulaDiagDoc } from '../../sim/aula';
import { AulaAoVivo } from './AulaAoVivo';
import { Projetor } from './Projetor';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

interface Props {
  sid: string;
  rodada?: RodadaDoc;
  aulaDiag?: AulaDiagDoc;
  online?: number;
}

export function RankingTab({ sid, rodada, aulaDiag, online = 0 }: Props) {
  const [scores, setScores] = useState<ScoreDoc[]>([]);
  const [projetor, setProjetor] = useState(false);
  const [tipo, setTipo] = useState<Tipo | 'todos'>(rodada?.tipo ?? 'todos');
  const [nivel, setNivel] = useState<Nivel>(rodada?.nivel ?? 'todos');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => watchScores(sid, setScores), [sid]);

  // Ranking = Desafio da máscara + acertos da Aula interativa (portas, diagnóstico, nuvem).
  const ordenado = useMemo(
    () =>
      ordenarRanking(
        scores.map((s) => {
          const a = normalizarAula(s.aula);
          const tentativas = a.portas.total + a.diagnostico.total + a.nuvem.total;
          return { ...s, ok: s.ok + acertosAula(s.aula), total: s.total + tentativas, aulaOk: acertosAula(s.aula) };
        }),
      ),
    [scores],
  );
  const pct = useMemo(() => percentualPorTipo(scores), [scores]);
  const ativa = !!rodada?.ativa;

  async function mudarRodada(ativa: boolean) {
    setOcupado(true);
    try {
      await setRodada(sid, { ativa, tipo, nivel });
    } finally {
      setOcupado(false);
    }
  }

  async function zerar() {
    if (!confirm('Zerar o ranking apaga o placar de todos os alunos e reinicia a contagem. Confirmar?')) return;
    setOcupado(true);
    try {
      await zerarRanking(sid);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="prof-grid">
      <div className="prof-section">
        <h2>Rodada do Desafio</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Enquanto a rodada estiver ativa, todos os alunos recebem só o tipo e a dificuldade escolhidos.
        </p>
        <div className="field">
          <label>Tipo de pergunta</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo | 'todos')}>
            <option value="todos">Todos os tipos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Dificuldade</label>
          <select value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
            {(Object.keys(ROTULO_NIVEL) as Nivel[]).map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={ocupado} onClick={() => mudarRodada(true)}>
            {ativa ? 'Atualizar rodada' : 'Iniciar rodada'}
          </button>
          {ativa && <button className="btn secondary" disabled={ocupado} onClick={() => mudarRodada(false)}>Encerrar rodada</button>}
        </div>
        {ativa && (
          <p style={{ color: 'var(--ok)', fontSize: 13 }}>
            ● Rodada ativa: {rodada!.tipo === 'todos' ? 'todos os tipos' : ROTULO_TIPO[rodada!.tipo]} · {ROTULO_NIVEL[rodada!.nivel]}
          </p>
        )}

        <h2 style={{ marginTop: 22 }}>Acerto da turma por tipo</h2>
        {TIPOS.map((t) => (
          <div key={t} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{ROTULO_TIPO[t]}</span>
              <span>{pct[t].pct === null ? '—' : `${pct[t].pct}%`} <span style={{ color: 'var(--muted)' }}>({pct[t].ok}/{pct[t].total})</span></span>
            </div>
            <div className="barra"><div style={{ width: `${pct[t].pct ?? 0}%` }} /></div>
          </div>
        ))}

        <AulaAoVivo sid={sid} scores={scores} online={online} aulaDiag={aulaDiag} />
      </div>

      <div className="prof-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Ranking ({ordenado.length})</h2>
          <button className="btn secondary" style={{ marginLeft: 'auto' }} onClick={() => setProjetor(true)}>Modo projetor</button>
          <button className="btn danger" disabled={ocupado} onClick={zerar}>Zerar ranking</button>
        </div>
        {ordenado.length === 0 && <p style={{ color: 'var(--muted)' }}>Ninguém respondeu ainda.</p>}
        <table className="students">
          <thead><tr><th>#</th><th>Aluno</th><th>Acertos</th><th>Tentativas</th><th>%</th><th>Aula</th><th>Seq.</th></tr></thead>
          <tbody>
            {ordenado.map((s, i) => (
              <tr key={s.uid}>
                <td>{i + 1}</td>
                <td>{s.name}</td>
                <td><b>{s.ok}</b></td>
                <td>{s.total}</td>
                <td>{s.total ? Math.round((s.ok / s.total) * 100) : 0}%</td>
                <td>{s.aulaOk}</td>
                <td>{s.streak >= 2 ? `🔥 ${s.streak}` : s.streak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {projetor && (
        <Projetor
          titulo="Ranking do Desafio"
          itens={ordenado.map((s) => ({ nome: s.name, valor: plural(s.ok, 'acerto', 'acertos'), detalhe: plural(s.total, 'tentativa', 'tentativas') }))}
          onClose={() => setProjetor(false)}
        />
      )}
    </div>
  );
}
