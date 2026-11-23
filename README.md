# 🖧 LabRedes — Rede simulada da turma

Simulador de rede **multiplayer** para a disciplina de **Redes de Computadores**. Cada aluno abre um link no navegador e vira um "computador" de uma rede compartilhada pela turma inteira. Os alunos digitam comandos de rede num terminal falso, pingam colegas, publicam sites fictícios e os descobrem por DNS — e o professor liga e desliga falhas (DNS fora, provedor caído, gateway de sub-rede fora, perda de pacotes) em tempo real, para criar exercícios de diagnóstico.

Feito com **Vite + React + TypeScript**, com o motor da simulação em TypeScript puro e testado (Vitest). Usa **Firebase Firestore** para o estado ao vivo, **Firebase Hosting** para publicar e **Auth anônimo** (um documento por navegador, sem cadastro).

🔗 **Acesse:** https://simuladorderede.web.app

- 🏠 **Tela inicial (passe este link à turma):** https://simuladorderede.web.app. Explica o que fazer e leva a cada área; tem o link para a área do professor.
- 👩‍🏫 **Professor:** https://simuladorderede.web.app/professor
- 📱 **Entrar na rede (terminal):** https://simuladorderede.web.app/entrar
- 🧮 **Máscara de rede (estudo sozinho, sem sessão):** https://simuladorderede.web.app/mascara
- 🎓 **Aula interativa (sem sessão):** https://simuladorderede.web.app/aula
  - TCP × UDP: https://simuladorderede.web.app/aula#tcp-udp
  - Portas: https://simuladorderede.web.app/aula#portas
  - Sem internet? (diagnóstico): https://simuladorderede.web.app/aula#diagnostico
  - Nuvem: https://simuladorderede.web.app/aula#nuvem
- ❓ **Ajuda:** https://simuladorderede.web.app/ajuda

Os endereços funcionam com ou sem `#` (`/professor` e `#/professor` abrem o mesmo painel).

## 🎯 O que a atividade cobre

Acompanha a Prática 1 (diagnóstico de rede no Windows, endereçamento IP e criação de VM no VirtualBox):

- **Comandos Windows** — `ipconfig`, `ping`, `tracert`, `nslookup`, `arp -a`, `route print`, `netstat -an`, `hostname`, `getmac`, `curl`/`navegar`.
- **Endereçamento** — CIDR, rede, broadcast, faixa de hosts, cálculo de sub-redes (/24, /25, /26).
- **Diagnóstico** — identificar, só pelos comandos, qual falha o professor ativou (DNS, gateway, provedor).
- **Sub-redes** — os alunos são distribuídos por sub-redes conforme o nº do computador, mostrando "mais de um gateway" na prática.
- **Máquina Virtual** — assistente do VirtualBox, modos de rede (NAT/Host-only/Bridge) e console Linux simulados.
- **Máscara de rede** — ferramenta bit a bit (aba "Máscara"), com o método do "salto" usado em aula, e Desafio com ranking da turma.
- **Revisão para a prova** — quiz ao vivo estilo Kahoot, com o conjunto pronto "Revisão Redes 2026.2".

## 🕹️ Como funciona

**Sessão padrão:** ao entrar em `/professor`, o painel abre sozinho a sessão com código **AULA** (cria se não existir). O aluno já vê `AULA` preenchido. Só o navegador que a criou a controla; em outro aparelho, crie uma sessão com outro código. O número do computador do aluno é opcional: em branco, segue a ordem de chegada.

1. O **professor** acessa o painel, escolhe o modo de rede (/24, /25 ou /26) e cria a sessão. Recebe um **código** (ex.: `REDES0411`) e um **QR Code em tela cheia** para projetar.
2. O **aluno** entra com código + nome + número do computador. Recebe automaticamente IP, máscara, gateway, DNS, MAC e hostname (`PC-joao-12`), alocados sem repetir por transação do Firestore.
3. Os alunos usam o **terminal**: pingam colegas (que recebem uma notificação na tela), publicam sites (`site criar padaria`) e os descobrem com `nslookup` e `tracert`.
4. O professor liga **falhas na rede** em tempo real e acompanha o **feed ao vivo** das interações, a lista de alunos online e o progresso da Prática 1.

## 🔀 Mover alunos de sub-rede (professor)

Na aba **Painel**, a coluna **Nº do PC** é editável: mude o número (1 a 40) e clique em **Salvar**. A sub-rede sai da mesma regra da entrada (no /25: 1–20 sub-rede 1, 21–40 sub-rede 2; no /26: de 10 em 10). Se a sub-rede muda, o aluno recebe um IP novo, com a máscara, o gateway e o hostname (`PC-nome-NN`) da nova sub-rede, e o IP antigo não é reaproveitado. A tela do aluno atualiza sozinha, mostra o aviso e limpa o cache ARP. O botão **Dividir a turma ao meio** (no /26, em 4 partes) redistribui os alunos online em sequência (1, 2, 3… e 21, 22, 23…). Só o dono da sessão altera esses campos (veja `firestore.rules`).

