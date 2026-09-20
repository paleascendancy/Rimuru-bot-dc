import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

const sessions = new Map();
const WELCOME_CONFIG_TOPIC = 'MM_WELCOME_CONFIG_V1';
const WELCOME_CONFIG_MESSAGE = 'MM_WELCOME_CONFIG_V1';
const WELCOME_CONFIG_FILENAME = 'welcome-config.json';

const DEFAULT_WELCOME = {
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

const DEFAULT_EMBED = {
  channelId: null,
  content: '',
  title: 'Novo embed',
  description: 'Use os controles abaixo para personalizar. A prévia será atualizada a cada alteração.',
  color: '#5865F2',
  url: '',
  image: '',
  thumbnail: '',
  author: '',
  authorUrl: '',
  authorIcon: '',
  footer: '',
  footerIcon: '',
  fields: [],
  buttons: [],
  timestamp: false,
  useWebhook: false,
  webhookId: '',
  webhookName: '',
  webhookAvatar: ''
};

const sessionKey = (interaction) => `${interaction.guildId}:${interaction.user.id}`;
const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function canManage(interaction, type) {
  if (interaction.user.id === interaction.guild.ownerId) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  return type === 'embed' && interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
}

function validUrl(value, allowAvatarToken = false) {
  if (!value) return false;
  if (allowAvatarToken && value.includes('{avatar}')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseColor(value) {
  const clean = String(value || '#5865F2').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return Number.parseInt(clean, 16);
}

function cleanValue(value = '') {
  const trimmed = String(value).trim();
  if (['remover', 'remove', 'limpar', 'clear', '-'].includes(trimmed.toLowerCase())) return '';
  return trimmed;
}

function parseFields(value) {
  const source = cleanValue(value);
  if (!source) return [];
  return source.split(';;').map((part) => part.trim()).filter(Boolean).slice(0, 25).map((part) => {
    const [name = '', fieldValue = '', inline = 'false'] = part.split('|');
    return {
      name: name.trim().slice(0, 256) || 'Campo',
      value: fieldValue.trim().slice(0, 1024) || '—',
      inline: ['true', 'sim', '1', 'inline'].includes(inline.trim().toLowerCase())
    };
  });
}

function parseButtons(value) {
  const source = cleanValue(value);
  if (!source) return [];
  return source.split(';;').map((part) => part.trim()).filter(Boolean).slice(0, 5).map((part) => {
    const [label = '', url = '', emoji = ''] = part.split('|');
    const target = url.trim();
    if (!validUrl(target)) throw new Error(`URL de botão inválida: ${target || '(vazia)'}`);
    return { label: label.trim().slice(0, 80) || 'Abrir', url: target, emoji: emoji.trim().slice(0, 64) };
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
  return String(value)
    .replaceAll('{user}', `<@${user.id}>`)
    .replaceAll('{username}', user.username)
    .replaceAll('{displayname}', displayName)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount))
    .replaceAll('{avatar}', user.displayAvatarURL({ size: 1024 }))
    .replaceAll('{id}', user.id);
}

function rendered(value, session, member) {
  return session.type === 'welcome' ? replaceTokens(value, member) : String(value || '');
}

function validateSession(session) {
  if (parseColor(session.config.color) === null) throw new Error('Cor inválida. Use hexadecimal, por exemplo `#5865F2`.');
  const allowToken = session.type === 'welcome';
  for (const [label, value] of [
    ['URL do título', session.config.url], ['Imagem', session.config.image], ['Thumbnail', session.config.thumbnail],
    ['URL do autor', session.config.authorUrl], ['Ícone do autor', session.config.authorIcon],
    ['Ícone do rodapé', session.config.footerIcon], ['Avatar do webhook', session.config.webhookAvatar]
  ]) {
    if (value && !validUrl(value, allowToken)) throw new Error(`${label} inválida.`);
  }
  if (!session.config.content && !session.config.title && !session.config.description && !session.config.image && !session.config.thumbnail && !session.config.fields?.length) {
    throw new Error('A mensagem precisa ter texto ou alguma parte do embed.');
  }
}

function buildMessage(session, member) {
  const config = session.config;
  const color = parseColor(config.color) ?? 0x5865F2;
  const title = rendered(config.title, session, member);
  const description = rendered(config.description, session, member);
  const url = rendered(config.url, session, member);
  const image = rendered(config.image, session, member);
  const thumbnail = rendered(config.thumbnail, session, member);
  const author = rendered(config.author, session, member);
  const authorUrl = rendered(config.authorUrl, session, member);
  const authorIcon = rendered(config.authorIcon, session, member);
  const footer = rendered(config.footer, session, member);
  const footerIcon = rendered(config.footerIcon, session, member);

  let embed = null;
  const hasEmbed = Boolean(title || description || image || thumbnail || author || footer || config.fields?.length);
  if (hasEmbed) {
    embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(title.slice(0, 256));
    if (description) embed.setDescription(description.slice(0, 4096));
    if (url && validUrl(url)) embed.setURL(url);
    if (image && validUrl(image)) embed.setImage(image);
    if (thumbnail && validUrl(thumbnail)) embed.setThumbnail(thumbnail);
    if (author) embed.setAuthor({
      name: author.slice(0, 256),
      url: authorUrl && validUrl(authorUrl) ? authorUrl : undefined,
      iconURL: authorIcon && validUrl(authorIcon) ? authorIcon : undefined
    });
    if (footer) embed.setFooter({
      text: footer.slice(0, 2048),
      iconURL: footerIcon && validUrl(footerIcon) ? footerIcon : undefined
    });
    const fields = (config.fields || []).slice(0, 25).map((field) => ({
      name: rendered(field.name, session, member).slice(0, 256) || 'Campo',
      value: rendered(field.value, session, member).slice(0, 1024) || '—',
      inline: Boolean(field.inline)
    }));
    if (fields.length) embed.addFields(fields);
    if (config.timestamp) embed.setTimestamp();
  }

  let linkRow = null;
  if (config.buttons?.length) {
    linkRow = new ActionRowBuilder();
    for (const button of config.buttons.slice(0, 5)) {
      const target = rendered(button.url, session, member);
      if (!validUrl(target)) continue;
      const builder = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(rendered(button.label, session, member).slice(0, 80)).setURL(target);
      if (button.emoji) builder.setEmoji(button.emoji);
      linkRow.addComponents(builder);
    }
    if (!linkRow.components.length) linkRow = null;
  }

  return {
    content: rendered(config.content, session, member) || undefined,
    embeds: embed ? [embed] : [],
    linkRow
  };
}

function toggleButton(id, label, enabled, emoji) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary);
}

function editorComponents(session, channelName) {
  const first = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lp_text').setLabel('Texto').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('lp_visual').setLabel('Visual').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lp_meta').setLabel('Autor/Rodapé').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lp_extras').setLabel('Campos/Botões').setEmoji('🧩').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lp_webhook').setLabel('Webhook').setEmoji('🪝').setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('lp_channel').setPlaceholder(`Destino: ${channelName || 'escolha um canal'}`.slice(0, 150)).setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)
  );

  const toggles = new ActionRowBuilder().addComponents(
    toggleButton('lp_toggle_timestamp', 'Timestamp', session.config.timestamp, '🕒'),
    toggleButton('lp_toggle_webhook', 'Webhook', session.config.useWebhook, '🪝')
  );
  if (session.type === 'welcome') {
    toggles.addComponents(
      toggleButton('lp_toggle_mention', 'Menção', session.config.mention, '📣'),
      toggleButton('lp_toggle_dm', 'DM', session.config.sendDm, '✉️')
    );
  }

  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lp_publish').setLabel(session.type === 'welcome' ? 'Salvar' : 'Publicar').setEmoji(session.type === 'welcome' ? '💾' : '📤').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('lp_reset').setLabel('Limpar').setEmoji('🧹').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lp_cancel').setLabel('Cancelar').setEmoji('✖️').setStyle(ButtonStyle.Danger)
  );

  return [first, channelRow, toggles, actions];
}

