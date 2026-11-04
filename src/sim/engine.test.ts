import { describe, expect, it } from 'vitest';
import { runCommand } from './engine';
import { makeContext, makeHost, seededRng } from './fixtures';
import {
  checkB1,
  expectedForHost,
  expectedForIpPrefix,
  b2Row,
  splitNetwork,
} from './pratica';
import { maskToPrefix, netInfo, subnetIndexForPc, subnetsFor } from './net';

function joined(lines: { text: string }[]): string {
  return lines.map((l) => l.text).join('\n');
}

describe('topologia e sub-redes', () => {
  it('modo /25 separa PC 5 e PC 30 em sub-redes diferentes', () => {
    expect(subnetIndexForPc(5, '/25')).toBe(0);
    expect(subnetIndexForPc(30, '/25')).toBe(1);
    const subs = subnetsFor('/25');
    expect(subs).toHaveLength(2);
    expect(subs[0].gateway).toBe('192.168.10.1');
    expect(subs[1].gateway).toBe('192.168.10.129');
  });

  it('modo /26 cria 4 sub-redes com os gateways corretos', () => {
    const subs = subnetsFor('/26');
    expect(subs.map((s) => s.gateway)).toEqual([
      '192.168.10.1',
      '192.168.10.65',
      '192.168.10.129',
      '192.168.10.193',
    ]);
  });
});

describe('tracert entre sub-redes (/25)', () => {
  it('tem 2 saltos e o primeiro é o gateway da origem', () => {
    const me = makeHost('Joao Silva', 5, '/25');
    const peer = makeHost('Maria Souza', 30, '/25');
    const ctx = makeContext({ me, hosts: [me, peer], mode: '/25' });
    const res = runCommand(ctx, `tracert -d ${peer.ip}`);
    const hopLines = res.lines.filter((l) => /^\s*\d+\s/.test(l.text));
    expect(hopLines).toHaveLength(2);
    expect(hopLines[0].text).toContain(me.gateway);
    expect(hopLines[1].text).toContain(peer.ip);
  });
});

describe('falha de DNS', () => {
  it('ping por nome falha, mas ping por IP funciona', () => {
    const me = makeHost('Joao', 5, '/25');
    const ctx = makeContext({ me, mode: '/25', faults: { dnsDown: true }, rng: seededRng(1) });
    const byName = runCommand(ctx, 'ping www.google.com');
    expect(joined(byName.lines)).toContain('não pôde encontrar o host');

    const byIp = runCommand(ctx, 'ping 142.250.79.36');
    expect(joined(byIp.lines)).toContain('Resposta de 142.250.79.36');
  });
});

describe('gateway caído', () => {
  it('sub-rede 1 fora: alcança a propria sub-rede mas não a 2 nem a internet', () => {
    const me = makeHost('Joao', 5, '/25'); // sub-rede 0
    const peerSame = makeHost('Ana', 6, '/25', 11); // mesma sub-rede, IP diferente
    const peerOther = makeHost('Maria', 30, '/25'); // sub-rede 1
    const ctx = makeContext({
      me,
      hosts: [me, peerSame, peerOther],
      mode: '/25',
      faults: { gatewayDown: [0] },
      rng: seededRng(3),
    });

    const same = runCommand(ctx, `ping ${peerSame.ip}`);
    expect(joined(same.lines)).toContain(`Resposta de ${peerSame.ip}`);

    const other = runCommand(ctx, `ping ${peerOther.ip}`);
    expect(joined(other.lines)).toContain('Esgotado o tempo limite do pedido.');
    expect(joined(other.lines)).toContain('100% de perda');

    const net = runCommand(ctx, 'ping 142.250.79.36');
    expect(joined(net.lines)).toContain('100% de perda');
  });
});

describe('link do provedor caído', () => {
  it('internet não responde e tracert para depois do 10.0.0.1', () => {
    const me = makeHost('Joao', 5, '/25');
    const ctx = makeContext({ me, mode: '/25', faults: { ispDown: true }, rng: seededRng(5) });
    const ping = runCommand(ctx, 'ping 142.250.79.36');
    expect(joined(ping.lines)).toContain('100% de perda');

    const tr = runCommand(ctx, 'tracert -d 142.250.79.36');
    const text = joined(tr.lines);
    expect(text).toContain('10.0.0.1');
    expect(text).not.toContain('200.150.10.1'); // não chega ao provedor
  });
});

