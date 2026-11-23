import { describe, expect, it } from 'vitest';
import {
  conferir,
  dividir,
  explicacao,
  gerarPergunta,
  info,
  mesmaRede,
  parseCidr,
  passos,
  primeiroBitDiferente,
  toInt,
  toStr,
} from './mascara';
import { seededRng } from './fixtures';
import { aplicarResposta, ordenarRanking, percentualPorTipo, scoreVazio } from './ranking';

const ip = (s: string) => toInt(s)!;

describe('info (cálculo da máscara)', () => {
  it('192.168.10.70/26 → rede .64, broadcast .127, hosts .65 a .126, 62 hosts', () => {
    const r = info(ip('192.168.10.70'), 26);
    expect(toStr(r.net)).toBe('192.168.10.64');
    expect(toStr(r.bc)).toBe('192.168.10.127');
    expect(toStr(r.first)).toBe('192.168.10.65');
    expect(toStr(r.last)).toBe('192.168.10.126');
    expect(r.hosts).toBe(62);
    expect(toStr(r.m)).toBe('255.255.255.192');
  });

  it('192.168.10.200/25 → rede .128', () => {
    const r = info(ip('192.168.10.200'), 25);
    expect(toStr(r.net)).toBe('192.168.10.128');
    expect(toStr(r.bc)).toBe('192.168.10.255');
    expect(r.hosts).toBe(126);
  });

  it('10.0.5.20/16 → rede 10.0.0.0, broadcast 10.0.255.255, 65534 hosts', () => {
    const r = info(ip('10.0.5.20'), 16);
    expect(toStr(r.net)).toBe('10.0.0.0');
    expect(toStr(r.bc)).toBe('10.0.255.255');
    expect(r.hosts).toBe(65534);
  });

  it('172.16.5.1/20 → rede 172.16.0.0, broadcast 172.16.15.255', () => {
    const r = info(ip('172.16.5.1'), 20);
    expect(toStr(r.net)).toBe('172.16.0.0');
    expect(toStr(r.bc)).toBe('172.16.15.255');
  });

  it('192.168.1.130/27 e 192.168.10.37/24 (demais exemplos)', () => {
    expect(toStr(info(ip('192.168.1.130'), 27).net)).toBe('192.168.1.128');
    expect(toStr(info(ip('192.168.10.37'), 24).bc)).toBe('192.168.10.255');
  });
});

describe('toInt', () => {
  it('rejeita endereços inválidos', () => {
    for (const ruim of ['', '1.2.3', '1.2.3.256', '1.2.3.4.5', 'a.b.c.d', '01234.1.1.1', '1.2.3.-4']) {
      expect(toInt(ruim)).toBeNull();
    }
  });
  it('ida e volta com toStr', () => {
    expect(toStr(ip('192.168.10.37'))).toBe('192.168.10.37');
  });
});

describe('truque do salto', () => {
  it('/26 → máscara .192, salto 64, rede .64, próxima .128', () => {
    const s = passos(ip('192.168.10.70'), 26);
    expect(s.k).toBe(3);
    expect(s.mk).toBe(192);
    expect(s.salto).toBe(64);
    expect(s.netk).toBe(64);
    expect(s.proxima).toBe(128);
    expect(s.fechado).toBe(false);
  });
  it('/20 corta o 3º bloco: salto 16', () => {
    const s = passos(ip('172.16.5.1'), 20);
    expect(s.k).toBe(2);
    expect(s.salto).toBe(16);
    expect(s.netk).toBe(0);
  });
  it('/24 e /16 não cortam bloco', () => {
    expect(passos(ip('10.0.5.20'), 16).fechado).toBe(true);
    expect(passos(ip('10.0.5.20'), 16).blocosCheios).toBe(2);
  });
});

describe('mesma rede?', () => {
  it('192.168.10.25 e .200: mesma rede em /24, mas não em /25', () => {
    const a = ip('192.168.10.25');
    const b = ip('192.168.10.200');
    expect(mesmaRede(a, b, 24)).toBe(true);
    expect(mesmaRede(a, b, 25)).toBe(false);
  });
  it('primeiro bit de rede diferente', () => {
    const a = ip('192.168.10.25');
    const b = ip('192.168.10.200');
    expect(primeiroBitDiferente(a, b, 24)).toBe(-1);
    expect(primeiroBitDiferente(a, b, 25)).toBe(24); // o 25º bit (posição 24)
  });
});