async function buildEditorReply(session, interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const channel = session.config.channelId ? await interaction.guild.channels.fetch(session.config.channelId).catch(() => null) : null;
  const message = buildMessage(session, member);
  const mode = session.config.useWebhook ? ` • webhook${session.config.webhookName ? `: ${rendered(session.config.webhookName, session, member)}` : ''}` : '';
  const content = `👁️ **Prévia ao vivo** • ${session.type === 'welcome' ? 'Boas-vindas' : 'Embed'}${mode}\n${message.content ? `\n${message.content}` : ''}`;
  const components = [];
  if (message.linkRow) components.push(message.linkRow);
  components.push(...editorComponents(session, channel?.name));
  return { content, embeds: message.embeds, components: components.slice(0, 5), allowedMentions: { parse: [] } };
}

function textInput(id, label, style, value, maxLength, required = false, placeholder = null) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setMaxLength(maxLength).setRequired(required);
  if (value) input.setValue(String(value).slice(0, maxLength));
  if (placeholder) input.setPlaceholder(placeholder);
  return input;
}

function modalFor(kind, session) {
  const c = session.config;
  if (kind === 'text') {
    return new ModalBuilder().setCustomId('lp_modal_text').setTitle('Texto do template').addComponents(
      new ActionRowBuilder().addComponents(textInput('content', 'Texto fora do embed', TextInputStyle.Paragraph, c.content, 2000, false, 'Opcional')),
      new ActionRowBuilder().addComponents(textInput('title', 'Título', TextInputStyle.Short, c.title, 256, false, 'Título do embed')),
      new ActionRowBuilder().addComponents(textInput('description', 'Descrição', TextInputStyle.Paragraph, c.description, 4000, false, 'Descrição principal'))
    );
  }
  if (kind === 'visual') {
    return new ModalBuilder().setCustomId('lp_modal_visual').setTitle('Visual do template').addComponents(
      new ActionRowBuilder().addComponents(textInput('color', 'Cor hexadecimal', TextInputStyle.Short, c.color, 7, false, '#5865F2')),
      new ActionRowBuilder().addComponents(textInput('url', 'URL clicável do título', TextInputStyle.Short, c.url, 1000, false, 'https://...')),
      new ActionRowBuilder().addComponents(textInput('image', 'Imagem grande', TextInputStyle.Short, c.image, 1000, false, 'https://...')),
      new ActionRowBuilder().addComponents(textInput('thumbnail', 'Thumbnail', TextInputStyle.Short, c.thumbnail, 1000, false, session.type === 'welcome' ? '{avatar} ou https://...' : 'https://...'))
    );
  }
  if (kind === 'meta') {
    return new ModalBuilder().setCustomId('lp_modal_meta').setTitle('Autor e rodapé').addComponents(
      new ActionRowBuilder().addComponents(textInput('author', 'Autor', TextInputStyle.Short, c.author, 256, false)),
      new ActionRowBuilder().addComponents(textInput('author_url', 'URL do autor', TextInputStyle.Short, c.authorUrl, 1000, false, 'https://...')),
      new ActionRowBuilder().addComponents(textInput('author_icon', 'Ícone do autor', TextInputStyle.Short, c.authorIcon, 1000, false, 'https://...')),
      new ActionRowBuilder().addComponents(textInput('footer', 'Rodapé', TextInputStyle.Short, c.footer, 2048, false)),
      new ActionRowBuilder().addComponents(textInput('footer_icon', 'Ícone do rodapé', TextInputStyle.Short, c.footerIcon, 1000, false, 'https://...'))
    );
  }
  if (kind === 'extras') {
    return new ModalBuilder().setCustomId('lp_modal_extras').setTitle('Campos e botões').addComponents(
      new ActionRowBuilder().addComponents(textInput('fields', 'Campos', TextInputStyle.Paragraph, stringifyFields(c.fields), 4000, false, 'Nome|Valor|true;;Nome 2|Valor 2|false')),
      new ActionRowBuilder().addComponents(textInput('buttons', 'Botões de link', TextInputStyle.Paragraph, stringifyButtons(c.buttons), 4000, false, 'Texto|https://link|emoji;;...'))
    );
  }
  return new ModalBuilder().setCustomId('lp_modal_webhook').setTitle('Webhook personalizado').addComponents(
    new ActionRowBuilder().addComponents(textInput('webhook_id', 'ID do webhook (embed)', TextInputStyle.Short, c.webhookId, 30, false, session.type === 'welcome' ? 'Não é necessário para boas-vindas' : 'ID de um webhook criado pelo bot')),
    new ActionRowBuilder().addComponents(textInput('webhook_name', 'Nome exibido', TextInputStyle.Short, c.webhookName, 80, false, session.type === 'welcome' ? '{server}' : 'Nome personalizado')),
    new ActionRowBuilder().addComponents(textInput('webhook_avatar', 'Avatar do webhook', TextInputStyle.Short, c.webhookAvatar, 1000, false, 'https://...'))
  );
}

