// Aula interativa: dados e regras puras das abas Portas, Sem internet? (diagnóstico) e Nuvem,
// mais o placar que vai para o ranking da turma. Nada aqui toca em DOM ou Firebase.

/* ------------------------------------ Portas ------------------------------------ */

export interface Servico {
  nome: string;
  porta: number;
  proto: 'TCP' | 'UDP';
  desc: string;
}

export const SERVICOS: Servico[] = [
  { nome: 'SSH', porta: 22, proto: 'TCP', desc: 'acesso remoto ao terminal, criptografado' },
  { nome: 'DNS', porta: 53, proto: 'UDP', desc: 'traduz nome em IP' },
  { nome: 'HTTP', porta: 80, proto: 'TCP', desc: 'site sem criptografia' },
  { nome: 'HTTPS', porta: 443, proto: 'TCP', desc: 'site com cadeado' },
  { nome: 'FTP', porta: 21, proto: 'TCP', desc: 'transferência de arquivos' },
  { nome: 'SMTP', porta: 25, proto: 'TCP', desc: 'envio de e-mail' },
];

/** Portas em ordem crescente (a ordem em que as "portas" aparecem na tela). */
export function portasOrdenadas(): number[] {
  return SERVICOS.map((s) => s.porta).sort((a, b) => a - b);
}

