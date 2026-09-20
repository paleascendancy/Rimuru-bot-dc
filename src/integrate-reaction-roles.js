import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!source.includes("from './reaction-roles.js'")) {
  source = source.replace(
    "import 'dotenv/config';",
    "import 'dotenv/config';\nimport { setupReactionRoles, handleReactionRoleAdd, handleReactionRoleRemove } from './reaction-roles.js';"
  );
  changed = true;
}

if (!source.includes('GatewayIntentBits.GuildMessageReactions')) {
  source = source.replace(
    'intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],',
    'intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions],'
  );
  changed = true;
}

if (!source.includes('Partials.Reaction')) {
  source = source.replace(
    'partials: [Partials.GuildMember]',
    'partials: [Partials.GuildMember, Partials.Message, Partials.Channel, Partials.Reaction]'
  );
  changed = true;
}

if (!source.includes('await setupReactionRoles(guild, client)')) {
  source = source.replace(
    'async function setupGuild(guild) {',
    "async function setupGuild(guild) {\n  await setupReactionRoles(guild, client).catch((error) => {\n    console.error(`Falha ao preparar cargos em ${guild.name}:`, error);\n  });\n"
  );
  changed = true;
}

if (!source.includes('Events.MessageReactionAdd')) {
  const handlers = [
    "client.on(Events.MessageReactionAdd, async (reaction, user) => {",
    "  try {",
    "    await handleReactionRoleAdd(reaction, user);",
    "  } catch (error) {",
    "    console.error('Falha ao processar adição de cargo por reação:', error);",
    "  }",
    "});",
    "",
    "client.on(Events.MessageReactionRemove, async (reaction, user) => {",
    "  try {",
    "    await handleReactionRoleRemove(reaction, user);",
    "  } catch (error) {",
    "    console.error('Falha ao processar remoção de cargo por reação:', error);",
    "  }",
    "});",
    "",
    ""
  ].join('\n');

  source = source.replace('client.on(Events.Error, (error) => {', handlers + 'client.on(Events.Error, (error) => {');
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, source);
  console.log('Reaction roles integration: index.js preparado.');
} else {
  console.log('Reaction roles integration: já aplicada.');
}