async function findStaffCategory(guild) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) => channel?.type === ChannelType.GuildCategory && ['equipe', 'staff'].some((name) => normalize(channel.name).includes(name))) || null;
}

async function ensureWelcomeConfigChannel(guild, client) {
  const channels = await guild.channels.fetch();
  let channel = channels.find((item) => item?.type === ChannelType.GuildText && item.topic === WELCOME_CONFIG_TOPIC) || null;
  if (channel) return channel;
  const category = await findStaffCategory(guild);
  channel = await guild.channels.create({
    name: '🔒・welcome-config',
    type: ChannelType.GuildText,
    parent: category?.id || undefined,
    topic: WELCOME_CONFIG_TOPIC,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages] }
    ],
    reason: 'Armazenamento interno da configuração de boas-vindas'
  });
  return channel;
}

async function loadWelcomeConfig(guild, client) {
  const channels = await guild.channels.fetch();
  const channel = channels.find((item) => item?.type === ChannelType.GuildText && item.topic === WELCOME_CONFIG_TOPIC) || null;
  if (!channel) return null;
  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  if (!messages) return null;
  const message = messages.find((item) => item.author.id === client.user.id && item.content === WELCOME_CONFIG_MESSAGE && item.attachments.size);
  if (!message) return null;
  const attachment = message.attachments.find((item) => item.name === WELCOME_CONFIG_FILENAME) || message.attachments.first();
  if (!attachment) return null;
  try {
    const response = await fetch(attachment.url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return { ...DEFAULT_WELCOME, ...JSON.parse(await response.text()) };
  } catch {
    return null;
  }
}

async function saveWelcomeConfig(guild, client, config) {
  const channel = await ensureWelcomeConfigChannel(guild, client);
  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  if (messages) {
    for (const message of messages.filter((item) => item.author.id === client.user.id && item.content === WELCOME_CONFIG_MESSAGE).values()) {
      await message.delete().catch(() => {});
    }
  }
  await channel.send({
    content: WELCOME_CONFIG_MESSAGE,
    files: [{ attachment: Buffer.from(JSON.stringify(config, null, 2), 'utf8'), name: WELCOME_CONFIG_FILENAME }],
    allowedMentions: { parse: [] }
  });
}

function editorOption(description) {
  return {
    type: 1,
    name: 'editor',
    description,
    options: [{ type: 7, name: 'canal', description: 'Canal de destino; pode ser alterado dentro do editor', required: false, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] }]
  };
}

