// Três das quatro sub-abas da Máscara: Calcular, Mesma rede? e Dividir em sub-redes.
import { useState, type ReactNode } from 'react';
import {
  NOMES_BLOCO,
  dividir,
  fmt,
  info,
  maskOf,
  mesmaRede,
  parseCidr,
  passos,
  primeiroBitDiferente,
  toInt,
  toStr,
} from '../../sim/mascara';
import { Strip } from './Strip';

const Mono = ({ children }: { children: ReactNode }) => <span className="mx-mono">{children}</span>;

const EXEMPLOS: Array<[string, number]> = [
  ['192.168.10.37', 24],
  ['192.168.10.200', 25],
  ['192.168.10.70', 26],
  ['10.0.5.20', 16],
  ['172.16.5.1', 20],
  ['192.168.1.130', 27],
];

/* ---------------------------------- Calcular ---------------------------------- */
export function Calcular() {
  const [ipTxt, setIpTxt] = useState('192.168.10.70');
  const [c, setC] = useState(26);
  const ip = toInt(ipTxt);

  return (
    <section>
      <div className="mx-controls">
        <div>
          <label htmlFor="mx-ip">Endereço IP</label>
          <input id="mx-ip" type="text" value={ipTxt} inputMode="decimal" autoComplete="off" className={ip === null ? 'bad' : ''} onChange={(e) => setIpTxt(e.target.value)} />
        </div>
        <div className="mx-slash">
          <output>/{c}</output>
          <input type="range" min={8} max={30} value={c} aria-label="Tamanho da máscara em bits" onChange={(e) => setC(+e.target.value)} />
        </div>
      </div>
      <div className="mx-presets">
        {EXEMPLOS.map(([a, cc]) => (
          <button key={a} type="button" onClick={() => { setIpTxt(a); setC(cc); }}>
            {a}/{cc}
          </button>
        ))}
      </div>
      {ip !== null && <Resultado ip={ip} c={c} />}
    </section>
  );
}

