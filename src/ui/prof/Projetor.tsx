// Modo projetor: os 10 primeiros em letras grandes, para compartilhar no Meet.
import { useEffect } from 'react';

export interface ItemProjetor {
  nome: string;
  valor: string; // ex.: "12 acertos" ou "8.450 pts"
  detalhe?: string;
}

interface Props {
  titulo: string;
  itens: ItemProjetor[];
  onClose: () => void;
}

export function Projetor({ titulo, itens, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const top = itens.slice(0, 10);
  return (
    <div className="proj" role="dialog" aria-label={titulo}>
      <button className="btn secondary proj-close" onClick={onClose}>Fechar (Esc)</button>
      <h1>{titulo}</h1>
      {top.length === 0 && <p className="proj-vazio">Ninguém pontuou ainda.</p>}
      <ol>
        {top.map((it, i) => (
          <li key={i} className={i < 3 ? `podio p${i + 1}` : ''}>
            <span className="pos">{i + 1}º</span>
            <span className="nome">{it.nome}</span>
            {it.detalhe && <span className="detalhe">{it.detalhe}</span>}
            <span className="valor">{it.valor}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
