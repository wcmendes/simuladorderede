# Prompt para o Kiro: LabRedes v3 (abas da aula interativa)

## 1. Contexto

Este é um **complemento**. O projeto LabRedes já existe neste repositório (Vite + React + TypeScript + Firebase: Hosting, Firestore e Auth anônima) e você já está fazendo, ou já fez, a parte de **máscara de rede**.
- **Não mexa** na área de máscara nem no que já funciona: entrada do aluno, painel do professor (`/professor`), terminal simulado, `firestore.rules`.
- **Não recrie o projeto.** Reaproveite os componentes, as cores e o estilo que já existem.
- O app é **neutro**: vou usá-lo em mais de uma instituição. Não coloque nome de faculdade, instituto ou escola em lugar nenhum (veja a limpeza final, na seção 4).

Sou professor de Redes de Computadores num curso superior de tecnologia. As próximas aulas são **online, pelo Meet**, e cada aluno usa o próprio computador ou celular.

**Anexei o arquivo `prototipo-aula-interativa.html`**: um protótipo pronto, testado e aprovado, com 4 abas para os temas da aula:
- TCP × UDP;
- Portas;
- Sem internet? (diagnóstico);
- Nuvem (IaaS, PaaS, SaaS).

Abra o arquivo e **porte para React mantendo o visual, os textos e a lógica**. Use as mesmas cores da área de máscara: azul `#2459C4`, laranja `#C65A12`, vermelho `#e4002b`. A interface fica em português do Brasil; termos técnicos (ACK, gateway, DNS) ficam em inglês.

## 2. O que fazer, em ordem de prioridade

Entregue cada prioridade **funcionando e publicada** (`firebase deploy`) antes de começar a próxima.

### P0. As 4 abas (porte do protótipo)

Crie a área **"Aula interativa"** na tela do aluno, com as 4 abas. Ela funciona também **sem entrar numa sessão**, em `/aula`, e cada aba tem o seu hash (`/aula#tcp-udp`, `#portas`, `#diagnostico`, `#nuvem`), para eu mandar o link direto de uma aba no chat do Meet.

1. **TCP × UDP**
   - Controle de perda de pacotes de 0 a 40% e o botão "Enviar 10 pacotes".
   - Duas pistas lado a lado (Cliente → Servidor).
   - **TCP:** primeiro o aperto de mão animado (SYN → SYN-ACK ← ACK →). Depois, cada pacote só sai quando chega o ACK do anterior. O pacote perdido some no meio do caminho e é **reenviado**, com a mensagem "Pacote N perdido: o TCP percebe e reenvia…".
   - **UDP:** os 10 pacotes saem em rajada. Os perdidos ficam como buracos vermelhos na fileira de chegada.
   - No fim, o resumo de cada pista: "Chegaram X de 10", número de reenvios e tempo.
   - Os quadros "O que observar" e "Qual combina com cada uso?" iguais ao protótipo.
2. **Portas**
   - O IP é o prédio, a porta é o apartamento.
   - Encaixar SSH 22, DNS 53, HTTP 80, HTTPS 443, FTP 21 e SMTP 25 nas portas, por arrastar e soltar **ou por toque** (toca no serviço, depois na porta), porque no celular não há arrastar.
   - Acertou: a porta fica verde e mostra o protocolo (TCP/UDP) e para que serve. Errou: a porta balança e diz "X não mora aqui".
   - Placar "N de 6" e o botão "Embaralhar de novo".
3. **Sem internet? (diagnóstico)**
   - Um PC com **defeito sorteado e escondido**: cabo/placa, gateway, provedor ou DNS.
   - Topologia no topo: PC → Roteador 192.168.0.1 → Provedor → Internet 8.8.8.8 · DNS 192.168.0.10.
   - Botões de comando: `ipconfig`, `ping 192.168.0.1`, `ping 8.8.8.8`, `nslookup www.exemplo.com.br`, `ping www.exemplo.com.br`, `tracert -d 8.8.8.8`. Cada clique mostra num terminal escuro a saída realista do **Windows em português**, de acordo com o defeito. Copie as saídas exatas do protótipo.
   - O aluno escolhe o defeito e recebe a explicação e quantos comandos usou ("Diagnóstico de profissional!" com 3 ou menos e acerto).
   - Placar e o botão "Outro computador". Um `<details>` "Como pensar" com a regra de baixo para cima.
