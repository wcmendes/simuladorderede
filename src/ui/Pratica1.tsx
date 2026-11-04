// Painel lateral da Prática 1: perguntas, correção em tempo real,
// botões "▶ Rodar", modo "rede real" e desafios extras.
import { useMemo } from 'react';
import type { Host } from '../sim/types';
import { QUESTIONS, checkField, scoreByPart } from './praticaDefs';

interface Props {
  me: Host;
  fields: Record<string, string>;
  realMode: boolean;
  arpPairs: Array<{ ip: string; mac: string }>;
  checklist: Record<string, boolean>;
  onChange: (key: string, value: string) => void;
  onToggleRealMode: () => void;
  onRun: (command: string) => void;
}

export function Pratica1({ me, fields, realMode, arpPairs, checklist, onChange, onToggleRealMode, onRun }: Props) {
  const parts = useMemo(() => scoreByPart(fields, me, arpPairs), [fields, me, arpPairs]);

  const pct = (p: { ok: number; total: number }) => (p.total ? Math.round((p.ok / p.total) * 100) : 0);
  const allDone = pct(parts.A) >= 80 && pct(parts.B) >= 80;

  return (
    <div className="pratica">
      <div className="mode-switch">
        <label style={{ flex: 1 }}>
          <b>Modo "rede real"</b>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            Ligue quando rodar os comandos no Windows de verdade. Desliga a correção das Partes A e C (a B continua).
          </div>
        </label>
        <div className={'switch' + (realMode ? ' on' : '')} onClick={onToggleRealMode} role="switch" aria-checked={realMode} tabIndex={0}>
          <div className="knob" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
        <span>Parte A: <b>{pct(parts.A)}%</b></span>
        <span>Parte B: <b>{pct(parts.B)}%</b></span>
        <span>Parte C: <b>{pct(parts.C)}%</b></span>
      </div>

      {(['A', 'B', 'C'] as const).map((part) => (
        <div key={part}>
          <h3>Parte {part} {part === 'A' ? '— Windows' : part === 'B' ? '— Endereçamento' : '— Máquina Virtual'}</h3>
          {part === 'B' && (
            <div className="lembrete">
              Nº de hosts = 2ⁿ − 2, onde n é a quantidade de bits 0 da máscara.
            </div>
          )}
          {QUESTIONS.filter((q) => q.part === part).map((q) => {
            const corrigir = !(realMode && (part === 'A' || part === 'C'));
            return (
              <div className="q" key={q.id}>
                <div className="label">
                  {q.title}
                  {q.command && (
                    <button className="run-btn" onClick={() => onRun(q.command!)} title="Digita e executa o comando no terminal">
                      ▶ Rodar
                    </button>
                  )}
                </div>
                {q.tip && <div className="tip">💡 {q.tip}</div>}
                {q.fields.map((f) => {
                  const val = fields[f.key] ?? '';
                  const result = corrigir ? checkField(f.key, val, me, arpPairs) : undefined;
                  return (
                    <div className="field-row" key={f.key}>
                      <label htmlFor={f.key}>{f.label}</label>
                      <input
                        id={f.key}
                        value={val}
                        placeholder={f.placeholder}
                        onChange={(e) => onChange(f.key, e.target.value)}
                      />
                      <span style={{ width: 18 }}>
                        {result === true && <span className="mark-ok">✓</span>}
                        {result === false && <span className="mark-err">✗</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {part === 'C' && (
            <div className="q">
              <div className="label">Checklist (marca sozinho conforme você conclui na aba VirtualBox)</div>
              {['C1 — Criou a VM redes-&lt;nome&gt;', 'C2 — Configurou NAT + Host-only', 'C3 — Instalou o Ubuntu Server', 'C4 — Abriu o console Linux'].map((t, i) => (
                <div key={i} style={{ fontSize: 13, padding: '2px 0' }}>
                  <span className={checklist[`C${i + 1}`] ? 'mark-ok' : 'mark-err'}>
                    {checklist[`C${i + 1}`] ? '☑' : '☐'}
                  </span>{' '}
                  <span dangerouslySetInnerHTML={{ __html: t }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {allDone && (
        <div>
          <h3>🏆 Desafios extras</h3>
          <div className="q">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
              <li>Publique um site e peça a um colega de OUTRA sub-rede para achá-lo com <code>nslookup</code> e <code>tracert</code>. Quantos saltos deu? Por quê?</li>
              <li>Descubra o hostname do IP 192.168.10.x com <code>nslookup</code>.</li>
              <li>O professor derrubou algo na rede. Descubra o quê usando só <code>ping</code> e <code>nslookup</code>.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