## 🧮 Aba Máscara

Ferramenta "Máscara de rede, bit a bit", com 4 sub-abas: **Calcular** (32 bits coloridos, passo a passo e régua de blocos), **Mesma rede?** (destaca o primeiro bit de rede diferente), **Dividir em sub-redes** (2, 4, 8 ou 16) e **Desafio** (perguntas aleatórias com correção pelo truque do salto). Azul = rede, laranja = host, vermelho = destaque.

Dentro de uma sessão ela é a aba **Máscara** da tela do aluno. Fora de sessão, o aluno estuda em casa em `/mascara`, sem login. Nesse modo o placar fica só no navegador dele.

## 🎓 Aula interativa (TCP × UDP, Portas, Sem internet?, Nuvem)

Quatro abas para a aula online. Cada aba tem o seu link, para colar direto no chat do Meet (links acima). Em `/aula` o aluno usa as abas sem código e sem número de computador. Se digitar nome e sobrenome no topo, entra na sessão única **AULA** e o professor passa a ver o progresso dele, identificado. Sem nome, nada é registrado. Dentro de uma sessão também é a aba **Aula interativa** da tela do aluno. Funciona no celular.

- **TCP × UDP** (`/aula#tcp-udp`): ajuste a perda de pacotes (0 a 40%) e clique em **Enviar 10 pacotes**. Peça que a turma compare as duas pistas com 0% e depois com 40%: o TCP faz o aperto de mão, espera cada ACK e reenvia o perdido; o UDP sai em rajada e deixa buracos vermelhos.
- **Portas** (`/aula#portas`): encaixe SSH 22, DNS 53, HTTP 80, HTTPS 443, FTP 21 e SMTP 25. No computador, arraste; no celular, toque no serviço e depois na porta. Acertou: a porta fica verde com o protocolo e a função. Errou: ela balança.
- **Sem internet?** (`/aula#diagnostico`): um PC com defeito escondido (cabo/placa, gateway, provedor ou DNS). Os alunos rodam os comandos, de baixo para cima, e escolhem o defeito. Ganha o "Diagnóstico de profissional!" quem acerta com 3 comandos ou menos.
- **Nuvem** (`/aula#nuvem`): classificar 10 serviços em IaaS, PaaS ou SaaS, com a analogia da pizza.

**Nova turma:** no painel, **Resetar (nova turma)** apaga alunos e placares e abre uma sessão AULA nova. Quem estava com a página aberta volta sozinho, com o nome salvo, sem herdar o placar da turma anterior. A sessão AULA precisa ter sido aberta uma vez em `/professor` antes dos alunos entrarem.

**Ranking e diagnóstico ao vivo (quando o aluno está na sessão).** Cada resposta de Portas, Sem internet? e Nuvem grava o placar do aluno no mesmo documento do ranking (`sessions/{sid}/scores/{uid}`, campos `portas`, `diagnostico` com a média de comandos, e `nuvem`). Na aba **Ranking** do painel do professor:

1. Os acertos da aula somam no ranking (coluna **Aula**).
2. A tabela **Por aluno** mostra, com nome, os acertos em Portas, Diagnóstico (com a média de comandos) e Nuvem.
3. Aparecem o percentual de acerto por atividade, a média de comandos e qual defeito a turma mais erra.
4. **Defeito para todos** sorteia o mesmo defeito para todos os alunos. Quando todos os alunos online respondem, ou quando você clica em **Revelar**, a turma vê o defeito certo, quantos acertaram e a média de comandos. **Encerrar** devolve a aba ao modo livre.

## 🏆 Ranking do Desafio em aula

Dentro de uma sessão, cada resposta do Desafio grava o placar do aluno (acertos, tentativas, sequência e acertos por tipo). No painel do professor, aba **Ranking**:

1. **Ranking:** lista ordenada por acertos (empate pelo menor número de tentativas), atualizada em tempo real, e o **percentual de acerto da turma por tipo** (rede, broadcast, hosts, mesma rede), para ver onde a turma erra mais.
2. **Modo projetor:** os 10 primeiros em letras grandes, para compartilhar a tela no Meet. `Esc` fecha.
3. **Rodada:** escolha o tipo (ex.: só broadcast) e a dificuldade (fácil = /24 e /16; médio = /25 a /27) e clique em **Iniciar rodada**. Todos os alunos recebem um aviso, são levados ao Desafio e passam a receber só esse tipo de pergunta, até você clicar em **Encerrar rodada**.
4. **Zerar ranking:** apaga o placar de todos (com confirmação) e reinicia a contagem no navegador de cada aluno.

## 🎯 Quiz ao vivo (revisão)

