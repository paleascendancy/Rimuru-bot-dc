import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
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

client.once('ready', async () => {
  try {
    const guild = await client.guilds.fetch(PALE_GUILD_ID).catch(() => null);
    if (!guild) {
      console.log('[PA-SERVICES] Pale Ascendancy não encontrada.');
      return;
    }

    const channels = await guild.channels.fetch();
    const supportCategory = channels.find((channel) =>
      channel?.type === ChannelType.GuildCategory && normalize(channel.name) === 'pasuporte'
    ) || null;

    let channel = channels.find((item) =>
      item?.type === ChannelType.GuildText && ['solicitarservico', 'pedirservico'].includes(normalize(item.name))
    ) || null;

    if (!channel) {
      channel = await guild.channels.create({
        name: '🧾・solicitar-serviço',
        type: ChannelType.GuildText,
        parent: supportCategory?.id || null,
        topic: 'Solicite serviços criativos da Pale Ascendancy por atendimento privado.',
        reason: 'Criar central de solicitação de serviços da Pale Ascendancy'
      });
    } else {
      await channel.edit({
        name: '🧾・solicitar-serviço',
        parent: supportCategory?.id || channel.parentId,
        topic: 'Solicite serviços criativos da Pale Ascendancy por atendimento privado.'
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

    const embed = new EmbedBuilder()
      .setColor(0x7b61ff)
      .setAuthor({
        name: 'Pale Ascendancy • Serviços',
        iconURL: guild.iconURL({ size: 128 }) || client.user.displayAvatarURL()
      })
      .setTitle('🧾 Solicitar um serviço')
      .setDescription(
        'Precisa de **edição, design ou outro serviço criativo**? Abra um atendimento privado e conte o que você precisa.\n\n' +
        '`01` Clique em **Solicitar serviço**.\n' +
        '`02` Informe o serviço, referências, prazo e orçamento aproximado.\n' +
        '`03` A equipe responde no seu ticket.'
      )
      .setFooter({ text: 'Pale Ascendancy • Atendimento profissional' });

    const button = new ButtonBuilder()
      .setCustomId('pa_service_open')
      .setLabel('Solicitar serviço')
      .setEmoji('💼')
      .setStyle(ButtonStyle.Primary);

    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    const panels = recent?.filter((message) =>
      message.author.id === client.user.id &&
      message.embeds.some((item) => item.title === '🧾 Solicitar um serviço')
    );

    const primary = panels?.first() || null;
    const payload = {
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(button)]
    };

    if (primary) {
      await primary.edit(payload);
      const duplicates = panels.filter((message) => message.id !== primary.id);
      for (const message of duplicates.values()) {
        await message.delete().catch(() => {});
      }
    } else {
      await channel.send(payload);
    }

    console.log('[PA-SERVICES] 🧾・solicitar-serviço configurado.');
  } catch (error) {
    console.error('[PA-SERVICES] Falha ao configurar solicitação de serviços:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