async function addEditorSubcommand(guild, commandName, description) {
  const commands = await guild.commands.fetch();
  const command = commands.find((item) => item.name === commandName);
  if (!command) return false;
  const json = command.toJSON();
  const options = (json.options || []).filter((option) => option.name !== 'editor');
  options.push(editorOption(description));
  const payload = { name: command.name, description: command.description, options };
  if (command.defaultMemberPermissions) payload.defaultMemberPermissions = command.defaultMemberPermissions;
  await command.edit(payload);
  return true;
}

export async function setupLivePreview(guild, client) {
  const embed = await addEditorSubcommand(guild, 'embed', 'Abre um editor visual com prévia ao vivo');
  const welcome = await addEditorSubcommand(guild, 'boas-vindas', 'Edita as boas-vindas com prévia ao vivo');
  console.log(`[LIVE-PREVIEW] ${guild.name}: embed=${embed ? 'ok' : 'ausente'} boas-vindas=${welcome ? 'ok' : 'ausente'}.`);
}

async function startEditor(interaction, client, type) {
  if (!canManage(interaction, type)) {
    await interaction.reply({ content: 'Você não tem permissão para usar esse editor.', ephemeral: true });
    return true;
  }
  const selected = interaction.options.getChannel('canal');
  let config;
  if (type === 'welcome') config = { ...DEFAULT_WELCOME, ...(await loadWelcomeConfig(interaction.guild, client) || {}) };
  else config = { ...DEFAULT_EMBED };
  if (selected) config.channelId = selected.id;
  if (!config.channelId && interaction.channel && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(interaction.channel.type)) config.channelId = interaction.channel.id;
  const session = { type, config, ownerId: interaction.user.id };
  sessions.set(sessionKey(interaction), session);
  const reply = await buildEditorReply(session, interaction);
  await interaction.reply({ ...reply, ephemeral: true });
  return true;
}

