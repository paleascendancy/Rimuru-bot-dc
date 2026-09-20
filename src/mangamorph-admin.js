import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const STAFF_ROLE_NAMES = new Set([
  'mangamorph',
  'direcao',
  'administrador',
  'moderador',
  'equipemangamorph',
  'desenvolvedor'
]);

const FORUM_TAGS = [
  { name: '📥 Pedido', moderated: false },
  { name: '🔎 Em análise', moderated: true },
  { name: '✅ Adicionada', moderated: true },
  { name: '⛔ Indisponível', moderated: true }
];

const FORUM_TOPIC = [
  'Sugira obras para serem adicionadas ao site MangaMorph.',
  '',
  'Antes de criar um post, pesquise se a obra já foi solicitada.',
  'No pedido informe: nome da obra, tipo (mangá/manhwa/manhua/webtoon), link ou referência oficial, idioma e uma observação curta.',
  '',
  'Use a tag 📥 Pedido. As tags de status são atualizadas pela equipe.'
].join('\n');

function isMangaMorphGuild(guild) {
  const configuredId = process.env.MANGAMORPH_GUILD_ID;
  if (configuredId) return guild.id === configuredId;
  return normalize(guild.name).includes('mangamorph');
}

async function findMemberRole(guild) {
  const roles = await guild.roles.fetch();
  return roles.find((role) => normalize(role.name) === 'membro' && !role.managed) || null;
}

async function findStaffRoles(guild) {
  const roles = await guild.roles.fetch();
  return roles.filter((role) => STAFF_ROLE_NAMES.has(normalize(role.name)) && !role.managed);
}

async function findWorksCategory(guild) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) =>
    channel?.type === ChannelType.GuildCategory &&
    (normalize(channel.name).includes('mmobras') || normalize(channel.name) === 'obras')
  ) || null;
}

async function ensureWorksForum(guild, client) {
  if (!isMangaMorphGuild(guild)) return null;

  const channels = await guild.channels.fetch();
  let category = await findWorksCategory(guild);
  if (!category) {
    category = await guild.channels.create({
      name: '「 MM 」 OBRAS',
      type: ChannelType.GuildCategory,
      reason: 'Área de obras do MangaMorph'
    });
  }

  let forum = channels.find((channel) =>
    channel?.type === ChannelType.GuildForum &&
    ['sugestoesdeobras', 'pedidosdeobras', 'sugerirobra'].includes(normalize(channel.name))
  ) || null;

  if (!forum) {
    forum = await guild.channels.create({
      name: '💡・sugestões-de-obras',
      type: ChannelType.GuildForum,
      parent: category.id,
      topic: FORUM_TOPIC,
      availableTags: FORUM_TAGS,
      defaultAutoArchiveDuration: 10080,
      defaultThreadRateLimitPerUser: 30,
      reason: 'Fórum oficial para sugestões de obras do MangaMorph'
    });
  } else {
    await forum.edit({
      name: '💡・sugestões-de-obras',
      parent: category.id,
      topic: FORUM_TOPIC,
      availableTags: FORUM_TAGS,
      defaultAutoArchiveDuration: 10080,
      defaultThreadRateLimitPerUser: 30
    }).catch((error) => console.error('[MM-ADMIN] Falha ao atualizar fórum:', error));
  }

  await forum.permissionOverwrites.edit(guild.roles.everyone.id, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: false,
    CreatePublicThreads: false,
    SendMessagesInThreads: false,
    AttachFiles: false,
    EmbedLinks: false
  }).catch(() => {});

  const memberRole = await findMemberRole(guild);
  if (memberRole) {
    await forum.permissionOverwrites.edit(memberRole.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      CreatePublicThreads: true,
      SendMessagesInThreads: true,
      AttachFiles: true,
      EmbedLinks: true
    }).catch(() => {});
  } else {
    await forum.permissionOverwrites.edit(guild.roles.everyone.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      CreatePublicThreads: true,
      SendMessagesInThreads: true,
      AttachFiles: true,
      EmbedLinks: true
    }).catch(() => {});
  }

  const staffRoles = await findStaffRoles(guild);
  for (const role of staffRoles.values()) {
    await forum.permissionOverwrites.edit(role.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      CreatePublicThreads: true,
      SendMessagesInThreads: true,
      AttachFiles: true,
      EmbedLinks: true,
      ManageThreads: true,
      ManageMessages: true
    }).catch(() => {});
  }

  await forum.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: true,
    CreatePublicThreads: true,
    SendMessagesInThreads: true,
    AttachFiles: true,
    EmbedLinks: true,
    ManageThreads: true,
    ManageMessages: true
  }).catch(() => {});

  console.log(`[MM-ADMIN] ${guild.name}: fórum de sugestões de obras configurado.`);
  return forum;
}

