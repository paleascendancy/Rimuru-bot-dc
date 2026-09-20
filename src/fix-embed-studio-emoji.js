import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioPath = path.join(__dirname, 'embed-studio.js');

let source = fs.readFileSync(studioPath, 'utf8');
const before = source;

source = source
  .replace(".setEmoji('➤')", ".setEmoji('📤')")
  .replace(".setEmoji('➜')", ".setEmoji('📤')");

if (source !== before) {
  fs.writeFileSync(studioPath, source, 'utf8');
  console.log('[EMBED-STUDIO] Emoji inválido corrigido para 📤.');
} else {
  console.log('[EMBED-STUDIO] Correção de emoji já aplicada ou não necessária.');
}
