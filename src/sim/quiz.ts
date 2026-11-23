// Quiz ao vivo: leitura do texto colado pelo professor, pontuação e ranking. Funções puras.

export interface QuizPergunta {
  texto: string;
  opcoes: string[];
  correta: number; // índice em opcoes
}

export const DURACAO_MS = 30_000;
export const MAX_OPCOES = 6;

export interface ResultadoParse {
  perguntas: QuizPergunta[];
  erros: string[];
}

/**
 * Formato: um bloco por pergunta, separados por linha em branco.
 * Primeira linha = pergunta; as demais = alternativas; a que começa com * é a correta.
 */
export function parseQuiz(entrada: string): ResultadoParse {
  const perguntas: QuizPergunta[] = [];
  const erros: string[] = [];
  const blocos = entrada
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((l) => l.length > 0);

  blocos.forEach((linhas, i) => {
    const n = i + 1;
    const [texto, ...resto] = linhas;
    if (resto.length < 2) {
      erros.push(`Pergunta ${n} ("${texto.slice(0, 40)}"): precisa de pelo menos 2 alternativas.`);
      return;
    }
    if (resto.length > MAX_OPCOES) {
      erros.push(`Pergunta ${n}: no máximo ${MAX_OPCOES} alternativas.`);
      return;
    }
    const marcadas = resto.filter((l) => l.startsWith('*'));
    if (marcadas.length !== 1) {
      erros.push(
        marcadas.length === 0
          ? `Pergunta ${n} ("${texto.slice(0, 40)}"): marque a alternativa correta com * no começo da linha.`
          : `Pergunta ${n} ("${texto.slice(0, 40)}"): só uma alternativa pode ter *.`,
      );
      return;
    }
    const opcoes = resto.map((l) => (l.startsWith('*') ? l.slice(1).trim() : l));
    if (opcoes.some((o) => o === '')) {
      erros.push(`Pergunta ${n}: há uma alternativa vazia.`);
      return;
    }
    if (texto.length > 300 || opcoes.some((o) => o.length > 150)) {
      erros.push(`Pergunta ${n}: texto muito longo (pergunta até 300 e alternativas até 150 caracteres).`);
      return;
    }
    perguntas.push({ texto, opcoes, correta: resto.findIndex((l) => l.startsWith('*')) });
  });

  return { perguntas, erros };
}

/** Embaralha as alternativas de cada pergunta, preservando qual é a correta. */
export function embaralhar(perguntas: QuizPergunta[], rng: () => number = Math.random): QuizPergunta[] {
  return perguntas.map((p) => {
    const idx = p.opcoes.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return { texto: p.texto, opcoes: idx.map((i) => p.opcoes[i]), correta: idx.indexOf(p.correta) };
  });
}

/** 500 pontos pelo acerto + até 500 pela rapidez: 1000 se instantâneo, 500 no limite do tempo. */
export function pontos(ms: number, limiteMs: number = DURACAO_MS): number {
  const frac = Math.min(1, Math.max(0, ms / limiteMs));
  return Math.round(500 + 500 * (1 - frac));
}

export interface RespostaQuiz {
  uid: string;
  q: number;
  choice: number;
  ms: number;
}

export interface LinhaQuiz {
  uid: string;
  pontos: number;
  acertos: number;
}

/** Placar acumulado das perguntas de índice 0 até `ateIndice` (as já reveladas). */
export function rankingQuiz(perguntas: QuizPergunta[], respostas: RespostaQuiz[], ateIndice: number): LinhaQuiz[] {
  const por = new Map<string, LinhaQuiz>();
  for (const r of respostas) {
    const p = perguntas[r.q];
    if (!p || r.q > ateIndice) continue;
    const linha = por.get(r.uid) ?? { uid: r.uid, pontos: 0, acertos: 0 };
    if (r.choice === p.correta) {
      linha.pontos += pontos(r.ms);
      linha.acertos += 1;
    }
    por.set(r.uid, linha);
  }
  return [...por.values()].sort((a, b) => b.pontos - a.pontos || b.acertos - a.acertos);
}

/** Quantos alunos marcaram cada alternativa da pergunta q. */
export function contagem(numOpcoes: number, respostas: RespostaQuiz[], q: number): number[] {
  const out = Array<number>(numOpcoes).fill(0);
  for (const r of respostas) {
    if (r.q === q && r.choice >= 0 && r.choice < numOpcoes) out[r.choice] += 1;
  }
  return out;
}
