import { describe, expect, it } from 'vitest';
import {
  COMANDOS,
  DEFEITOS,
  NUVEM,
  SERVICOS,
  acertosAula,
  aplicarEvento,
  aulaVazia,
  conferirNuvem,
  conferirPorta,
  embaralhar,
  feedbackDiagnostico,
  normalizarAula,
  portasOrdenadas,
  resumoAoVivo,
  resumoTurma,
  saidaComando,
  sortearDefeito,
  MODELOS_NUVEM,
} from './aula';
import { seededRng } from './fixtures';

const rng = () => 0;

describe('portas', () => {
  it('cada serviço tem a porta certa e as outras erradas', () => {
    const esperado: Record<string, number> = { SSH: 22, DNS: 53, HTTP: 80, HTTPS: 443, FTP: 21, SMTP: 25 };
    expect(SERVICOS).toHaveLength(6);
    for (const s of SERVICOS) {
      expect(conferirPorta(s.nome, esperado[s.nome]).ok).toBe(true);
      for (const p of portasOrdenadas().filter((x) => x !== esperado[s.nome])) {
        expect(conferirPorta(s.nome, p).ok).toBe(false);
      }
    }
  });
  it('DNS é UDP; o resto é TCP', () => {
    expect(SERVICOS.filter((s) => s.proto === 'UDP').map((s) => s.nome)).toEqual(['DNS']);
  });
  it('nome desconhecido nunca acerta', () => {
    expect(conferirPorta('Telnet', 23).ok).toBe(false);
  });
  it('portas saem em ordem crescente e o embaralhar mantém os itens', () => {
    expect(portasOrdenadas()).toEqual([21, 22, 25, 53, 80, 443]);
    const e = embaralhar(SERVICOS, seededRng(3));
    expect(e).toHaveLength(6);
    expect(new Set(e.map((s) => s.nome)).size).toBe(6);
  });
});

describe('saídas dos comandos por defeito', () => {
  const s = (c: (typeof COMANDOS)[number], d: (typeof DEFEITOS)[number]) => saidaComando(c, d, rng);

  it('DNS: ping 8.8.8.8 responde e nslookup dá tempo esgotado', () => {
    expect(s('ping 8.8.8.8', 'dns')).toContain('Recebidos = 4');
    expect(s('nslookup www.exemplo.com.br', 'dns')).toContain('Tempo limite da solicitação');
    expect(s('ping www.exemplo.com.br', 'dns')).toContain('não pôde encontrar o host');
    expect(s('ping 192.168.0.1', 'dns')).toContain('Recebidos = 4');
  });
  it('gateway: ping 192.168.0.1 dá "Esgotado o tempo limite"', () => {
    expect(s('ping 192.168.0.1', 'gateway')).toContain('Esgotado o tempo limite');
    expect(s('ping 192.168.0.1', 'gateway')).toContain('Recebidos = 0');
    expect(s('ping 8.8.8.8', 'gateway')).toContain('Recebidos = 0');
    expect(s('tracert -d 8.8.8.8', 'gateway')).not.toContain('192.168.0.1  ');
  });
  it('provedor: gateway responde, 8.8.8.8 não, tracert para depois do 192.168.0.1', () => {
    expect(s('ping 192.168.0.1', 'provedor')).toContain('Recebidos = 4');
    expect(s('ping 8.8.8.8', 'provedor')).toContain('Recebidos = 0');
    const t = s('tracert -d 8.8.8.8', 'provedor');
    expect(t).toContain('192.168.0.1');
    expect(t).toContain('  2     *');
    expect(t).not.toContain('200.150.10.1');
    expect(t).toContain('(interrompido)');
  });
  it('cabo: ipconfig mostra mídia desconectada e o ping dá Falha geral', () => {
    expect(s('ipconfig', 'cabo')).toContain('mídia desconectada');
    expect(s('ping 192.168.0.1', 'cabo')).toContain('Falha geral');
    expect(s('ping 8.8.8.8', 'cabo')).toContain('Falha geral');
    expect(s('ipconfig', 'dns')).toContain('192.168.0.37');
  });
  it('sem defeito de rede o tracert chega ao destino e o nome resolve (defeito dns não chega)', () => {
    expect(s('tracert -d 8.8.8.8', 'dns')).toContain('Rastreamento concluído.');
    expect(s('nslookup www.exemplo.com.br', 'provedor')).toContain('dns.lab.local');
  });
  it('nenhuma saída cita instituição', () => {
    for (const d of DEFEITOS) for (const c of COMANDOS) expect(saidaComando(c, d, rng).toLowerCase()).not.toMatch(/\.edu\.br/);
  });
  it('sortearDefeito não repete o anterior', () => {
    for (const d of DEFEITOS) for (let i = 0; i < 20; i++) expect(sortearDefeito(seededRng(i), d)).not.toBe(d);
  });
});

