import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes("from './mangamorph-admin.js'")) {
  source = source.replace(
    "import 'dotenv/config';",
    "import 'dotenv/config';\nimport { setupMangaMorphAdmin, handleMangaMorphAdminInteraction } from './mangamorph-admin.js';"
  );
  changed = true;
}

if (!source.includes('await setupMangaMorphAdmin(guild, client)')) {
  source = source.replace(
    'async function setupGuild(guild) {',
    "async function setupGuild(guild) {\n  await setupMangaMorphAdmin(guild, client).catch((error) => {\n    console.error(`Falha ao preparar recursos administrativos em ${guild.name}:`, error);\n  });\n"
  );
  changed = true;
}

if (!source.includes('await handleMangaMorphAdminInteraction(interaction, client)')) {
  source = source.replace(
    "    if (!interaction.inGuild()) return;",
    "    if (!interaction.inGuild()) return;\n\n    if (await handleMangaMorphAdminInteraction(interaction, client)) return;"
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, source, 'utf8');
  console.log('[MM-ADMIN] Integração administrativa aplicada ao index.js.');
} else {
  console.log('[MM-ADMIN] Integração administrativa já aplicada.');
}
