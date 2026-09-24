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
  console.error('[UCM-GROUPS] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const GROUPS = [
  {
    key: 'portaria',
    name: '「 UCM 」 PORTARIA',
    existingId: '1155332929355006094',
    channels: [
      ['1155684648828014602', '📜・regras'],
      ['1155332929355006096', '👋・boas-vindas'],
      ['1155332929355006097', '🚪・saídas']
    ]
  },
  {
    key: 'sos',
    name: '「 UCM 」 SOS',
    existingId: '1156086485859184652',
    channels: [
      ['1156086511767408650', '🎫・ticket']
    ]
  },
  {
    key: 'geral',
    name: '「 UCM 」 GERAL',
    channels: [
      ['1521503971632742645', '💬・chat-geral'],
      ['1521500251549335622', '🖼️・mídia'],
      ['1525249545456451614', '🎨・gartic'],
      ['1525249751056908308', '🧞・akinator'],
      ['1525256979256311928', '🔊・criar-call']
    ]
  },
  {
    key: 'membros',
    name: '「 UCM 」 MEMBROS',
    channels: [
      ['1521501731773481001', '🧩・modelos'],
      ['1521501784214999080', '📣・divulgação'],
      ['1523344624909946932', '🎨・artes'],
      ['1525241468938223827', '🧱・construções'],
      ['1552364892349014066', '🛒・vendas-de-modelos'],
      ['1552562264521969684', '🎭・cargos']
    ]
  },
  {
    key: 'addons',
    name: '「 UCM 」 ADDONS',
    channels: [
      ['1550941029862084730', '📢・anúncios'],
      ['1521503006095315085', '📘・tutorial-addon'],
      ['1521706960527818823', '🤝・parcerias'],
      ['1521502082467893258', '🐛・relatar-bug'],
      ['1521502328044257350', '💡・sugestões'],
      ['1550831020910321734', '🧩・addons-dos-membros'],
      ['1549576504013361223', '💠・stark-legacy'],
      ['1552562262772809808', '💡・sugestões-gerais']
    ]
  },
  {
    key: 'punicoes',
    name: '「 UCM 」 PUNIÇÕES',
    channels: [
      ['1156037018934055062', '⚖️・punições']
    ]
  },
  {
    key: 'staff',
    name: '「 UCM 」 STAFF',
    existingId: '1156391946777018409',
    channels: [
      ['1158042478516121670', '🛡️・moderação'],
      ['1549505626214895636', '🗃️・guardar'],
      ['1552544736936599652', '⚙️・comandos-staff']
    ]
  }
];

