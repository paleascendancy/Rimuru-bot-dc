import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

export const PALE_COMMUNITY_GUILD_ID = '1513757281311916042';

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const ROLE_GROUPS = [
  {
    title: '🎯 ÁREAS CRIATIVAS',
    description: 'Escolha as áreas que representam o que você faz ou quer aprender.',
    exclusive: false,
    items: [
      { emoji: '🎬', role: '🎬・Edição de vídeo', label: 'Edição de vídeo' },
      { emoji: '🎨', role: '🎨・Design', label: 'Design' },
      { emoji: '📱', role: '📱・Social Media', label: 'Social Media' },
      { emoji: '🌀', role: '🌀・Motion Design', label: 'Motion Design' }
    ]
  },
  {
    title: '🛠️ FERRAMENTAS',
    description: 'Marque os programas que você usa. Você pode escolher vários.',
    exclusive: false,
    items: [
      { emoji: '✂️', role: 'CapCut', label: 'CapCut' },
      { emoji: '💠', role: 'After Effects', label: 'After Effects' },
      { emoji: '🎞️', role: 'Premiere Pro', label: 'Premiere Pro' },
      { emoji: '💫', role: 'Alight Motion', label: 'Alight Motion' },
      { emoji: '🎛️', role: 'DaVinci Resolve', label: 'DaVinci Resolve' },
      { emoji: '🖌️', role: 'Photoshop', label: 'Photoshop' }
    ]
  },
  {
    title: '🔔 NOTIFICAÇÕES',
    description: 'Receba apenas os avisos que interessam a você.',
    exclusive: false,
    items: [
      { emoji: '📢', role: '📢・Anúncios PA', label: 'Anúncios' },
      { emoji: '🎉', role: '🎉・Eventos PA', label: 'Eventos' },
      { emoji: '💼', role: '💼・Serviços PA', label: 'Serviços' },
      { emoji: '🤝', role: '🤝・Parcerias PA', label: 'Parcerias' }
    ]
  },
  {
    title: '🌈 COR DO PERFIL',
    description: 'Escolha uma cor para personalizar seu nome no servidor. Apenas uma fica ativa por vez.',
    exclusive: true,
    items: [
      { emoji: '🔴', role: '🔴・Crimson', label: 'Crimson', color: 0xc93f4d },
      { emoji: '🟡', role: '🟡・Gold', label: 'Gold', color: 0xe0ad3b },
      { emoji: '🟢', role: '🟢・Emerald', label: 'Emerald', color: 0x3ca66b },
      { emoji: '🔵', role: '🔵・Azure', label: 'Azure', color: 0x4b89dc },
      { emoji: '🟣', role: '🟣・Violet', label: 'Violet', color: 0x805ad5 },
      { emoji: '🌸', role: '🌸・Rose', label: 'Rose', color: 0xd95f8d },
      { emoji: '⚪', role: '⚪・Silver', label: 'Silver', color: 0xb8bec9 }
    ]
  }
];

async function findChannel(guild, normalizedName) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) =>
    channel?.type === ChannelType.GuildText && normalize(channel.name) === normalizedName
  ) || null;
}

async function findRole(guild, roleName) {
  const roles = await guild.roles.fetch();
  return roles.find((role) => normalize(role.name) === normalize(roleName)) || null;
}

async function ensureRole(guild, item) {
  let role = await findRole(guild, item.role);
  if (role) return role;

  role = await guild.roles.create({
    name: item.role,
    color: item.color,
    hoist: false,
    mentionable: false,
    reason: 'Cargo automático da Pale Ascendancy'
  });
  return role;
}

async function ensureSelfRoles(guild) {
  const result = new Map();
  for (const group of ROLE_GROUPS) {
    for (const item of group.items) {
      const role = await ensureRole(guild, item);
      result.set(normalize(item.role), role);
    }
  }

  const roles = await guild.roles.fetch();
  const support = roles.find((role) => normalize(role.name) === 'suporte') || null;
  if (support) {
    for (const item of ROLE_GROUPS.find((group) => group.exclusive)?.items || []) {
      const role = result.get(normalize(item.role));
      if (!role?.editable) continue;
      const target = Math.max(1, support.position - 1);
      await role.setPosition(target, { reason: 'Cores de perfil acima dos cargos comuns' }).catch(() => {});
    }
  }

  return result;
}

async function setPanelPermissions(channel, guild) {
  await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
    AddReactions: true
  }).catch(() => {});

  const memberRole = await findRole(guild, 'Membro');
  if (memberRole) {
    await channel.permissionOverwrites.edit(memberRole.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: false,
      SendMessagesInThreads: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
      AddReactions: true
    }).catch(() => {});
  }

  await channel.permissionOverwrites.edit(guild.client.user.id, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: true,
    EmbedLinks: true,
    AddReactions: true,
    ManageMessages: true
  }).catch(() => {});
}