/** Embaralha sem alterar o original (Fisher-Yates). */
export function embaralhar<T>(lista: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface ResultadoPorta {
  ok: boolean;
  servico?: Servico;
}

/** O serviço mora nessa porta? Nome desconhecido nunca acerta. */
export function conferirPorta(nome: string, porta: number): ResultadoPorta {
  const servico = SERVICOS.find((s) => s.nome === nome);
  return { ok: !!servico && servico.porta === porta, servico };
}

/* ---------------------------------- Diagnóstico ---------------------------------- */

export type Defeito = 'cabo' | 'gateway' | 'provedor' | 'dns';
export const DEFEITOS: Defeito[] = ['cabo', 'gateway', 'provedor', 'dns'];

export const ROTULO_DEFEITO: Record<Defeito, string> = {
  cabo: 'Cabo ou placa de rede',
  gateway: 'Roteador (gateway)',
  provedor: 'Provedor (internet)',
  dns: 'Servidor DNS',
};

export const EXPLICACAO_DEFEITO: Record<Defeito, string> = {
  cabo: 'O ipconfig mostra "mídia desconectada" e o ping dá "falha geral": o PC nem chega ao roteador.',
  gateway: 'O ping no gateway (192.168.0.1) não responde: o problema está no roteador ou na rede local.',
  provedor: 'O gateway responde, mas o 8.8.8.8 não, e o tracert para depois do roteador: o defeito está no provedor.',
  dns: 'O ping no 8.8.8.8 funciona, mas o nome não resolve: a internet está ok, o DNS não.',
};

export const COMANDOS = [
  'ipconfig',
  'ping 192.168.0.1',
  'ping 8.8.8.8',
  'nslookup www.exemplo.com.br',
  'ping www.exemplo.com.br',
  'tracert -d 8.8.8.8',
] as const;
export type Comando = (typeof COMANDOS)[number];

export const PROMPT_WINDOWS = 'C:\\Users\\aluno>';

const SITE = 'www.exemplo.com.br';
const SITE_IP = '200.150.20.10';

const ping = (ip: string, ms: number, ttl: number, rng: () => number) =>
  `Disparando ${ip} com 32 bytes de dados:\n` +
  [0, 1, 2, 3].map(() => `Resposta de ${ip}: bytes=32 tempo=${ms + Math.floor(rng() * 5)}ms TTL=${ttl}`).join('\n') +
  `\n\nPacotes: Enviados = 4, Recebidos = 4, Perdidos = 0 (0% de perda)`;
const pingTimeout = (ip: string) =>
  `Disparando ${ip} com 32 bytes de dados:\n` +
  'Esgotado o tempo limite do pedido.\n'.repeat(4) +
  `\nPacotes: Enviados = 4, Recebidos = 0, Perdidos = 4 (100% de perda)`;
const pingFalhaGeral = (ip: string) =>
  `Disparando ${ip} com 32 bytes de dados:\n` +
  'A transmissão falhou. Falha geral.\n'.repeat(4) +
  `\nPacotes: Enviados = 4, Recebidos = 0, Perdidos = 4 (100% de perda)`;
const naoEncontrou = `A solicitação ping não pôde encontrar o host ${SITE}. Verifique o nome e tente novamente.`;

/** Saída (texto puro) do comando no Windows em português, de acordo com o defeito. */
export function saidaComando(cmd: Comando, defeito: Defeito, rng: () => number = Math.random): string {
  switch (cmd) {
    case 'ipconfig':
      return defeito === 'cabo'
        ? 'Adaptador Ethernet Ethernet:\n\n   Estado da mídia. . . . . . . . . : mídia desconectada'
        : 'Adaptador Ethernet Ethernet:\n\n   Endereço IPv4. . . . . . . . . . : 192.168.0.37\n   Máscara de Sub-rede. . . . . . . : 255.255.255.0\n   Gateway Padrão . . . . . . . . . : 192.168.0.1\n   Servidores DNS . . . . . . . . . : 192.168.0.10';
    case 'ping 192.168.0.1':
      return defeito === 'cabo' ? pingFalhaGeral('192.168.0.1') : defeito === 'gateway' ? pingTimeout('192.168.0.1') : ping('192.168.0.1', 1, 64, rng);
    case 'ping 8.8.8.8':
      return defeito === 'cabo' ? pingFalhaGeral('8.8.8.8') : defeito === 'gateway' || defeito === 'provedor' ? pingTimeout('8.8.8.8') : ping('8.8.8.8', 18, 117, rng);
    case 'nslookup www.exemplo.com.br':
      if (defeito === 'cabo') return '*** Não é possível localizar o servidor padrão.';
      if (defeito === 'dns') return 'DNS request timed out.\n    timeout was 2 seconds.\nServidor:  UnKnown\nAddress:  192.168.0.10\n\n*** Tempo limite da solicitação a UnKnown esgotado';
      return `Servidor:  dns.lab.local\nAddress:  192.168.0.10\n\nNão é resposta autoritativa:\nNome:    ${SITE}\nAddress:  ${SITE_IP}`;
    case 'ping www.exemplo.com.br':
      if (defeito === 'cabo') return `A solicitação ping não pôde encontrar o host ${SITE}.`;
      return defeito === 'dns' || defeito === 'gateway' || defeito === 'provedor' ? naoEncontrou : ping(SITE_IP, 22, 117, rng);
    case 'tracert -d 8.8.8.8': {
      const saltos = [
        '  1     1 ms     1 ms     1 ms  192.168.0.1',
        '  2     9 ms     8 ms    10 ms  200.150.10.1',
        '  3    17 ms    18 ms    16 ms  187.16.216.1',
        '  4    19 ms    18 ms    20 ms  8.8.8.8',
      ];
      const cab = 'Rastreando a rota para 8.8.8.8 com no máximo 30 saltos\n\n';
      const to = (n: number) => `  ${n}     *        *        *     Esgotado o tempo limite do pedido.`;
      if (defeito === 'cabo') return 'Falha na transmissão. Falha geral.';
      if (defeito === 'gateway') return `${cab}${to(1)}\n${to(2)}\n\n(interrompido)`;
      if (defeito === 'provedor') return `${cab}${saltos[0]}\n${to(2)}\n${to(3)}\n\n(interrompido)`;
      return `${cab}${saltos.join('\n')}\n\nRastreamento concluído.`;
    }
  }
}

/** Sorteia um defeito, evitando repetir o anterior. */
export function sortearDefeito(rng: () => number = Math.random, anterior?: Defeito | null): Defeito {
  const opcoes = DEFEITOS.filter((d) => d !== anterior);
  return opcoes[Math.floor(rng() * opcoes.length)];
}

export interface FeedbackDiagnostico {
  ok: boolean;
  titulo: string;
  explicacao: string;
  usados: string;
  profissional: boolean;
}

/** Texto do resultado: acerto/erro, explicação e quantos comandos foram usados. */
export function feedbackDiagnostico(defeito: Defeito, escolha: Defeito, usados: number): FeedbackDiagnostico {
  const ok = escolha === defeito;
  const profissional = ok && usados <= 3;
  return {
    ok,
    titulo: ok ? 'Certo!' : `Não era isso. O defeito era: ${ROTULO_DEFEITO[defeito]}`,
    explicacao: EXPLICACAO_DEFEITO[defeito],
    usados: `Você usou ${usados} comando(s). ${profissional ? 'Diagnóstico de profissional!' : 'Dá para resolver com 3 ou menos.'}`,
    profissional,
  };
}

/* ------------------------------------- Nuvem ------------------------------------- */

export type ModeloNuvem = 'IaaS' | 'PaaS' | 'SaaS';
export const MODELOS_NUVEM: ModeloNuvem[] = ['IaaS', 'PaaS', 'SaaS'];

export interface ServicoNuvem {
  nome: string;
  modelo: ModeloNuvem;
  explicacao: string;
}

export const NUVEM: ServicoNuvem[] = [
  { nome: 'Máquina virtual na AWS (EC2)', modelo: 'IaaS', explicacao: 'Você recebe a máquina e instala o sistema.' },
  { nome: 'Gmail', modelo: 'SaaS', explicacao: 'Você só usa o programa.' },
  { nome: 'Google Drive', modelo: 'SaaS', explicacao: 'Pronto para usar no navegador.' },
  { nome: 'Heroku ou Vercel', modelo: 'PaaS', explicacao: 'Você manda o código; eles cuidam do servidor.' },
  { nome: 'Firebase Hosting', modelo: 'PaaS', explicacao: 'Publica o seu site sem cuidar de servidor.' },
  { nome: 'Netflix', modelo: 'SaaS', explicacao: 'Você só assiste.' },
  { nome: 'Azure Virtual Machines', modelo: 'IaaS', explicacao: 'Uma VM alugada, igual à do VirtualBox.' },
  { nome: 'Google App Engine', modelo: 'PaaS', explicacao: 'Plataforma para rodar o seu app.' },
  { nome: 'Microsoft 365 (Word online)', modelo: 'SaaS', explicacao: 'Programa pronto no navegador.' },
  { nome: 'Servidor Linux na Oracle Cloud', modelo: 'IaaS', explicacao: 'Uma máquina para você administrar.' },
];

export function conferirNuvem(nome: string, escolha: ModeloNuvem): { ok: boolean; servico?: ServicoNuvem } {
  const servico = NUVEM.find((s) => s.nome === nome);
  return { ok: !!servico && servico.modelo === escolha, servico };
}

/* ------------------------------ Placar para o ranking ------------------------------ */

export interface Par {
  ok: number;
  total: number;
}
export interface DiagScore extends Par {
  cmds: number; // soma dos comandos usados em todas as respostas
  media: number; // cmds / total, uma casa decimal (é o que o professor lê)
  porDefeito: Record<Defeito, Par>; // por defeito sorteado: quantas vezes apareceu e quantas acertou
}
export interface AulaScore {
  portas: Par;
  diagnostico: DiagScore;
  nuvem: Par;
}

export type EventoAula =
  | { atividade: 'portas'; ok: boolean }
  | { atividade: 'nuvem'; ok: boolean }
  | { atividade: 'diagnostico'; ok: boolean; defeito: Defeito; cmds: number };

const par = (p?: Partial<Par>): Par => ({ ok: Math.max(0, Number(p?.ok) || 0), total: Math.max(0, Number(p?.total) || 0) });
const media = (cmds: number, total: number) => (total ? Math.round((cmds / total) * 10) / 10 : 0);

export function aulaVazia(): AulaScore {
  return normalizarAula(null);
}

/** Lê um placar salvo (localStorage ou Firestore), tolerando campos que faltam. */
export function normalizarAula(raw: unknown): AulaScore {
  const v = (raw ?? {}) as { portas?: Partial<Par>; nuvem?: Partial<Par>; diagnostico?: Partial<DiagScore> };
  const d = v.diagnostico ?? {};
  const porDefeito = {} as Record<Defeito, Par>;
  for (const k of DEFEITOS) porDefeito[k] = par(d.porDefeito?.[k]);
  const dp = par(d);
  const cmds = Math.max(0, Number(d.cmds) || 0);
  return { portas: par(v.portas), nuvem: par(v.nuvem), diagnostico: { ...dp, cmds, media: media(cmds, dp.total), porDefeito } };
}

/** Novo placar com a resposta contabilizada (não altera o original). */
export function aplicarEvento(s: AulaScore, ev: EventoAula): AulaScore {
  const n = normalizarAula(s);
  const soma = (p: Par): Par => ({ ok: p.ok + (ev.ok ? 1 : 0), total: p.total + 1 });
  if (ev.atividade === 'portas') return { ...n, portas: soma(n.portas) };
  if (ev.atividade === 'nuvem') return { ...n, nuvem: soma(n.nuvem) };
  const d = n.diagnostico;
  const cmds = d.cmds + Math.max(0, Math.floor(ev.cmds));
  const total = d.total + 1;
  return {
    ...n,
    diagnostico: {
      ok: d.ok + (ev.ok ? 1 : 0),
      total,
      cmds,
      media: media(cmds, total),
      porDefeito: { ...d.porDefeito, [ev.defeito]: soma(d.porDefeito[ev.defeito]) },
    },
  };
}

/** Acertos somados das três atividades (entra no ranking junto com o Desafio da máscara). */
export function acertosAula(s: Partial<AulaScore> | undefined): number {
  const n = normalizarAula(s);
  return n.portas.ok + n.diagnostico.ok + n.nuvem.ok;
}

export interface ResumoAula {
  portas: Par & { pct: number | null };
  nuvem: Par & { pct: number | null };
  diagnostico: Par & { pct: number | null; mediaCmds: number | null };
  /** Por defeito: quantas respostas e quantos erros. */
  porDefeito: Record<Defeito, { total: number; erros: number }>;
  /** Defeito com mais erros na turma (null se ninguém errou). */
  maisErrado: Defeito | null;
}

const pct = (p: Par) => (p.total ? Math.round((p.ok / p.total) * 100) : null);

/** Agrega os placares dos alunos para o painel do professor. */
export function resumoTurma(lista: Array<Partial<AulaScore> | undefined>): ResumoAula {
  const soma = (pegar: (a: AulaScore) => Par): Par => {
    const t: Par = { ok: 0, total: 0 };
    for (const item of lista) {
      const p = pegar(normalizarAula(item));
      t.ok += p.ok;
      t.total += p.total;
    }
    return t;
  };
  const portas = soma((a) => a.portas);
  const nuvem = soma((a) => a.nuvem);
  const diag = soma((a) => a.diagnostico);
  let cmds = 0;
  const porDefeito = {} as ResumoAula['porDefeito'];
  for (const k of DEFEITOS) porDefeito[k] = { total: 0, erros: 0 };
  for (const item of lista) {
    const a = normalizarAula(item);
    cmds += a.diagnostico.cmds;
    for (const k of DEFEITOS) {
      const p = a.diagnostico.porDefeito[k];
      porDefeito[k].total += p.total;
      porDefeito[k].erros += p.total - p.ok;
    }
  }
  let maisErrado: Defeito | null = null;
  for (const k of DEFEITOS) {
    if (porDefeito[k].erros > 0 && (maisErrado === null || porDefeito[k].erros > porDefeito[maisErrado].erros)) maisErrado = k;
  }
  return {
    portas: { ...portas, pct: pct(portas) },
    nuvem: { ...nuvem, pct: pct(nuvem) },
    diagnostico: { ...diag, pct: pct(diag), mediaCmds: diag.total ? Math.round((cmds / diag.total) * 10) / 10 : null },
    porDefeito,
    maisErrado,
  };
}

/* --------------------------- Diagnóstico ao vivo (professor) --------------------------- */

/** Estado gravado em sessions/{sid}.aulaDiag: o mesmo defeito para todos. */
export interface AulaDiagDoc {
  ativo: boolean;
  rodada: number; // identifica a rodada (timestamp)
  defeito: Defeito;
  revelado: boolean;
  /** Gravado pelo professor ao revelar, para a turma ver sem ler o placar de todos. */
  resumo?: ResumoAoVivo;
}

/** Resposta do aluno na rodada ao vivo, gravada no próprio doc de placar. */
export interface RespostaAoVivo {
  rodada: number;
  escolha: Defeito;
  cmds: number;
}

export interface ResumoAoVivo {
  responderam: number;
  acertaram: number;
  mediaCmds: number | null;
}

/** Só conta quem respondeu a rodada atual. A média de comandos é a de quem respondeu. */
export function resumoAoVivo(respostas: Array<RespostaAoVivo | undefined>, rodada: number, defeito: Defeito): ResumoAoVivo {
  const validas = respostas.filter((r): r is RespostaAoVivo => !!r && r.rodada === rodada);
  const cmds = validas.reduce((s, r) => s + Math.max(0, r.cmds), 0);
  return {
    responderam: validas.length,
    acertaram: validas.filter((r) => r.escolha === defeito).length,
    mediaCmds: validas.length ? Math.round((cmds / validas.length) * 10) / 10 : null,
  };
}