describe('TTL do ping', () => {
  it('ping na internet responde com TTL próximo de 117', () => {
    const me = makeHost('Joao', 5, '/25');
    const ctx = makeContext({ me, mode: '/25', rng: seededRng(11) });
    const res = runCommand(ctx, 'ping 142.250.79.36');
    const resp = res.lines.find((l) => l.text.includes('Resposta de'));
    expect(resp).toBeDefined();
    const ttl = Number(/TTL=(\d+)/.exec(resp!.text)![1]);
    expect(ttl).toBeGreaterThanOrEqual(110);
    expect(ttl).toBeLessThanOrEqual(117);
  });

  it('ping em colega da mesma sub-rede responde com TTL 128', () => {
    const me = makeHost('Joao', 5, '/25');
    const peer = makeHost('Ana', 6, '/25', 11);
    const ctx = makeContext({ me, hosts: [me, peer], mode: '/25', rng: seededRng(2) });
    const res = runCommand(ctx, `ping ${peer.ip}`);
    const resp = res.lines.find((l) => l.text.includes('Resposta de'));
    expect(resp!.text).toContain('TTL=128');
  });
});

describe('cache ARP', () => {
  it('arp -a só lista o colega da mesma sub-rede depois de um ping bem-sucedido', () => {
    const me = makeHost('Joao', 5, '/25');
    const peer = makeHost('Ana', 6, '/25', 11);
    const before = makeContext({ me, hosts: [me, peer], mode: '/25' });
    expect(joined(runCommand(before, 'arp -a').lines)).not.toContain(peer.ip);

    const ping = runCommand(before, `ping ${peer.ip}`);
    expect(ping.arpAdd).toContain(peer.ip);

    const after = makeContext({ me, hosts: [me, peer], mode: '/25', arpCache: ping.arpAdd });
    expect(joined(runCommand(after, 'arp -a').lines)).toContain(peer.ip);
  });

  it('não lista colega de outra sub-rede mesmo após ping', () => {
    const me = makeHost('Joao', 5, '/25');
    const peer = makeHost('Maria', 30, '/25');
    const ctx = makeContext({ me, hosts: [me, peer], mode: '/25' });
    const ping = runCommand(ctx, `ping ${peer.ip}`);
    expect(ping.arpAdd).not.toContain(peer.ip); // outra sub-rede não entra no ARP
  });
});

describe('ping gera evento entre alunos', () => {
  it('grava evento ao pingar colega online', () => {
    const me = makeHost('Joao', 5, '/25');
    const peer = makeHost('Ana', 6, '/25', 11);
    const ctx = makeContext({ me, hosts: [me, peer], mode: '/25', rng: seededRng(9) });
    const res = runCommand(ctx, `ping ${peer.ip}`);
    expect(res.events.some((e) => e.type === 'ping' && e.toIp === peer.ip)).toBe(true);
  });

  it('não grava evento ao pingar a internet', () => {
    const me = makeHost('Joao', 5, '/25');
    const ctx = makeContext({ me, mode: '/25', rng: seededRng(9) });
    const res = runCommand(ctx, 'ping 142.250.79.36');
    expect(res.events).toHaveLength(0);
  });
});

describe('nslookup', () => {
  it('reverso de IP da turma devolve o hostname', () => {
    const me = makeHost('Joao Silva', 5, '/25');
    const peer = makeHost('Maria Souza', 6, '/25', 11);
    const ctx = makeContext({ me, hosts: [me, peer], mode: '/25' });
    const res = runCommand(ctx, `nslookup ${peer.ip}`);
    expect(joined(res.lines)).toContain(`${peer.hostname}.turma.lab`);
  });

  it('resolve site da turma criado pelo colega', () => {
    const me = makeHost('Joao', 5, '/25');
    const peer = makeHost('Ze', 6, '/25', 11);
    const ctx = makeContext({
      me,
      hosts: [me, peer],
      mode: '/25',
      sites: [{ name: 'padaria-do-ze', ownerUid: peer.uid, ip: peer.ip, title: 'x', body: 'y', createdAt: 0 }],
    });
    const res = runCommand(ctx, 'nslookup padaria-do-ze');
    expect(joined(res.lines)).toContain(peer.ip);
    expect(joined(res.lines)).toContain('padaria-do-ze.turma.lab');
  });

  it('nome inexistente devolve Non-existent domain', () => {
    const me = makeHost('Joao', 5, '/25');
    const ctx = makeContext({ me, mode: '/25' });
    expect(joined(runCommand(ctx, 'nslookup naoexiste').lines)).toContain('Non-existent domain');
  });
});

