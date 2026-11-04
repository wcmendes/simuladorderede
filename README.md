# LabRedes

Simulador de rede multiplayer para a turma de **Redes de Computadores** (ADS, Faculdade EDUFOR).

Cada aluno abre um link no navegador e vira um "computador" de uma rede simulada **compartilhada pela turma**. Os alunos digitam comandos de rede num terminal falso (`ipconfig`, `ping`, `tracert`, `nslookup`, `arp`, `route`, `netstat`, `curl`...), pingam colegas, publicam sites fictícios e os descobrem por DNS. O professor controla tudo num painel: cria a sessão, projeta o QR Code, acompanha os alunos e **liga e desliga falhas na rede em tempo real** (DNS fora, provedor caído, gateway de uma sub-rede fora, perda de pacotes).

Serve para três coisas:
1. apoio à aula prática;
2. **plano B** caso o VirtualBox não funcione no laboratório;
3. teste da ideia para evoluir nos próximos encontros.

## Stack

- **Vite + React + TypeScript** (sem framework de UI pesado).
- **Firebase (plano gratuito Spark):** Hosting, Cloud Firestore (`onSnapshot`) e Authentication anônima.
- Motor da simulação em **TypeScript puro** em `src/sim/`, separado da UI e do Firebase, com testes **Vitest**.
- Terminal próprio (sem xterm.js). Dependência extra: `qrcode`.

## Passo a passo para publicar (para quem nunca usou Firebase)

### 1. Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**. Dê um nome (ex.: `labredes`). Pode desativar o Google Analytics.
2. No menu lateral, vá em **Criar → Authentication → Começar** e habilite o provedor **Anônimo**.
3. Vá em **Criar → Firestore Database → Criar banco de dados**. Escolha o local **`southamerica-east1`** (São Paulo) e o modo de produção (as regras serão enviadas no deploy).
4. Em **Configurações do projeto → Seus apps**, clique no ícone `</>` (Web) para **registrar um app web**. Copie os valores do objeto `firebaseConfig` (apiKey, authDomain, projectId etc.).

### 2. Instalar as ferramentas e dependências

```bash
npm install
npm install -g firebase-tools
firebase login
```

Se preferir inicializar do zero (opcional — o projeto já traz `firebase.json`, `firestore.rules` e `firestore.indexes.json`):

```bash
firebase init
# Selecione: Hosting + Firestore
# Pasta pública: dist
# Configurar como SPA (single-page app): Yes
# Não sobrescreva firestore.rules nem firestore.indexes.json
```

Associe o projeto local ao do console:

```bash
firebase use --add   # escolha o projeto criado no passo 1
```

### 3. Configurar o `.env`

Copie `.env.example` para `.env` e preencha com os valores do passo 1:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_PROF_PIN=1234     # PIN de acesso ao painel do professor
```

### 4. Build e deploy

```bash
npm run build
firebase deploy
```

O Firebase mostra a URL do Hosting (ex.: `https://seu-projeto.web.app`). Esse é o link que os alunos vão abrir.

## Como testar antes da aula (roteiro de 5 minutos)

1. Abra `https://seu-projeto.web.app/#/professor`, digite o PIN e **crie uma sessão** (deixe o modo `/25`). Anote o código (ex.: `REDES0411`) — a tela mostra o QR Code em tela cheia.
2. Abra **3 abas anônimas** (Ctrl+Shift+N) com a URL do site. Em cada uma, entre com o código, um nome diferente e números de computador diferentes (ex.: 5, 12 e 30). Confira que **cada aba recebe um IP diferente** (alocação por transação, sem repetir).
3. **Ping entre alunos:** na aba do PC 5, digite `ping <IP do PC 12>`. A aba do PC 12 deve mostrar o toast "📶 Ping recebido".
4. **Site:** na aba do PC 12, digite `site criar padaria` e depois edite o conteúdo. Na aba do PC 5, faça `nslookup padaria`, depois `curl padaria`. A aba do PC 12 recebe "🌐 Visita ao seu site".
5. **Falha de DNS:** no painel do professor, ligue "DNS fora do ar". Em uma aba de aluno, `ping www.google.com` deve falhar ("não pôde encontrar o host"), mas `ping 142.250.79.36` continua funcionando. Esse é o exercício principal de diagnóstico.
6. **Prática 1:** na aba de um aluno, preencha a Parte A clicando nos botões "▶ Rodar" e a Parte B calculando. Os campos corretos ficam com ✓.

## Encerrar a sessão

No painel do professor, o botão **"Encerrar sessão"** (com confirmação) apaga todas as subcoleções da sessão (alunos, sites, eventos, respostas). Use ao final da aula para manter os dados limpos e ficar dentro do plano gratuito.

## Desenvolvimento

```bash
npm run dev        # servidor local (http://localhost:5173)
npm run test       # testes do motor de simulação (Vitest)
npm run typecheck  # checagem de tipos
npm run build      # build de produção (checa tipos e gera dist/)
```

### Estrutura

```
src/sim/      motor da simulação (TypeScript puro + testes)
  net.ts        endereçamento IPv4, sub-redes, topologia
  routing.ts    caminhos/saltos (tracert, TTL do ping)
  dns.ts        resolução de nomes (direta e reversa)
  engine.ts     processador de comandos do terminal Windows
  pratica.ts    correção das Partes A e B da Prática 1
  vm.ts         VM simulada (VirtualBox) e regras de alcance
  *.test.ts     testes Vitest
src/firebase/ inicialização e acesso ao Firestore
src/ui/       componentes React (terminal, abas, painel do professor)
```

## Modos de rede

| Modo | Sub-redes | Gateways |
|------|-----------|----------|
| `/24` | 1: 192.168.10.0/24 | .1 |
| `/25` (padrão) | 2: .0/25 e .128/25 | .1 e .129 |
| `/26` | 4: .0, .64, .128, .192 | .1, .65, .129, .193 |

Os alunos são distribuídos pelas sub-redes conforme o número do computador, para ligar com a parte de sub-redes da aula.

## Rotas da aplicação

- `/` — entrada do aluno (ou `#/?code=REDES0411` com o código pré-preenchido pelo QR Code).
- `#/professor` — painel do professor (protegido por PIN).
- `#/ajuda` — explicação de cada comando e sua camada OSI/TCP-IP.

## Status das prioridades

- **P0 (pronto):** entrada com IP sem duplicar, todos os comandos com ajuda completa (`help`, `help <cmd>`, `/?`, "você quis dizer", Tab, botões "▶ Rodar", boas-vindas), ping entre alunos com notificação, sites da turma, painel do professor com falhas em tempo real e feed, Prática 1 (Partes A e B) com modo "rede real", regras do Firestore e deploy.
- **P1 (incluído):** simulação de VM (assistente, rede, instalação, console Linux com regras de alcance NAT/Host-only/Bridge).
- Itens visuais de P1 (mapa da rede animado, captura mini-Wireshark, modo projetor com topologia) ficam como próximo passo para o encontro de 19/11.