const OLD_UCM_CATEGORY_IDS = [
  '1552561066788266034',
  '1552561068549742674',
  '1552561070143709226',
  '1552561072295120976'
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(UCM_GUILD_ID).catch(() => null);
    if (!guild) {
      console.error('[UCM-GROUPS] UCM Studios não encontrado.');
      return;
    }

    const me = await guild.members.fetchMe();
    console.log(
      `[UCM-GROUPS] Permissões: admin=${me.permissions.has(PermissionFlagsBits.Administrator)} gerenciar-canais=${me.permissions.has(PermissionFlagsBits.ManageChannels)}`
    );

    let channels = await guild.channels.fetch();
    const categories = new Map();

    for (let index = 0; index < GROUPS.length; index += 1) {
      const group = GROUPS[index];
      let category = group.existingId ? channels.get(group.existingId) : null;

      if (!category || category.type !== ChannelType.GuildCategory) {
        category = await guild.channels.create({
          name: group.name,
          type: ChannelType.GuildCategory,
          reason: 'Restaurar agrupamento original do UCM com visual padronizado'
        });
        console.log(`[UCM-GROUPS] Categoria criada: ${group.name}`);
      } else if (category.name !== group.name) {
        await category.setName(group.name, 'Padronização visual do UCM Studios')
          .then(() => console.log(`[UCM-GROUPS] Categoria renomeada: ${group.name}`))
          .catch((error) => {
            console.log(`[UCM-GROUPS] Categoria mantida como "${category.name}" por falta de acesso para renomear: ${error.message}`);
          });
      }

      await category.setPosition(index).catch(() => {});
      categories.set(group.key, category);
      channels = await guild.channels.fetch();
    }

    for (const group of GROUPS) {
      const category = categories.get(group.key);
      if (!category) continue;

      for (const [channelId, channelName] of group.channels) {
        const channel = channels.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          console.log(`[UCM-GROUPS] Canal ausente: ${channelId}`);
          continue;
        }

        const permissions = channel.permissionsFor(me);
        const canManage = me.permissions.has(PermissionFlagsBits.Administrator) ||
          permissions?.has(PermissionFlagsBits.ManageChannels);

        if (!canManage && channel.parentId === category.id) {
          console.log(`[UCM-GROUPS] Mantido no grupo correto, sem alterar: ${channel.name}`);
          continue;
        }

        if (!canManage) {
          console.error(`[UCM-GROUPS] BLOQUEADO: ${channel.name} não pode ser movido para ${group.name}.`);
          continue;
        }

        const options = {};
        if (channel.name !== channelName) options.name = channelName;
        if (channel.parentId !== category.id) {
          options.parent = category.id;
          options.lockPermissions = false;
        }

        if (!Object.keys(options).length) {
          console.log(`[UCM-GROUPS] OK: ${channelName} permanece em ${group.name}.`);
          continue;
        }

        await channel.edit({
          ...options,
          reason: 'Manter cada canal no agrupamento original com nomes padronizados'
        }).then(() => {
          console.log(`[UCM-GROUPS] OK: ${channelName} → ${group.name}.`);
        }).catch((error) => {
          console.error(`[UCM-GROUPS] Falha em ${channel.name}:`, error.message);
        });

        await wait(120);
      }
    }

    // O canal de lançamentos era independente; volta a ficar sem categoria.
    const releases = channels.get('1550914485747843122') || await guild.channels.fetch('1550914485747843122').catch(() => null);
    if (releases) {
      const permissions = releases.permissionsFor(me);
      const canManage = me.permissions.has(PermissionFlagsBits.Administrator) ||
        permissions?.has(PermissionFlagsBits.ManageChannels);

      if (canManage) {
        await releases.edit({
          name: '📦・lançamentos',
          parent: null,
          lockPermissions: false,
          reason: 'Restaurar posição independente original do canal de lançamentos'
        }).catch((error) => console.error('[UCM-GROUPS] Falha em lançamentos:', error.message));
      }
    }

    channels = await guild.channels.fetch();

    for (const id of OLD_UCM_CATEGORY_IDS) {
      const category = channels.get(id);
      if (!category || category.type !== ChannelType.GuildCategory) continue;

      const children = channels.filter((channel) => channel.parentId === category.id);
      if (children.size) {
        console.log(`[UCM-GROUPS] Categoria temporária preservada; ainda contém: ${children.map((child) => child.name).join(', ')}`);
        continue;
      }

      await category.delete('Remover categoria temporária criada pela reorganização anterior')
        .then(() => console.log(`[UCM-GROUPS] Categoria temporária removida: ${category.name}`))
        .catch((error) => console.error(`[UCM-GROUPS] Falha ao remover ${category.name}:`, error.message));
    }

    const finalChannels = await guild.channels.fetch();
    const finalCategories = finalChannels
      .filter((channel) => channel.type === ChannelType.GuildCategory)
      .map((channel) => channel.name);

    console.log(`[UCM-GROUPS] Categorias finais: ${finalCategories.join(' | ')}`);
    console.log('[UCM-GROUPS] Reagrupamento concluído.');
  } catch (error) {
    console.error('[UCM-GROUPS] Falha geral:', error);
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN).catch((error) => {
  console.error('[UCM-GROUPS] Falha no login:', error.message);
  process.exit(1);
});
