import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes("from './generic-guild.js'")) {
  source = source.replace(
    "import 'dotenv/config';",
    "import 'dotenv/config';\nimport { isGenericGuild } from './guild-profile.js';\nimport { createBotInvite, setupGenericGuild, handleGenericMemberAdd, handleGenericInteraction } from './generic-guild.js';"
  );
  changed = true;
}

if (!source.includes('await setupGenericGuild(guild, client)')) {
  source = source.replace(
    'async function setupGuild(guild) {',
    "async function setupGuild(guild) {\n  if (isGenericGuild(guild)) {\n    await setupGenericGuild(guild, client).catch((error) => {\n      console.error('[MULTI] Falha ao preparar ' + guild.name + ':', error);\n    });\n    return;\n  }"
  );
  changed = true;
}

if (!source.includes('await handleGenericMemberAdd(member, client)')) {
  source = source.replace(
    'client.on(Events.GuildMemberAdd, async (member) => {\n  try {',
    "client.on(Events.GuildMemberAdd, async (member) => {\n  try {\n    if (isGenericGuild(member.guild)) {\n      await handleGenericMemberAdd(member, client);\n      return;\n    }"
  );
  changed = true;
}

if (!source.includes('await handleGenericInteraction(interaction, client)')) {
  source = source.replace(
    '    if (!interaction.inGuild()) return;',
    '    if (!interaction.inGuild()) return;\n\n    if (await handleGenericInteraction(interaction, client)) return;'
  );
  changed = true;
}

if (!source.includes('[INVITE]')) {
  source = source.replace(
    "  client.user.setActivity('MangaMorph');",
    "  client.user.setActivity('Rimuru • /rimuru ajuda');\n\n  createBotInvite(client)\n    .then((invite) => console.log('[INVITE] ' + invite))\n    .catch((error) => console.error('[INVITE] Falha ao gerar convite:', error));"
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, source, 'utf8');
  console.log('[MULTI] Proteção multi-servidor integrada ao runtime.');
} else {
  console.log('[MULTI] Proteção multi-servidor já integrada.');
}