function Resultado({ ip, c }: { ip: number; c: number }) {
  const r = info(ip, c);
  const s = passos(ip, c);
  const nome = NOMES_BLOCO[s.k];
  const nb = s.fechado ? 0 : 256 / s.salto;

  return (
    <>
      <Strip linhas={[{ rotulo: 'IP', valor: ip, tipo: 'ip' }, { rotulo: 'Máscara', valor: r.m, tipo: 'mask' }]} c={c} />
      <div className="mx-legend">
        <span><b style={{ background: 'var(--net)' }} />bit de rede (máscara = 1)</span>
        <span><b style={{ background: 'var(--host)' }} />bit de host (máscara = 0)</span>
        <span><b style={{ outline: '3px solid var(--red)' }} />bloco onde a máscara "corta"</span>
      </div>
      <div className="mx-grid2">
        <div className="mx-figs">
          {([['Máscara', r.m], ['Rede', r.net], ['Primeiro host', r.first], ['Último host', r.last], ['Broadcast', r.bc]] as const).map(([rot, v]) => (
            <div key={rot}><span>{rot}</span><strong>{toStr(v)}</strong></div>
          ))}
          <div className="mx-big"><span>Computadores que cabem</span><strong>{fmt(r.hosts)}</strong></div>
        </div>
        <div className="mx-steps">
          <h2>A conta, passo a passo</h2>
          <ol>
            <li><b>/{c}</b> = {c} bits de rede e <b>{r.n}</b> bits de host (32 − {c}).</li>
            <li>Bits de rede viram 1, de host viram 0. Em decimal: máscara <Mono>{toStr(r.m)}</Mono>.</li>
            {s.fechado ? (
              <li>Os {s.blocosCheios} primeiros blocos são 255: eles são a "rua" e ficam iguais ao IP. Os outros viram 0 na rede e 255 no broadcast.</li>
            ) : (
              <>
                <li>A máscara corta o <b>{nome} bloco</b> (valor {s.mk}). <b>Salto</b> = 256 − {s.mk} = <b>{s.salto}</b>. As redes andam de {s.salto} em {s.salto}.</li>
                <li>O IP tem <b>{s.ipk}</b> nesse bloco. O múltiplo de {s.salto} logo abaixo é <b>{s.netk}</b>: rede <Mono>{toStr(r.net)}</Mono>. A próxima rede começa em {s.proxima}, então o broadcast é {s.proxima - 1}.</li>
              </>
            )}
            <li>Hosts = 2<sup>{r.n}</sup> − 2 = {fmt(2 ** r.n)} − 2 = <b>{fmt(r.hosts)}</b>. O −2 tira a rede e o broadcast.</li>
          </ol>
          {!s.fechado && (
            <div className="mx-ruler">
              <div className="mx-note" style={{ marginBottom: 6 }}>
                Régua do {nome} bloco: {nb} pedaços de {s.salto}. O seu IP ({s.ipk}) cai no vermelho.
              </div>
              <div className="mx-rbar">
                {Array.from({ length: nb }, (_, i) => (
                  <div key={i} className={i * s.salto === s.netk ? 'on' : ''}>{nb <= 16 ? i * s.salto : ''}</div>
                ))}
              </div>
              <div className="mx-rscale"><span>0</span><span>255</span></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* --------------------------------- Mesma rede? --------------------------------- */
export function MesmaRede() {
  const [a, setA] = useState('192.168.10.25');
  const [b, setB] = useState('192.168.10.200');
  const [c, setC] = useState(25);
  const ia = toInt(a);
  const ib = toInt(b);
  const ok = ia !== null && ib !== null;

  const eq = ok && mesmaRede(ia, ib, c);
  const diff = ok ? primeiroBitDiferente(ia, ib, c) : -1;

  return (
    <section>
      <div className="mx-controls">
        <div>
          <label htmlFor="mx-ipa">Computador A</label>
          <input id="mx-ipa" type="text" value={a} className={ia === null ? 'bad' : ''} onChange={(e) => setA(e.target.value)} />
        </div>
        <div>
          <label htmlFor="mx-ipb">Computador B</label>
          <input id="mx-ipb" type="text" value={b} className={ib === null ? 'bad' : ''} onChange={(e) => setB(e.target.value)} />
        </div>
        <div className="mx-slash">
          <output>/{c}</output>
          <input type="range" min={8} max={30} value={c} aria-label="Máscara usada pelos dois" onChange={(e) => setC(+e.target.value)} />
        </div>
      </div>
      {ok && (
        <>
          <Strip
            linhas={[{ rotulo: 'A', valor: ia, tipo: 'ip' }, { rotulo: 'B', valor: ib, tipo: 'ip' }, { rotulo: 'Máscara', valor: maskOf(c), tipo: 'mask' }]}
            c={c}
            destaqueBit={diff}
          />
          <div className="mx-grid2">
            <div className="mx-card">
              <div className={'mx-verdict ' + (eq ? 'yes' : 'no')}>{eq ? 'Mesma rede' : 'Redes diferentes'}</div>
              <p style={{ margin: 0 }}>
                {eq ? (
                  <>Os {c} bits azuis são iguais. As duas redes dão <Mono>{toStr(info(ia, c).net)}</Mono>/{c}.</>
                ) : (
                  <>O bit {diff + 1}, que é de rede, é diferente (no {Math.floor(diff / 8) + 1}º bloco). A fica em <Mono>{toStr(info(ia, c).net)}</Mono> e B em <Mono>{toStr(info(ib, c).net)}</Mono>.</>
                )}
              </p>
            </div>
            <div className="mx-steps">
              <h2>Como decidir</h2>
              <ol>
                <li>Pegue só os bits <b style={{ color: 'var(--net)' }}>azuis</b>, os de rede, dos dois IPs.</li>
                <li>Se forem todos iguais, é a <b>mesma rede</b>: conversam direto, pelo switch.</li>
                <li>Se um único bit azul for diferente, são <b>redes diferentes</b>: precisam do roteador (gateway).</li>
                <li>Teste: deixe os mesmos IPs e mude o "/". A resposta muda!</li>
              </ol>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------------------------- Dividir ---------------------------------- */
export function Dividir() {
  const [baseTxt, setBaseTxt] = useState('192.168.20.0/24');
  const [partes, setPartes] = useState(4);
  const p = parseCidr(baseTxt);
  const valido = p !== null && p.c >= 8 && p.c <= 28;
  const d = valido ? dividir(p.ip, p.c, partes) : null;

  return (
    <section>
      <div className="mx-controls">
        <div>
          <label htmlFor="mx-base">Rede original</label>
          <input id="mx-base" type="text" value={baseTxt} className={valido ? '' : 'bad'} onChange={(e) => setBaseTxt(e.target.value)} />
        </div>
        <div>
          <label htmlFor="mx-partes">Dividir em</label>
          <select id="mx-partes" value={partes} onChange={(e) => setPartes(+e.target.value)}>
            {[2, 4, 8, 16].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {valido && !d && (
        <div className="mx-card" style={{ marginBottom: 18 }}>
          <h2>Não cabe: sobrariam menos de 2 hosts por sub-rede</h2>
        </div>
      )}

      {d && p && (
        <>
          <div className="mx-card" style={{ marginBottom: 18 }}>
            <h2>{toStr(d.base)}/{d.c} em {d.partes} sub-redes /{d.novoC}</h2>
            <div className="mx-rbar">
              {d.subredes.map((_, i) => (
                <div key={i} style={{ background: i % 2 ? 'var(--netl)' : 'var(--hostl)', color: 'var(--ink)' }}>
                  {d.partes <= 8 ? 'Sub-rede ' + (i + 1) : i + 1}
                </div>
              ))}
            </div>
            <p className="mx-note" style={{ margin: '10px 0 0' }}>
              {d.partes} = 2<sup>{d.add}</sup>, então a máscara ganha <b>{d.add} bit{d.add > 1 ? 's' : ''}</b>: /{d.c} → /{d.novoC} ({toStr(maskOf(d.novoC))}). Cada sub-rede tem {fmt(d.tamanho)} endereços e <b>{fmt(d.tamanho - 2)} hosts</b>.
            </p>
          </div>
          <div className="mx-scroll">
            <table>
              <thead>
                <tr><th>Sub-rede</th><th>Rede / CIDR</th><th>Primeiro host</th><th>Último host</th><th>Broadcast</th><th>Hosts</th></tr>
              </thead>
              <tbody>
                {d.subredes.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="m">{toStr(r.net)}/{d.novoC}</td>
                    <td className="m">{toStr(r.first)}</td>
                    <td className="m">{toStr(r.last)}</td>
                    <td className="m">{toStr(r.bc)}</td>
                    <td>{fmt(r.hosts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
