// Aba "Portas": o IP é o prédio, a porta é o apartamento. Arrastar e soltar ou tocar (serviço, depois porta).
import { useState } from 'react';
import { SERVICOS, conferirPorta, embaralhar, portasOrdenadas } from '../../sim/aula';

interface Props {
  onResposta?: (ok: boolean) => void;
}

export function Portas({ onResposta }: Props) {
  const [ordem, setOrdem] = useState(() => embaralhar(SERVICOS).map((s) => s.nome));
  const [postos, setPostos] = useState<Record<string, true>>({}); // nome do serviço já encaixado
  const [msgs, setMsgs] = useState<Record<number, string>>({}); // "X não mora aqui"
  const [balanca, setBalanca] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  const portas = portasOrdenadas();
  const acertos = Object.keys(postos).length;

  function tentar(nome: string, porta: number) {
    if (!nome || postos[nome]) return;
    const portaOcupada = SERVICOS.some((s) => postos[s.nome] && s.porta === porta);
    if (portaOcupada) return;
    const r = conferirPorta(nome, porta);
    if (!r.servico) return;
    if (r.ok) {
      setPostos((p) => ({ ...p, [nome]: true }));
      setMsgs((m) => {
        const { [porta]: _tira, ...resto } = m;
        return resto;
      });
    } else {
      setMsgs((m) => ({ ...m, [porta]: `${nome} não mora aqui` }));
      setBalanca(porta);
      setTimeout(() => setBalanca((b) => (b === porta ? null : b)), 320);
    }
    setSel(null);
    onResposta?.(r.ok);
  }

  function reiniciar() {
    setOrdem(embaralhar(SERVICOS).map((s) => s.nome));
    setPostos({});
    setMsgs({});
    setSel(null);
  }

  return (
    <section>
      <p style={{ margin: '0 0 10px' }}>
        O <b>IP é o prédio</b>; a <b>porta é o apartamento</b> de cada serviço. Arraste cada serviço para a porta certa (ou toque no serviço e depois na porta).
      </p>
      <div className="au-chips">
        {ordem.map((nome) => (
          <button
            key={nome}
            type="button"
            className={'au-chip' + (sel === nome ? ' sel' : '') + (postos[nome] ? ' done' : '')}
            draggable={!postos[nome]}
            aria-pressed={sel === nome}
            onClick={() => !postos[nome] && setSel(sel === nome ? null : nome)}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', nome);
              setSel(nome);
            }}
          >
            {nome}
          </button>
        ))}
      </div>
      <div className="au-doors">
        {portas.map((porta) => {
          const dono = SERVICOS.find((s) => s.porta === porta)!;
          const ok = !!postos[dono.nome];
          return (
            <div
              key={porta}
              className={'au-door' + (ok ? ' ok' : '') + (sobre === porta ? ' over' : '') + (balanca === porta ? ' shake' : '')}
              role="button"
              tabIndex={0}
              aria-label={`Porta ${porta}`}
              onClick={() => sel && tentar(sel, porta)}
              onKeyDown={(e) => {
                if (sel && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  tentar(sel, porta);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(porta);
              }}
              onDragLeave={() => setSobre((s) => (s === porta ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                tentar(e.dataTransfer.getData('text/plain'), porta);
              }}
            >
              <div className="num">{porta}</div>
              <small>
                {ok ? (
                  <>
                    <b>{dono.nome}</b>
                    <br />
                    {dono.proto} · {dono.desc}
                  </>
                ) : (
                  msgs[porta] ?? 'porta vazia'
                )}
              </small>
            </div>
          );
        })}
      </div>
      <div className="au-controls" style={{ marginTop: 14 }}>
        <span className="au-score" aria-live="polite">{acertos} de 6</span>
        <button type="button" onClick={reiniciar}>Embaralhar de novo</button>
      </div>
    </section>
  );
}
