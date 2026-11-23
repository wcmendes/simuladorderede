import { describe, expect, it } from 'vitest';
import { dividirTurma, subnetIndexForPc, subnetsFor, hostnameFor } from './net';

describe('dividirTurma', () => {
  it('/25: metade em cada sub-rede, numerada em sequência (1, 2, 3... e 21, 22, 23...)', () => {
    expect(dividirTurma(6, '/25')).toEqual([1, 2, 3, 21, 22, 23]);
    const pcs = dividirTurma(40, '/25');
    expect(pcs.slice(0, 20)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(pcs.slice(20)).toEqual(Array.from({ length: 20 }, (_, i) => i + 21));
  });
  it('turma ímpar: a primeira parte fica com um a mais', () => {
    expect(dividirTurma(5, '/25')).toEqual([1, 2, 3, 21, 22]);
  });
  it('/26: quatro partes iguais, de 10 em 10', () => {
    expect(dividirTurma(8, '/26')).toEqual([1, 2, 11, 12, 21, 22, 31, 32]);
  });
  it('/24: tudo na mesma sub-rede', () => {
    expect(dividirTurma(3, '/24')).toEqual([1, 2, 3]);
  });
  it('os números gerados caem nas sub-redes esperadas', () => {
    for (const mode of ['/25', '/26'] as const) {
      const n = 12;
      const pcs = dividirTurma(n, mode);
      const partes = subnetsFor(mode).length;
      const porParte = new Array(partes).fill(0);
      for (const pc of pcs) porParte[subnetIndexForPc(pc, mode)]++;
      expect(Math.max(...porParte) - Math.min(...porParte)).toBeLessThanOrEqual(1);
    }
  });
  it('não cabe: mais alunos que a faixa da sub-rede', () => {
    expect(() => dividirTurma(41, '/25')).toThrow(RangeError);
    expect(() => dividirTurma(41, '/24')).toThrow(RangeError);
    expect(dividirTurma(0, '/25')).toEqual([]);
  });
  it('hostname usa o novo número', () => {
    expect(hostnameFor('Maria Souza', 21)).toBe('PC-maria-21');
  });
});
