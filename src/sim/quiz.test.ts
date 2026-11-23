import { describe, expect, it } from 'vitest';
import { contagem, embaralhar, parseQuiz, pontos, rankingQuiz, type QuizPergunta } from './quiz';
import { REVISAO_REDES } from './quizPronto';
import { seededRng } from './fixtures';

describe('parseQuiz', () => {
  it('lê o formato do prompt (pergunta, alternativas, * na correta)', () => {
    const r = parseQuiz('Qual camada do OSI cuida do endereço IP?\n*Rede\nEnlace\nTransporte\nAplicação');
    expect(r.erros).toEqual([]);
    expect(r.perguntas).toEqual([
      { texto: 'Qual camada do OSI cuida do endereço IP?', opcoes: ['Rede', 'Enlace', 'Transporte', 'Aplicação'], correta: 0 },
    ]);
  });

  it('aceita a correta em qualquer posição, linhas em branco extras e CRLF', () => {
    const r = parseQuiz('P1?\r\nA\r\n*B\r\nC\r\n\r\n\r\n\r\nP2?\r\n*X\r\nY\r\n');
    expect(r.erros).toEqual([]);
    expect(r.perguntas.map((p) => p.correta)).toEqual([1, 0]);
  });

  it('explica cada erro em português, sem descartar as perguntas boas', () => {
    const r = parseQuiz('Sem correta?\nA\nB\n\nDuas?\n*A\n*B\n\nPoucas?\n*A\n\nBoa?\n*A\nB');
    expect(r.perguntas).toHaveLength(1);
    expect(r.erros).toHaveLength(3);
    expect(r.erros[0]).toMatch(/Pergunta 1.*marque a alternativa correta/);
    expect(r.erros[1]).toMatch(/Pergunta 2.*só uma/);
    expect(r.erros[2]).toMatch(/Pergunta 3.*pelo menos 2/);
  });

  it('não interpreta HTML: o texto é guardado como veio', () => {
    const r = parseQuiz('<b>x</b>?\n*<script>alert(1)</script>\nb');
    expect(r.perguntas[0].texto).toBe('<b>x</b>?');
    expect(r.perguntas[0].opcoes[0]).toBe('<script>alert(1)</script>');
  });
});

describe('conjunto pronto "Revisão Redes 2026.2"', () => {
  const { perguntas, erros } = parseQuiz(REVISAO_REDES);
  it('tem as 22 perguntas, todas válidas, com 4 alternativas', () => {
    expect(erros).toEqual([]);
    expect(perguntas).toHaveLength(22);
    expect(perguntas.every((p) => p.opcoes.length === 4)).toBe(true);
  });
  it('respostas certas conferem com o gabarito do prompt', () => {
    const certa = (trecho: string) => {
      const p = perguntas.find((x) => x.texto.includes(trecho))!;
      return p.opcoes[p.correta];
    };
    expect(certa('cobre um país')).toBe('WAN');
    expect(certa('bits tem o IPv6')).toBe('128');
    expect(certa('rede /24')).toBe('254');
    expect(certa('rede /25')).toBe('126');
    expect(certa('192.168.10.200/25')).toBe('192.168.10.128');
    expect(certa('HTTPS')).toBe('443');
    expect(certa('SSH')).toBe('22');
    expect(certa('ping por nome não')).toBe('DNS');
    expect(certa('proteção de dados')).toBe('LGPD (Lei 13.709/2018)');
  });
});

describe('embaralhar', () => {
  it('mantém a alternativa correta e as mesmas alternativas', () => {
    const { perguntas } = parseQuiz(REVISAO_REDES);
    const emb = embaralhar(perguntas, seededRng(9));
    perguntas.forEach((p, i) => {
      expect(emb[i].opcoes[emb[i].correta]).toBe(p.opcoes[p.correta]);
      expect([...emb[i].opcoes].sort()).toEqual([...p.opcoes].sort());
    });
  });
  it('de fato muda a posição da correta em boa parte das perguntas', () => {
    const { perguntas } = parseQuiz(REVISAO_REDES);
    const emb = embaralhar(perguntas, seededRng(3));
    expect(emb.filter((p) => p.correta !== 0).length).toBeGreaterThan(10);
  });
});

describe('pontos (até 1000 por pergunta)', () => {
  it('1000 se instantâneo, 750 na metade, 500 no limite, e nunca abaixo de 500', () => {
    expect(pontos(0)).toBe(1000);
    expect(pontos(15_000)).toBe(750);
    expect(pontos(30_000)).toBe(500);
    expect(pontos(99_000)).toBe(500);
    expect(pontos(-5)).toBe(1000);
  });
});

describe('rankingQuiz e contagem', () => {
  const perguntas: QuizPergunta[] = [
    { texto: 'a', opcoes: ['x', 'y'], correta: 0 },
    { texto: 'b', opcoes: ['x', 'y'], correta: 1 },
  ];
  const respostas = [
    { uid: 'ana', q: 0, choice: 0, ms: 0 }, // 1000
    { uid: 'bia', q: 0, choice: 0, ms: 15_000 }, // 750
    { uid: 'caio', q: 0, choice: 1, ms: 100 }, // errou
    { uid: 'ana', q: 1, choice: 0, ms: 1000 }, // errou
    { uid: 'bia', q: 1, choice: 1, ms: 0 }, // 1000
  ];

  it('soma só as perguntas reveladas e ordena por pontos', () => {
    expect(rankingQuiz(perguntas, respostas, 0).map((l) => [l.uid, l.pontos])).toEqual([
      ['ana', 1000], ['bia', 750], ['caio', 0],
    ]);
    const todas = rankingQuiz(perguntas, respostas, 1);
    expect(todas[0]).toEqual({ uid: 'bia', pontos: 1750, acertos: 2 });
    expect(todas[1]).toEqual({ uid: 'ana', pontos: 1000, acertos: 1 });
  });

  it('conta quantos marcaram cada alternativa', () => {
    expect(contagem(2, respostas, 0)).toEqual([2, 1]);
    expect(contagem(2, respostas, 1)).toEqual([1, 1]);
  });
});
