// Página de Ajuda: explicação curta de cada comando e a camada OSI/TCP-IP.
import { HELP } from '../sim/help';
import { Footer } from './Footer';

export function HelpPage() {
  return (
    <>
    <div className="help-page">
      <h1>Ajuda — comandos de rede</h1>
      <p style={{ color: 'var(--muted)' }}>
        Cada comando tem uma função e pertence a uma camada do modelo OSI/TCP-IP.
      </p>
      {Object.values(HELP).map((e) => (
        <div className="cmd" key={e.name}>
          <span className="layer">{e.layer}</span>
          <div><code>{e.name}</code> — {e.purpose}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Uso: {e.usage}</div>
          {e.observe && <div style={{ fontSize: 13, marginTop: 4 }}>Observe: {e.observe}</div>}
        </div>
      ))}
    </div>
    <Footer />
    </>
  );
}
