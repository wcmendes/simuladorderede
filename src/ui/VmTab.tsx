// Aba "VirtualBox (simulado)": assistente, rede, instalação e console Linux.
import { useState } from 'react';
import type { Host } from '../sim/types';
import {
  AdapterMode,
  VmConfig,
  expectedVmName,
  runLinuxCommand,
  validateWizard,
  vmHostname,
  wizardValid,
} from '../sim/vm';

type Stage = 'wizard' | 'network' | 'install' | 'console';

interface Props {
  me: Host;
  onChecklist: (id: string, done: boolean) => void;
}

const MODES: AdapterMode[] = ['NAT', 'Bridge', 'Host-only', 'Desabilitado'];

export function VmTab({ me, onChecklist }: Props) {
  const [stage, setStage] = useState<Stage>('wizard');
  const [cfg, setCfg] = useState<VmConfig>({
    name: '', iso: '', skipUnattended: false, memory: 2048, cpus: 2, disk: 15,
    adapter1: 'NAT', adapter2: 'Host-only', installed: false, running: false,
  });
  const [installProgress, setInstallProgress] = useState(0);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [consoleInput, setConsoleInput] = useState('');
  const [awaitingPwd, setAwaitingPwd] = useState(false);

  const checks = validateWizard(cfg, me.name);
  const want = expectedVmName(me.name);

  function startInstall() {
    setStage('install');
    onChecklist('C1', true);
    onChecklist('C2', cfg.adapter1 !== 'Desabilitado' && cfg.adapter2 !== 'Desabilitado');
    setInstallProgress(0);
    const timer = setInterval(() => {
      setInstallProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        return p + 4;
      });
    }, 1200);
  }

  function finishInstall() {
    setCfg((c) => ({ ...c, installed: true, running: true }));
    onChecklist('C3', true);
    onChecklist('C4', true);
    setConsoleLines([
      `Ubuntu 24.04 LTS ${vmHostname(me.name)} tty1`,
      '',
      `${vmHostname(me.name)} login: aluno`,
      'Senha:',
      `Welcome to Ubuntu 24.04 LTS (GNU/Linux)`,
      '',
    ]);
    setStage('console');
  }

  function runConsole() {
    const prompt = `aluno@${vmHostname(me.name)}:~$ `;
    if (awaitingPwd) {
      const ok = consoleInput === 'redes2026';
      setConsoleLines((l) => [...l, prompt + '••••••••']);
      setAwaitingPwd(false);
      setConsoleInput('');
      if (ok) {
        setConsoleLines((l) => [...l, 'A VM está sendo desligada...']);
        setCfg((c) => ({ ...c, running: false }));
      } else {
        setConsoleLines((l) => [...l, 'sudo: senha incorreta']);
      }
      return;
    }
    const res = runLinuxCommand(cfg, me.name, consoleInput);
    const echo = prompt + consoleInput;
    if (res.lines[0] === '__CLEAR__') {
      setConsoleLines([]);
    } else {
      setConsoleLines((l) => [...l, echo, ...res.lines]);
    }
    if (res.needPassword) setAwaitingPwd(true);
    setConsoleInput('');
  }

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 12 }}>
        {(['wizard', 'network', 'install', 'console'] as Stage[]).map((s) => (
          <button key={s} className={stage === s ? 'active' : ''} onClick={() => setStage(s)}>
            {s === 'wizard' ? '1. Nova VM' : s === 'network' ? '2. Rede' : s === 'install' ? '3. Instalação' : '4. Console'}
          </button>
        ))}
      </div>

      {stage === 'wizard' && (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Assistente "Nova VM". Preencha exatamente como na folha.</p>
          <div className="field">
            <label>Nome (deve ser {want})</label>
            <input value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Imagem ISO</label>
            <select value={cfg.iso} onChange={(e) => setCfg({ ...cfg, iso: e.target.value })} style={{ width: '100%' }}>
              <option value="">(selecione)</option>
              <option value="ubuntu-24.04-live-server-amd64.iso">ubuntu-24.04-live-server-amd64.iso</option>
              <option value="ubuntu-22.04-desktop.iso">ubuntu-22.04-desktop.iso</option>
              <option value="windows11.iso">windows11.iso</option>
            </select>
          </div>
          <label style={{ display: 'flex', gap: 8, fontSize: 14, margin: '8px 0' }}>
            <input type="checkbox" checked={cfg.skipUnattended} onChange={(e) => setCfg({ ...cfg, skipUnattended: e.target.checked })} />
            Pular instalação desassistida
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Memória (MB)</label>
              <input type="number" value={cfg.memory} onChange={(e) => setCfg({ ...cfg, memory: Number(e.target.value) })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Processadores</label>
              <input type="number" value={cfg.cpus} onChange={(e) => setCfg({ ...cfg, cpus: Number(e.target.value) })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Disco (GB)</label>
              <input type="number" value={cfg.disk} onChange={(e) => setCfg({ ...cfg, disk: Number(e.target.value) })} />
            </div>
          </div>
          <ul style={{ fontSize: 13, paddingLeft: 18 }}>
            {checks.filter((c) => !c.ok).map((c) => (
              <li key={c.field} className="mark-err">✗ {c.msg}</li>
            ))}
            {checks.every((c) => c.ok) && <li className="mark-ok">✓ Tudo certo! Avance para a rede.</li>}
          </ul>
          <button className="btn" disabled={!wizardValid(cfg, me.name)} onClick={() => setStage('network')}>Avançar</button>
        </div>
      )}

      {stage === 'network' && (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Configurações → Rede. O esperado na aula é <b>Adaptador 1 = NAT</b> e <b>Adaptador 2 = Host-only</b>.
          </p>
          <div className="field">
            <label>Adaptador 1</label>
            <select value={cfg.adapter1} onChange={(e) => setCfg({ ...cfg, adapter1: e.target.value as AdapterMode, bridgeIp: e.target.value === 'Bridge' ? me.ip.replace(/\d+$/, '50') : cfg.bridgeIp })} style={{ width: '100%' }}>
              {MODES.filter((m) => m !== 'Desabilitado').map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Adaptador 2 (habilitado)</label>
            <select value={cfg.adapter2} onChange={(e) => setCfg({ ...cfg, adapter2: e.target.value as AdapterMode, bridgeIp: e.target.value === 'Bridge' ? me.ip.replace(/\d+$/, '51') : cfg.bridgeIp })} style={{ width: '100%' }}>
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button className="btn" onClick={startInstall}>Iniciar instalação</button>
        </div>
      )}

      {stage === 'install' && (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Instalação do Ubuntu Server (resumida):</p>
          <ul style={{ fontSize: 13, lineHeight: 1.7 }}>
            <li>Idioma: English</li>
            <li>Teclado: Portuguese (Brazil)</li>
            <li>Rede: enp0s3 ({cfg.adapter1}) e enp0s8 ({cfg.adapter2})</li>
            <li>Disco: {cfg.disk} GB (uso completo)</li>
            <li>Perfil: usuário <b>aluno</b>, senha <b>redes2026</b>, server name <b>{vmHostname(me.name)}</b></li>
            <li>☑ Install OpenSSH server</li>
          </ul>
          <div style={{ background: 'var(--panel2)', borderRadius: 6, height: 20, overflow: 'hidden', margin: '12px 0' }}>
            <div style={{ width: `${installProgress}%`, background: 'var(--ok)', height: '100%', transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 13 }}>{installProgress}%</div>
          <button className="btn" disabled={installProgress < 100} onClick={finishInstall}>Reboot Now</button>
        </div>
      )}

      {stage === 'console' && (
        <div>
          {!cfg.installed ? (
            <p style={{ color: 'var(--muted)' }}>Conclua a instalação primeiro.</p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                Estado da VM: <b>{cfg.running ? 'Em execução' : 'Desligada'}</b>. Comandos: ip a, ping, hostname, whoami, clear, sudo poweroff.
              </p>
              <div className="terminal" style={{ height: 320, borderRadius: 6 }}>
                {consoleLines.map((l, i) => <div key={i}>{l}</div>)}
                {cfg.running && (
                  <div className="input-row">
                    <span className="prompt">{awaitingPwd ? '[sudo] senha: ' : `aluno@${vmHostname(me.name)}:~$ `}</span>
                    <input
                      type={awaitingPwd ? 'password' : 'text'}
                      value={consoleInput}
                      onChange={(e) => setConsoleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runConsole()}
                      autoFocus
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