describe('feedback do diagnóstico', () => {
  it('profissional só com acerto e 3 comandos ou menos', () => {
    expect(feedbackDiagnostico('dns', 'dns', 3).profissional).toBe(true);
    expect(feedbackDiagnostico('dns', 'dns', 4).profissional).toBe(false);
    const erro = feedbackDiagnostico('dns', 'cabo', 1);
    expect(erro.ok).toBe(false);
    expect(erro.profissional).toBe(false);
    expect(erro.titulo).toContain('Servidor DNS');
  });
});

describe('nuvem', () => {
  it('10 serviços: 4 SaaS, 3 IaaS, 3 PaaS', () => {
    expect(NUVEM).toHaveLength(10);
    const n = (m: string) => NUVEM.filter((x) => x.modelo === m).length;
    expect([n('SaaS'), n('IaaS'), n('PaaS')]).toEqual([4, 3, 3]);
  });
  it('cada serviço tem uma única resposta certa', () => {
    for (const s of NUVEM) {
      for (const m of MODELOS_NUVEM) expect(conferirNuvem(s.nome, m).ok).toBe(m === s.modelo);
    }
  });
  it('classificações pedidas', () => {
    const por = (nome: string) => NUVEM.find((s) => s.nome.includes(nome))?.modelo;
    expect(por('Gmail')).toBe('SaaS');
    expect(por('Netflix')).toBe('SaaS');
    expect(por('EC2')).toBe('IaaS');
    expect(por('Oracle')).toBe('IaaS');
    expect(por('Heroku')).toBe('PaaS');
    expect(por('Firebase')).toBe('PaaS');
    expect(por('App Engine')).toBe('PaaS');
  });
});

describe('placar da aula', () => {
  it('acumula acertos, comandos e média', () => {
    let s = aulaVazia();
    s = aplicarEvento(s, { atividade: 'portas', ok: true });
    s = aplicarEvento(s, { atividade: 'portas', ok: false });
    s = aplicarEvento(s, { atividade: 'nuvem', ok: true });
    s = aplicarEvento(s, { atividade: 'diagnostico', ok: true, defeito: 'dns', cmds: 3 });
    s = aplicarEvento(s, { atividade: 'diagnostico', ok: false, defeito: 'cabo', cmds: 6 });
    expect(s.portas).toEqual({ ok: 1, total: 2 });
    expect(s.nuvem).toEqual({ ok: 1, total: 1 });
    expect(s.diagnostico.media).toBe(4.5);
    expect(s.diagnostico.porDefeito.cabo).toEqual({ ok: 0, total: 1 });
    expect(acertosAula(s)).toBe(3);
  });
  it('não altera o original e tolera dados incompletos', () => {
    const a = aulaVazia();
    aplicarEvento(a, { atividade: 'portas', ok: true });
    expect(a.portas.total).toBe(0);
    expect(normalizarAula({ portas: { ok: 'x' } }).portas).toEqual({ ok: 0, total: 0 });
    expect(acertosAula(undefined)).toBe(0);
  });
  it('resume a turma e aponta o defeito mais errado', () => {
    let a = aulaVazia();
    a = aplicarEvento(a, { atividade: 'diagnostico', ok: false, defeito: 'provedor', cmds: 5 });
    let b = aulaVazia();
    b = aplicarEvento(b, { atividade: 'diagnostico', ok: false, defeito: 'provedor', cmds: 3 });
    b = aplicarEvento(b, { atividade: 'diagnostico', ok: true, defeito: 'dns', cmds: 4 });
    b = aplicarEvento(b, { atividade: 'portas', ok: true });
    const r = resumoTurma([a, b, undefined]);
    expect(r.maisErrado).toBe('provedor');
    expect(r.diagnostico.pct).toBe(33);
    expect(r.diagnostico.mediaCmds).toBe(4);
    expect(r.portas.pct).toBe(100);
    expect(r.nuvem.pct).toBeNull();
    expect(resumoTurma([]).maisErrado).toBeNull();
  });
});

describe('diagnóstico ao vivo', () => {
  it('conta só a rodada atual', () => {
    const r = resumoAoVivo(
      [
        { rodada: 2, escolha: 'dns', cmds: 2 },
        { rodada: 2, escolha: 'cabo', cmds: 4 },
        { rodada: 1, escolha: 'dns', cmds: 9 },
        undefined,
      ],
      2,
      'dns',
    );
    expect(r).toEqual({ responderam: 2, acertaram: 1, mediaCmds: 3 });
    expect(resumoAoVivo([], 2, 'dns').mediaCmds).toBeNull();
  });
});
