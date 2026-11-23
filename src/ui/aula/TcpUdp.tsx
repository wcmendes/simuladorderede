// Aba "TCP × UDP": os mesmos 10 pacotes por TCP (aperto de mão, ACK e reenvio) e por UDP (rajada).
import { useEffect, useRef, useState } from 'react';

type Slot = '' | 'got' | 'gotu' | 'miss';
const vazio = (): Slot[] => Array.from({ length: 10 }, () => '');
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Voa um pacote pela pista. Resolve true se chegou, false se foi perdido no meio do caminho. */
function voar(pista: HTMLElement, rotulo: string, cls: string, perdido: boolean, volta: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const p = document.createElement('div');
    p.className = 'au-pk ' + cls;
    p.textContent = rotulo; // textContent: nunca HTML
    const W = pista.clientWidth;
    p.style.left = (volta ? W - 62 - 44 : 62) + 'px';
    pista.appendChild(p);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        p.style.left = (perdido ? W / 2 - 20 : volta ? 62 : W - 62 - 44) + 'px';
      }),
    );
    setTimeout(() => {
      if (perdido) p.classList.add('lost');
      setTimeout(() => {
        p.remove();
        resolve(!perdido);
      }, perdido ? 300 : 40);
    }, perdido ? 280 : 520);
  });
}

function Pista({ titulo, cor, pistaRef, slots, resultado }: {
  titulo: string;
  cor: string;
  pistaRef: React.RefObject<HTMLDivElement | null>;
  slots: Slot[];
  resultado: string;
}) {
  return (
    <div className="au-lane">
      <h3 style={{ color: cor }}>{titulo}</h3>
      <div className="au-track" ref={pistaRef}>
        <div className="au-end a">Cliente</div>
        <div className="au-end b">Servidor</div>
      </div>
      <div className="au-slots">
        {slots.map((s, i) => (
          <span key={i} className={s}>{i + 1}</span>
        ))}
      </div>
      <div className="au-lres" aria-live="polite">{resultado}</div>
    </div>
  );
}

export function TcpUdp() {
  const [perda, setPerda] = useState(20);
  const [rodando, setRodando] = useState(false);
  const [slTcp, setSlTcp] = useState<Slot[]>(vazio);
  const [slUdp, setSlUdp] = useState<Slot[]>(vazio);
  const [resTcp, setResTcp] = useState('');
  const [resUdp, setResUdp] = useState('');
  const pistaTcp = useRef<HTMLDivElement>(null);
  const pistaUdp = useRef<HTMLDivElement>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const marcar = (set: React.Dispatch<React.SetStateAction<Slot[]>>, i: number, v: Slot) =>
    set((s) => s.map((x, k) => (k === i ? v : x)));

  async function tcp(l: number) {
    const tr = pistaTcp.current!;
    setSlTcp(vazio());
    setResTcp('Aperto de mão…');
    const t0 = performance.now();
    let reenvios = 0;
    await voar(tr, 'SYN', 'ctl', false, false);
    await voar(tr, 'SYN-ACK', 'ctl', false, true);
    await voar(tr, 'ACK', 'ctl', false, false);
    for (let i = 1; i <= 10; i++) {
      if (!vivo.current) return;
      let ok = false;
      setResTcp(`Enviando o pacote ${i} e esperando a confirmação (ACK)…`);
      while (!ok) {
        ok = await voar(tr, String(i), '', Math.random() * 100 < l, false);
        if (!vivo.current) return;
        if (!ok) {
          reenvios++;
          setResTcp(`Pacote ${i} perdido: o TCP percebe e reenvia…`);
          await sleep(250);
        }
      }
      marcar(setSlTcp, i - 1, 'got');
      await voar(tr, 'ACK', 'back', false, true);
    }
    setResTcp(`Chegaram 10 de 10, em ordem · ${reenvios} reenvio(s) · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }

  async function udp(l: number) {
    const tr = pistaUdp.current!;
    setSlUdp(vazio());
    setResUdp('Enviando sem conexão…');
    const t0 = performance.now();
    let chegaram = 0;
    const jobs: Promise<void>[] = [];
    for (let i = 1; i <= 10; i++) {
      const perdido = Math.random() * 100 < l;
      jobs.push(
        voar(tr, String(i), 'udp', perdido, false).then((ok) => {
          marcar(setSlUdp, i - 1, ok ? 'gotu' : 'miss');
          if (ok) chegaram++;
        }),
      );
      await sleep(160);
      if (!vivo.current) return;
    }
    await Promise.all(jobs);
    setResUdp(`Chegaram ${chegaram} de 10 · ${10 - chegaram} perdido(s) e ninguém reenviou · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }

  async function enviar() {
    if (rodando) return;
    setRodando(true);
    await Promise.all([tcp(perda), udp(perda)]);
    if (vivo.current) setRodando(false);
  }

  return (
    <section>
      <div className="au-controls">
        <div className="au-slash">
          <div>
            <label htmlFor="au-loss">Perda de pacotes na rede</label>
            <output htmlFor="au-loss">{perda}%</output>
          </div>
          <input id="au-loss" type="range" min={0} max={40} step={5} value={perda} disabled={rodando} aria-label="Perda de pacotes" onChange={(e) => setPerda(+e.target.value)} />
        </div>
        <button className="solid" type="button" disabled={rodando} onClick={enviar}>Enviar 10 pacotes</button>
      </div>
      <Pista titulo="TCP · com conexão: confere e reenvia" cor="var(--net)" pistaRef={pistaTcp} slots={slTcp} resultado={resTcp} />
      <Pista titulo="UDP · sem conexão: manda e não olha para trás" cor="var(--host)" pistaRef={pistaUdp} slots={slUdp} resultado={resUdp} />
      <div className="au-grid2">
        <div className="au-steps">
          <h2>O que observar</h2>
          <ol>
            <li>O TCP começa com o <b>aperto de mão</b>: SYN → SYN-ACK → ACK.</li>
            <li>Pacote perdido no TCP é <b>reenviado</b>: chega tudo, em ordem, mais devagar.</li>
            <li>No UDP chega <b>rápido</b>, mas com buracos.</li>
            <li>Coloque a perda em 0% e depois em 40%. Qual sofre mais?</li>
          </ol>
        </div>
        <div className="au-card">
          <h2>Qual combina com cada uso?</h2>
          <p style={{ margin: 0 }}>
            Download, site, e-mail, SSH → <b style={{ color: 'var(--net)' }}>TCP</b>: não pode faltar nada.<br />
            Chamada de vídeo, jogo online, transmissão ao vivo → <b style={{ color: 'var(--host)' }}>UDP</b>: melhor perder um quadro do que atrasar.<br />
            DNS → <b style={{ color: 'var(--host)' }}>UDP</b>, porta 53: pergunta curta, resposta rápida.
          </p>
        </div>
      </div>
    </section>
  );
}
