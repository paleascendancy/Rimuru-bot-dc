import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const welcomePath = path.join(__dirname, 'welcome-manager.js');

let source = fs.readFileSync(welcomePath, 'utf8');
let changed = false;

const oldContent = "    content: replaceTokens(config.content, member, { allowMention: true }) || undefined,";
const newContent = "    content: [config.mention ? `<@${member.id}>` : '', replaceTokens(config.content, member, { allowMention: true })].filter(Boolean).join(' ') || undefined,";

if (source.includes(oldContent)) {
  source = source.replace(oldContent, newContent);
  changed = true;
}

if (changed) {
  fs.writeFileSync(welcomePath, source, 'utf8');
  console.log('[WELCOME] Menção real do novo membro ativada fora do embed.');
} else if (source.includes(newContent)) {
  console.log('[WELCOME] Correção de menção já aplicada.');
} else {
  console.warn('[WELCOME] Não foi possível localizar o payload para aplicar a correção de menção.');
}
