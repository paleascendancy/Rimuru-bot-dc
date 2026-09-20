import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;
const PALE_GUILD_ID = '1513757281311916042';

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const EDITORS = [
  {
    label: 'Smookecut',
    emoji: '⭐',
    url: 'https://www.tiktok.com/@smookecut?_r=1&_t=ZS-99cfIpszrwT',
    description: 'Editor principal • referência da equipe para serviços e produções.'
  },
  {
    label: 'Shyrez',
    emoji: '🎬',
    url: 'https://www.tiktok.com/@shyrez2?_r=1&_t=ZS-99cfebo7Irl',
    description: 'Editor da comunidade • participa da produção de serviços solicitados.'
  },
  {
    label: 'Mangaká',
    emoji: '✒️',
    url: 'https://www.tiktok.com/@mangaka.studio?_r=1&_t=ZS-99cfhNvZFGX',
    description: 'Editor da comunidade • participa da produção de serviços solicitados.'
  },
  {
    label: 'Dexsi',
    emoji: '🎞️',
    url: 'https://www.tiktok.com/@dexsi.m?_r=1&_t=ZS-99cfkA8hAGb',
    description: 'Editor da comunidade • participa da produção de serviços solicitados.'
  }
];

function findTextChannel(channels, names) {
  const wanted = new Set(names.map(normalize));
  return channels.find((channel) =>
    channel?.type === ChannelType.GuildText && wanted.has(normalize(channel.name))
  ) || null;
}

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(PALE_GUILD_ID).catch(() => null);
    if (!guild) {
      console.log('[PA-ABOUT] Pale Ascendancy não encontrada.');
      return;
    }

    const channels = await guild.channels.fetch();
    const introCategory = channels.find((channel) =>
      channel?.type === ChannelType.GuildCategory && normalize(channel.name) === 'painicio'
    ) || null;

    let channel = findTextChannel(channels, ['sobre-a-comunidade', 'nossa-comunidade', 'institucional']);

    if (!channel) {
      channel = await guild.channels.create({
        name: '🌐・sobre-a-comunidade',
        type: ChannelType.GuildText,
        parent: introCategory?.id || null,
        topic: 'Conheça a Pale Ascendancy, nossos editores e como solicitar serviços.',
        reason: 'Criar apresentação oficial da comunidade Pale Ascendancy'
      });
    } else {
      await channel.edit({
        name: '🌐・sobre-a-comunidade',
        parent: introCategory?.id || channel.parentId,
        topic: 'Conheça a Pale Ascendancy, nossos editores e como solicitar serviços.'
      }).catch(() => {});
    }

    await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: false,
      SendMessagesInThreads: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
      AddReactions: false
    }).catch(() => {});

    await channel.permissionOverwrites.edit(client.user.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      EmbedLinks: true,
      ManageMessages: true
    }).catch(() => {});

    const freshChannels = await guild.channels.fetch();
    const serviceChannel = findTextChannel(freshChannels, ['solicitar-serviço', 'pedir-serviço']);
    const serviceMention = serviceChannel ? `<#${serviceChannel.id}>` : '`🧾・solicitar-serviço`';

    const header = new EmbedBuilder()
      .setColor(0x7b61ff)
      .setAuthor({
        name: 'Pale Ascendancy • Comunidade Criativa',
        iconURL: guild.iconURL({ size: 128 }) || client.user.displayAvatarURL()
      })
      .setTitle('🌐 Sobre a comunidade')
      .setDescription(
        'A **Pale Ascendancy** é uma comunidade criativa voltada para edição, design e produção digital. ' +
        'Além de reunir criadores, conectamos clientes aos nossos editores para a realização de serviços solicitados dentro da comunidade.\n\n' +
        `Para contratar, utilize ${serviceMention}. A equipe recebe o pedido, organiza as informações e encaminha para o editor adequado.`
      );

    const editors = new EmbedBuilder()
      .setColor(0x2b2f3a)
      .setTitle('🎬 Editores de promoção e serviços')
      .setDescription(
        EDITORS.map((editor) => `${editor.emoji} **${editor.label}**\n${editor.description}`).join('\n\n')
      )
      .setFooter({ text: 'Pale Ascendancy • Criatividade, organização e entrega' });

    const buttons = EDITORS.map((editor) =>
      new ButtonBuilder()
        .setLabel(editor.label)
        .setEmoji(editor.emoji)
        .setStyle(ButtonStyle.Link)
        .setURL(editor.url)
    );

    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    const panels = recent?.filter((message) =>
      message.author.id === client.user.id &&
      message.embeds.some((embed) => embed.title === '🌐 Sobre a comunidade')
    );

    const payload = {
      embeds: [header, editors],
      components: [new ActionRowBuilder().addComponents(...buttons)]
    };

    const primary = panels?.first() || null;
    if (primary) {
      await primary.edit(payload);
      const duplicates = panels.filter((message) => message.id !== primary.id);
      for (const duplicate of duplicates.values()) {
        await duplicate.delete().catch(() => {});
      }
    } else {
      await channel.send(payload);
    }

    console.log('[PA-ABOUT] 🌐・sobre-a-comunidade configurado.');
  } catch (error) {
    console.error('[PA-ABOUT] Falha ao configurar sobre a comunidade:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