async function getSession(interaction) {
  const session = sessions.get(sessionKey(interaction));
  if (!session || session.ownerId !== interaction.user.id) {
    const payload = { content: 'Esta sessão de edição expirou. Abra o editor novamente.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
    return null;
  }
  return session;
}

async function publishSession(interaction, client, session) {
  validateSession(session);
  const channel = session.config.channelId ? await interaction.guild.channels.fetch(session.config.channelId).catch(() => null) : null;
  if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) throw new Error('Escolha um canal de destino válido.');

  if (session.type === 'welcome') {
    const config = { ...DEFAULT_WELCOME, ...session.config, enabled: true };
    await saveWelcomeConfig(interaction.guild, client, config);
    sessions.delete(sessionKey(interaction));
    await interaction.update({ content: `✅ Boas-vindas salvas. A prévia foi aplicada ao sistema automático em ${channel}.`, embeds: [], components: [] });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const built = buildMessage(session, member);
  const payload = { content: built.content, embeds: built.embeds, components: built.linkRow ? [built.linkRow] : [], allowedMentions: { parse: [] } };

  if (session.config.useWebhook) {
    if (!session.config.webhookId) throw new Error('Informe o ID do webhook no botão **Webhook** ou desative o modo webhook.');
    if (!channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.ManageWebhooks)) throw new Error('O bot precisa de **Gerenciar Webhooks** nesse canal.');
    const webhooks = await channel.fetchWebhooks();
    const webhook = webhooks.get(session.config.webhookId);
    if (!webhook || (webhook.owner?.id && webhook.owner.id !== client.user.id)) throw new Error('Webhook não encontrado nesse canal ou não foi criado por este bot.');
    await webhook.send({ ...payload, username: session.config.webhookName || undefined, avatarURL: session.config.webhookAvatar || undefined });
  } else {
    await channel.send(payload);
  }

  sessions.delete(sessionKey(interaction));
  await interaction.update({ content: `✅ Publicado em ${channel}.`, embeds: [], components: [] });
}

