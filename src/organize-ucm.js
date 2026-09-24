import 'dotenv/config';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;
const UCM_GUILD_ID = '1155332928755224678';

if (!DISCORD_TOKEN) {
  console.error('[UCM-LAYOUT] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const CATEGORY_DEFS = [
  { key: 'inicio', name: '「 UCM 」 INÍCIO' },
  { key: 'comunidade', name: '「 UCM 」 COMUNIDADE' },
  { key: 'projetos', name: '「 UCM 」 PROJETOS' },
  { key: 'staff', name: '「 UCM 」 STAFF' }
];

const CHANNEL_DEFS = [
  { aliases: ['bemvindo', 'boasvindas'], name: '👋・boas-vindas', category: 'inicio' },
  { aliases: ['saida', 'saidas'], name: '🚪・saídas', category: 'inicio' },
  { aliases: ['ticket', 'abrirticket'], name: '🎫・abrir-ticket', category: 'inicio' },

  { aliases: ['chatgeral', 'geral'], name: '💬・chat-geral', category: 'comunidade' },
  { aliases: ['midia', 'media'], name: '🖼️・mídia', category: 'comunidade' },
  { aliases: ['sugestoes', 'sugestao'], name: '💡・sugestões', category: 'comunidade' },

  { aliases: ['modelos', 'modelo'], name: '🧩・modelos', category: 'projetos' },
  { aliases: ['divulgacao'], name: '📣・divulgação', category: 'projetos' },
  { aliases: ['artes', 'arte'], name: '🎨・artes', category: 'projetos' },
  { aliases: ['construcoes', 'construcao'], name: '🧱・construções', category: 'projetos' },

  { aliases: ['moderacao', 'mod'], name: '🛡️・moderação', category: 'staff' }
];

function findReusableCategory(channels, key) {
  const wanted = normalize(key);
  return channels.find((channel) => {
    if (channel?.type !== ChannelType.GuildCategory) return false;
    const name = normalize(channel.name);
    return name === wanted ||
      name === `ucm${wanted}` ||
      name.endsWith(wanted);
  }) || null;
}

function findTargetChannel(channels, aliases) {
  const wanted = new Set(aliases.map(normalize));
  return channels.find((channel) => {
    if (!channel || channel.type === ChannelType.GuildCategory) return false;
    return wanted.has(normalize(channel.name));
  }) || null;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(UCM_GUILD_ID).catch(() => null);
    if (!guild) {
      console.log('[UCM-LAYOUT] Servidor UCM não encontrado.');
      return;
    }

    let channels = await guild.channels.fetch();
    const categories = new Map();
    let created = 0;
    let renamed = 0;
    let moved = 0;
    let removedEmpty = 0;

    for (let index = 0; index < CATEGORY_DEFS.length; index += 1) {
      const definition = CATEGORY_DEFS[index];
      let category = findReusableCategory(channels, definition.key);

      if (!category) {
        category = await guild.channels.create({
          name: definition.name,
          type: ChannelType.GuildCategory,
          reason: 'Organização visual solicitada para o UCM Studios'
        });
        created += 1;
      } else if (category.name !== definition.name) {
        await category.setName(definition.name, 'Padronização visual do UCM Studios');
        renamed += 1;
      }

      await category.setPosition(index).catch(() => {});
      categories.set(definition.key, category);
      channels = await guild.channels.fetch();
    }

    for (const definition of CHANNEL_DEFS) {
      channels = await guild.channels.fetch();
      const channel = findTargetChannel(channels, definition.aliases);
      if (!channel) {
        console.log(`[UCM-LAYOUT] Canal não encontrado para: ${definition.name}`);
        continue;
      }

      const targetCategory = categories.get(definition.category);
      if (channel.name !== definition.name) {
        await channel.setName(definition.name, 'Padronização visual do UCM Studios');
        renamed += 1;
      }

      if (targetCategory && channel.parentId !== targetCategory.id) {
        await channel.setParent(targetCategory.id, {
          lockPermissions: false,
          reason: 'Organização em quatro categorias do UCM Studios'
        });
        moved += 1;
      }

      console.log(`[UCM-LAYOUT] ${channel.name} → ${targetCategory?.name || definition.category}`);
    }

    channels = await guild.channels.fetch();
    const protectedIds = new Set([...categories.values()].map((category) => category.id));

    for (const category of channels.filter((channel) => channel?.type === ChannelType.GuildCategory).values()) {
      if (protectedIds.has(category.id)) continue;

      const children = channels.filter((channel) => channel?.parentId === category.id);
      if (children.size > 0) {
        console.log(`[UCM-LAYOUT] Categoria preservada por conter canais não mapeados: ${category.name}`);
        continue;
      }

      await category.delete('Remoção de categoria vazia após reorganização do UCM Studios')
        .then(() => { removedEmpty += 1; })
        .catch((error) => {
          console.error(`[UCM-LAYOUT] Falha ao remover categoria vazia ${category.name}:`, error.message);
        });
    }

    const finalChannels = await guild.channels.fetch();
    const remainingCategories = finalChannels
      .filter((channel) => channel?.type === ChannelType.GuildCategory)
      .map((channel) => channel.name);

    console.log(
      `[UCM-LAYOUT] Concluído: categorias criadas=${created}, itens renomeados=${renamed}, canais movidos=${moved}, categorias vazias removidas=${removedEmpty}.`
    );
    console.log(`[UCM-LAYOUT] Categorias finais: ${remainingCategories.join(' | ')}`);
  } catch (error) {
    console.error('[UCM-LAYOUT] Falha ao organizar o servidor:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
