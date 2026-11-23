// Aba "Diagnóstico" do professor: sorteia uma falha escondida e acompanha quem descobre.
import { useEffect, useMemo, useState } from 'react';
import { setDiag, setFaults, watchDiagAnswers, type SessionDoc } from '../../firebase/data';
import {
  FALHAS,
  ROTULO_FALHA,
  aplicarFalha,
  rankingDiag,
  sortearFalha,
  type Falha,
  type RespostaDiag,
} from '../../sim/diag';
import { gatewayList } from '../../sim/net';
import { NO_FAULTS, type Host } from '../../sim/types';
import { Projetor } from './Projetor';

type Gabarito = Record<number, Falha>;
const chaveGab = (sid: string) => `labredes-diag-gabarito:${sid}`;

function lerGabarito(sid: string): Gabarito {
  try {
    return JSON.parse(localStorage.getItem(chaveGab(sid)) || '{}');
  } catch {
    return {};
  }
}

export function DiagTab({ sid, session, hosts, online }: { sid: string; session: SessionDoc | null; hosts: Host[]; online: number }) {
  const [respostas, setRespostas] = useState<RespostaDiag[]>([]);
  const [gabarito, setGabarito] = useState<Gabarito>(() => lerGabarito(sid));
  const [mostrar, setMostrar] = useState(false);
  const [desligar, setDesligar] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [projetor, setProjetor] = useState(false);

  useEffect(() => watchDiagAnswers(sid, setRespostas), [sid]);

  const diag = session?.diag;
  const ativa = !!diag?.ativo;
  const rodada = diag?.rodada ?? 0;
  const falhaAtual = ativa ? gabarito[rodada] : undefined;
  const subredes = gatewayList(session?.mode ?? '/25').length;

  async function iniciar() {
    setOcupado(true);
    try {
      const anterior = Object.entries(gabarito).sort((a, b) => Number(b[0]) - Number(a[0]))[0]?.[1];
      const falha = sortearFalha(Math.random, anterior);
      const nova = Date.now();
      const novoGab = { ...gabarito, [nova]: falha };
      localStorage.setItem(chaveGab(sid), JSON.stringify(novoGab));
      setGabarito(novoGab);
      setMostrar(false);
      await setFaults(sid, aplicarFalha(falha, subredes));
      await setDiag(sid, { ativo: true, rodada: nova });
    } finally {
      setOcupado(false);
    }
  }

  async function encerrar() {
    setOcupado(true);
    try {
      await setDiag(sid, { ativo: false, rodada });
      if (desligar) await setFaults(sid, NO_FAULTS);
      setMostrar(true); // o professor vê a resposta ao encerrar
    } finally {
      setOcupado(false);
    }
  }

  const nomes = useMemo(() => new Map(hosts.map((h) => [h.uid, h.name])), [hosts]);
  const ranking = useMemo(() => rankingDiag(respostas, gabarito), [respostas, gabarito]);
  const daRodada = respostas.filter((r) => r.round === rodada);
  const porEscolha = FALHAS.map((f) => daRodada.filter((r) => r.choice === f).length);
  const max = Math.max(1, ...porEscolha);
  const ultimaRodadaFalha = !ativa && rodada ? gabarito[rodada] : undefined;

  return (
    <div className="prof-grid">
      <div className="prof-section">
        <h2>Desafio de diagnóstico</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Sorteia uma falha escondida (DNS, gateway, provedor ou cabo/placa) e a liga na rede de todos. Os alunos só podem usar
          <code> ping</code>, <code>nslookup</code>, <code>tracert</code> e <code>ipconfig</code>, e respondem num seletor. O ranking conta acertos e, no empate, vence quem usou menos comandos.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={ocupado} onClick={iniciar}>{ativa ? 'Sortear outra falha' : 'Sortear falha e iniciar'}</button>
          <button className="btn secondary" disabled={ocupado || !ativa} onClick={encerrar}>Encerrar rodada</button>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0', fontSize: 14 }}>
          <input type="checkbox" checked={desligar} onChange={(e) => setDesligar(e.target.checked)} />
          Desligar a falha ao encerrar
        </label>

        {ativa && (
          <div className="q" style={{ background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <div>● Rodada em andamento. Responderam <b>{daRodada.length}</b> de {online} online.</div>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              Gabarito:{' '}
              {mostrar ? <b style={{ color: 'var(--ok)' }}>{falhaAtual ? ROTULO_FALHA[falhaAtual] : 'desconhecido (sorteada em outro navegador)'}</b> : <i style={{ color: 'var(--muted)' }}>escondido (a tela pode estar projetada)</i>}{' '}
              <button className="btn secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setMostrar(!mostrar)}>
                {mostrar ? 'ocultar' : 'mostrar'}
              </button>
            </div>
          </div>
        )}
        {ultimaRodadaFalha && (
          <p style={{ fontSize: 14 }}>Rodada encerrada. A falha era: <b style={{ color: 'var(--ok)' }}>{ROTULO_FALHA[ultimaRodadaFalha]}</b>.</p>
        )}

        {rodada > 0 && (
          <>
            <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>O que a turma respondeu</h3>
            {FALHAS.map((f, i) => (
              <div key={f} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{ROTULO_FALHA[f]}</span><span>{porEscolha[i]}</span>
                </div>
                <div className="barra"><div style={{ width: `${(porEscolha[i] / max) * 100}%` }} /></div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="prof-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Ranking do diagnóstico ({ranking.length})</h2>
          <button className="btn secondary" style={{ marginLeft: 'auto' }} onClick={() => setProjetor(true)}>Modo projetor</button>
        </div>
        {ranking.length === 0 && <p style={{ color: 'var(--muted)' }}>Ninguém respondeu ainda.</p>}
        <table className="students">
          <thead><tr><th>#</th><th>Aluno</th><th>Acertos</th><th>Comandos</th><th>Rodadas</th></tr></thead>
          <tbody>
            {ranking.map((l, i) => (
              <tr key={l.uid}><td>{i + 1}</td><td>{nomes.get(l.uid) ?? 'Aluno'}</td><td><b>{l.acertos}</b></td><td>{l.comandos}</td><td>{l.rodadas}</td></tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          "Comandos" soma só as rodadas que o aluno acertou. Menos comandos = diagnóstico mais direto.
        </p>
      </div>

      {projetor && (
        <Projetor
          titulo="Ranking do Diagnóstico"
          itens={ranking.map((l) => ({
            nome: nomes.get(l.uid) ?? 'Aluno',
            valor: `${l.acertos} ${l.acertos === 1 ? 'acerto' : 'acertos'}`,
            detalhe: `${l.comandos} comandos`,
          }))}
          onClose={() => setProjetor(false)}
        />
      )}
    </div>
  );
}
