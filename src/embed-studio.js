import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

const sessions = new Map();
const keyFor = (interaction) => `${interaction.guildId}:${interaction.user.id}`;

const blankEmbed = (index = 1) => ({
  title: `Embed ${index}`,
  description: 'Use os controles abaixo para personalizar este embed.',
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
  timestamp: false
});

function canManage(interaction) {
  return interaction.user.id === interaction.guild.ownerId ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
}

function validUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function clean(value = '') {
  const text = String(value).trim();
  if (['-', 'remover', 'limpar', 'clear', 'remove'].includes(text.toLowerCase())) return '';
  return text;
}

function parseColor(value) {
  const cleanValue = String(value || '#5865F2').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleanValue)) return null;
  return Number.parseInt(cleanValue, 16);
}

function parseBoolean(value, fallback = false) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  if (['sim', 's', 'true', '1', 'on', 'ativar', 'ativo'].includes(text)) return true;
  if (['nao', 'não', 'n', 'false', '0', 'off', 'desativar', 'inativo'].includes(text)) return false;
  return fallback;
}

function parseFields(value) {
  const source = clean(value);
  if (!source) return [];
  return source.split(';;').map((item) => item.trim()).filter(Boolean).slice(0, 25).map((item) => {
    const [name = '', fieldValue = '', inline = 'false'] = item.split('|');
    return {
      name: name.trim().slice(0, 256) || 'Campo',
      value: fieldValue.trim().slice(0, 1024) || '—',
      inline: parseBoolean(inline, false)
    };
  });
}

function stringifyFields(fields = []) {
  return fields.map((field) => `${field.name}|${field.value}|${field.inline ? 'true' : 'false'}`).join(';;');
}

function activeEmbed(session) {
  return session.embeds[session.active] || session.embeds[0];
}

function buildOneEmbed(config) {
  const color = parseColor(config.color);
  if (color === null) throw new Error('Cor inválida. Use hexadecimal, como `#5865F2`.');

  for (const [label, value] of [
    ['URL do título', config.url], ['Imagem', config.image], ['Thumbnail', config.thumbnail],
    ['URL do autor', config.authorUrl], ['Ícone do autor', config.authorIcon], ['Ícone do rodapé', config.footerIcon]
  ]) {
    if (value && !validUrl(value)) throw new Error(`${label} inválida.`);
  }

  const embed = new EmbedBuilder().setColor(color);
  if (config.title) embed.setTitle(config.title.slice(0, 256));
  if (config.description) embed.setDescription(config.description.slice(0, 4096));
  if (config.url) embed.setURL(config.url);
  if (config.image) embed.setImage(config.image);
  if (config.thumbnail) embed.setThumbnail(config.thumbnail);
  if (config.author) embed.setAuthor({
    name: config.author.slice(0, 256),
    url: config.authorUrl || undefined,
    iconURL: config.authorIcon || undefined
  });
  if (config.footer) embed.setFooter({
    text: config.footer.slice(0, 2048),
    iconURL: config.footerIcon || undefined
  });
  if (config.fields?.length) embed.addFields(config.fields.slice(0, 25));
  if (config.timestamp) embed.setTimestamp();
  return embed;
}

function validateSession(session) {
  if (!session.embeds.length) throw new Error('Adicione pelo menos um embed.');
  if (session.embeds.length > 10) throw new Error('O Discord permite no máximo 10 embeds por mensagem.');
  let characters = 0;
  for (const config of session.embeds) {
    buildOneEmbed(config);
    characters += (config.title?.length || 0) + (config.description?.length || 0) + (config.footer?.length || 0) + (config.author?.length || 0);
    for (const field of config.fields || []) characters += field.name.length + field.value.length;
  }
  if (characters > 6000) throw new Error('Os embeds juntos ultrapassam o limite de texto do Discord. Reduza o conteúdo.');
  for (const button of session.buttons) {
    if (!validUrl(button.url)) throw new Error(`URL inválida no botão **${button.label}**.`);
  }
}

function buildLinkRow(session) {
  if (!session.buttons.length) return null;
  const row = new ActionRowBuilder();
  for (const button of session.buttons.slice(0, 5)) {
    const builder = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(button.label.slice(0, 80))
      .setURL(button.url);
    if (button.emoji) builder.setEmoji(button.emoji);
    row.addComponents(builder);
  }
  return row;
}

