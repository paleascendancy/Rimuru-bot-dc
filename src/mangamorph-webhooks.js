import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';

const WEBHOOK_GROUP = {
  type: 2,
  name: 'webhook',
  description: 'Cria e usa webhooks personalizados para embeds',
  options: [
    {
      type: 1,
      name: 'criar',
      description: 'Cria um webhook personalizado no canal',
      options: [
        { type: 3, name: 'nome', description: 'Nome do webhook', required: true, max_length: 80 },
        { type: 7, name: 'canal', description: 'Canal; padrão: canal atual', channel_types: [0, 5] },
        { type: 3, name: 'avatar', description: 'URL da imagem do webhook', max_length: 1000 }
      ]
    },
    {
      type: 1,
      name: 'enviar',
      description: 'Envia um embed pelo webhook com nome e avatar personalizados',
      options: [
        { type: 3, name: 'id', description: 'ID do webhook', required: true, max_length: 30 },
        { type: 7, name: 'canal', description: 'Canal do webhook; padrão: canal atual', channel_types: [0, 5] },
        { type: 3, name: 'username', description: 'Nome exibido nesta mensagem', max_length: 80 },
        { type: 3, name: 'avatar', description: 'URL do avatar exibido nesta mensagem', max_length: 1000 },
        { type: 3, name: 'conteudo', description: 'Texto fora do embed', max_length: 2000 },
        { type: 3, name: 'titulo', description: 'Título do embed', max_length: 256 },
        { type: 3, name: 'descricao', description: 'Descrição do embed', max_length: 4000 },
        { type: 3, name: 'cor', description: 'Cor hexadecimal, ex.: #5865F2', max_length: 7 },
        { type: 3, name: 'url', description: 'URL clicável do título', max_length: 1000 },
        { type: 3, name: 'imagem', description: 'URL da imagem grande', max_length: 1000 },
        { type: 3, name: 'thumbnail', description: 'URL da miniatura', max_length: 1000 },
        { type: 3, name: 'autor', description: 'Nome do autor do embed', max_length: 256 },
        { type: 3, name: 'autor_url', description: 'URL clicável do autor', max_length: 1000 },
        { type: 3, name: 'autor_icone', description: 'URL do ícone do autor', max_length: 1000 },
        { type: 3, name: 'rodape', description: 'Texto do rodapé', max_length: 2048 },
        { type: 3, name: 'rodape_icone', description: 'URL do ícone do rodapé', max_length: 1000 },
        { type: 3, name: 'campos', description: 'Campos: Nome|Valor|inline;;Nome 2|Valor 2|false', max_length: 4000 },
        { type: 5, name: 'timestamp', description: 'Mostrar data/hora no embed' }
      ]
    },
    {
      type: 1,
      name: 'editar',
      description: 'Edita um webhook criado pelo bot',
      options: [
        { type: 3, name: 'id', description: 'ID do webhook', required: true, max_length: 30 },
        { type: 7, name: 'canal', description: 'Canal do webhook; padrão: canal atual', channel_types: [0, 5] },
        { type: 3, name: 'nome', description: 'Novo nome do webhook', max_length: 80 },
        { type: 3, name: 'avatar', description: 'Nova URL do avatar; use remover para retirar', max_length: 1000 }
      ]
    },
    {
      type: 1,
      name: 'apagar',
      description: 'Apaga um webhook criado pelo bot',
      options: [
        { type: 3, name: 'id', description: 'ID do webhook', required: true, max_length: 30 },
        { type: 7, name: 'canal', description: 'Canal do webhook; padrão: canal atual', channel_types: [0, 5] }
      ]
    }
  ]
};

function hasAccess(interaction) {
  return interaction.user.id === interaction.guild.ownerId ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageWebhooks);
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

function parseColor(value) {
  if (!value) return 0x5865f2;
  const clean = value.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return Number.parseInt(clean, 16);
}

