import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes("from './pale.js'")) {
  source = source.replace(
    "import 'dotenv/config';",
    "import 'dotenv/config';\nimport { PALE_GUILD_ID, handlePaleInteraction, handlePaleMemberAdd } from './pale.js';\nimport { setupPaleRuntime } from './pale-runtime.js';\nimport { handlePaleCommunityInteraction, handlePaleCommunityReactionAdd, handlePaleCommunityReactionRemove } from './pale-community.js';"
  );
  changed = true;
} else {
  if (!source.includes("from './pale-runtime.js'")) {
    source = source.replace(
      "import { PALE_GUILD_ID, handlePaleInteraction, handlePaleMemberAdd } from './pale.js';",
      "import { PALE_GUILD_ID, handlePaleInteraction, handlePaleMemberAdd } from './pale.js';\nimport { setupPaleRuntime } from './pale-runtime.js';"
    );
    changed = true;
  }

  if (!source.includes("from './pale-community.js'")) {
    const anchor = "import { setupPaleRuntime } from './pale-runtime.js';";
    source = source.replace(
      anchor,
      `${anchor}\nimport { handlePaleCommunityInteraction, handlePaleCommunityReactionAdd, handlePaleCommunityReactionRemove } from './pale-community.js';`
    );
    changed = true;
  }
}

if (!source.includes('await setupPaleRuntime(guild)')) {
  source = source.replace(
    'async function setupGuild(guild) {',
    "async function setupGuild(guild) {\n  if (guild.id === PALE_GUILD_ID) {\n    await setupPaleRuntime(guild).catch((error) => {\n      console.error(`Falha ao preparar Pale Ascendancy:`, error);\n    });\n    return;\n  }"
  );
  changed = true;
}

if (!source.includes('await handlePaleMemberAdd(member)')) {
  source = source.replace(
    'client.on(Events.GuildMemberAdd, async (member) => {\n  try {',
    "client.on(Events.GuildMemberAdd, async (member) => {\n  try {\n    if (member.guild.id === PALE_GUILD_ID) {\n      await handlePaleMemberAdd(member);\n      return;\n    }"
  );
  changed = true;
}

if (!source.includes('await handlePaleCommunityInteraction(interaction)')) {
  source = source.replace(
    '    if (!interaction.inGuild()) return;',
    '    if (!interaction.inGuild()) return;\n\n    if (await handlePaleCommunityInteraction(interaction)) return;'
  );
  changed = true;
}

if (!source.includes('await handlePaleInteraction(interaction)')) {
  source = source.replace(
    '    if (!interaction.inGuild()) return;',
    '    if (!interaction.inGuild()) return;\n\n    if (await handlePaleInteraction(interaction)) return;'
  );
  changed = true;
}

if (!source.includes('handlePaleCommunityReactionAdd(reaction, user)')) {
  const listeners = `client.on(Events.MessageReactionAdd, async (reaction, user) => {\n  try {\n    await handlePaleCommunityReactionAdd(reaction, user);\n  } catch (error) {\n    console.error('Falha no cargo por reação da Pale Ascendancy:', error);\n  }\n});\n\nclient.on(Events.MessageReactionRemove, async (reaction, user) => {\n  try {\n    await handlePaleCommunityReactionRemove(reaction, user);\n  } catch (error) {\n    console.error('Falha ao remover cargo por reação da Pale Ascendancy:', error);\n  }\n});\n\n`;

  source = source.replace('client.on(Events.Error, (error) => {', `${listeners}client.on(Events.Error, (error) => {`);
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, source);
  console.log('Pale Ascendancy integration: index.js preparado.');
} else {
  console.log('Pale Ascendancy integration: já aplicada.');
}