4. **Nuvem**
   - 10 serviços em ordem aleatória: Gmail, Google Drive, Netflix, Microsoft 365 (SaaS); VM na AWS EC2, Azure Virtual Machines, servidor Linux na Oracle Cloud (IaaS); Heroku/Vercel, Firebase Hosting, Google App Engine (PaaS).
   - O aluno classifica em IaaS, PaaS ou SaaS, recebe a correção com a explicação e o serviço vai para a coluna certa (em vermelho se errou).
   - O quadro com a analogia da pizza. Placar e o botão "Recomeçar".

**Código:** os dados e regras (lista de portas, saídas dos comandos por defeito, lista de serviços de nuvem) ficam em `src/sim/aula.ts`, puros, com testes Vitest:
- defeito **DNS**: `ping 8.8.8.8` responde e `nslookup` dá tempo esgotado;
- defeito **gateway**: `ping 192.168.0.1` dá "Esgotado o tempo limite";
- defeito **provedor**: o gateway responde, o 8.8.8.8 não, e o `tracert` para depois do 192.168.0.1;
- defeito **cabo**: o `ipconfig` mostra "mídia desconectada" e o `ping` dá "Falha geral";
- cada serviço de nuvem e cada porta têm a resposta certa.

### P1. Pontos no ranking da turma (se o ranking já existir)

Se o ranking da sessão já foi feito na etapa anterior, some os acertos destas abas a ele. Grave uma vez por resposta em `sessions/{sid}/scores/{uid}`, nos campos `portas`, `diagnostico` (com a média de comandos usados) e `nuvem`.

No painel do professor, mostre o percentual de acerto por atividade e, no diagnóstico, qual defeito a turma mais erra. Se o ranking ainda não existe, pule este item.

### P2. Diagnóstico ao vivo, comandado pelo professor (se sobrar tempo)

No painel do professor, um botão **"Defeito para todos"** sorteia **o mesmo defeito** para todos os alunos da sessão. Quando todos responderem (ou eu clicar em "Revelar"), aparecem para a turma:
- o defeito certo;
- quantos acertaram;
- a média de comandos usados.

## 3. Critérios de aceite

- As 4 abas ficam visualmente iguais ao protótipo e se comportam como ele.
- Funciona em celular: o aluno pode estar no Meet pelo computador e mexer pelo celular. "Portas" funciona só com toques.
- A área de máscara continua funcionando exatamente como antes.
- Nenhum texto vindo de aluno vira HTML.
- Antes de terminar, rode os testes e o build e confirme que não há erros de TypeScript. Atualize o `README.md` com os links das abas (`/aula#tcp-udp` etc.) e como usar cada uma em aula.

## 4. Limpeza final: app sem nome de instituição

Faça isto **por último**, depois de tudo pronto, e antes do último `firebase deploy`. O app vai ser usado em várias instituições, então não pode ter o nome de nenhuma.

1. Procure em **todo o repositório** (código, textos da interface, dados simulados, testes, `README.md`, `index.html`, `<title>`, manifest, favicon, metadados e configuração do Firebase que apareçam na tela) por nomes de instituição. Busque sem diferenciar maiúsculas e minúsculas, no mínimo por:
   - `edufor`, `faculdade`, `ifma`, `instituto federal`, `universidade`, `campus`;
   - qualquer domínio institucional (`.edu.br` que não seja de exemplo);
   - nomes de professores ou de cursos de uma instituição específica.
2. Troque tudo por termos genéricos:
   - **sites e hosts:** `www.exemplo.com.br`, `dns.lab.local`, `srv.lab.local`;
   - **nome do app:** "LabRedes" ou "Laboratório de Redes";
   - **rodapés ou créditos:** nada de instituição.
3. Dados de rede fictícios continuam fictícios e genéricos (192.168.0.x, 10.0.0.x, 8.8.8.8). Nada que identifique a rede real de uma instituição.
4. Rode a busca de novo e **mostre no final a lista do que foi trocado**, arquivo por arquivo, e a confirmação de que a busca não encontra mais nenhum nome de instituição.
5. Rode os testes e o build de novo depois da limpeza.