function input(id, label, style, value, maxLength, placeholder = null) {
  const field = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(false)
    .setMaxLength(maxLength);
  if (value) field.setValue(String(value).slice(0, maxLength));
  if (placeholder) field.setPlaceholder(placeholder);
  return field;
}

function basicModal(session) {
  const item = activeEmbed(session);
  return new ModalBuilder().setCustomId('es_modal_edit').setTitle(`Editar Embed ${session.active + 1}`).addComponents(
    new ActionRowBuilder().addComponents(input('title', 'Título', TextInputStyle.Short, item.title, 256, 'Título do embed')),
    new ActionRowBuilder().addComponents(input('description', 'Descrição', TextInputStyle.Paragraph, item.description, 4000, 'Conteúdo principal')),
    new ActionRowBuilder().addComponents(input('color', 'Cor hexadecimal', TextInputStyle.Short, item.color, 7, '#5865F2')),
    new ActionRowBuilder().addComponents(input('url', 'URL clicável do título', TextInputStyle.Short, item.url, 1000, 'https://...')),
    new ActionRowBuilder().addComponents(input('image', 'Imagem grande', TextInputStyle.Short, item.image, 1000, 'https://...'))
  );
}

function visualModal(session) {
  const item = activeEmbed(session);
  return new ModalBuilder().setCustomId('es_modal_visual').setTitle('Visual do Embed').addComponents(
    new ActionRowBuilder().addComponents(input('thumbnail', 'Thumbnail', TextInputStyle.Short, item.thumbnail, 1000, 'https://...')),
    new ActionRowBuilder().addComponents(input('timestamp', 'Timestamp: sim ou não', TextInputStyle.Short, item.timestamp ? 'sim' : 'não', 5, 'sim'))
  );
}

function authorModal(session) {
  const item = activeEmbed(session);
  return new ModalBuilder().setCustomId('es_modal_author').setTitle('Autor e Rodapé').addComponents(
    new ActionRowBuilder().addComponents(input('author', 'Autor', TextInputStyle.Short, item.author, 256)),
    new ActionRowBuilder().addComponents(input('author_url', 'URL do autor', TextInputStyle.Short, item.authorUrl, 1000, 'https://...')),
    new ActionRowBuilder().addComponents(input('author_icon', 'Ícone do autor', TextInputStyle.Short, item.authorIcon, 1000, 'https://...')),
    new ActionRowBuilder().addComponents(input('footer', 'Rodapé', TextInputStyle.Short, item.footer, 2048)),
    new ActionRowBuilder().addComponents(input('footer_icon', 'Ícone do rodapé', TextInputStyle.Short, item.footerIcon, 1000, 'https://...'))
  );
}

function fieldsModal(session) {
  const item = activeEmbed(session);
  return new ModalBuilder().setCustomId('es_modal_fields').setTitle('Campos do Embed').addComponents(
    new ActionRowBuilder().addComponents(input(
      'fields',
      'Campos: Nome|Valor|inline;;...',
      TextInputStyle.Paragraph,
      stringifyFields(item.fields),
      4000,
      'Plano|R$ 20|true;;Prazo|2 dias|true'
    ))
  );
}

function buttonModal() {
  return new ModalBuilder().setCustomId('es_modal_button').setTitle('Adicionar Botão').addComponents(
    new ActionRowBuilder().addComponents(input('label', 'Texto do botão', TextInputStyle.Short, '', 80, 'Abrir site')),
    new ActionRowBuilder().addComponents(input('url', 'URL do botão', TextInputStyle.Short, '', 1000, 'https://...')),
    new ActionRowBuilder().addComponents(input('emoji', 'Emoji opcional', TextInputStyle.Short, '', 64, '🔗'))
  );
}

function generatorModal() {
  return new ModalBuilder().setCustomId('es_modal_generate').setTitle('Gerar modelo automaticamente').addComponents(
    new ActionRowBuilder().addComponents(input('purpose', 'O que o embed deve comunicar?', TextInputStyle.Paragraph, '', 1000, 'Ex.: anúncio de atualização do site')),
    new ActionRowBuilder().addComponents(input('style', 'Estilo', TextInputStyle.Short, '', 80, 'profissional, curto, premium...'))
  );
}