const configurarCommand = new SlashCommandBuilder()
  .setName('configurar')
  .setDescription('Configura recursos do servidor MangaMorph')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) => subcommand
    .setName('canal')
    .setDescription('Configura visual, permissões e comportamento de um canal')
    .addChannelOption((option) => option
      .setName('canal')
      .setDescription('Canal que será configurado; padrão: canal atual')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum))
    .addStringOption((option) => option
      .setName('modo')
      .setDescription('Modelo de permissões')
      .addChoices(
        { name: 'Público', value: 'publico' },
        { name: 'Somente leitura', value: 'leitura' },
        { name: 'Somente staff', value: 'staff' },
        { name: 'Mídia / uploads', value: 'midia' }
      ))
    .addStringOption((option) => option
      .setName('nome')
      .setDescription('Novo nome do canal')
      .setMaxLength(100))
    .addStringOption((option) => option
      .setName('topico')
      .setDescription('Novo tópico/descrição do canal')
      .setMaxLength(1000))
    .addIntegerOption((option) => option
      .setName('slowmode')
      .setDescription('Intervalo entre mensagens, em segundos')
      .setMinValue(0)
      .setMaxValue(21600)))
  .addSubcommand((subcommand) => subcommand
    .setName('forum-obras')
    .setDescription('Reaplica a configuração padrão do fórum de sugestões de obras'));