function rolePanelEmbed(group) {
  return new EmbedBuilder()
    .setColor(group.exclusive ? 0x7b61ff : 0x2b2f3a)
    .setTitle(group.title)
    .setDescription(
      `${group.description}\n\n` +
      group.items.map((item) => `${item.emoji}  **${item.label}**`).join('\n')
    )
    .setFooter({ text: group.exclusive ? 'Trocar de cor remove automaticamente a anterior.' : 'Reaja para adicionar • retire a reação para remover.' });
}

async function ensureRolePanels(guild) {
  const channel = await findChannel(guild, 'cargos');
  if (!channel) return;

  await channel.setTopic('Escolha áreas criativas, ferramentas, notificações e a cor do seu perfil • cargos automáticos por reação').catch(() => {});
  await setPanelPermissions(channel, guild);
  await ensureSelfRoles(guild);

  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (recent) {
    const old = recent.filter((message) =>
      message.author.id === guild.client.user.id &&
      message.embeds.some((embed) => embed.title === '🎭 Cargos da comunidade')
    );
    for (const message of old.values()) await message.delete().catch(() => {});
  }

  const introTitle = '🎭 Personalize seu perfil';
  const introPayload = {
    embeds: [
      new EmbedBuilder()
        .setColor(0x7b61ff)
        .setAuthor({ name: 'Pale Ascendancy • Identidade' })
        .setTitle(introTitle)
        .setDescription('Escolha seus cargos pelas reações abaixo. **Áreas, ferramentas e notificações** aceitam várias opções; **cor do perfil** aceita apenas uma.')
        .setFooter({ text: 'As alterações são aplicadas automaticamente.' })
    ]
  };

  let intro = recent?.find((message) =>
    message.author.id === guild.client.user.id && message.embeds.some((embed) => embed.title === introTitle)
  ) || null;
  if (intro) await intro.edit(introPayload).catch(() => {});
  else intro = await channel.send(introPayload);

  for (const group of ROLE_GROUPS) {
    const payload = { embeds: [rolePanelEmbed(group)] };
    const matches = recent?.filter((message) =>
      message.author.id === guild.client.user.id && message.embeds.some((embed) => embed.title === group.title)
    );
    let message = matches?.first() || null;
    if (message) {
      await message.edit(payload).catch(() => {});
      const duplicates = matches.filter((candidate) => candidate.id !== message.id);
      for (const duplicate of duplicates.values()) await duplicate.delete().catch(() => {});
    } else {
      message = await channel.send(payload);
    }

    for (const item of group.items) {
      if (!message.reactions.cache.some((reaction) => reaction.emoji.name === item.emoji)) {
        await message.react(item.emoji).catch(() => {});
      }
    }
  }

  console.log('[Pale Ascendancy] 🎭 Cargos por reação configurados.');
}

function buildSuggestionModal() {
  const title = new TextInputBuilder()
    .setCustomId('pa_suggestion_title')
    .setLabel('Título da sugestão')
    .setPlaceholder('Ex.: novo canal de desafios de edição')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const area = new TextInputBuilder()
    .setCustomId('pa_suggestion_area')
    .setLabel('Área')
    .setPlaceholder('Ex.: comunidade, recursos, eventos, bot...')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  const idea = new TextInputBuilder()
    .setCustomId('pa_suggestion_idea')
    .setLabel('Explique sua ideia')
    .setPlaceholder('O que você gostaria que fosse adicionado ou melhorado?')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true);

  const benefit = new TextInputBuilder()
    .setCustomId('pa_suggestion_benefit')
    .setLabel('Por que seria útil?')
    .setPlaceholder('Explique rapidamente o benefício para a comunidade.')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId('pa_suggestion_modal')
    .setTitle('Enviar sugestão')
    .addComponents(
      new ActionRowBuilder().addComponents(title),
      new ActionRowBuilder().addComponents(area),
      new ActionRowBuilder().addComponents(idea),
      new ActionRowBuilder().addComponents(benefit)
    );
}

