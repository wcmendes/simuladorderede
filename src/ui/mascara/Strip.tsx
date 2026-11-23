// Faixa de 32 bits: IP em cima, máscara embaixo. Azul = rede, laranja = host.
import { Fragment } from 'react';
import { bin, cutOct, octs } from '../../sim/mascara';

export interface LinhaStrip {
  rotulo: string;
  valor: number;
  tipo: 'ip' | 'mask';
}

interface Props {
  linhas: LinhaStrip[];
  c: number;
  destaqueBit?: number; // posição (0 a 31) a contornar de vermelho nas linhas de IP
}

export function Strip({ linhas, c, destaqueBit }: Props) {
  const k = cutOct(c);
  return (
    <div className="mx-strip">
      {linhas.map((l) => (
        <Fragment key={l.rotulo}>
          <div className="mx-rowlab">{l.rotulo}</div>
          {octs(l.valor).map((o, i) => (
            <div key={i} className={'mx-oct' + (i === k && c % 8 ? ' mx-cut' : '')}>
              <div className="mx-dec">{o}</div>
              <div className="mx-bits">
                {[...bin(o)].map((b, j) => {
                  const pos = i * 8 + j;
                  const rede = pos < c;
                  const cls = l.tipo === 'mask' ? (rede ? 'm1' : 'm0') : rede ? 'n' : 'h';
                  const destaque = l.tipo === 'ip' && destaqueBit === pos;
                  return (
                    <span key={j} className={`mx-bit ${cls}`} style={destaque ? { outline: '3px solid var(--red)' } : undefined}>
                      {b}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
