// Aba "Nuvem": classificar 10 serviços em IaaS, PaaS ou SaaS.
import { useState } from 'react';
import { MODELOS_NUVEM, NUVEM, conferirNuvem, embaralhar, type ModeloNuvem, type ServicoNuvem } from '../../sim/aula';

interface Props {
  onResposta?: (ok: boolean) => void;
}

interface Colocado {
  servico: ServicoNuvem;
  ok: boolean;
}

const COR: Record<ModeloNuvem, string> = { IaaS: 'var(--net)', PaaS: 'var(--host)', SaaS: 'var(--red)' };
const SUBTITULO: Record<ModeloNuvem, string> = {
  IaaS: 'Infraestrutura: máquinas virtuais',
  PaaS: 'Plataforma: publica seu código',
  SaaS: 'Software pronto para usar',
};

export function Nuvem({ onResposta }: Props) {
  const [fila, setFila] = useState(() => embaralhar(NUVEM));
  const [i, setI] = useState(0);
  const [colocados, setColocados] = useState<Colocado[]>([]);
  const [fb, setFb] = useState<{ ok: boolean; nome: string; modelo: ModeloNuvem; texto: string } | null>(null);

  const acertos = colocados.filter((c) => c.ok).length;
  const fim = i >= fila.length;
  const atual = fila[i];

  function escolher(m: ModeloNuvem) {
    if (fim) return;
    const { ok, servico } = conferirNuvem(atual.nome, m);
    if (!servico) return;
    setColocados((c) => [...c, { servico, ok }]);
    setFb({ ok, nome: servico.nome, modelo: servico.modelo, texto: servico.explicacao });
    setI(i + 1);
    onResposta?.(ok);
  }

  function recomecar() {
    setFila(embaralhar(NUVEM));
    setI(0);
    setColocados([]);
    setFb(null);
  }

  return (
    <section>
      <div className="au-grid2" style={{ marginBottom: 16 }}>
        <div className="au-card">
          <h2>{fim ? 'Classifique' : `Classifique · ${i + 1} de ${fila.length}`}</h2>
          <div className="au-q">{fim ? 'Fim! Clique para recomeçar.' : atual.nome}</div>
          <p className="au-note" style={{ margin: 0 }}>{fim ? '' : 'É IaaS, PaaS ou SaaS?'}</p>
          <div className="au-pick">
            {fim ? (
              <button type="button" className="solid" onClick={recomecar}>Recomeçar</button>
            ) : (
              MODELOS_NUVEM.map((m) => (
                <button key={m} type="button" onClick={() => escolher(m)}>{m}</button>
              ))
            )}
          </div>
          {fb && (
            <div className={'au-fb ' + (fb.ok ? 'ok' : 'err')} role="status">
              <b>{fb.nome}: {fb.ok ? 'certo!' : `é ${fb.modelo}.`}</b> {fb.texto}
            </div>
          )}
          <span className="au-score" aria-live="polite">{acertos} de {colocados.length}</span>
          {!fim && colocados.length > 0 && (
            <button type="button" style={{ marginLeft: 12 }} onClick={recomecar}>Recomeçar</button>
          )}
        </div>
        <div className="au-steps">
          <h2>A analogia da pizza</h2>
          <ol style={{ listStyle: 'none', padding: 0 }}>
            <li><b>No local</b>: você faz a pizza inteira em casa (seu servidor, sua sala).</li>
            <li><b style={{ color: 'var(--net)' }}>IaaS</b>: compra a pizza congelada e assa no seu forno. Você recebe a <b>máquina</b> e cuida do resto.</li>
            <li><b style={{ color: 'var(--host)' }}>PaaS</b>: pede delivery e só põe a mesa. Você recebe a <b>plataforma</b> e cuida só do seu código.</li>
            <li><b style={{ color: 'var(--red)' }}>SaaS</b>: janta no restaurante. Você só <b>usa o programa</b>.</li>
          </ol>
        </div>
      </div>
      <div className="au-buckets">
        {MODELOS_NUVEM.map((m) => (
          <div className="au-bucket" key={m}>
            <h3 style={{ color: COR[m] }}>{m}</h3>
            <p>{SUBTITULO[m]}</p>
            <div>
              {colocados
                .filter((c) => c.servico.modelo === m)
                .map((c) => (
                  <span key={c.servico.nome} className={'au-tag' + (c.ok ? '' : ' bad')}>{c.servico.nome}</span>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