export async function handleLivePreviewInteraction(interaction, client) {
  if (!interaction.inGuild()) return false;

  if (interaction.isChatInputCommand() && ['embed', 'boas-vindas'].includes(interaction.commandName)) {
    const subcommand = interaction.options.getSubcommand(false);
    if (subcommand !== 'editor') return false;
    return startEditor(interaction, client, interaction.commandName === 'embed' ? 'embed' : 'welcome');
  }

  const relevantComponent = interaction.isButton() && interaction.customId.startsWith('lp_');
  const relevantSelect = interaction.isChannelSelectMenu() && interaction.customId === 'lp_channel';
  const relevantModal = interaction.isModalSubmit() && interaction.customId.startsWith('lp_modal_');
  if (!relevantComponent && !relevantSelect && !relevantModal) return false;

  const session = await getSession(interaction);
  if (!session) return true;

  try {
    if (relevantSelect) {
      session.config.channelId = interaction.values[0];
      await interaction.update(await buildEditorReply(session, interaction));
      return true;
    }

    if (relevantModal) {
      if (interaction.customId === 'lp_modal_text') {
        session.config.content = cleanValue(interaction.fields.getTextInputValue('content'));
        session.config.title = cleanValue(interaction.fields.getTextInputValue('title'));
        session.config.description = cleanValue(interaction.fields.getTextInputValue('description'));
      } else if (interaction.customId === 'lp_modal_visual') {
        const color = cleanValue(interaction.fields.getTextInputValue('color')) || '#5865F2';
        if (parseColor(color) === null) throw new Error('Cor inválida. Use hexadecimal como `#5865F2`.');
        session.config.color = color;
        session.config.url = cleanValue(interaction.fields.getTextInputValue('url'));
        session.config.image = cleanValue(interaction.fields.getTextInputValue('image'));
        session.config.thumbnail = cleanValue(interaction.fields.getTextInputValue('thumbnail'));
      } else if (interaction.customId === 'lp_modal_meta') {
        session.config.author = cleanValue(interaction.fields.getTextInputValue('author'));
        session.config.authorUrl = cleanValue(interaction.fields.getTextInputValue('author_url'));
        session.config.authorIcon = cleanValue(interaction.fields.getTextInputValue('author_icon'));
        session.config.footer = cleanValue(interaction.fields.getTextInputValue('footer'));
        session.config.footerIcon = cleanValue(interaction.fields.getTextInputValue('footer_icon'));
      } else if (interaction.customId === 'lp_modal_extras') {
        session.config.fields = parseFields(interaction.fields.getTextInputValue('fields'));
        session.config.buttons = parseButtons(interaction.fields.getTextInputValue('buttons'));
      } else if (interaction.customId === 'lp_modal_webhook') {
        session.config.webhookId = cleanValue(interaction.fields.getTextInputValue('webhook_id'));
        session.config.webhookName = cleanValue(interaction.fields.getTextInputValue('webhook_name'));
        session.config.webhookAvatar = cleanValue(interaction.fields.getTextInputValue('webhook_avatar'));
        if (session.config.webhookAvatar && !validUrl(session.config.webhookAvatar, session.type === 'welcome')) throw new Error('Avatar do webhook inválido.');
      }
      validateSession(session);
      await interaction.update(await buildEditorReply(session, interaction));
      return true;
    }

    if (interaction.customId === 'lp_text') await interaction.showModal(modalFor('text', session));
    else if (interaction.customId === 'lp_visual') await interaction.showModal(modalFor('visual', session));
    else if (interaction.customId === 'lp_meta') await interaction.showModal(modalFor('meta', session));
    else if (interaction.customId === 'lp_extras') await interaction.showModal(modalFor('extras', session));
    else if (interaction.customId === 'lp_webhook') await interaction.showModal(modalFor('webhook', session));
    else if (interaction.customId === 'lp_toggle_timestamp') {
      session.config.timestamp = !session.config.timestamp;
      await interaction.update(await buildEditorReply(session, interaction));
    } else if (interaction.customId === 'lp_toggle_webhook') {
      session.config.useWebhook = !session.config.useWebhook;
      await interaction.update(await buildEditorReply(session, interaction));
    } else if (interaction.customId === 'lp_toggle_mention' && session.type === 'welcome') {
      session.config.mention = !session.config.mention;
      await interaction.update(await buildEditorReply(session, interaction));
    } else if (interaction.customId === 'lp_toggle_dm' && session.type === 'welcome') {
      session.config.sendDm = !session.config.sendDm;
      await interaction.update(await buildEditorReply(session, interaction));
    } else if (interaction.customId === 'lp_reset') {
      const channelId = session.config.channelId;
      session.config = { ...(session.type === 'welcome' ? DEFAULT_WELCOME : DEFAULT_EMBED), channelId };
      await interaction.update(await buildEditorReply(session, interaction));
    } else if (interaction.customId === 'lp_cancel') {
      sessions.delete(sessionKey(interaction));
      await interaction.update({ content: 'Edição cancelada.', embeds: [], components: [] });
    } else if (interaction.customId === 'lp_publish') {
      await publishSession(interaction, client, session);
    }
    return true;
  } catch (error) {
    console.error('[LIVE-PREVIEW] Falha:', error);
    const message = error?.message || 'Falha ao atualizar a prévia.';
    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: `⚠️ ${message}`, ephemeral: true }).catch(() => {});
    else await interaction.reply({ content: `⚠️ ${message}`, ephemeral: true }).catch(() => {});
    return true;
  }
}
