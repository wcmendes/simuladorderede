import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { ensureAuth, firebaseConfigured } from './firebase/app';
import { getSession } from './firebase/data';
import type { Host } from './sim/types';
import { JoinScreen } from './ui/JoinScreen';
import { ProfessorApp } from './ui/ProfessorApp';
import { StudentApp } from './ui/StudentApp';
import { HelpPage } from './ui/HelpPage';
import { Footer } from './ui/Footer';
import { Mascara } from './ui/mascara/Mascara';

/** Rota atual: aceita "#/professor" (hash) e "/professor" (caminho). */
function currentRoute(): string {
  const h = location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : location.pathname;
}

function useRoute(): string {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const on = () => setRoute(currentRoute());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return route;
}

function App() {
  const route = useRoute();
  const [uid, setUid] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');
  const [joined, setJoined] = useState<{ sid: string; host: Host } | null>(() => {
    const raw = localStorage.getItem('labredes-join');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (!firebaseConfigured) {
      setAuthError('Firebase não configurado. Preencha o arquivo .env (veja o README).');
      return;
    }
    ensureAuth()
      .then((u) => setUid(u.uid))
      .catch((e) => setAuthError('Erro de autenticação: ' + (e?.message ?? e)));
  }, []);

  // Revalida a sessão salva ao abrir (o professor pode tê-la encerrado).
  useEffect(() => {
    if (joined) {
      getSession(joined.sid).then((s) => {
        if (!s) {
          localStorage.removeItem('labredes-join');
          setJoined(null);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ferramenta de estudo: não precisa de login nem de sessão.
  if (route.startsWith('/mascara')) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}><Mascara /></div>
        <Footer />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="center-screen">
        <div className="card">
          <h1>LabRedes</h1>
          <div className="error-msg">{authError}</div>
        </div>
      </div>
    );
  }

  if (!uid) {
    return <div className="center-screen"><div className="card"><h1>LabRedes</h1><p className="sub">Conectando...</p></div></div>;
  }

  if (route.startsWith('/ajuda')) return <HelpPage />;
  if (route.startsWith('/professor')) return <ProfessorApp uid={uid} />;

  if (joined) {
    return <StudentApp sid={joined.sid} me={joined.host} />;
  }

  const codeParam = new URLSearchParams(route.split('?')[1] ?? '').get('code') ?? undefined;
  return (
    <JoinScreen
      uid={uid}
      initialCode={codeParam}
      onJoined={(sid, host) => {
        const j = { sid, host };
        localStorage.setItem('labredes-join', JSON.stringify(j));
        setJoined(j);
      }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
