// Ferramenta "Máscara de rede, bit a bit": 4 sub-abas. Funciona dentro de uma sessão
// (com ranking) e sozinha, em /mascara.
import { useEffect, useState } from 'react';
import './mascara.css';
import { Calcular, Dividir, MesmaRede } from './Abas';
import { Desafio, type SessaoDesafio } from './Desafio';

type Aba = 'calcular' | 'mesma' | 'dividir' | 'desafio';

const ABAS: Array<[Aba, string]> = [
  ['calcular', 'Calcular'],
  ['mesma', 'Mesma rede?'],
  ['dividir', 'Dividir em sub-redes'],
  ['desafio', 'Desafio'],
];

export function Mascara({ sessao }: { sessao?: SessaoDesafio }) {
  const [aba, setAba] = useState<Aba>('calcular');
  const rodadaAtiva = !!sessao?.rodada?.ativa;

  // Quando o professor inicia uma rodada, leva o aluno direto ao Desafio.
  useEffect(() => {
    if (rodadaAtiva) setAba('desafio');
  }, [rodadaAtiva]);

  return (
    <div className="mx">
      <div className="mx-wrap">
        <h1>Máscara de rede, bit a bit</h1>
        <p className="mx-lead">
          Mexa no "/" e veja onde termina a <b style={{ color: 'var(--net)' }}>rede</b> e começa o <b style={{ color: 'var(--host)' }}>host</b>. Cada número a mais no "/" pinta mais um bit de azul.
        </p>
        <nav className="mx-tabs" aria-label="Seções da ferramenta de máscara">
          {ABAS.map(([id, rotulo]) => (
            <button key={id} type="button" aria-current={aba === id ? 'page' : undefined} onClick={() => setAba(id)}>
              {rotulo}
            </button>
          ))}
        </nav>
        {aba === 'calcular' && <Calcular />}
        {aba === 'mesma' && <MesmaRede />}
        {aba === 'dividir' && <Dividir />}
        {aba === 'desafio' && <Desafio sessao={sessao} />}
      </div>
    </div>
  );
}
