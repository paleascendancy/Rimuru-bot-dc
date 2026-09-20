import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder
} from 'discord.js';

export const PALE_GUILD_ID = '1513757281311916042';

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const STAFF_NAMES = new Set(['dono', 'desenvolvedor', 'administrador', 'moderador', 'suporte']);

async function findRole(guild, name) {
  const roles = await guild.roles.fetch();
  return roles.find((role) => normalize(role.name) === normalize(name)) || null;
}

async function findChannel(guild, names, type = ChannelType.GuildText) {
  const channels = await guild.channels.fetch();
  const wanted = names.map(normalize);
  return channels.find((channel) => channel?.type === type && wanted.includes(normalize(channel.name))) || null;
}

function isStaff(member) {
  return member?.roles?.cache?.some((role) => STAFF_NAMES.has(normalize(role.name))) || false;
}

function userIdentity(user, member = null) {
  const displayName = member?.displayName || user.globalName || user.username;
  const username = user.username ? `@${user.username}` : 'sem username';
  return `${displayName} (${username}) • ID: ${user.id}`;
}

async function createPaleTicket(interaction, reasonKey) {
  const labels = {
    suporte: ['Suporte geral', '🛟'],
    parceria: ['Parceria / projeto', '🤝'],
    denuncia: ['Denúncia', '🚨'],
    equipe: ['Equipe / candidatura', '📨'],
    outro: ['Outro assunto', '💬']
  };

  const [label, emoji] = labels[reasonKey] || labels.outro;
  const guild = interaction.guild;
  const supportCategory = (await guild.channels.fetch()).find((channel) =>
    channel?.type === ChannelType.GuildCategory && normalize(channel.name) === 'pasuporte'
  ) || null;

  const open = (await guild.channels.fetch()).find((channel) =>
    channel?.type === ChannelType.GuildText &&
    channel.topic?.startsWith(`PA_TICKET:${interaction.user.id}`)
  );

  if (open) {
    await interaction.reply({ content: `Você já possui um atendimento aberto: ${open}`, ephemeral: true });
    return;
  }

  const staffRoles = (await guild.roles.fetch()).filter((role) => STAFF_NAMES.has(normalize(role.name)));
  const safeName = interaction.user.username
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'membro';

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  for (const role of staffRoles.values()) {
    overwrites.push({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  const channel = await guild.channels.create({
    name: `ticket-${safeName}`,
    type: ChannelType.GuildText,
    parent: supportCategory?.id || null,
    topic: `PA_TICKET:${interaction.user.id}|REASON:${reasonKey}`,
    permissionOverwrites: overwrites,
    reason: `Ticket Pale Ascendancy: ${label}`
  });

  const embed = new EmbedBuilder()
    .setColor(0x7b61ff)
    .setAuthor({ name: 'Pale Ascendancy • Atendimento' })
    .setTitle(`${emoji} ${label}`)
    .setDescription(
      `Olá, ${interaction.member?.displayName || interaction.user.globalName || interaction.user.username}. Seu atendimento foi aberto.\n\n` +
      'Explique o que você precisa com o máximo de contexto possível. A equipe responderá por aqui.'
    )
    .addFields(
      { name: 'Solicitante', value: userIdentity(interaction.user, interaction.member), inline: false },
      { name: 'Categoria', value: label, inline: true }
    )
    .setFooter({ text: 'Pale Ascendancy • Suporte privado' })
    .setTimestamp();

  const close = new ButtonBuilder()
    .setCustomId('pa_ticket_close')
    .setLabel('Fechar ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(close)] });
  await interaction.reply({ content: `Atendimento criado: ${channel}`, ephemeral: true });
}

export async function handlePaleInteraction(interaction) {
  if (!interaction.inGuild() || interaction.guildId !== PALE_GUILD_ID) return false;

  if (interaction.isButton() && interaction.customId === 'pa_ticket_open') {
    const select = new StringSelectMenuBuilder()
      .setCustomId('pa_ticket_reason')
      .setPlaceholder('Escolha o motivo do atendimento')
      .addOptions(
        { label: 'Suporte geral', value: 'suporte', emoji: '🛟' },
        { label: 'Parceria / projeto', value: 'parceria', emoji: '🤝' },
        { label: 'Denúncia', value: 'denuncia', emoji: '🚨' },
        { label: 'Equipe / candidatura', value: 'equipe', emoji: '📨' },
        { label: 'Outro assunto', value: 'outro', emoji: '💬' }
      );

    await interaction.reply({
      content: 'Selecione o assunto para abrir um atendimento privado.',
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'pa_ticket_reason') {
    await createPaleTicket(interaction, interaction.values[0]);
    return true;
  }

  if (interaction.isButton() && interaction.customId === 'pa_ticket_close') {
    const channel = interaction.channel;
    if (!channel?.topic?.startsWith('PA_TICKET:')) return true;

    const ownerId = channel.topic.split('|')[0].replace('PA_TICKET:', '');
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    if (interaction.user.id !== ownerId && !isStaff(member)) {
      await interaction.reply({ content: 'Somente o autor do ticket ou a equipe pode fechá-lo.', ephemeral: true });
      return true;
    }

    await interaction.reply({ content: '🔒 Atendimento encerrado.' });
    setTimeout(() => channel.delete('Ticket encerrado na Pale Ascendancy').catch(() => {}), 1500);
    return true;
  }

  return false;
}

export async function handlePaleMemberAdd(member) {
  if (member.guild.id !== PALE_GUILD_ID) return false;

  const memberRole = await findRole(member.guild, 'Membro');
  if (memberRole?.editable) {
    await member.roles.add(memberRole, 'Entrada automática na Pale Ascendancy').catch(() => {});
  }

  const welcome = await findChannel(member.guild, ['👋・boas-vindas', 'boas-vindas']);
  if (welcome) {
    const embed = new EmbedBuilder()
      .setColor(0x7b61ff)
      .setAuthor({ name: 'Pale Ascendancy • Comunidade Criativa' })
      .setTitle('✨ Bem-vindo à Pale Ascendancy')
      .setDescription(
        `Olá, ${member.displayName || member.user.globalName || member.user.username}. Bem-vindo à comunidade.\n\n` +
        'Explore recursos, compartilhe seus trabalhos, converse com outros criadores e evolua junto com a comunidade.'
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `Membro #${member.guild.memberCount} • Pale Ascendancy` })
      .setTimestamp();

    await welcome.send({ embeds: [embed] }).catch(() => {});
  }

  return true;
}