function parseFields(value) {
  if (!value) return [];
  const fields = value.split(';;').map((part) => part.trim()).filter(Boolean).slice(0, 25);
  return fields.map((part) => {
    const [name = '', fieldValue = '', inline = 'false'] = part.split('|');
    return {
      name: name.trim().slice(0, 256) || 'Campo',
      value: fieldValue.trim().slice(0, 1024) || '—',
      inline: ['true', 'sim', '1', 'inline'].includes(inline.trim().toLowerCase())
    };
  });
}

async function resolveChannel(interaction) {
  const channel = interaction.options.getChannel('canal') || interaction.channel;
  if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return null;
  return channel;
}

async function fetchAvatarBuffer(value) {
  if (!value || value.toLowerCase() === 'remover') return value?.toLowerCase() === 'remover' ? null : undefined;
  if (!validUrl(value)) throw new Error('URL de avatar inválida.');

  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' || host === '::1' || host.endsWith('.local') ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) throw new Error('Esse endereço de imagem não é permitido.');

  const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'follow' });
  if (!response.ok) throw new Error('Não consegui baixar o avatar.');
  const type = response.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error('A URL do avatar precisa apontar para uma imagem.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error('O avatar é grande demais.');
  return bytes;
}

async function findOwnedWebhook(channel, id, client) {
  const webhooks = await channel.fetchWebhooks();
  const webhook = webhooks.get(id) || null;
  if (!webhook) return { webhook: null, error: 'Webhook não encontrado nesse canal.' };
  if (webhook.owner?.id && webhook.owner.id !== client.user.id) {
    return { webhook: null, error: 'Por segurança, só edito ou apago webhooks criados por este bot.' };
  }
  return { webhook, error: null };
}

function buildEmbed(interaction) {
  const title = interaction.options.getString('titulo');
  const description = interaction.options.getString('descricao');
  const color = parseColor(interaction.options.getString('cor'));
  if (color === null) throw new Error('Cor inválida. Use formato hexadecimal como #5865F2.');

  const embed = new EmbedBuilder().setColor(color);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);

  const url = interaction.options.getString('url');
  const image = interaction.options.getString('imagem');
  const thumbnail = interaction.options.getString('thumbnail');
  const author = interaction.options.getString('autor');
  const authorUrl = interaction.options.getString('autor_url');
  const authorIcon = interaction.options.getString('autor_icone');
  const footer = interaction.options.getString('rodape');
  const footerIcon = interaction.options.getString('rodape_icone');

  for (const [label, value] of [
    ['URL', url], ['imagem', image], ['thumbnail', thumbnail],
    ['URL do autor', authorUrl], ['ícone do autor', authorIcon], ['ícone do rodapé', footerIcon]
  ]) {
    if (value && !validUrl(value)) throw new Error(`${label} inválida.`);
  }

  if (url) embed.setURL(url);
  if (image) embed.setImage(image);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (author) embed.setAuthor({ name: author, url: authorUrl || undefined, iconURL: authorIcon || undefined });
  if (footer) embed.setFooter({ text: footer, iconURL: footerIcon || undefined });

  const fields = parseFields(interaction.options.getString('campos'));
  if (fields.length) embed.addFields(fields);
  if (interaction.options.getBoolean('timestamp')) embed.setTimestamp();

  const hasEmbedContent = Boolean(title || description || image || thumbnail || author || footer || fields.length);
  return hasEmbedContent ? embed : null;
}

export async function setupMangaMorphWebhookTools(guild) {
  const commands = await guild.commands.fetch();
  const command = commands.find((item) => item.name === 'embed');
  if (!command) return;

  const json = command.toJSON();
  const options = (json.options || []).filter((option) => option.name !== 'webhook');
  options.push(WEBHOOK_GROUP);

  const payload = {
    name: command.name,
    description: command.description,
    options
  };
  if (command.defaultMemberPermissions) payload.defaultMemberPermissions = command.defaultMemberPermissions;

  await command.edit(payload);
  console.log(`[MM-WEBHOOK] ${guild.name}: /embed webhook configurado.`);
}

