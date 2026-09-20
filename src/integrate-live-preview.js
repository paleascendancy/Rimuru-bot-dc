import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes("from './live-preview.js'")) {
  source = source.replace(
    "import 'dotenv/config';",
    "import 'dotenv/config';\nimport { setupLivePreview, handleLivePreviewInteraction } from './live-preview.js';"
  );
  changed = true;
}

if (!source.includes('await setupLivePreview(guild, client)')) {
  const ticketBlock = `  await ensureTicketPanel(guild).catch((error) => {\n    console.error(\`Falha ao preparar suporte em \${guild.name}:\`, error);\n  });\n`;
  const previewBlock = `\n  await setupLivePreview(guild, client).catch((error) => {\n    console.error(\`Falha ao registrar editor visual em \${guild.name}:\`, error);\n  });\n`;
  if (source.includes(ticketBlock)) source = source.replace(ticketBlock, ticketBlock + previewBlock);
  else source = source.replace('async function setupGuild(guild) {', `async function setupGuild(guild) {\n${previewBlock}`);
  changed = true;
}

if (!source.includes('await handleLivePreviewInteraction(interaction, client)')) {
  source = source.replace(
    '    if (!interaction.inGuild()) return;',
    '    if (!interaction.inGuild()) return;\n\n    if (await handleLivePreviewInteraction(interaction, client)) return;'
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, source, 'utf8');
  console.log('[LIVE-PREVIEW] Editor visual integrado ao index.js.');
} else {
  console.log('[LIVE-PREVIEW] Editor visual já integrado.');
}
