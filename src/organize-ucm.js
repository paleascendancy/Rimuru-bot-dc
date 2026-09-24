import 'dotenv/config';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;
const UCM_GUILD_ID = '1155332928755224678';

if (!DISCORD_TOKEN) {
  console.error('[UCM-LAYOUT] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const CATEGORY_IDS = {
  inicio: '1552561066788266034',
  comunidade: '1552561068549742674',
  projetos: '1552561070143709226',
  staff: '1552561072295120976'
};

const CATEGORY_NAMES = {
  inicio: '「 UCM 」 INÍCIO',
  comunidade: '「 UCM 」 COMUNIDADE',
  projetos: '「 UCM 」 PROJETOS',
  staff: '「 UCM 」 STAFF'
};

const TARGETS = [
  { id: '1155684648828014602', name: '📜・regras', category: 'inicio' },
  { id: '1155332929355006096', name: '👋・boas-vindas', category: 'inicio' },
  { id: '1155332929355006097', name: '🚪・saídas', category: 'inicio' },
  { id: '1156086511767408650', name: '🎫・ticket', category: 'inicio' },
  { id: '1552562264521969684', name: '🎭・cargos', category: 'inicio' },

  { id: '1521503971632742645', name: '💬・chat-geral', category: 'comunidade' },
  { id: '1521500251549335622', name: '🖼️・mídia', category: 'comunidade' },
  { id: '1525249545456451614', name: '🎨・gartic', category: 'comunidade' },
  { id: '1525249751056908308', name: '🧞・akinator', category: 'comunidade' },
  { id: '1525256979256311928', name: '🔊・criar-call', category: 'comunidade' },
  { id: '1552562262772809808', name: '💡・sugestões', category: 'comunidade' },

  { id: '1550914485747843122', name: '📦・lançamentos', category: 'projetos' },
  { id: '1550941029862084730', name: '📢・anúncios', category: 'projetos' },
  { id: '1521501731773481001', name: '🧩・modelos', category: 'projetos' },
  { id: '1521501784214999080', name: '📣・divulgação', category: 'projetos' },
  { id: '1523344624909946932', name: '🎨・artes', category: 'projetos' },
  { id: '1525241468938223827', name: '🧱・construções', category: 'projetos' },
  { id: '1550831020910321734', name: '🧩・addons-dos-membros', category: 'projetos' },
  { id: '1521503006095315085', name: '📘・tutorial-addon', category: 'projetos' },
  { id: '1552364892349014066', name: '🛒・vendas-de-modelos', category: 'projetos' },
  { id: '1521706960527818823', name: '🤝・parcerias', category: 'projetos' },
  { id: '1521502082467893258', name: '🐛・relatar-bug', category: 'projetos' },
  { id: '1521502328044257350', name: '💡・sugestões-de-addon', category: 'projetos' },
  { id: '1549576504013361223', name: '💠・stark-legacy', category: 'projetos' },

  { id: '1156037018934055062', name: '⚖️・punições', category: 'staff' },
  { id: '1158042478516121670', name: '🛡️・moderação', category: 'staff' },
  { id: '1549505626214895636', name: '🗃️・guardar', category: 'staff' },
  { id: '1552544736936599652', name: '⚙️・comandos-staff', category: 'staff' }
];

const OLD_CATEGORY_IDS = [
  '1155332929355006094',
  '1156086485859184652',
  '1155675149685768252',
  '1521501695623041185',
  '1155659504512405575',
  '1156036975648833586',
  '1156391946777018409'
];

function timeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout em ${label}`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(UCM_GUILD_ID).catch(() => null);
    if (!guild) {
      console.error('[UCM-LAYOUT] Servidor UCM não encontrado.');
      return;
    }

    const me = await guild.members.fetchMe();
    let channels = await guild.channels.fetch();

    console.log(
      `[UCM-LAYOUT] Permissões globais: admin=${me.permissions.has(PermissionFlagsBits.Administrator)} gerenciar-canais=${me.permissions.has(PermissionFlagsBits.ManageChannels)}`
    );

    for (const [key, id] of Object.entries(CATEGORY_IDS)) {
      const category = channels.get(id);
      if (!category || category.type !== ChannelType.GuildCategory) {
        console.error(`[UCM-LAYOUT] Categoria alvo ausente: ${CATEGORY_NAMES[key]} (${id})`);
        continue;
      }

      if (category.name !== CATEGORY_NAMES[key]) {
        await timeout(
          category.setName(CATEGORY_NAMES[key], 'Padronização final do UCM Studios'),
          15000,
          `categoria ${CATEGORY_NAMES[key]}`
        ).catch((error) => console.error(`[UCM-LAYOUT] Falha em ${CATEGORY_NAMES[key]}:`, error.message));
      }
    }

    channels = await guild.channels.fetch();

    for (let i = 0; i < TARGETS.length; i += 4) {
      const chunk = TARGETS.slice(i, i + 4);

      await Promise.allSettled(chunk.map(async (target) => {
        const channel = channels.get(target.id) || await guild.channels.fetch(target.id).catch(() => null);
        if (!channel) {
          console.log(`[UCM-LAYOUT] Ausente: ${target.id} → ${target.name}`);
          return;
        }

        const categoryId = CATEGORY_IDS[target.category];
        const permissions = channel.permissionsFor(me);
        const canManage = permissions?.has(PermissionFlagsBits.ManageChannels) || me.permissions.has(PermissionFlagsBits.Administrator);

        if (!canManage) {
          console.error(`[UCM-LAYOUT] BLOQUEADO: ${channel.name} (${channel.id}) sem Gerenciar Canais neste canal.`);
          return;
        }

        const options = {};
        if (channel.name !== target.name) options.name = target.name;
        if (channel.parentId !== categoryId) {
          options.parent = categoryId;
          options.lockPermissions = false;
        }

        if (!Object.keys(options).length) {
          console.log(`[UCM-LAYOUT] OK: ${target.name} já está em ${CATEGORY_NAMES[target.category]}.`);
          return;
        }

        await timeout(
          channel.edit({
            ...options,
            reason: 'Organização final em quatro categorias do UCM Studios'
          }),
          15000,
          target.name
        ).then(() => {
          console.log(`[UCM-LAYOUT] OK: ${target.name} → ${CATEGORY_NAMES[target.category]}.`);
        }).catch((error) => {
          console.error(`[UCM-LAYOUT] Falha: ${channel.name} (${channel.id}):`, error.message);
        });
      }));
    }

    channels = await guild.channels.fetch();

    for (const id of OLD_CATEGORY_IDS) {
      const category = channels.get(id);
      if (!category || category.type !== ChannelType.GuildCategory) continue;

      const children = channels.filter((channel) => channel.parentId === category.id);
      if (children.size) {
        console.log(`[UCM-LAYOUT] Categoria antiga preservada porque ainda contém: ${children.map((child) => child.name).join(', ')}`);
        continue;
      }

      await timeout(
        category.delete('Categoria antiga vazia após organização do UCM Studios'),
        15000,
        category.name
      ).then(() => {
        console.log(`[UCM-LAYOUT] Categoria antiga removida: ${category.name}`);
      }).catch((error) => {
        console.error(`[UCM-LAYOUT] Falha ao remover categoria ${category.name}:`, error.message);
      });
    }

    const finalChannels = await guild.channels.fetch();
    const finalCategories = finalChannels
      .filter((channel) => channel.type === ChannelType.GuildCategory)
      .map((channel) => channel.name);

    console.log(`[UCM-LAYOUT] Categorias finais: ${finalCategories.join(' | ')}`);
    console.log('[UCM-LAYOUT] Migração finalizada.');
  } catch (error) {
    console.error('[UCM-LAYOUT] Falha geral:', error);
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN).catch((error) => {
  console.error('[UCM-LAYOUT] Falha no login:', error.message);
  process.exit(1);
});