function personalizedModal(session) {
  return new ModalBuilder().setCustomId('es_modal_personalized').setTitle('Envio Personalizado').addComponents(
    new ActionRowBuilder().addComponents(input('username', 'Nome exibido pelo webhook', TextInputStyle.Short, session.webhookName, 80, 'MangaMorph')),
    new ActionRowBuilder().addComponents(input('avatar', 'Avatar do webhook', TextInputStyle.Short, session.webhookAvatar, 1000, 'https://...')),
    new ActionRowBuilder().addComponents(input('content', 'Texto fora dos embeds', TextInputStyle.Paragraph, session.content, 2000, 'Opcional'))
  );
}

function generateModel(purpose, style, guildName) {
  const prompt = clean(purpose) || 'Informação importante para a comunidade';
  const tone = clean(style).toLowerCase();
  let color = '#5865F2';
  let prefix = '📌';
  if (/aviso|atenção|urgente|alerta/.test(prompt.toLowerCase())) { color = '#F0B232'; prefix = '⚠️'; }
  else if (/erro|problema|indispon/.test(prompt.toLowerCase())) { color = '#ED4245'; prefix = '🚨'; }
  else if (/sucesso|conclu|lanç|novo|atualiza/.test(prompt.toLowerCase())) { color = '#57F287'; prefix = '✨'; }
  else if (/premium|elegante|luxo/.test(tone)) { color = '#8B5CF6'; prefix = '◆'; }

  const titleSource = prompt.split(/[.!?\n]/)[0].trim().slice(0, 90);
  return {
    ...blankEmbed(1),
    title: `${prefix} ${titleSource || 'Comunicado'}`,
    description: `${prompt}\n\n**${guildName}** • informação organizada para a comunidade.`,
    color,
    footer: guildName,
    timestamp: true
  };
}

async function resolveChannel(interaction, session) {
  if (!session.channelId) return interaction.channel;
  return interaction.guild.channels.fetch(session.channelId).catch(() => null);
}

async function panelPayload(interaction, session) {
  const channel = await resolveChannel(interaction, session);
  const previewEmbeds = session.embeds.map(buildOneEmbed);
  const select = new StringSelectMenuBuilder()
    .setCustomId('es_select_embed')
    .setPlaceholder(`Selecione um Embed para editar • atual: ${session.active + 1}`)
    .addOptions(session.embeds.map((item, index) => ({
      label: `Embed ${index + 1}`,
      description: (item.title || 'Sem título').slice(0, 90),
      value: String(index),
      default: index === session.active
    })));

  const rowSelect = new ActionRowBuilder().addComponents(select);
  const rowEdit = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('es_add_embed').setLabel('Adicionar Embed').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('es_edit').setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('es_visual').setLabel('Visual').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('es_fields').setLabel('Campos').setEmoji('🧩').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('es_remove_embed').setLabel('Remover').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  const rowActions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('es_author').setLabel('Autor/Rodapé').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('es_add_button').setLabel('Adicionar Botão').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('es_generate').setLabel('Gerar Modelo').setEmoji('✨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('es_personalized').setLabel('Enviar Personalizado').setEmoji('🪝').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('es_quick_send').setLabel('Enviar Rápido').setEmoji('➤').setStyle(ButtonStyle.Success)
  );
  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('es_channel')
      .setPlaceholder(`Canal de destino: ${channel?.name || 'selecione'}`.slice(0, 150))
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1)
  );

  const components = [rowSelect, rowEdit, rowActions, channelRow];
  const linkRow = buildLinkRow(session);
  if (linkRow) components.unshift(linkRow);

  return {
    content:
      `## 🧩 Painel de Criação de Embed\n` +
      `**Prévia em tempo real** • ${session.embeds.length}/10 embeds • ${session.buttons.length}/5 botões\n` +
      `Edite os elementos abaixo e veja o resultado antes de enviar.`,
    embeds: previewEmbeds,
    components: components.slice(0, 5),
    allowedMentions: { parse: [] }
  };
}

async function getSession(interaction) {
  const session = sessions.get(keyFor(interaction));
  if (!session || session.ownerId !== interaction.user.id) {
    const reply = { content: 'Esse painel expirou. Use `/embed criar` novamente.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
    return null;
  }
  return session;
}

async function sendQuick(interaction, session) {
  validateSession(session);
  const channel = await resolveChannel(interaction, session);
  if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) throw new Error('Escolha um canal de texto válido.');
  const row = buildLinkRow(session);
  await channel.send({
    content: session.content || undefined,
    embeds: session.embeds.map(buildOneEmbed),
    components: row ? [row] : [],
    allowedMentions: { parse: [] }
  });
  return channel;
}

