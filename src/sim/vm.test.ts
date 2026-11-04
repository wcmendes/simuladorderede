import { describe, expect, it } from 'vitest';
import { expectedVmName, runLinuxCommand, vmReachableFromPeer, wizardValid, type VmConfig } from './vm';

const base: VmConfig = {
  name: 'redes-joao', iso: 'ubuntu-24.04-live-server-amd64.iso', skipUnattended: true,
  memory: 2048, cpus: 2, disk: 15, adapter1: 'NAT', adapter2: 'Host-only',
  installed: true, running: true,
};

describe('VM: assistente', () => {
  it('nome esperado é redes-<primeiro nome>', () => {
    expect(expectedVmName('João Silva')).toBe('redes-joao');
  });

  it('valida a configuração correta da folha', () => {
    expect(wizardValid(base, 'João Silva')).toBe(true);
    expect(wizardValid({ ...base, memory: 1024 }, 'João Silva')).toBe(false);
    expect(wizardValid({ ...base, skipUnattended: false }, 'João Silva')).toBe(false);
  });
});

describe('VM: regras de alcance', () => {
  it('NAT + Host-only não é alcançável por um colega', () => {
    expect(vmReachableFromPeer(base)).toBe(false);
  });

  it('Bridge torna a VM alcançável na rede do laboratório', () => {
    expect(vmReachableFromPeer({ ...base, adapter1: 'Bridge' })).toBe(true);
  });

  it('VM desligada nunca é alcançável', () => {
    expect(vmReachableFromPeer({ ...base, adapter1: 'Bridge', running: false })).toBe(false);
  });
});

describe('VM: console Linux', () => {
  it('ip a mostra enp0s3 (NAT) e enp0s8 (Host-only)', () => {
    const r = runLinuxCommand(base, 'João', 'ip a');
    const text = r.lines.join('\n');
    expect(text).toContain('10.0.2.15/24');
    expect(text).toContain('192.168.56.101/24');
  });

  it('ping Linux usa o formato icmp_seq/ttl=117', () => {
    const r = runLinuxCommand(base, 'João', 'ping -c 4 google.com');
    expect(r.lines.some((l) => /icmp_seq=1 ttl=117/.test(l))).toBe(true);
  });

  it('sudo poweroff pede senha e desliga', () => {
    const r = runLinuxCommand(base, 'João', 'sudo poweroff');
    expect(r.needPassword).toBe(true);
    expect(r.poweroff).toBe(true);
  });
});
