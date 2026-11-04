// Lógica da VM simulada (Parte C): estado, console Linux e regras de alcance.
import { stripAccents } from './net';

export type AdapterMode = 'NAT' | 'Bridge' | 'Host-only' | 'Desabilitado';

export interface VmConfig {
  name: string;
  iso: string;
  skipUnattended: boolean;
  memory: number;
  cpus: number;
  disk: number;
  adapter1: AdapterMode;
  adapter2: AdapterMode;
  installed: boolean;
  running: boolean;
  bridgeIp?: string; // IP do laboratório, se Bridge
}

export function vmHostname(name: string): string {
  const first = stripAccents(name.trim().split(/\s+/)[0] ?? 'aluno').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `redes-${first || 'aluno'}`;
}

export function expectedVmName(studentName: string): string {
  const first = stripAccents(studentName.trim().split(/\s+/)[0] ?? 'aluno').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `redes-${first || 'aluno'}`;
}

export interface WizardCheck {
  field: string;
  ok: boolean;
  msg: string;
}

export function validateWizard(cfg: Partial<VmConfig>, studentName: string): WizardCheck[] {
  const want = expectedVmName(studentName);
  const checks: WizardCheck[] = [];
  checks.push({ field: 'name', ok: (cfg.name ?? '') === want, msg: `O nome deve ser "${want}".` });
  checks.push({
    field: 'iso',
    ok: (cfg.iso ?? '').includes('ubuntu-24.04-live-server-amd64.iso'),
    msg: 'Selecione a ISO ubuntu-24.04-live-server-amd64.iso.',
  });
  checks.push({ field: 'skipUnattended', ok: cfg.skipUnattended === true, msg: 'Marque "Pular instalação desassistida".' });
  checks.push({ field: 'memory', ok: cfg.memory === 2048, msg: 'A memória deve ser 2048 MB.' });
  checks.push({ field: 'cpus', ok: cfg.cpus === 2, msg: 'Use 2 processadores.' });
  checks.push({ field: 'disk', ok: cfg.disk === 15, msg: 'O disco deve ter 15 GB, dinamicamente alocado.' });
  return checks;
}

export function wizardValid(cfg: Partial<VmConfig>, studentName: string): boolean {
  return validateWizard(cfg, studentName).every((c) => c.ok);
}

/**
 * Um colega que dá ping na VM alcança?
 * - NAT: nunca (timeout).
 * - Host-only: só o próprio hospedeiro (não aplicável entre alunos diferentes).
 * - Bridge: a VM aparece na rede do laboratório como mais um host.
 */
export function vmReachableFromPeer(cfg: VmConfig): boolean {
  if (!cfg.installed || !cfg.running) return false;
  return cfg.adapter1 === 'Bridge' || cfg.adapter2 === 'Bridge';
}

export function helpNat(): string[] {
  return [
    'NAT (Network Address Translation):',
    '  A VM fica "escondida" atrás do computador hospedeiro. Ela consegue',
    '  sair para a internet, mas ninguém de fora consegue iniciar uma conexão',
    '  até ela. Por isso o ping de um colega não alcança a VM em NAT.',
  ];
}

/** Processa um comando no console Linux da VM. */
export function runLinuxCommand(cfg: VmConfig, studentName: string, input: string): { lines: string[]; poweroff?: boolean; needPassword?: boolean } {
  const trimmed = input.trim();
  const [cmd, ...rest] = trimmed.split(/\s+/);
  const host = vmHostname(studentName);

  switch (cmd) {
    case 'ip':
      if (rest[0] === 'a' || rest[0] === 'addr') return { lines: ipAddr(cfg) };
      return { lines: [`Object "${rest[0]}" is unknown, try "ip help".`] };
    case 'hostname':
      return { lines: [host] };
    case 'whoami':
      return { lines: ['aluno'] };
    case 'clear':
      return { lines: ['__CLEAR__'] };
    case 'ping': {
      const target = rest.filter((r) => !r.startsWith('-'))[0];
      if (!target) return { lines: ['ping: usage error: Destination address required'] };
      return { lines: pingLinux(target) };
    }
    case 'sudo':
      if (rest[0] === 'poweroff') return { lines: ['[sudo] senha para aluno:'], needPassword: true, poweroff: true };
      return { lines: [`sudo: ${rest.join(' ')}: comando não encontrado`] };
    case '':
      return { lines: [] };
    default:
      return { lines: [`${cmd}: comando não encontrado`] };
  }
}

function ipAddr(cfg: VmConfig): string[] {
  const lines = [
    '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536',
    '    inet 127.0.0.1/8 scope host lo',
  ];
  const adapters: Array<[AdapterMode, string]> = [[cfg.adapter1, 'enp0s3'], [cfg.adapter2, 'enp0s8']];
  adapters.forEach(([mode, iface], i) => {
    if (mode === 'Desabilitado') return;
    let ip = '';
    if (mode === 'NAT') ip = '10.0.2.15/24';
    else if (mode === 'Host-only') ip = '192.168.56.101/24';
    else if (mode === 'Bridge') ip = (cfg.bridgeIp ?? '192.168.10.50') + '/25';
    lines.push(`${i + 2}: ${iface}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500`);
    lines.push(`    inet ${ip} scope global ${iface}`);
  });
  return lines;
}

function pingLinux(target: string): string[] {
  const lines = [`PING ${target} 56(84) bytes of data.`];
  for (let i = 1; i <= 4; i++) {
    const t = (10 + Math.random() * 6).toFixed(1);
    lines.push(`64 bytes from ${target}: icmp_seq=${i} ttl=117 time=${t} ms`);
  }
  lines.push('');
  lines.push(`--- ${target} ping statistics ---`);
  lines.push('4 packets transmitted, 4 received, 0% packet loss, time 3004ms');
  return lines;
}