async function ensureStudioWebhook(channel, interaction) {
  if (!channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.ManageWebhooks)) {
    throw new Error('O bot precisa da permissão **Gerenciar Webhooks** nesse canal.');
  }
  const hooks = await channel.fetchWebhooks();
  const owned = hooks.find((hook) => hook.owner?.id === interaction.client.user.id && hook.name === 'MangaMorph Embed Studio');
  if (owned) return owned;
  return channel.createWebhook({ name: 'MangaMorph Embed Studio', reason: `Embed Studio usado por ${interaction.user.tag}` });
}

function studioSubcommand() {
  return {
    type: 1,
    name: 'criar',
    description: 'Abre um painel interativo de criação de Embeds',
    options: [
      {
        type: 7,
        name: 'canal',
        description: 'Canal de destino; também pode ser trocado no painel',
        required: false,
        channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement]
      }
    ]
  };
}

export async function setupEmbedStudio(guild) {
  const commands = await guild.commands.fetch();
  const command = commands.find((item) => item.name === 'embed');
  if (!command) return;
  const json = command.toJSON();
  const options = (json.options || []).filter((option) => option.name !== 'criar');
  options.unshift(studioSubcommand());
  const payload = { name: command.name, description: command.description, options };
  if (command.defaultMemberPermissions) payload.defaultMemberPermissions = command.defaultMemberPermissions;
  await command.edit(payload);
  console.log(`[EMBED-STUDIO] ${guild.name}: /embed criar convertido para painel interativo.`);
}

