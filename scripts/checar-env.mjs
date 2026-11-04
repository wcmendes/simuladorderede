// Valida o arquivo .env antes do build/deploy e dá mensagens claras em pt-BR.
import { readFileSync, existsSync } from 'node:fs';

const OBRIGATORIAS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_PROF_PIN',
];

if (!existsSync('.env')) {
  console.error('\n❌ Arquivo .env não encontrado.');
  console.error('   Copie o .env.example para .env e preencha com a config do Firebase.');
  console.error('   Veja o passo 3 do README.md.\n');
  process.exit(1);
}

const texto = readFileSync('.env', 'utf8');
const valores = {};
for (const linha of texto.split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
  if (m) valores[m[1]] = m[2].trim();
}

const faltando = OBRIGATORIAS.filter((k) => !valores[k] || valores[k] === '');
if (faltando.length) {
  console.error('\n❌ Faltam preencher no .env:\n');
  for (const k of faltando) console.error('   - ' + k);
  console.error('\n   Pegue os valores em: Firebase → Configurações do projeto → Seus apps (ícone </>).');
  console.error('   O VITE_PROF_PIN você escolhe (ex.: 1234).\n');
  process.exit(1);
}

console.log('✅ .env preenchido. Projeto Firebase: ' + valores.VITE_FIREBASE_PROJECT_ID);