async function ensureSuggestionPanel(guild) {
  const channel = await findChannel(guild, 'sugestoes');
  if (!channel) return;

  await channel.setTopic('Envie sugestões pelo botão abaixo • a comunidade pode votar com 👍 ou 👎').catch(() => {});
  await setPanelPermissions(channel, guild);

  const title = '💡 Central de Sugestões • Pale Ascendancy';
  const payload = {
    embeds: [
      new EmbedBuilder()
        .setColor(0x7b61ff)
        .setAuthor({ name: 'Pale Ascendancy • Comunidade' })
        .setTitle(title)
        .setDescription('Tem uma ideia para melhorar o servidor? Clique em **Enviar sugestão**, explique de forma objetiva e a comunidade poderá votar.')
        .addFields({ name: 'Pode sugerir', value: 'Canais • recursos • eventos • bots • organização • melhorias da comunidade' })
        .setFooter({ text: 'Sugestões claras são mais fáceis de analisar.' })
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('pa_suggestion_open')
          .setLabel('Enviar sugestão')
          .setEmoji('💡')
          .setStyle(ButtonStyle.Primary)
      )
    ]
  };

  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const panels = recent?.filter((message) =>
    message.author.id === guild.client.user.id &&
    message.embeds.some((embed) => [title, '💡 Sugestões'].includes(embed.title))
  );

  const exact = panels?.find((message) => message.embeds.some((embed) => embed.title === title)) || null;
  if (exact) await exact.edit(payload).catch(() => {});
  else await channel.send(payload);

  if (panels) {
    for (const message of panels.values()) {
      if (exact && message.id === exact.id) continue;
      await message.delete().catch(() => {});
    }
  }

  console.log('[Pale Ascendancy] 💡 Botão de sugestões configurado.');
}

export async function setupPaleCommunity(guild) {
  if (guild.id !== PALE_COMMUNITY_GUILD_ID) return false;
  await ensureSuggestionPanel(guild);
  await ensureRolePanels(guild);
  return true;
}

export async function handlePaleCommunityInteraction(interaction) {
  if (!interaction.inGuild() || interaction.guildId !== PALE_COMMUNITY_GUILD_ID) return false;

  if (interaction.isButton() && interaction.customId === 'pa_suggestion_open') {
    await interaction.showModal(buildSuggestionModal());
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'pa_suggestion_modal') {
    const channel = await findChannel(interaction.guild, 'sugestoes');
    if (!channel) {
      await interaction.reply({ content: 'O canal de sugestões não foi encontrado.', ephemeral: true });
      return true;
    }

    const title = interaction.fields.getTextInputValue('pa_suggestion_title');
    const area = interaction.fields.getTextInputValue('pa_suggestion_area');
    const idea = interaction.fields.getTextInputValue('pa_suggestion_idea');
    const benefit = interaction.fields.getTextInputValue('pa_suggestion_benefit');

    const embed = new EmbedBuilder()
      .setColor(0x7b61ff)
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ size: 128 }) })
      .setTitle(`💡 ${title}`)
      .setDescription(idea)
      .addFields(
        { name: 'Área', value: area, inline: true },
        { name: 'Por que seria útil?', value: benefit }
      )
      .setFooter({ text: 'Vote abaixo • 👍 apoio  |  👎 não apoio' })
      .setTimestamp();

    const message = await channel.send({ embeds: [embed] });
    await message.react('👍').catch(() => {});
    await message.react('👎').catch(() => {});
    await interaction.reply({ content: `Sua sugestão foi publicada em ${channel}.`, ephemeral: true });
    return true;
  }

  return false;
}

async function resolveRoleReaction(reaction) {
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

  const guild = reaction.message.guild;
  if (!guild || guild.id !== PALE_COMMUNITY_GUILD_ID) return null;
  if (reaction.message.author?.id !== guild.client.user.id) return null;
  if (normalize(reaction.message.channel?.name) !== 'cargos') return null;

  const title = reaction.message.embeds?.[0]?.title;
  const group = ROLE_GROUPS.find((entry) => entry.title === title);
  if (!group) return null;

  const item = group.items.find((entry) => entry.emoji === reaction.emoji.name);
  if (!item) return null;

  const role = await findRole(guild, item.role);
  if (!role) return null;
  return { guild, group, item, role };
}

export async function handlePaleCommunityReactionAdd(reaction, user) {
  if (user.bot) return false;
  const resolved = await resolveRoleReaction(reaction);
  if (!resolved) return false;

  const { guild, group, item, role } = resolved;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return true;

  if (group.exclusive) {
    for (const other of group.items) {
      if (other.role === item.role) continue;
      const otherRole = await findRole(guild, other.role);
      if (otherRole && member.roles.cache.has(otherRole.id)) {
        await member.roles.remove(otherRole, 'Troca de cor do perfil').catch(() => {});
      }
      const otherReaction = reaction.message.reactions.cache.find((entry) => entry.emoji.name === other.emoji);
      if (otherReaction) await otherReaction.users.remove(user.id).catch(() => {});
    }
  }

  await member.roles.add(role, 'Cargo escolhido por reação na Pale Ascendancy').catch(() => {});
  return true;
}

export async function handlePaleCommunityReactionRemove(reaction, user) {
  if (user.bot) return false;
  const resolved = await resolveRoleReaction(reaction);
  if (!resolved) return false;

  const { guild, role } = resolved;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (member?.roles.cache.has(role.id)) {
    await member.roles.remove(role, 'Cargo removido pela reação na Pale Ascendancy').catch(() => {});
  }
  return true;
}