describe('sites e segurança de HTML', () => {
  it('curl escapa HTML do corpo do site (sem XSS)', () => {
    const me = makeHost('Joao', 5, '/25');
    const peer = makeHost('Ze', 6, '/25', 11);
    const ctx = makeContext({
      me,
      hosts: [me, peer],
      mode: '/25',
      sites: [{
        name: 'padaria', ownerUid: peer.uid, ip: peer.ip,
        title: '<script>alert(1)</script>', body: '<img src=x onerror=1>', createdAt: 0,
      }],
    });
    const res = runCommand(ctx, 'curl padaria');
    const text = joined(res.lines);
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
    expect(text).not.toContain('<img src=x');
  });

  it('curl em IP sem site recusa a conexão', () => {
    const me = makeHost('Joao', 5, '/25');
    const peer = makeHost('Ana', 6, '/25', 11);
    const ctx = makeContext({ me, hosts: [me, peer], mode: '/25' });
    expect(joined(runCommand(ctx, `curl ${peer.ip}`).lines)).toContain('Connection refused');
  });
});

describe('comandos de ajuda', () => {
  it('ping sem argumento mostra uso', () => {
    const me = makeHost('Joao', 5, '/25');
    const ctx = makeContext({ me, mode: '/25' });
    expect(joined(runCommand(ctx, 'ping').lines)).toContain('Uso: ping');
  });

  it('comando desconhecido sugere o mais parecido', () => {
    const me = makeHost('Joao', 5, '/25');
    const ctx = makeContext({ me, mode: '/25' });
    const res = runCommand(ctx, 'ipconfg');
    expect(joined(res.lines)).toContain('não é reconhecido');
    expect(joined(res.lines)).toContain('ipconfig');
  });

  it('comando /? mostra ajuda detalhada', () => {
    const me = makeHost('Joao', 5, '/25');
    const ctx = makeContext({ me, mode: '/25' });
    expect(joined(runCommand(ctx, 'ping /?').lines)).toContain('Para que serve');
  });
});

describe('ipconfig', () => {
  it('ipconfig /all mostra MAC, DNS e gateway', () => {
    const me = makeHost('Joao', 5, '/25');
    const ctx = makeContext({ me, mode: '/25' });
    const text = joined(runCommand(ctx, 'ipconfig /all').lines);
    expect(text).toContain(me.mac);
    expect(text).toContain('172.16.0.2');
    expect(text).toContain(me.gateway);
    expect(text).toContain('turma.lab');
  });
});

describe('Prática 1 - Parte B', () => {
  it('B1 corrige corretamente para o IP/máscara alocado', () => {
    const me = makeHost('Joao', 5, '/25');
    const exp = expectedForHost(me);
    const check = checkB1(
      {
        cidr: String(maskToPrefix(me.mask)),
        network: exp.network,
        broadcast: exp.broadcast,
        firstHost: exp.first,
        lastHost: exp.last,
        hostCount: String(exp.hosts),
      },
      exp,
    );
    expect(check.allCorrect).toBe(true);
  });

  it('B1 aponta erro em campo incorreto', () => {
    const me = makeHost('Joao', 5, '/25');
    const exp = expectedForHost(me);
    const check = checkB1({ network: '0.0.0.0' }, exp);
    expect(check.network).toBe(false);
    expect(check.allCorrect).toBe(false);
  });

  it('B2 confere as linhas da tabela do enunciado', () => {
    expect(b2Row('192.168.10.37', 24)).toMatchObject({
      mask: '255.255.255.0', network: '192.168.10.0', broadcast: '192.168.10.255', hosts: 254,
    });
    expect(b2Row('192.168.10.200', 25)).toMatchObject({
      mask: '255.255.255.128', network: '192.168.10.128', broadcast: '192.168.10.255', hosts: 126,
    });
    expect(b2Row('192.168.10.70', 26)).toMatchObject({
      network: '192.168.10.64', broadcast: '192.168.10.127', hosts: 62,
    });
    expect(b2Row('10.0.5.20', 16)).toMatchObject({
      network: '10.0.0.0', broadcast: '10.0.255.255', hosts: 65534,
    });
  });

  it('B3 divide 192.168.20.0/24 em 4 sub-redes /26', () => {
    const subs = splitNetwork('192.168.20.0', 24, 4);
    expect(subs.map((s) => s.cidr)).toEqual([
      '192.168.20.0/26', '192.168.20.64/26', '192.168.20.128/26', '192.168.20.192/26',
    ]);
    expect(subs[0]).toMatchObject({ first: '192.168.20.1', last: '192.168.20.62', broadcast: '192.168.20.63' });
    expect(subs[3]).toMatchObject({ first: '192.168.20.193', last: '192.168.20.254', broadcast: '192.168.20.255' });
  });

  it('expectedForIpPrefix é consistente com netInfo', () => {
    const exp = expectedForIpPrefix('192.168.10.200', 25);
    const info = netInfo('192.168.10.200', 25);
    expect(exp.network).toBe(info.network);
    expect(exp.broadcast).toBe(info.broadcast);
  });
});
