# 🖧 LabRedes — Rede simulada da turma

Simulador de rede **multiplayer** para a disciplina de **Redes de Computadores** (curso de ADS). Cada aluno abre um link no navegador e vira um "computador" de uma rede compartilhada pela turma inteira. Os alunos digitam comandos de rede num terminal falso, pingam colegas, publicam sites fictícios e os descobrem por DNS — e o professor liga e desliga falhas (DNS fora, provedor caído, gateway de sub-rede fora, perda de pacotes) em tempo real, para criar exercícios de diagnóstico.

Feito com **Vite + React + TypeScript**, com o motor da simulação em TypeScript puro e testado (Vitest). Usa **Firebase Firestore** para o estado ao vivo, **Firebase Hosting** para publicar e **Auth anônimo** (um documento por navegador, sem cadastro).

🔗 **Acesse:** https://simuladorderede.web.app

- 👩‍🏫 **Professor:** https://simuladorderede.web.app/#/professor
- 📱 **Aluno:** https://simuladorderede.web.app
- ❓ **Ajuda:** https://simuladorderede.web.app/#/ajuda

## 🎯 O que a atividade cobre

Acompanha a Prática 1 (diagnóstico de rede no Windows, endereçamento IP e criação de VM no VirtualBox):

- **Comandos Windows** — `ipconfig`, `ping`, `tracert`, `nslookup`, `arp -a`, `route print`, `netstat -an`, `hostname`, `getmac`, `curl`/`navegar`.
- **Endereçamento** — CIDR, rede, broadcast, faixa de hosts, cálculo de sub-redes (/24, /25, /26).
- **Diagnóstico** — identificar, só pelos comandos, qual falha o professor ativou (DNS, gateway, provedor).
- **Sub-redes** — os alunos são distribuídos por sub-redes conforme o nº do computador, mostrando "mais de um gateway" na prática.
- **Máquina Virtual** — assistente do VirtualBox, modos de rede (NAT/Host-only/Bridge) e console Linux simulados.

## 🕹️ Como funciona

1. O **professor** acessa o painel, escolhe o modo de rede (/24, /25 ou /26) e cria a sessão. Recebe um **código** (ex.: `REDES0411`) e um **QR Code em tela cheia** para projetar.
2. O **aluno** entra com código + nome + número do computador. Recebe automaticamente IP, máscara, gateway, DNS, MAC e hostname (`PC-joao-12`), alocados sem repetir por transação do Firestore.
3. Os alunos usam o **terminal**: pingam colegas (que recebem uma notificação na tela), publicam sites (`site criar padaria`) e os descobrem com `nslookup` e `tracert`.
4. O professor liga **falhas na rede** em tempo real e acompanha o **feed ao vivo** das interações, a lista de alunos online e o progresso da Prática 1.

## 🗂️ Estrutura

| Pasta/arquivo | Função |
|---|---|
| `src/sim/net.ts` | Endereçamento IPv4, sub-redes e topologia do laboratório. |
| `src/sim/routing.ts` | Caminhos/saltos (usados por `tracert` e pelo TTL do `ping`). |
| `src/sim/dns.ts` | Resolução de nomes (direta e reversa). |
| `src/sim/engine.ts` | Processador dos comandos do terminal Windows. |
| `src/sim/pratica.ts` | Correção das Partes A e B da Prática 1. |
| `src/sim/vm.ts` | VM simulada (VirtualBox) e regras de alcance. |
| `src/sim/*.test.ts` | Testes do motor (Vitest). |
| `src/firebase/` | Init do Firebase, auth anônimo e acesso ao Firestore. |
| `src/ui/` | Componentes React (terminal, abas, painel do professor, rodapé). |
| `firebase.json` | Configuração do Hosting + Firestore + rewrites de SPA. |
| `.firebaserc` | Projeto Firebase padrão (`simuladorderede`). |
| `firestore.rules` | Regras de segurança da sessão. |
| `firestore.indexes.json` | Índice dos eventos (`toIp` + `at`). |

## 🚀 Como colocar no ar

Precisa de **Node.js**. A CLI do Firebase já vem como dependência do projeto (não precisa instalar global).

No console do Firebase (uma vez):

1. **Authentication → Método de login →** habilite **Anônimo**.
2. **Firestore Database →** crie o banco (local `southamerica-east1`, modo de produção — as regras deste repo cuidam do acesso).
3. Registre um app da Web e copie o `firebaseConfig`.

No projeto:

```bash
npm install
cp .env.example .env     # preencha com o firebaseConfig e o VITE_PROF_PIN
npm run login            # entra na conta Google (abre o navegador)
npm run publicar         # valida o .env, builda e publica tudo
```

Reimplantar depois de uma alteração:

```bash
npm run publicar              # build + deploy completo
npm run deploy:hosting        # só o front-end (mais rápido)
```

## 🔒 Segurança

- As chaves em `.env` (`VITE_FIREBASE_*`) são **públicas por natureza** — vão para o navegador. A proteção real vem das `firestore.rules`.
- Cada aluno entra com **auth anônimo**; o documento do host usa o próprio `uid` e o IP não pode ser alterado depois de atribuído.
- Um aluno só escreve o **próprio** host e as próprias respostas, e só cria eventos cujo `fromIp` bate com o IP do seu host (validado por `get()` nas regras).
- Só o **dono da sessão** (o professor) altera o modo/as falhas e pode apagar sites, remover alunos e encerrar a sessão.
- **Nada do que o aluno digita é renderizado como HTML** (todo conteúdo de site é escapado) — há teste automatizado para isso.

## 🧪 Desenvolvimento

```bash
npm run dev        # servidor local
npm run test       # testes do motor de simulação (Vitest)
npm run typecheck  # checagem de tipos
npm run build      # build de produção
```

## 👤 Autor

**Prof. William Corrêa Mendes**

- Currículo Lattes: https://lattes.cnpq.br/7726054867638395
- Outros materiais educativos: [Simuladores (Quiz ao vivo)](https://github.com/wcmendes/simuladores)

## 📄 Licença de uso

Material educacional para fins acadêmicos. Reprodução, adaptação e distribuição permitidas, desde que seja dado o devido crédito ao autor. Veja o arquivo [LICENSE](LICENSE).
