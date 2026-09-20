import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes("from './welcome-manager.js'")) {
  source = source.replace(
    "import 'dotenv/config';",
    "import 'dotenv/config';\nimport { setupWelcomeManager, handleWelcomeManagerInteraction, sendConfiguredWelcome } from './welcome-manager.js';"
  );
  changed = true;
}

if (!source.includes('await setupWelcomeManager(guild, client)')) {
  source = source.replace(
    'async function setupGuild(guild) {',
    "async function setupGuild(guild) {\n  await setupWelcomeManager(guild, client).catch((error) => {\n    console.error(`Falha ao registrar boas-vindas em ${guild.name}:`, error);\n  });\n"
  );
  changed = true;
}

if (!source.includes('await handleWelcomeManagerInteraction(interaction, client)')) {
  source = source.replace(
    '    if (!interaction.inGuild()) return;',
    '    if (!interaction.inGuild()) return;\n\n    if (await handleWelcomeManagerInteraction(interaction, client)) return;'
  );
  changed = true;
}

if (!source.includes('const customWelcomeHandled = await sendConfiguredWelcome(member, client)')) {
  const startMarker = '    const welcomeChannel = await findTextChannel(\n      member.guild,';
  if (source.includes(startMarker)) {
    source = source.replace(
      startMarker,
      "    const customWelcomeHandled = await sendConfiguredWelcome(member, client).catch((error) => {\n      console.error('[WELCOME] Falha ao enviar boas-vindas personalizadas:', error);\n      return true;\n    });\n\n    if (!customWelcomeHandled) {\n" + startMarker
    );

    const endMarker = "    } else {\n      console.warn('Canal de boas-vindas não encontrado.');\n    }\n\n    await sendLog(member.guild, 'Novo membro'";
    if (source.includes(endMarker)) {
      source = source.replace(
        endMarker,
        "    } else {\n      console.warn('Canal de boas-vindas não encontrado.');\n    }\n    }\n\n    await sendLog(member.guild, 'Novo membro'"
      );
    }
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(indexPath, source, 'utf8');
  console.log('[WELCOME] Sistema personalizável integrado ao index.js.');
} else {
  console.log('[WELCOME] Sistema personalizável já integrado.');
}
