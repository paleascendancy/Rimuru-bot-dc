import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes("from './mangamorph-webhooks.js'")) {
  source = source.replace(
    "import 'dotenv/config';",
    "import 'dotenv/config';\nimport { setupMangaMorphWebhookTools, handleMangaMorphWebhookInteraction } from './mangamorph-webhooks.js';"
  );
  changed = true;
}

if (!source.includes('await setupMangaMorphWebhookTools(guild)')) {
  const proBlock = `  await setupMangaMorphProTools(guild).catch((error) => {\n    console.error(\`Falha ao registrar ferramentas avançadas em \${guild.name}:\`, error);\n  });\n`;
  const webhookBlock = `  await setupMangaMorphWebhookTools(guild).catch((error) => {\n    console.error(\`Falha ao registrar webhooks de embed em \${guild.name}:\`, error);\n  });\n`;

  if (source.includes(proBlock)) {
    source = source.replace(proBlock, proBlock + webhookBlock);
  } else {
    source = source.replace('async function setupGuild(guild) {', `async function setupGuild(guild) {\n${webhookBlock}`);
  }
  changed = true;
}

if (!source.includes('await handleMangaMorphWebhookInteraction(interaction, client)')) {
  const proHandler = '    if (await handleMangaMorphProToolsInteraction(interaction, client)) return;';
  const webhookHandler = '    if (await handleMangaMorphWebhookInteraction(interaction, client)) return;\n\n';

  if (source.includes(proHandler)) {
    source = source.replace(proHandler, webhookHandler + proHandler);
  } else {
    source = source.replace(
      '    if (!interaction.inGuild()) return;',
      '    if (!interaction.inGuild()) return;\n\n    if (await handleMangaMorphWebhookInteraction(interaction, client)) return;'
    );
  }
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, source, 'utf8');
  console.log('[MM-WEBHOOK] Ferramentas de webhook integradas ao index.js.');
} else {
  console.log('[MM-WEBHOOK] Ferramentas de webhook já integradas.');
}
