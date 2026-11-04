// Aba "Sites da turma": lista os sites e permite editar o próprio.
import { useState } from 'react';
import type { Host, Site } from '../sim/types';

interface Props {
  me: Host;
  sites: Site[];
  onEdit: (title: string, body: string) => void;
  onRemove: () => void;
  onPickToken: (token: string) => void;
}

export function SitesTab({ me, sites, onEdit, onRemove, onPickToken }: Props) {
  const mine = sites.find((s) => s.ownerUid === me.uid);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);

  function startEdit() {
    setTitle(mine?.title ?? '');
    setBody(mine?.body ?? '');
    setEditing(true);
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>
        Crie o seu site pelo terminal: <code>site criar &lt;nome&gt;</code>. Os colegas o descobrem com <code>nslookup</code> e acessam com <code>curl</code> ou <code>navegar</code>.
      </p>

      {mine && (
        <div className="q" style={{ background: 'var(--panel2)', border: '1px solid var(--accent)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <b>Seu site:</b> {mine.name}.turma.lab →{' '}
          <span className="term-link" onClick={() => onPickToken(me.ip)}>{me.ip}</span>
          {!editing ? (
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="btn secondary" onClick={startEdit}>Editar</button>
              <button className="btn danger" onClick={onRemove}>Remover</button>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div className="field">
                <label>Título (até 60)</label>
                <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div className="field">
                <label>Texto (até 280, texto puro)</label>
                <textarea value={body} maxLength={280} rows={4} onChange={(e) => setBody(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => { onEdit(title, body); setEditing(false); }}>Salvar</button>
                <button className="btn secondary" onClick={() => setEditing(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      <h3 style={{ fontSize: 15 }}>Sites publicados ({sites.length})</h3>
      {sites.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum site ainda.</p>}
      <table className="students" style={{ fontSize: 13 }}>
        <tbody>
          {sites.map((s) => (
            <tr key={s.name}>
              <td>
                <span className="term-link" onClick={() => onPickToken(s.name + '.turma.lab')}>{s.name}.turma.lab</span>
              </td>
              <td>
                <span className="term-link" onClick={() => onPickToken(s.ip)}>{s.ip}</span>
              </td>
              <td>{s.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
