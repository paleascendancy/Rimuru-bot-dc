import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';

const CONFIG_TOPIC = 'MM_WELCOME_CONFIG_V1';
const CONFIG_MESSAGE = 'MM_WELCOME_CONFIG_V1';
const CONFIG_FILENAME = 'welcome-config.json';

const DEFAULT_CONFIG = {
  enabled: true,
  channelId: null,
  content: '',
  title: 'Bem-vindo ao {server}',
  description: 'Olá, {user}! Seja bem-vindo(a) à comunidade. Você é o membro **#{membercount}**.',
  color: '#5865F2',
  url: '',
  image: '',
  thumbnail: '{avatar}',
  author: '{server}',
  authorUrl: '',
  authorIcon: '',
  footer: 'Membro #{membercount} • {server}',
  footerIcon: '',
  fields: [],
  buttons: [],
  timestamp: true,
  mention: true,
  sendDm: false,
  useWebhook: false,
  webhookId: '',
  webhookName: '{server}',
  webhookAvatar: ''
};

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

function validHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseColor(value, fallback = '#5865F2') {
  const source = value || fallback;
  const clean = source.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return Number.parseInt(clean, 16);
}

function parseFields(value) {
  if (!value) return [];
  return value.split(';;').map((part) => part.trim()).filter(Boolean).slice(0, 25).map((part) => {
    const [name = '', fieldValue = '', inline = 'false'] = part.split('|');
    return {
      name: name.trim().slice(0, 256) || 'Campo',
      value: fieldValue.trim().slice(0, 1024) || '—',
      inline: ['true', 'sim', '1', 'inline'].includes(inline.trim().toLowerCase())
    };
  });
}

function parseButtons(value) {
  if (!value) return [];
  return value.split(';;').map((part) => part.trim()).filter(Boolean).slice(0, 5).map((part) => {
    const [label = '', url = '', emoji = ''] = part.split('|');
    const cleanUrl = url.trim();
    if (!validHttpUrl(cleanUrl)) throw new Error(`URL de botão inválida: ${cleanUrl || '(vazia)'}`);
    return {
      label: label.trim().slice(0, 80) || 'Abrir',
      url: cleanUrl,
      emoji: emoji.trim().slice(0, 64)
    };
  });
}

function stringifyFields(fields = []) {
  return fields.map((field) => `${field.name}|${field.value}|${field.inline ? 'true' : 'false'}`).join(';;');
}

function stringifyButtons(buttons = []) {
  return buttons.map((button) => `${button.label}|${button.url}|${button.emoji || ''}`).join(';;');
}

function replaceTokens(value, member) {
  if (!value) return '';
  const user = member.user;
  const displayName = member.displayName || user.globalName || user.username;
  const avatar = user.displayAvatarURL({ size: 1024 });
  return String(value)
    .replaceAll('{user}', displayName)
    .replaceAll('{username}', user.username)
    .replaceAll('{displayname}', displayName)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount))
    .replaceAll('{avatar}', avatar)
    .replaceAll('{id}', user.id);
}

function removable(current, incoming) {
  if (incoming === null || incoming === undefined) return current;
  if (['remover', 'remove', 'limpar', 'clear'].includes(incoming.trim().toLowerCase())) return '';
  return incoming;
}

async function findStaffCategory(guild) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) =>
    channel?.type === ChannelType.GuildCategory &&
    ['equipe', 'staff'].some((name) => normalize(channel.name).includes(name))
  ) || null;
}

async function ensureConfigChannel(guild, client) {
  const channels = await guild.channels.fetch();
  let channel = channels.find((item) => item?.type === ChannelType.GuildText && item.topic === CONFIG_TOPIC) || null;
  if (channel) return channel;

  const category = await findStaffCategory(guild);
  channel = await guild.channels.create({
    name: '🔒・welcome-config',
    type: ChannelType.GuildText,
    parent: category?.id || undefined,
    topic: CONFIG_TOPIC,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ],
    reason: 'Armazenamento interno da configuração de boas-vindas'
  });
  return channel;
}