export async function handleEmbedStudioInteraction(interaction) {
  if (!interaction.inGuild()) return false;

  if (interaction.isChatInputCommand() && interaction.commandName === 'embed' && interaction.options.getSubcommand(false) === 'criar') {
    if (!canManage(interaction)) {
      await interaction.reply({ content: 'Você não tem permissão para criar embeds administrativos.', ephemeral: true });
      return true;
    }
    const selected = interaction.options.getChannel('canal');
    const session = {
      ownerId: interaction.user.id,
      embeds: [blankEmbed(1)],
      active: 0,
      buttons: [],
      content: '',
      channelId: selected?.id || ([ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(interaction.channel?.type) ? interaction.channel.id : null),
      webhookName: interaction.guild.name,
      webhookAvatar: interaction.guild.iconURL({ size: 256 }) || ''
    };
    sessions.set(keyFor(interaction), session);
    await interaction.reply({ ...(await panelPayload(interaction, session)), ephemeral: true });
    return true;
  }

  const isButton = interaction.isButton() && interaction.customId.startsWith('es_');
  const isSelect = interaction.isStringSelectMenu() && interaction.customId === 'es_select_embed';
  const isChannel = interaction.isChannelSelectMenu() && interaction.customId === 'es_channel';
  const isModal = interaction.isModalSubmit() && interaction.customId.startsWith('es_modal_');
  if (!isButton && !isSelect && !isChannel && !isModal) return false;

  const session = await getSession(interaction);
  if (!session) return true;

  try {
    if (isSelect) {
      session.active = Math.max(0, Math.min(Number(interaction.values[0]) || 0, session.embeds.length - 1));
      await interaction.update(await panelPayload(interaction, session));
      return true;
    }

    if (isChannel) {
      session.channelId = interaction.values[0];
      await interaction.update(await panelPayload(interaction, session));
      return true;
    }

    if (isButton) {
      if (interaction.customId === 'es_add_embed') {
        if (session.embeds.length >= 10) throw new Error('Você já atingiu o limite de 10 embeds por mensagem.');
        session.embeds.push(blankEmbed(session.embeds.length + 1));
        session.active = session.embeds.length - 1;
        await interaction.update(await panelPayload(interaction, session));
        return true;
      }
      if (interaction.customId === 'es_remove_embed') {
        if (session.embeds.length === 1) throw new Error('A mensagem precisa manter pelo menos um embed.');
        session.embeds.splice(session.active, 1);
        session.active = Math.max(0, session.active - 1);
        await interaction.update(await panelPayload(interaction, session));
        return true;
      }
      if (interaction.customId === 'es_edit') { await interaction.showModal(basicModal(session)); return true; }
      if (interaction.customId === 'es_visual') { await interaction.showModal(visualModal(session)); return true; }
      if (interaction.customId === 'es_author') { await interaction.showModal(authorModal(session)); return true; }
      if (interaction.customId === 'es_fields') { await interaction.showModal(fieldsModal(session)); return true; }
      if (interaction.customId === 'es_add_button') {
        if (session.buttons.length >= 5) throw new Error('Você já atingiu o limite de 5 botões por mensagem.');
        await interaction.showModal(buttonModal());
        return true;
      }
      if (interaction.customId === 'es_generate') { await interaction.showModal(generatorModal()); return true; }
      if (interaction.customId === 'es_personalized') { await interaction.showModal(personalizedModal(session)); return true; }
      if (interaction.customId === 'es_quick_send') {
        await interaction.deferUpdate();
        const channel = await sendQuick(interaction, session);
        await interaction.followUp({ content: `✅ Embed enviado em ${channel}. O painel continua aberto para novas alterações.`, ephemeral: true });
        return true;
      }
    }

    if (isModal) {
      const item = activeEmbed(session);
      if (interaction.customId === 'es_modal_edit') {
        item.title = clean(interaction.fields.getTextInputValue('title'));
        item.description = clean(interaction.fields.getTextInputValue('description'));
        item.color = clean(interaction.fields.getTextInputValue('color')) || '#5865F2';
        item.url = clean(interaction.fields.getTextInputValue('url'));
        item.image = clean(interaction.fields.getTextInputValue('image'));
      } else if (interaction.customId === 'es_modal_visual') {
        item.thumbnail = clean(interaction.fields.getTextInputValue('thumbnail'));
        item.timestamp = parseBoolean(interaction.fields.getTextInputValue('timestamp'), item.timestamp);
      } else if (interaction.customId === 'es_modal_author') {
        item.author = clean(interaction.fields.getTextInputValue('author'));
        item.authorUrl = clean(interaction.fields.getTextInputValue('author_url'));
        item.authorIcon = clean(interaction.fields.getTextInputValue('author_icon'));
        item.footer = clean(interaction.fields.getTextInputValue('footer'));
        item.footerIcon = clean(interaction.fields.getTextInputValue('footer_icon'));
      } else if (interaction.customId === 'es_modal_fields') {
        item.fields = parseFields(interaction.fields.getTextInputValue('fields'));
      } else if (interaction.customId === 'es_modal_button') {
        const label = clean(interaction.fields.getTextInputValue('label')) || 'Abrir';
        const url = clean(interaction.fields.getTextInputValue('url'));
        const emoji = clean(interaction.fields.getTextInputValue('emoji'));
        if (!validUrl(url)) throw new Error('Informe uma URL válida para o botão.');
        session.buttons.push({ label, url, emoji });
      } else if (interaction.customId === 'es_modal_generate') {
        session.embeds[session.active] = generateModel(
          interaction.fields.getTextInputValue('purpose'),
          interaction.fields.getTextInputValue('style'),
          interaction.guild.name
        );
      } else if (interaction.customId === 'es_modal_personalized') {
        const username = clean(interaction.fields.getTextInputValue('username')) || interaction.guild.name;
        const avatar = clean(interaction.fields.getTextInputValue('avatar'));
        const content = clean(interaction.fields.getTextInputValue('content'));
        if (avatar && !validUrl(avatar)) throw new Error('A URL do avatar do webhook é inválida.');
        session.webhookName = username;
        session.webhookAvatar = avatar;
        session.content = content;
        validateSession(session);
        const channel = await resolveChannel(interaction, session);
        if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) throw new Error('Escolha um canal de destino válido.');
        const webhook = await ensureStudioWebhook(channel, interaction);
        const row = buildLinkRow(session);
        await webhook.send({
          content: session.content || undefined,
          embeds: session.embeds.map(buildOneEmbed),
          components: row ? [row] : [],
          username: username.slice(0, 80),
          avatarURL: avatar || undefined,
          allowedMentions: { parse: [] }
        });
        await interaction.update(await panelPayload(interaction, session));
        await interaction.followUp({ content: `✅ Enviado por webhook personalizado em ${channel}.`, ephemeral: true });
        return true;
      }

      validateSession(session);
      await interaction.update(await panelPayload(interaction, session));
      return true;
    }
  } catch (error) {
    console.error('[EMBED-STUDIO] Falha:', error);
    const reply = { content: `Não foi possível concluir: ${error?.message || 'erro desconhecido'}`, ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
    return true;
  }

  return false;
}
