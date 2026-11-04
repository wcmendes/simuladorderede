// Textos de ajuda dos comandos (seção 11.1).

export interface HelpEntry {
  name: string;
  summary: string; // uma linha para o help geral
  example: string; // exemplo para o help geral
  purpose: string; // "para que serve"
  usage: string; // sintaxe
  examples: string[];
  observe: string; // o que observar na resposta
  layer: string; // camada OSI/TCP-IP
}

export const HELP: Record<string, HelpEntry> = {
  ipconfig: {
    name: 'ipconfig',
    summary: 'Mostra o endereço IP, a máscara e o gateway do computador',
    example: 'ipconfig /all',
    purpose: 'Mostra a configuração de rede da sua máquina (IP, máscara, gateway, DNS, MAC).',
    usage: 'ipconfig [/all]',
    examples: ['ipconfig', 'ipconfig /all'],
    observe: 'Procure o Endereço IPv4, a Máscara de Sub-rede, o Gateway Padrão e os Servidores DNS.',
    layer: 'Rede (IP)',
  },
  ping: {
    name: 'ping',
    summary: 'Testa se outro computador responde',
    example: 'ping 8.8.8.8',
    purpose: 'Envia pacotes a um destino para ver se ele responde e quanto tempo demora.',
    usage: 'ping <IP ou nome> [-n quantidade]',
    examples: ['ping 8.8.8.8', 'ping www.google.com', 'ping 192.168.10.12 -n 2'],
    observe: 'Veja o TTL e o tempo. "Esgotado o tempo limite" = o destino não respondeu.',
    layer: 'Rede (ICMP)',
  },
  tracert: {
    name: 'tracert',
    summary: 'Mostra o caminho (roteadores) até um destino',
    example: 'tracert www.google.com',
    purpose: 'Lista cada roteador (salto) no caminho até o destino.',
    usage: 'tracert [-d] <IP ou nome>',
    examples: ['tracert www.google.com', 'tracert -d 8.8.8.8'],
    observe: 'Cada linha é um salto. "* * *" = aquele salto não respondeu. Use -d para não resolver nomes.',
    layer: 'Rede (IP/ICMP)',
  },
  nslookup: {
    name: 'nslookup',
    summary: 'Descobre o IP de um nome, ou o nome de um IP',
    example: 'nslookup www.edufor.edu.br',
    purpose: 'Pergunta ao servidor DNS qual o IP de um nome (ou o nome de um IP).',
    usage: 'nslookup <nome ou IP>',
    examples: ['nslookup www.edufor.edu.br', 'nslookup 192.168.10.12', 'nslookup padaria.turma.lab'],
    observe: 'Veja o servidor que respondeu e o Address retornado. Se o DNS estiver fora, dá tempo limite.',
    layer: 'Aplicação (DNS)',
  },
  arp: {
    name: 'arp',
    summary: 'Mostra a tabela que liga IP a endereço físico (MAC) na rede local',
    example: 'arp -a',
    purpose: 'Mostra o cache ARP: quais IPs da rede local você já "conheceu" e o MAC de cada um.',
    usage: 'arp -a',
    examples: ['arp -a'],
    observe: 'Só aparecem máquinas da MESMA sub-rede com quem você já trocou pacotes. ARP é local.',
    layer: 'Enlace (MAC)',
  },
  route: {
    name: 'route',
    summary: 'Mostra a tabela de roteamento do computador',
    example: 'route print',
    purpose: 'Mostra as rotas que o computador usa para decidir por onde enviar cada pacote.',
    usage: 'route print',
    examples: ['route print'],
    observe: 'A linha 0.0.0.0 0.0.0.0 é a rota padrão; o gateway dela leva ao resto da rede.',
    layer: 'Rede (IP)',
  },
  netstat: {
    name: 'netstat',
    summary: 'Lista as conexões de rede abertas',
    example: 'netstat -an',
    purpose: 'Mostra as conexões e portas abertas do computador.',
    usage: 'netstat -an',
    examples: ['netstat -an'],
    observe: 'ESTABELECIDA = conexão ativa; ESCUTANDO = porta aguardando conexão. Porta 443 = HTTPS.',
    layer: 'Transporte (TCP/UDP)',
  },
  hostname: {
    name: 'hostname',
    summary: 'Mostra o nome do seu computador',
    example: 'hostname',
    purpose: 'Mostra o nome (hostname) da sua máquina na rede.',
    usage: 'hostname',
    examples: ['hostname'],
    observe: 'É o nome que o DNS reverso devolve quando alguém faz nslookup no seu IP.',
    layer: 'Aplicação',
  },
  getmac: {
    name: 'getmac',
    summary: 'Mostra o endereço físico (MAC) da placa de rede',
    example: 'getmac',
    purpose: 'Mostra o endereço físico (MAC) da sua placa de rede.',
    usage: 'getmac',
    examples: ['getmac'],
    observe: 'O MAC identifica a placa na rede local. Começa com 08-00-27 (padrão VirtualBox).',
    layer: 'Enlace (MAC)',
  },
  curl: {
    name: 'curl',
    summary: 'Abre (baixa) uma página web de um site',
    example: 'curl www.edufor.edu.br',
    purpose: 'Acessa um site pela porta 80 e mostra o conteúdo.',
    usage: 'curl <nome ou IP>',
    examples: ['curl www.edufor.edu.br', 'curl padaria.turma.lab'],
    observe: 'Se não houver site naquele IP: "Connection refused". Se o DNS estiver fora, o nome não resolve.',
    layer: 'Aplicação (HTTP)',
  },
  navegar: {
    name: 'navegar',
    summary: 'Abre um site no navegador simulado',
    example: 'navegar www.edufor.edu.br',
    purpose: 'Igual ao curl, mas abre o site no painel de navegador ao lado.',
    usage: 'navegar <nome ou IP>',
    examples: ['navegar www.edufor.edu.br', 'navegar padaria.turma.lab'],
    observe: 'O site só funciona se o dono estiver online e o nome resolver no DNS.',
    layer: 'Aplicação (HTTP)',
  },
  site: {
    name: 'site',
    summary: 'Cria, edita ou remove o seu site da turma',
    example: 'site criar padaria',
    purpose: 'Publica um site fictício apontando para o seu IP, que os colegas podem descobrir.',
    usage: 'site criar <nome> | site editar | site remover',
    examples: ['site criar padaria', 'site editar', 'site remover'],
    observe: 'O nome vira <nome>.turma.lab. Cada aluno pode ter um site. Fica no ar enquanto você está online.',
    layer: 'Aplicação (DNS/HTTP)',
  },
  cls: {
    name: 'cls',
    summary: 'Limpa a tela do terminal',
    example: 'cls',
    purpose: 'Limpa tudo o que está escrito no terminal.',
    usage: 'cls',
    examples: ['cls'],
    observe: '',
    layer: '-',
  },
  help: {
    name: 'help',
    summary: 'Mostra a lista de comandos ou a ajuda de um comando',
    example: 'help ping',
    purpose: 'Mostra todos os comandos, ou a ajuda detalhada de um comando.',
    usage: 'help [comando]',
    examples: ['help', 'help ping', 'ping /?'],
    observe: '',
    layer: '-',
  },
};

export const SHORTCUT_COMMANDS = ['ipconfig /all', 'ping ', 'tracert ', 'nslookup ', 'arp -a', 'help'];