async function loadConfig(guild, client) {
  const channels = await guild.channels.fetch();
  const channel = channels.find((item) => item?.type === ChannelType.GuildText && item.topic === CONFIG_TOPIC) || null;
  if (!channel) return null;

  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  if (!messages) return null;
  const message = messages.find((item) => item.author.id === client.user.id && item.content === CONFIG_MESSAGE && item.attachments.size);
  if (!message) return null;
  const attachment = message.attachments.find((item) => item.name === CONFIG_FILENAME) || message.attachments.first();
  if (!attachment) return null;

  try {
    const response = await fetch(attachment.url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const parsed = JSON.parse(await response.text());
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (error) {
    console.error(`[WELCOME] Falha ao carregar configuração em ${guild.name}:`, error);
    return null;
  }
}

async function saveConfig(guild, client, config) {
  const channel = await ensureConfigChannel(guild, client);
  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  if (messages) {
    const old = messages.filter((item) => item.author.id === client.user.id && item.content === CONFIG_MESSAGE);
    for (const message of old.values()) await message.delete().catch(() => {});
  }

  await channel.send({
    content: CONFIG_MESSAGE,
    files: [{ attachment: Buffer.from(JSON.stringify(config, null, 2), 'utf8'), name: CONFIG_FILENAME }],
    allowedMentions: { parse: [] }
  });
}

async function resolveTargetChannel(guild, channelId) {
  if (!channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return null;
  return channel;
}

function validateConfig(config) {
  const color = parseColor(config.color);
  if (color === null) throw new Error('Cor inválida. Use hexadecimal, por exemplo `#5865F2`.');

  for (const [label, value] of [
    ['URL do título', config.url],
    ['Imagem', config.image],
    ['Thumbnail', config.thumbnail],
    ['URL do autor', config.authorUrl],
    ['Ícone do autor', config.authorIcon],
    ['Ícone do rodapé', config.footerIcon],
    ['Avatar do webhook', config.webhookAvatar]
  ]) {
    if (!value || value.includes('{avatar}')) continue;
    if (!validHttpUrl(value)) throw new Error(`${label} inválida.`);
  }

  if (!config.content && !config.title && !config.description && !config.image && !config.thumbnail && !config.fields?.length) {
    throw new Error('A mensagem precisa ter conteúdo ou alguma parte do embed.');
  }
}

function buildRenderedPayload(config, member) {
  const color = parseColor(config.color) ?? 0x5865F2;
  const title = replaceTokens(config.title, member);
  const description = replaceTokens(config.description, member);
  const image = replaceTokens(config.image, member);
  const thumbnail = replaceTokens(config.thumbnail, member);
  const author = replaceTokens(config.author, member);
  const authorUrl = replaceTokens(config.authorUrl, member);
  const authorIcon = replaceTokens(config.authorIcon, member);
  const footer = replaceTokens(config.footer, member);
  const footerIcon = replaceTokens(config.footerIcon, member);
  const url = replaceTokens(config.url, member);

  let embed = null;
  const hasEmbed = Boolean(title || description || image || thumbnail || author || footer || (config.fields || []).length);
  if (hasEmbed) {
    embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (url && validHttpUrl(url)) embed.setURL(url);
    if (image && validHttpUrl(image)) embed.setImage(image);
    if (thumbnail && validHttpUrl(thumbnail)) embed.setThumbnail(thumbnail);
    if (author) embed.setAuthor({
      name: author.slice(0, 256),
      url: authorUrl && validHttpUrl(authorUrl) ? authorUrl : undefined,
      iconURL: authorIcon && validHttpUrl(authorIcon) ? authorIcon : undefined
    });
    if (footer) embed.setFooter({
      text: footer.slice(0, 2048),
      iconURL: footerIcon && validHttpUrl(footerIcon) ? footerIcon : undefined
    });
    const fields = (config.fields || []).slice(0, 25).map((field) => ({
      name: replaceTokens(field.name, member).slice(0, 256) || 'Campo',
      value: replaceTokens(field.value, member).slice(0, 1024) || '—',
      inline: Boolean(field.inline)
    }));
    if (fields.length) embed.addFields(fields);
    if (config.timestamp) embed.setTimestamp();
  }

  let components = [];
  if (config.buttons?.length) {
    const row = new ActionRowBuilder();
    for (const button of config.buttons.slice(0, 5)) {
      const builder = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(replaceTokens(button.label, member).slice(0, 80))
        .setURL(replaceTokens(button.url, member));
      if (button.emoji) builder.setEmoji(button.emoji);
      row.addComponents(builder);
    }
    components = [row];
  }

  return {
    content: replaceTokens(config.content, member) || undefined,
    embeds: embed ? [embed] : [],
    components,
    allowedMentions: {
      parse: [],
      users: config.mention ? [member.id] : [],
      roles: []
    }
  };
}

async function ensureWelcomeWebhook(channel, config, client) {
  if (!config.useWebhook) return null;
  if (!channel.permissionsFor(client.user)?.has(PermissionFlagsBits.ManageWebhooks)) {
    throw new Error('O bot precisa da permissão **Gerenciar Webhooks** no canal de boas-vindas.');
  }

  const webhooks = await channel.fetchWebhooks();
  if (config.webhookId && webhooks.has(config.webhookId)) return webhooks.get(config.webhookId);

  const owned = webhooks.find((webhook) => webhook.owner?.id === client.user.id && normalize(webhook.name).includes('welcome'));
  if (owned) return owned;

  return channel.createWebhook({
    name: 'MangaMorph Welcome',
    reason: 'Webhook do sistema de boas-vindas'
  });
}

async function sendWelcome(member, client, config, destinationOverride = null) {
  const channel = destinationOverride || await resolveTargetChannel(member.guild, config.channelId);
  if (!channel) throw new Error('O canal configurado para boas-vindas não existe mais.');

  const payload = buildRenderedPayload(config, member);
  if (config.useWebhook) {
    const webhook = await ensureWelcomeWebhook(channel, config, client);
    await webhook.send({
      ...payload,
      username: replaceTokens(config.webhookName || member.guild.name, member).slice(0, 80),
      avatarURL: replaceTokens(config.webhookAvatar, member) || undefined
    });
  } else {
    await channel.send(payload);
  }

  if (config.sendDm) {
    await member.send({ ...payload, allowedMentions: { parse: [] } }).catch(() => {});
  }
}

function addCommonOptions(subcommand, requireChannel = false) {
  return subcommand
    .addChannelOption((option) => option
      .setName('canal')
      .setDescription(requireChannel ? 'Canal onde as boas-vindas serão enviadas' : 'Novo canal de boas-vindas')
      .setRequired(requireChannel)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((option) => option.setName('conteudo').setDescription('Texto fora do embed; use remover para limpar').setMaxLength(2000))
    .addStringOption((option) => option.setName('titulo').setDescription('Título do embed; aceita variáveis').setMaxLength(256))
    .addStringOption((option) => option.setName('descricao').setDescription('Descrição; use remover para limpar').setMaxLength(4000))
    .addStringOption((option) => option.setName('cor').setDescription('Cor hexadecimal, ex.: #5865F2').setMaxLength(7))
    .addStringOption((option) => option.setName('url').setDescription('URL clicável do título; remover para limpar').setMaxLength(1000))
    .addStringOption((option) => option.setName('imagem').setDescription('URL da imagem grande; remover para limpar').setMaxLength(1000))
    .addStringOption((option) => option.setName('thumbnail').setDescription('URL da miniatura ou {avatar}; remover para limpar').setMaxLength(1000))
    .addStringOption((option) => option.setName('autor').setDescription('Nome do autor; remover para limpar').setMaxLength(256))
    .addStringOption((option) => option.setName('autor_url').setDescription('URL do autor; remover para limpar').setMaxLength(1000))
    .addStringOption((option) => option.setName('autor_icone').setDescription('Ícone do autor; remover para limpar').setMaxLength(1000))
    .addStringOption((option) => option.setName('rodape').setDescription('Texto do rodapé; remover para limpar').setMaxLength(2048))
    .addStringOption((option) => option.setName('rodape_icone').setDescription('Ícone do rodapé; remover para limpar').setMaxLength(1000))
    .addStringOption((option) => option.setName('campos').setDescription('Nome|Valor|inline;;Nome2|Valor2|false; remover limpa').setMaxLength(4000))
    .addStringOption((option) => option.setName('botoes').setDescription('Texto|URL|emoji;;... até 5; remover limpa').setMaxLength(4000))
    .addBooleanOption((option) => option.setName('timestamp').setDescription('Mostrar data/hora no embed'))
    .addBooleanOption((option) => option.setName('mencionar').setDescription('Mencionar o novo membro de verdade'))
    .addBooleanOption((option) => option.setName('enviar_dm').setDescription('Também enviar a mensagem por DM'))
    .addBooleanOption((option) => option.setName('webhook').setDescription('Enviar como webhook personalizado'))
    .addStringOption((option) => option.setName('webhook_nome').setDescription('Nome exibido pelo webhook').setMaxLength(80))
    .addStringOption((option) => option.setName('webhook_avatar').setDescription('URL do avatar exibido pelo webhook').setMaxLength(1000));
}

const welcomeCommand = new SlashCommandBuilder()
  .setName('boas-vindas')
  .setDescription('Cria e personaliza o sistema automático de boas-vindas')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

welcomeCommand.addSubcommand((subcommand) => addCommonOptions(
  subcommand.setName('criar').setDescription('Cria uma mensagem automática de boas-vindas totalmente personalizada'),
  true
));
welcomeCommand.addSubcommand((subcommand) => addCommonOptions(
  subcommand.setName('editar').setDescription('Edita qualquer parte da mensagem de boas-vindas atual'),
  false
));
welcomeCommand
  .addSubcommand((subcommand) => subcommand.setName('ver').setDescription('Mostra uma prévia da configuração atual'))
  .addSubcommand((subcommand) => subcommand.setName('testar').setDescription('Envia um teste no canal configurado'))
  .addSubcommand((subcommand) => subcommand.setName('ativar').setDescription('Ativa novamente as boas-vindas automáticas'))
  .addSubcommand((subcommand) => subcommand.setName('desativar').setDescription('Desativa as boas-vindas automáticas'));

function applyOptions(interaction, base) {
  const config = { ...base };
  const channel = interaction.options.getChannel('canal');
  if (channel) config.channelId = channel.id;

  const stringMap = {
    conteudo: 'content', titulo: 'title', descricao: 'description', cor: 'color', url: 'url', imagem: 'image',
    thumbnail: 'thumbnail', autor: 'author', autor_url: 'authorUrl', autor_icone: 'authorIcon', rodape: 'footer',
    rodape_icone: 'footerIcon', webhook_nome: 'webhookName', webhook_avatar: 'webhookAvatar'
  };
  for (const [optionName, key] of Object.entries(stringMap)) {
    const value = interaction.options.getString(optionName);
    config[key] = removable(config[key], value);
  }

  const fieldsInput = interaction.options.getString('campos');
  if (fieldsInput !== null) config.fields = ['remover', 'limpar', 'clear'].includes(fieldsInput.trim().toLowerCase()) ? [] : parseFields(fieldsInput);
  const buttonsInput = interaction.options.getString('botoes');
  if (buttonsInput !== null) config.buttons = ['remover', 'limpar', 'clear'].includes(buttonsInput.trim().toLowerCase()) ? [] : parseButtons(buttonsInput);

  const timestamp = interaction.options.getBoolean('timestamp');
  const mention = interaction.options.getBoolean('mencionar');
  const sendDm = interaction.options.getBoolean('enviar_dm');
  const webhook = interaction.options.getBoolean('webhook');
  if (timestamp !== null) config.timestamp = timestamp;
  if (mention !== null) config.mention = mention;
  if (sendDm !== null) config.sendDm = sendDm;
  if (webhook !== null) config.useWebhook = webhook;

  config.enabled = true;
  return config;
}

function configSummary(config, channel) {
  return [
    `**Status:** ${config.enabled ? '🟢 Ativo' : '🔴 Desativado'}`,
    `**Canal:** ${channel || `\`${config.channelId || 'não definido'}\``}`,
    `**Webhook:** ${config.useWebhook ? 'Sim' : 'Não'}`,
    `**Menciona membro:** ${config.mention ? 'Sim' : 'Não'}`,
    `**Envia DM:** ${config.sendDm ? 'Sim' : 'Não'}`,
    `**Campos:** ${(config.fields || []).length}`,
    `**Botões:** ${(config.buttons || []).length}`,
    '',
    '**Variáveis disponíveis**',
    '`{user}` `{username}` `{displayname}` `{server}` `{membercount}` `{avatar}` `{id}`'
  ].join('\n');
}

export async function setupWelcomeManager(guild, client) {
  const commands = await guild.commands.fetch();
  const data = welcomeCommand.toJSON();
  const existing = commands.find((command) => command.name === data.name);
  if (existing) await existing.edit(data);
  else await guild.commands.create(data);
  console.log(`[WELCOME] ${guild.name}: /boas-vindas registrado.`);
}

export async function handleWelcomeManagerInteraction(interaction, client) {
  if (!interaction.inGuild() || !interaction.isChatInputCommand() || interaction.commandName !== 'boas-vindas') return false;

  const allowed = interaction.user.id === interaction.guild.ownerId ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (!allowed) {
    await interaction.reply({ content: 'Você não tem permissão para configurar as boas-vindas.', ephemeral: true });
    return true;
  }

  const subcommand = interaction.options.getSubcommand();
  const current = await loadConfig(interaction.guild, client);

  try {
    if (subcommand === 'criar') {
      const config = applyOptions(interaction, { ...DEFAULT_CONFIG });
      validateConfig(config);
      const channel = await resolveTargetChannel(interaction.guild, config.channelId);
      if (!channel) throw new Error('Escolha um canal de texto válido.');
      if (config.useWebhook) {
        const webhook = await ensureWelcomeWebhook(channel, config, client);
        config.webhookId = webhook.id;
      }
      await saveConfig(interaction.guild, client, config);
      await interaction.reply({ content: `✅ Boas-vindas criadas e ativadas em ${channel}. Use \`/boas-vindas testar\` para conferir.`, ephemeral: true });
      return true;
    }

    if (!current) {
      await interaction.reply({ content: 'Ainda não existe uma configuração personalizada. Use `/boas-vindas criar` primeiro.', ephemeral: true });
      return true;
    }

    if (subcommand === 'editar') {
      const config = applyOptions(interaction, current);
      validateConfig(config);
      const channel = await resolveTargetChannel(interaction.guild, config.channelId);
      if (!channel) throw new Error('O canal de boas-vindas configurado não é válido.');
      if (config.useWebhook) {
        const webhook = await ensureWelcomeWebhook(channel, config, client);
        config.webhookId = webhook.id;
      }
      await saveConfig(interaction.guild, client, config);
      await interaction.reply({ content: `✅ Boas-vindas atualizadas em ${channel}.`, ephemeral: true });
      return true;
    }

    if (subcommand === 'desativar' || subcommand === 'ativar') {
      const config = { ...current, enabled: subcommand === 'ativar' };
      await saveConfig(interaction.guild, client, config);
      await interaction.reply({ content: subcommand === 'ativar' ? '🟢 Boas-vindas ativadas.' : '🔴 Boas-vindas desativadas.', ephemeral: true });
      return true;
    }

    if (subcommand === 'testar') {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await sendWelcome(member, client, current);
      await interaction.reply({ content: '✅ Teste enviado no canal configurado.', ephemeral: true });
      return true;
    }

    if (subcommand === 'ver') {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const channel = await resolveTargetChannel(interaction.guild, current.channelId);
      const payload = buildRenderedPayload(current, member);
      const summary = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Configuração de boas-vindas')
        .setDescription(configSummary(current, channel));
      await interaction.reply({
        content: payload.content,
        embeds: [summary, ...payload.embeds].slice(0, 10),
        components: payload.components,
        ephemeral: true,
        allowedMentions: { parse: [] }
      });
      return true;
    }
  } catch (error) {
    console.error('[WELCOME] Falha:', error);
    const message = error?.message || 'Falha ao configurar as boas-vindas.';
    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    else await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    return true;
  }

  return false;
}

export async function sendConfiguredWelcome(member, client) {
  const config = await loadConfig(member.guild, client);
  if (!config) return false;
  if (!config.enabled) return true;

  await sendWelcome(member, client, config);
  return true;
}

export { stringifyFields, stringifyButtons };
