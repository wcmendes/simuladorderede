import { describe, expect, it } from 'vitest';
import { runCommand } from './engine';
import { makeContext, makeHost, seededRng } from './fixtures';
import { FALHAS, aplicarFalha, classificarComando, falhaAtiva, rankingDiag, sortearFalha } from './diag';

const texto = (r: { lines: { text: string }[] }) => r.lines.map((l) => l.text).join('\n');

describe('falhas do desafio', () => {
  it('cada falha liga só ela mesma e falhaAtiva() a reconhece', () => {
    for (const f of FALHAS) {
      const faults = aplicarFalha(f, 2);
      expect(falhaAtiva(faults)).toBe(f);
    }
    expect(aplicarFalha('gateway', 4).gatewayDown).toEqual([0, 1, 2, 3]);
    expect(falhaAtiva(aplicarFalha('dns', 2))).toBe('dns');
    expect(aplicarFalha('dns', 2).gatewayDown).toEqual([]);
  });

  it('sorteia todas as falhas e nunca repete a anterior', () => {
    const rng = seededRng(11);
    const vistas = new Set<string>();
    let ant = null as ReturnType<typeof sortearFalha> | null;
    for (let i = 0; i < 200; i++) {
      const f = sortearFalha(rng, ant);
      expect(f).not.toBe(ant);
      vistas.add(f);
      ant = f;
    }
    expect(vistas.size).toBe(4);
  });
});

describe('cada falha é distinguível só com ping, nslookup, tracert e ipconfig', () => {
  const me = makeHost('Joao', 5, '/25');
  const colega = makeHost('Ana', 6, '/25', 11);
  const outra = makeHost('Maria', 30, '/25');
  const ctxCom = (f: ReturnType<typeof aplicarFalha>) =>
    makeContext({ me, hosts: [me, colega, outra], mode: '/25', faults: f, rng: seededRng(4) });
  const perda100 = (t: string) => t.includes('100% de perda');

  it('DNS: nome falha, IP funciona, gateway responde', () => {
    const c = ctxCom(aplicarFalha('dns', 2));
    expect(texto(runCommand(c, 'ping www.google.com'))).toContain('não pôde encontrar o host');
    expect(texto(runCommand(c, 'ping 8.8.8.8'))).toContain('Resposta de 8.8.8.8');
    expect(texto(runCommand(c, `ping ${me.gateway}`))).toContain(`Resposta de ${me.gateway}`);
    expect(texto(runCommand(c, 'nslookup www.google.com'))).toContain('Tempo limite');
  });

  it('Gateway: vizinho responde, fora da sub-rede e internet não, tracert para no 1º salto', () => {
    const c = ctxCom(aplicarFalha('gateway', 2));
    expect(texto(runCommand(c, `ping ${colega.ip}`))).toContain(`Resposta de ${colega.ip}`);
    expect(perda100(texto(runCommand(c, `ping ${me.gateway}`)))).toBe(true);
    expect(perda100(texto(runCommand(c, 'ping 8.8.8.8')))).toBe(true);
    const tr = texto(runCommand(c, 'tracert -d 8.8.8.8'));
    expect(tr).not.toContain('10.0.0.1');
  });

  it('Provedor: DNS responde, rede do campus alcança, internet não, tracert para em 10.0.0.1', () => {
    const c = ctxCom(aplicarFalha('provedor', 2));
    const ns = texto(runCommand(c, 'nslookup www.google.com'));
    expect(ns).toContain('142.250.79.36');
    expect(texto(runCommand(c, `ping ${me.gateway}`))).toContain('Resposta de');
    expect(perda100(texto(runCommand(c, 'ping 142.250.79.36')))).toBe(true);
    const tr = texto(runCommand(c, 'tracert -d 142.250.79.36'));
    expect(tr).toContain('10.0.0.1');
    expect(tr).not.toContain('200.150.10.1');
  });

  it('Cabo/placa: ipconfig mostra mídia desconectada e nada responde, nem o vizinho', () => {
    const c = ctxCom(aplicarFalha('cabo', 2));
    const ip = texto(runCommand(c, 'ipconfig'));
    expect(ip).toContain('mídia desconectada');
    expect(ip).not.toContain('Endereço IPv4');
    expect(texto(runCommand(c, 'ipconfig /all'))).toContain('mídia desconectada');
    const p = texto(runCommand(c, `ping ${colega.ip}`));
    expect(p).toContain('falha geral');
    expect(p).toContain('100% de perda');
    expect(texto(runCommand(c, 'ping www.google.com'))).toContain('não pôde encontrar o host');
    expect(texto(runCommand(c, 'tracert -d 8.8.8.8'))).toContain('Falha geral');
  });

  it('sem falha o ipconfig mostra o IPv4 normalmente', () => {
    const c = ctxCom(aplicarFalha('dns', 2));
    expect(texto(runCommand(c, 'ipconfig'))).toContain(me.ip);
  });

  it('a dica não entrega o nome do serviço com problema', () => {
    const c = ctxCom(aplicarFalha('dns', 2));
    const dica = runCommand(c, 'ping www.google.com').lines.filter((l) => l.kind === 'hint').map((l) => l.text).join(' ');
    expect(dica).toContain('Dica');
    expect(dica.toLowerCase()).not.toContain('dns');
    expect(dica.toLowerCase()).not.toContain('nomes');
  });
});

describe('comandos do desafio', () => {
  it('conta só ping, nslookup, tracert e ipconfig; bloqueia os demais', () => {
    expect(classificarComando('PING 8.8.8.8')).toBe('conta');
    expect(classificarComando('  tracert -d x')).toBe('conta');
    expect(classificarComando('nslookup a')).toBe('conta');
    expect(classificarComando('ipconfig /all')).toBe('conta');
    expect(classificarComando('help ping')).toBe('livre');
    expect(classificarComando('cls')).toBe('livre');
    expect(classificarComando('arp -a')).toBe('bloqueado');
    expect(classificarComando('netstat -an')).toBe('bloqueado');
    expect(classificarComando('curl www.edufor.edu.br')).toBe('bloqueado');
    expect(classificarComando('   ')).toBe('vazio');
  });
});

describe('ranking do diagnóstico', () => {
  const gab = { 1: 'dns', 2: 'cabo' } as const;
  it('mais acertos primeiro; empate pelo menor número de comandos; erro não premia', () => {
    const r = rankingDiag(
      [
        { uid: 'ana', round: 1, choice: 'dns', cmds: 5 },
        { uid: 'ana', round: 2, choice: 'cabo', cmds: 3 },
        { uid: 'bia', round: 1, choice: 'dns', cmds: 2 },
        { uid: 'bia', round: 2, choice: 'cabo', cmds: 4 },
        { uid: 'caio', round: 1, choice: 'gateway', cmds: 1 },
        { uid: 'caio', round: 2, choice: 'cabo', cmds: 9 },
        { uid: 'dani', round: 99, choice: 'dns', cmds: 1 }, // rodada sem gabarito: ignorada
      ],
      { ...gab },
    );
    expect(r.map((l) => [l.uid, l.acertos, l.comandos])).toEqual([
      ['bia', 2, 6],
      ['ana', 2, 8],
      ['caio', 1, 9],
    ]);
  });
});