const embedCommand = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Cria e modifica templates de embed do bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) => subcommand
    .setName('criar')
    .setDescription('Cria um embed personalizado')
    .addStringOption((option) => option.setName('titulo').setDescription('Título').setRequired(true).setMaxLength(256))
    .addStringOption((option) => option.setName('descricao').setDescription('Conteúdo do embed').setRequired(true).setMaxLength(4000))
    .addChannelOption((option) => option
      .setName('canal')
      .setDescription('Canal de destino; padrão: canal atual')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((option) => option.setName('cor').setDescription('Cor hexadecimal, ex.: #5865F2').setMaxLength(7))
    .addStringOption((option) => option.setName('imagem').setDescription('URL de uma imagem para o template').setMaxLength(1000))
    .addStringOption((option) => option.setName('rodape').setDescription('Texto do rodapé').setMaxLength(2048)))
  .addSubcommand((subcommand) => subcommand
    .setName('editar')
    .setDescription('Edita um embed publicado pelo bot')
    .addStringOption((option) => option.setName('mensagem').setDescription('ID da mensagem').setRequired(true).setMaxLength(30))
    .addChannelOption((option) => option
      .setName('canal')
      .setDescription('Canal onde está a mensagem; padrão: canal atual')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((option) => option.setName('titulo').setDescription('Novo título').setMaxLength(256))
    .addStringOption((option) => option.setName('descricao').setDescription('Nova descrição').setMaxLength(4000))
    .addStringOption((option) => option.setName('cor').setDescription('Nova cor hexadecimal').setMaxLength(7))
    .addStringOption((option) => option.setName('imagem').setDescription('Nova URL de imagem; use remover para retirar').setMaxLength(1000))
    .addStringOption((option) => option.setName('rodape').setDescription('Novo rodapé; use remover para retirar').setMaxLength(2048)))
  .addSubcommand((subcommand) => subcommand
    .setName('excluir')
    .setDescription('Exclui uma mensagem de embed publicada pelo bot')
    .addStringOption((option) => option.setName('mensagem').setDescription('ID da mensagem').setRequired(true).setMaxLength(30))
    .addChannelOption((option) => option
      .setName('canal')
      .setDescription('Canal onde está a mensagem; padrão: canal atual')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
  .addSubcommand((subcommand) => subcommand
    .setName('template')
    .setDescription('Publica um template visual pronto')
    .addStringOption((option) => option
      .setName('tipo')
      .setDescription('Estilo do template')
      .setRequired(true)
      .addChoices(
        { name: 'Informação', value: 'info' },
        { name: 'Anúncio', value: 'anuncio' },
        { name: 'Aviso', value: 'aviso' },
        { name: 'Sucesso', value: 'sucesso' },
        { name: 'Erro / atenção', value: 'erro' }
      ))
    .addStringOption((option) => option.setName('titulo').setDescription('Título').setRequired(true).setMaxLength(256))
    .addStringOption((option) => option.setName('descricao').setDescription('Texto do template').setRequired(true).setMaxLength(4000))
    .addChannelOption((option) => option
      .setName('canal')
      .setDescription('Canal de destino; padrão: canal atual')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)));

const COMMANDS = [configurarCommand, embedCommand];

async function registerCommands(guild) {
  if (!isMangaMorphGuild(guild)) return;
  const existing = await guild.commands.fetch();
  for (const builder of COMMANDS) {
    const data = builder.toJSON();
    const command = existing.find((item) => item.name === data.name);
    if (command) await command.edit(data);
    else await guild.commands.create(data);
  }
  console.log(`[MM-ADMIN] ${guild.name}: comandos administrativos registrados.`);
}

function parseColor(input, fallback = 0x5865f2) {
  if (!input) return fallback;
  const normalized = input.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return Number.parseInt(normalized, 16);
}

function validHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasAdminAccess(interaction) {
  return interaction.user.id === interaction.guild.ownerId ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

async function resolveMessageChannel(interaction) {
  const selected = interaction.options.getChannel('canal');
  const channel = selected || interaction.channel;
  if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return null;
  return channel;
}

async function applyChannelMode(guild, channel, mode) {
  if (!mode) return;
  const memberRole = await findMemberRole(guild);
  const staffRoles = await findStaffRoles(guild);

  if (mode === 'staff') {
    await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
      ViewChannel: false,
      SendMessages: false,
      CreatePublicThreads: false,
      SendMessagesInThreads: false
    });
    if (memberRole) {
      await channel.permissionOverwrites.edit(memberRole.id, {
        ViewChannel: false,
        SendMessages: false,
        CreatePublicThreads: false,
        SendMessagesInThreads: false
      });
    }
    for (const role of staffRoles.values()) {
      await channel.permissionOverwrites.edit(role.id, {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: true,
        CreatePublicThreads: true,
        SendMessagesInThreads: true,
        AttachFiles: true,
        EmbedLinks: true
      });
    }
    return;
  }

  const base = mode === 'leitura'
    ? {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false,
        CreatePublicThreads: false,
        SendMessagesInThreads: false,
        AttachFiles: false,
        EmbedLinks: false
      }
    : mode === 'midia'
      ? {
          ViewChannel: true,
          ReadMessageHistory: true,
          SendMessages: true,
          CreatePublicThreads: true,
          SendMessagesInThreads: true,
          AttachFiles: true,
          EmbedLinks: true
        }
      : {
          ViewChannel: true,
          ReadMessageHistory: true,
          SendMessages: true,
          CreatePublicThreads: true,
          SendMessagesInThreads: true
        };

  await channel.permissionOverwrites.edit(guild.roles.everyone.id, base);
  if (memberRole) await channel.permissionOverwrites.edit(memberRole.id, base);
}

function makeEmbed({ title, description, color, image, footer }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
  if (image) embed.setImage(image);
  if (footer) embed.setFooter({ text: footer });
  return embed;
}

export async function setupMangaMorphAdmin(guild, client) {
  if (!isMangaMorphGuild(guild)) return;
  await ensureWorksForum(guild, client);
  await registerCommands(guild);
}

export async function handleMangaMorphAdminInteraction(interaction, client) {
  if (!interaction.inGuild() || !interaction.isChatInputCommand()) return false;
  if (!['configurar', 'embed'].includes(interaction.commandName)) return false;
  if (!isMangaMorphGuild(interaction.guild)) return false;

  if (!hasAdminAccess(interaction)) {
    await interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
    return true;
  }

  if (interaction.commandName === 'configurar') {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'forum-obras') {
      const forum = await ensureWorksForum(interaction.guild, client);
      await interaction.reply({ content: `✅ Fórum configurado: ${forum}`, ephemeral: true });
      return true;
    }

    const channel = interaction.options.getChannel('canal') || interaction.channel;
    if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(channel.type)) {
      await interaction.reply({ content: 'Escolha um canal de texto, anúncio ou fórum.', ephemeral: true });
      return true;
    }

    const mode = interaction.options.getString('modo');
    const name = interaction.options.getString('nome');
    const topic = interaction.options.getString('topico');
    const slowmode = interaction.options.getInteger('slowmode');

    await applyChannelMode(interaction.guild, channel, mode);
    const changes = {};
    if (name) changes.name = name;
    if (topic !== null) changes.topic = topic;
    if (slowmode !== null && channel.type !== ChannelType.GuildForum) changes.rateLimitPerUser = slowmode;
    if (slowmode !== null && channel.type === ChannelType.GuildForum) changes.defaultThreadRateLimitPerUser = slowmode;
    if (Object.keys(changes).length) await channel.edit(changes);

    await interaction.reply({
      content: `✅ ${channel} configurado${mode ? ` no modo **${mode}**` : ''}.`,
      ephemeral: true
    });
    return true;
  }

  if (interaction.commandName === 'embed') {
    const subcommand = interaction.options.getSubcommand();
    const channel = await resolveMessageChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: 'Use este comando em um canal de texto ou selecione um canal compatível.', ephemeral: true });
      return true;
    }

    if (subcommand === 'criar') {
      const color = parseColor(interaction.options.getString('cor'));
      if (color === null) {
        await interaction.reply({ content: 'Cor inválida. Use o formato `#5865F2`.', ephemeral: true });
        return true;
      }
      const image = interaction.options.getString('imagem');
      if (image && !validHttpUrl(image)) {
        await interaction.reply({ content: 'A imagem precisa ser uma URL `http` ou `https` válida.', ephemeral: true });
        return true;
      }
      const embed = makeEmbed({
        title: interaction.options.getString('titulo', true),
        description: interaction.options.getString('descricao', true),
        color,
        image,
        footer: interaction.options.getString('rodape') || 'MangaMorph • Template oficial'
      });
      const message = await channel.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ Embed publicado: ${message.url}`, ephemeral: true });
      return true;
    }

    if (subcommand === 'template') {
      const type = interaction.options.getString('tipo', true);
      const colors = { info: 0x5865f2, anuncio: 0x7b61ff, aviso: 0xf0b232, sucesso: 0x57f287, erro: 0xed4245 };
      const labels = { info: 'INFORMAÇÃO', anuncio: 'ANÚNCIO', aviso: 'AVISO', sucesso: 'CONCLUÍDO', erro: 'ATENÇÃO' };
      const embed = new EmbedBuilder()
        .setColor(colors[type] || 0x5865f2)
        .setAuthor({ name: `MangaMorph • ${labels[type] || 'OFICIAL'}` })
        .setTitle(interaction.options.getString('titulo', true))
        .setDescription(interaction.options.getString('descricao', true))
        .setFooter({ text: 'MangaMorph • Comunidade Oficial' })
        .setTimestamp();
      const message = await channel.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ Template publicado: ${message.url}`, ephemeral: true });
      return true;
    }

    const messageId = interaction.options.getString('mensagem', true);
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      await interaction.reply({ content: 'Mensagem não encontrada nesse canal.', ephemeral: true });
      return true;
    }
    if (message.author.id !== client.user.id) {
      await interaction.reply({ content: 'Só posso modificar mensagens publicadas por mim.', ephemeral: true });
      return true;
    }

    if (subcommand === 'excluir') {
      await message.delete();
      await interaction.reply({ content: '✅ Embed excluído.', ephemeral: true });
      return true;
    }

    const source = message.embeds[0];
    if (!source) {
      await interaction.reply({ content: 'Essa mensagem não contém um embed.', ephemeral: true });
      return true;
    }

    const title = interaction.options.getString('titulo');
    const description = interaction.options.getString('descricao');
    const colorInput = interaction.options.getString('cor');
    const imageInput = interaction.options.getString('imagem');
    const footerInput = interaction.options.getString('rodape');

    if ([title, description, colorInput, imageInput, footerInput].every((value) => value === null)) {
      await interaction.reply({ content: 'Informe pelo menos um campo para alterar.', ephemeral: true });
      return true;
    }

    const color = colorInput ? parseColor(colorInput) : null;
    if (colorInput && color === null) {
      await interaction.reply({ content: 'Cor inválida. Use o formato `#5865F2`.', ephemeral: true });
      return true;
    }
    if (imageInput && normalize(imageInput) !== 'remover' && !validHttpUrl(imageInput)) {
      await interaction.reply({ content: 'A imagem precisa ser uma URL válida ou `remover`.', ephemeral: true });
      return true;
    }

    const embed = EmbedBuilder.from(source);
    if (title !== null) embed.setTitle(title);
    if (description !== null) embed.setDescription(description);
    if (colorInput !== null) embed.setColor(color);
    if (imageInput !== null) {
      if (normalize(imageInput) === 'remover') embed.setImage(null);
      else embed.setImage(imageInput);
    }
    if (footerInput !== null) {
      if (normalize(footerInput) === 'remover') embed.setFooter(null);
      else embed.setFooter({ text: footerInput });
    }

    await message.edit({ embeds: [embed] });
    await interaction.reply({ content: `✅ Embed atualizado: ${message.url}`, ephemeral: true });
    return true;
  }

  return false;
}