describe('dividir em sub-redes', () => {
  it('192.168.20.0/24 em 4 → .0, .64, .128 e .192, todas /26', () => {
    const d = dividir(ip('192.168.20.0'), 24, 4)!;
    expect(d.novoC).toBe(26);
    expect(d.subredes.map((s) => toStr(s.net))).toEqual(['192.168.20.0', '192.168.20.64', '192.168.20.128', '192.168.20.192']);
    expect(toStr(d.subredes[1].first)).toBe('192.168.20.65');
    expect(toStr(d.subredes[1].last)).toBe('192.168.20.126');
    expect(toStr(d.subredes[3].bc)).toBe('192.168.20.255');
    expect(d.subredes.every((s) => s.hosts === 62)).toBe(true);
  });
  it('recusa quando sobrariam menos de 2 hosts', () => {
    expect(dividir(ip('192.168.20.0'), 28, 16)).toBeNull();
  });
  it('rejeita número de partes que não é potência de 2', () => {
    expect(dividir(ip('192.168.20.0'), 24, 3)).toBeNull();
  });
  it('parseCidr', () => {
    expect(parseCidr('192.168.20.0/24')).toEqual({ ip: ip('192.168.20.0'), c: 24 });
    expect(parseCidr('192.168.20.0')).toBeNull();
    expect(parseCidr('192.168.20.0/x')).toBeNull();
    expect(parseCidr('300.1.1.1/24')).toBeNull();
  });
});

describe('desafio', () => {
  it('a resposta gerada sempre é aceita por conferir()', () => {
    const rng = seededRng(123);
    for (let i = 0; i < 300; i++) {
      const p = gerarPergunta(rng);
      expect(conferir(p, p.resposta)).toBe(true);
      expect(explicacao(p).length).toBeGreaterThan(10);
    }
  });

  it('respeita o tipo e o nível da rodada', () => {
    const rng = seededRng(5);
    for (let i = 0; i < 100; i++) {
      const facil = gerarPergunta(rng, { tipo: 'broadcast', nivel: 'facil' });
      expect(facil.tipo).toBe('broadcast');
      expect([24, 16]).toContain(facil.c);
      const medio = gerarPergunta(rng, { tipo: 'rede', nivel: 'medio' });
      expect(medio.tipo).toBe('rede');
      expect([25, 26, 27]).toContain(medio.c);
    }
  });

  it('hosts aceita separador de milhar e rejeita vazio', () => {
    const p = { tipo: 'hosts' as const, ip: ip('10.0.5.20'), c: 16, resposta: '65534' };
    expect(conferir(p, '65.534')).toBe(true);
    expect(conferir(p, '65534')).toBe(true);
    expect(conferir(p, '')).toBe(false);
    expect(conferir(p, '65535')).toBe(false);
  });

  it('mesma rede aceita "nao" sem acento e maiúsculas', () => {
    const a = ip('192.168.10.25');
    const b = ip('192.168.10.200');
    const p = { tipo: 'mesma' as const, ip: a, outro: b, c: 25, resposta: 'não' };
    expect(conferir(p, 'nao')).toBe(true);
    expect(conferir(p, ' NÃO ')).toBe(true);
    expect(conferir(p, 'sim')).toBe(false);
  });

  it('rede e broadcast exigem o endereço completo', () => {
    const p = { tipo: 'rede' as const, ip: ip('192.168.10.70'), c: 26, resposta: '192.168.10.64' };
    expect(conferir(p, '192.168.10.64')).toBe(true);
    expect(conferir(p, '64')).toBe(false);
  });
});

describe('ranking', () => {
  it('aplicarResposta conta acertos, tentativas, sequência e tipo', () => {
    let s = scoreVazio();
    s = aplicarResposta(s, 'rede', true);
    s = aplicarResposta(s, 'rede', true);
    s = aplicarResposta(s, 'hosts', false);
    s = aplicarResposta(s, 'broadcast', true);
    expect(s).toMatchObject({ ok: 3, total: 4, streak: 1 });
    expect(s.byKind.rede).toEqual({ ok: 2, total: 2 });
    expect(s.byKind.hosts).toEqual({ ok: 0, total: 1 });
  });

  it('ordena por acertos e desempata pelo menor número de tentativas', () => {
    const lista = [
      { name: 'Ana', ok: 5, total: 9 },
      { name: 'Bia', ok: 5, total: 6 },
      { name: 'Caio', ok: 7, total: 20 },
    ];
    expect(ordenarRanking(lista).map((l) => l.name)).toEqual(['Caio', 'Bia', 'Ana']);
  });

  it('percentual da turma por tipo', () => {
    let a = scoreVazio();
    a = aplicarResposta(a, 'rede', true);
    a = aplicarResposta(a, 'hosts', false);
    let b = scoreVazio();
    b = aplicarResposta(b, 'rede', false);
    const pct = percentualPorTipo([a, b]);
    expect(pct.rede.pct).toBe(50);
    expect(pct.hosts.pct).toBe(0);
    expect(pct.broadcast.pct).toBeNull();
  });
});