export async function handleMangaMorphWebhookInteraction(interaction, client) {
  if (!interaction.inGuild() || !interaction.isChatInputCommand() || interaction.commandName !== 'embed') return false;
  if (interaction.options.getSubcommandGroup(false) !== 'webhook') return false;

  if (!hasAccess(interaction)) {
    await interaction.reply({ content: 'Você não tem permissão para gerenciar webhooks.', ephemeral: true });
    return true;
  }

  const channel = await resolveChannel(interaction);
  if (!channel) {
    await interaction.reply({ content: 'Escolha um canal de texto válido.', ephemeral: true });
    return true;
  }

  const botMember = interaction.guild.members.me;
  if (!channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageWebhooks)) {
    await interaction.reply({ content: 'O bot precisa da permissão **Gerenciar Webhooks** nesse canal.', ephemeral: true });
    return true;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'criar') {
      const name = interaction.options.getString('nome', true).trim();
      const avatarInput = interaction.options.getString('avatar');
      const avatar = await fetchAvatarBuffer(avatarInput);
      const webhook = await channel.createWebhook({
        name,
        avatar,
        reason: `Webhook personalizado criado por ${interaction.user.tag}`
      });

      await interaction.reply({
        content: `Webhook **${webhook.name}** criado em ${channel}. ID: \`${webhook.id}\`\nO token/URL secreto não é exibido no Discord.`,
        ephemeral: true
      });
      return true;
    }

    const id = interaction.options.getString('id', true);
    const { webhook, error } = await findOwnedWebhook(channel, id, client);
    if (!webhook) {
      await interaction.reply({ content: error, ephemeral: true });
      return true;
    }

    if (subcommand === 'editar') {
      const name = interaction.options.getString('nome');
      const avatarInput = interaction.options.getString('avatar');
      if (!name && !avatarInput) {
        await interaction.reply({ content: 'Informe pelo menos `nome` ou `avatar` para editar.', ephemeral: true });
        return true;
      }
      const avatar = avatarInput ? await fetchAvatarBuffer(avatarInput) : undefined;
      await webhook.edit({
        name: name?.trim() || undefined,
        avatar,
        reason: `Webhook editado por ${interaction.user.tag}`
      });
      await interaction.reply({ content: `Webhook \`${id}\` atualizado.`, ephemeral: true });
      return true;
    }

    if (subcommand === 'apagar') {
      await webhook.delete(`Webhook apagado por ${interaction.user.tag}`);
      await interaction.reply({ content: `Webhook \`${id}\` apagado.`, ephemeral: true });
      return true;
    }

    if (subcommand === 'enviar') {
      const username = interaction.options.getString('username');
      const avatarURL = interaction.options.getString('avatar');
      const content = interaction.options.getString('conteudo');
      if (avatarURL && !validUrl(avatarURL)) throw new Error('URL do avatar da mensagem inválida.');

      const embed = buildEmbed(interaction);
      if (!content && !embed) {
        await interaction.reply({ content: 'Informe conteúdo ou pelo menos uma opção do embed.', ephemeral: true });
        return true;
      }

      const message = await webhook.send({
        content: content || undefined,
        embeds: embed ? [embed] : [],
        username: username || undefined,
        avatarURL: avatarURL || undefined,
        allowedMentions: { parse: [] }
      });

      await interaction.reply({
        content: `Embed enviado pelo webhook em ${channel}. Mensagem: \`${message.id}\``,
        ephemeral: true
      });
      return true;
    }
  } catch (error) {
    console.error('[MM-WEBHOOK] Falha:', error);
    const message = error?.message || 'Falha ao executar a ação do webhook.';
    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    else await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    return true;
  }

  return false;
}
