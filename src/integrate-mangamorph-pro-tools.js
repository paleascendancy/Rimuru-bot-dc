import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes("from './mangamorph-pro-tools.js'")) {
  source = source.replace(
    "import 'dotenv/config';",
    "import 'dotenv/config';\nimport { setupMangaMorphProTools, handleMangaMorphProToolsInteraction } from './mangamorph-pro-tools.js';"
  );
  changed = true;
}

if (!source.includes('await setupMangaMorphProTools(guild)')) {
  const adminBlock = `  await setupMangaMorphAdmin(guild, client).catch((error) => {\n    console.error(\`Falha ao preparar recursos administrativos em \${guild.name}:\`, error);\n  });\n`;
  const proBlock = `  await setupMangaMorphProTools(guild).catch((error) => {\n    console.error(\`Falha ao registrar ferramentas avançadas em \${guild.name}:\`, error);\n  });\n`;

  if (source.includes(adminBlock)) {
    source = source.replace(adminBlock, adminBlock + proBlock);
  } else {
    source = source.replace('async function setupGuild(guild) {', `async function setupGuild(guild) {\n${proBlock}`);
  }
  changed = true;
}

if (!source.includes('await handleMangaMorphProToolsInteraction(interaction, client)')) {
  source = source.replace(
    '    if (!interaction.inGuild()) return;',
    '    if (!interaction.inGuild()) return;\n\n    if (await handleMangaMorphProToolsInteraction(interaction, client)) return;'
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, source, 'utf8');
  console.log('[MM-PRO] Ferramentas avançadas integradas ao index.js.');
} else {
  console.log('[MM-PRO] Ferramentas avançadas já integradas.');
}