No painel do professor, aba **Quiz**:

1. Cole as perguntas, uma por bloco separado por linha em branco. A primeira linha é a pergunta, as outras são as alternativas (2 a 6) e a correta começa com `*`:

   ```
   Qual camada do OSI cuida do endereço IP?
   *Rede
   Enlace
   Transporte
   Aplicação
   ```

   Ou clique em **Carregar "Revisão Redes 2026.2"** (22 perguntas prontas). Com **Embaralhar** marcado, a posição da resposta certa muda a cada pergunta.
2. Clique em **Iniciar quiz**, depois em **Próxima pergunta** a cada rodada. Todos os alunos da sessão veem a pergunta ao mesmo tempo, em tela cheia, com botões grandes coloridos e cronômetro de 30 s.
3. Cada aluno responde **uma vez** (a primeira resposta vale; recarregar a página não permite trocar). Quando o tempo acaba, a resposta é revelada sozinha. Você também pode clicar em **Revelar** antes.
4. Na revelação, todos veem a alternativa certa e quantos marcaram cada uma. A pontuação vai até 1000 por pergunta: 500 pelo acerto mais até 500 pela rapidez. O **ranking geral** aparece na sua tela e no **Modo projetor**.
5. **Reiniciar** apaga as respostas para começar de novo. O texto das perguntas fica salvo no seu navegador.

Cada aluno escuta só um documento (`quiz/state`) e grava a própria resposta. Só o professor lê todas as respostas e agrega o placar, o que mantém 40 alunos dentro do plano gratuito: as 22 perguntas custam cerca de 3.500 leituras e 900 gravações, contra o limite de 50 mil e 20 mil por dia.

## 🔧 Desafio de diagnóstico ("rede quebrada")

Na aba **Diagnóstico** do painel, **Sortear falha e iniciar** liga uma falha escondida para toda a turma: DNS, gateway, provedor ou cabo/placa de rede. Os alunos veem uma faixa sobre o terminal, só conseguem usar `ping`, `nslookup`, `tracert` e `ipconfig` (os outros comandos ficam bloqueados) e respondem num seletor.

- O ranking conta **acertos** e, no empate, vence quem usou **menos comandos** (só entram os comandos das rodadas que o aluno acertou).
- O gabarito fica escondido na sua tela (a tela pode estar projetada). **Encerrar rodada** revela a falha e, por padrão, desliga a falha.
- Como distinguir: o **DNS** falha só por nome; o **gateway** e o **provedor** falham por IP, e o `tracert` mostra onde o caminho para (no primeiro salto ou depois do `10.0.0.1`); o **cabo/placa** aparece no `ipconfig` como "mídia desconectada".

## 🗂️ Estrutura

| Pasta/arquivo | Função |
|---|---|
| `src/sim/net.ts` | Endereçamento IPv4, sub-redes e topologia do laboratório. |
| `src/sim/routing.ts` | Caminhos/saltos (usados por `tracert` e pelo TTL do `ping`). |
| `src/sim/dns.ts` | Resolução de nomes (direta e reversa). |
| `src/sim/engine.ts` | Processador dos comandos do terminal Windows. |
| `src/sim/pratica.ts` | Correção das Partes A e B da Prática 1. |
| `src/sim/vm.ts` | VM simulada (VirtualBox) e regras de alcance. |
| `src/sim/mascara.ts` | Cálculos de máscara, "truque do salto", dividir em sub-redes e perguntas do Desafio. |
| `src/sim/ranking.ts` | Placar do Desafio e agregações do professor. |
| `src/sim/quiz.ts`, `quizPronto.ts` | Leitura das perguntas coladas, pontuação do quiz e o conjunto "Revisão Redes 2026.2". |
| `src/sim/diag.ts` | Falhas do desafio de diagnóstico, comandos permitidos e ranking. |
| `src/sim/aula.ts` | Portas, saídas dos comandos por defeito, serviços de nuvem e placar da Aula interativa. |
| `src/ui/aula/` | Abas da Aula interativa (porte do protótipo `prototipo-aula-interativa.html`). |
| `src/ui/mascara/` | Aba Máscara (porte do protótipo em `docs/prototipo-mascara.html`). |
| `src/ui/prof/` | Abas do professor: Ranking, Quiz, Diagnóstico e modo projetor. |
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
- **Placar e quiz:** cada aluno escreve só o próprio placar (`ok` nunca maior que `total`); só o professor zera o ranking e escreve o estado do quiz. A resposta do quiz só pode ser criada uma vez, antes da revelação e para a pergunta em andamento.
- **Limite honesto:** é uma atividade de sala de aula. O tempo da resposta é medido no navegador do aluno, e as falhas do diagnóstico chegam ao navegador (o simulador precisa delas), então um aluno que abra as ferramentas do navegador pode trapacear. Para a presença e a nota, siga a folha em papel.

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
