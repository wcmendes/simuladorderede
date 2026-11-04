// Transforma IPs e hostnames de qualquer texto em links clicáveis.
// Clicar insere o token no input do terminal.
import { Fragment } from 'react';

const TOKEN = /(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|PC-[a-z0-9]+-\d+(?:\.turma\.lab)?|[a-z0-9-]+\.turma\.lab|www\.[a-z0-9.-]+)/gi;

export function Clickable({ text, onPick }: { text: string; onPick?: (token: string) => void }) {
  if (!onPick) return <>{text}</>;
  const parts: (string | { token: string })[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ token: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <span
            key={i}
            className="term-link"
            onClick={() => onPick(p.token)}
            title="Clique para inserir no comando"
          >
            {p.token}
          </span>
        ),
      )}
    </>
  );
}
