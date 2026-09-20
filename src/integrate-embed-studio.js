import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes("from './embed-studio.js'")) {
  source = source.replace(
    "import 'dotenv/config';",
    "import 'dotenv/config';\nimport { setupEmbedStudio, handleEmbedStudioInteraction } from './embed-studio.js';"
  );
  changed = true;
}

if (!source.includes('await setupEmbedStudio(guild)')) {
  const liveBlock = `  await setupLivePreview(guild, client).catch((error) => {\n    console.error(\`Falha ao registrar editor visual em \${guild.name}:\`, error);\n  });\n`;
  const studioBlock = `\n  await setupEmbedStudio(guild).catch((error) => {\n    console.error(\`Falha ao registrar Embed Studio em \${guild.name}:\`, error);\n  });\n`;

  if (source.includes(liveBlock)) source = source.replace(liveBlock, liveBlock + studioBlock);
  else source = source.replace('async function setupGuild(guild) {', `async function setupGuild(guild) {\n${studioBlock}`);
  changed = true;
}

if (!source.includes('await handleEmbedStudioInteraction(interaction)')) {
  source = source.replace(
    '    if (!interaction.inGuild()) return;',
    '    if (!interaction.inGuild()) return;\n\n    if (await handleEmbedStudioInteraction(interaction)) return;'
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, source, 'utf8');
  console.log('[EMBED-STUDIO] Painel profissional integrado ao index.js.');
} else {
  console.log('[EMBED-STUDIO] Painel profissional já integrado.');
}
