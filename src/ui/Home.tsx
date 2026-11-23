// Tela inicial: explica o que o aluno pode fazer e leva a cada área. Sem login.
import type { CSSProperties, ReactNode } from 'react';
import { Footer } from './Footer';

const card: CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
};
const grade: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 };

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>{titulo}</h2>
      {children}
    </section>
  );
}

const lista: CSSProperties = { margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 };

export function Home() {
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, maxWidth: 1180, width: '100%', margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 34 }}>LabRedes</h1>
        <p style={{ color: 'var(--muted)', margin: '0 0 24px', maxWidth: 70 + 'ch' }}>
          Laboratório de Redes de Computadores no navegador. Escolha abaixo o que fazer. Funciona no computador e no celular, sem cadastro.
        </p>

        <div className="home-corpo">
          <div className="home-cards">

        <div style={grade}>
          <Cartao titulo="1. Entrar na rede da turma">
            <p style={{ margin: 0 }}>
              Você vira um computador da rede da turma: recebe IP, máscara e gateway, usa um terminal Windows simulado (<code>ipconfig</code>, <code>ping</code>, <code>tracert</code>, <code>nslookup</code>), publica um site e acompanha a Prática 1.
            </p>
            <ol style={lista}>
              <li>Clique em <b>Entrar na rede</b>.</li>
              <li>Confira o código <b>AULA</b> (ou o que o professor passar) e digite nome e sobrenome.</li>
              <li>Siga a aba <b>Prática 1</b>, à direita.</li>
            </ol>
            <p style={{ margin: '14px 0 0' }}><a className="btn" href="/entrar" style={{ display: 'inline-block', textDecoration: 'none' }}>Entrar na rede</a></p>
          </Cartao>

          <Cartao titulo="2. Aula interativa">
            <p style={{ margin: 0 }}>Quatro atividades curtas, sem código. Entre com seu nome no topo da página se quiser que o professor veja os seus acertos.</p>
            <ul style={lista}>
              <li><a href="/aula#tcp-udp"><b>TCP × UDP</b></a>: mande 10 pacotes e veja quem perde dados.</li>
              <li><a href="/aula#portas"><b>Portas</b></a>: encaixe cada serviço na porta certa.</li>
              <li><a href="/aula#diagnostico"><b>Sem internet?</b></a>: ache o defeito com os comandos.</li>
              <li><a href="/aula#nuvem"><b>Nuvem</b></a>: IaaS, PaaS ou SaaS?</li>
            </ul>
          </Cartao>

          <Cartao titulo="3. Máscara de rede">
            <p style={{ margin: 0 }}>Ferramenta para estudar sozinho: veja os bits da máscara, calcule rede e broadcast, divida em sub-redes e treine no desafio.</p>
            <p style={{ margin: '14px 0 0' }}><a className="btn secondary" href="/mascara" style={{ display: 'inline-block', textDecoration: 'none' }}>Abrir a máscara</a></p>
          </Cartao>

          <Cartao titulo="Precisa de ajuda?">
            <p style={{ margin: 0 }}>Lista dos comandos do terminal e dicas de uso.</p>
            <p style={{ margin: '14px 0 0' }}><a className="btn secondary" href="/ajuda" style={{ display: 'inline-block', textDecoration: 'none' }}>Ver a ajuda</a></p>
          </Cartao>
        </div>
          </div>
          <img className="home-avatar" src="/will.webp" alt="Professor segurando um cabo de fibra óptica ligado a uma nuvem" />
        </div>

        <p style={{ marginTop: 28, fontSize: 14, color: 'var(--muted)' }}>
          Não pedimos matrícula, e-mail nem senha. Professor? <a href="/professor">Área do professor</a> (pede o PIN).
        </p>
      </main>
      <Footer />
    </div>
  );
}
