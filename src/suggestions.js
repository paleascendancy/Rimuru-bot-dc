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

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

async function findSuggestionsChannel(guild) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) =>
    channel?.type === ChannelType.GuildText &&
    ['sugestoes', 'sugestao'].includes(normalize(channel.name))
  ) || null;
}

async function findMangaMorphCategory(guild) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) =>
    channel?.type === ChannelType.GuildCategory &&
    normalize(channel.name).includes('mangamorph')
  ) || null;
}

async function ensureSuggestionsChannel(guild, client) {
  let channel = await findSuggestionsChannel(guild);
  const category = await findMangaMorphCategory(guild);

  if (!channel) {
    channel = await guild.channels.create({
      name: '💡・sugestões',
      type: ChannelType.GuildText,
      parent: category?.id || null,
      topic: 'Envie ideias para melhorar o MangaMorph • use o botão abaixo • votação pela comunidade',
      reason: 'Central de sugestões do MangaMorph'
    });
  } else {
    if (category && channel.parentId !== category.id) {
      await channel.setParent(category.id, { lockPermissions: false }).catch(() => {});
    }
    await channel.setTopic(
      'Envie ideias para melhorar o MangaMorph • use o botão abaixo • votação pela comunidade'
    ).catch(() => {});
  }

  await channel.permissionOverwrites.edit(
    guild.roles.everyone.id,
    {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: false,
      SendMessagesInThreads: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
      AddReactions: false
    },
    { reason: 'Sugestões somente pelo painel oficial' }
  );

  const roles = await guild.roles.fetch();
  const memberRole = roles.find((role) => normalize(role.name) === 'membro') || null;

  if (memberRole) {
    await channel.permissionOverwrites.edit(
      memberRole.id,
      {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false,
        SendMessagesInThreads: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        AddReactions: false
      },
      { reason: 'Membros enviam sugestões somente pelo botão' }
    );
  }

  await channel.permissionOverwrites.edit(
    client.user.id,
    {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      EmbedLinks: true,
      AddReactions: true,
      ManageMessages: true
    },
    { reason: 'Permitir painel e publicação automática de sugestões' }
  );

  return channel;
}

function buildSuggestionPanel(guild, client) {
  const header = new EmbedBuilder()
    .setColor(0x6f7cff)
    .setAuthor({
      name: 'MangaMorph • Comunidade Oficial',
      iconURL: guild.iconURL({ size: 128 }) || client.user.displayAvatarURL()
    })
    .setTitle('💡 Central de Sugestões')
    .setDescription(
      'O que você gostaria que o **MangaMorph** melhorasse ou ajustasse?\n\n' +
      'Sua opinião ajuda a evoluir a plataforma e a comunidade. Clique no botão abaixo e envie sua ideia de forma clara.'
    );

  const categories = new EmbedBuilder()
    .setColor(0x2f3545)
    .setTitle('01  ·  O QUE VOCÊ PODE SUGERIR')
    .setDescription(
      '📖 **Leitor & experiência** — navegação, visualização e experiência de leitura\n' +
      '🌐 **Site & funções** — busca, filtros, favoritos, ranks e recursos\n' +
      '💬 **Servidor & comunidade** — canais, organização e eventos\n' +
      '🤖 **Bot & automações** — cargos, avisos, tickets e sistemas\n' +
      '🎨 **Design & identidade** — visual, painéis, artes e interface\n' +
      '⚙️ **Qualidade & usabilidade** — desempenho, organização e melhorias gerais'
    );

  const howItWorks = new EmbedBuilder()
    .setColor(0x232833)
    .setTitle('02  ·  COMO FUNCIONA')
    .setDescription(
      '`01` Clique em **Enviar sugestão**.\n' +
      '`02` Explique sua ideia e por que ela seria útil.\n' +
      '`03` O bot publica a sugestão neste canal.\n' +
      '`04` A comunidade pode votar com 👍 ou 👎.\n\n' +
      '**Dica:** sugestões objetivas e bem explicadas são mais fáceis de analisar.'
    )
    .setFooter({ text: 'MangaMorph • Construindo a plataforma com a comunidade' });

  const button = new ButtonBuilder()
    .setCustomId('mm_suggestion_open')
    .setLabel('Enviar sugestão')
    .setEmoji('💡')
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [header, categories, howItWorks],
    components: [new ActionRowBuilder().addComponents(button)]
  };
}

function buildSuggestionModal() {
  const title = new TextInputBuilder()
    .setCustomId('suggestion_title')
    .setLabel('Título da sugestão')
    .setPlaceholder('Ex.: Melhorar filtros da biblioteca')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const category = new TextInputBuilder()
    .setCustomId('suggestion_category')
    .setLabel('Área da sugestão')
    .setPlaceholder('Ex.: site, leitor, Discord, bot, design, usabilidade')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  const idea = new TextInputBuilder()
    .setCustomId('suggestion_idea')
    .setLabel('Explique sua ideia')
    .setPlaceholder('O que deveria ser melhorado ou ajustado?')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true);

  const benefit = new TextInputBuilder()
    .setCustomId('suggestion_benefit')
    .setLabel('Por que isso seria útil?')
    .setPlaceholder('Explique rapidamente o benefício para o MangaMorph.')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(600)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId('mm_suggestion_modal')
    .setTitle('Enviar sugestão')
    .addComponents(
      new ActionRowBuilder().addComponents(title),
      new ActionRowBuilder().addComponents(category),
      new ActionRowBuilder().addComponents(idea),
      new ActionRowBuilder().addComponents(benefit)
    );
}

export async function setupSuggestions(guild, client) {
  const channel = await ensureSuggestionsChannel(guild, client);
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const panelMessages = recent?.filter((message) =>
    message.author.id === client.user.id &&
    message.embeds.some((embed) => embed.title === '💡 Central de Sugestões')
  );

  const primary = panelMessages?.first() || null;
  const payload = buildSuggestionPanel(guild, client);

  if (primary) {
    await primary.edit(payload);
    const duplicates = panelMessages.filter((message) => message.id !== primary.id);
    for (const message of duplicates.values()) {
      await message.delete().catch(() => {});
    }
  } else {
    await channel.send(payload);
  }

  console.log(`[${guild.name}] 💡・sugestões configurado.`);
}

export async function handleSuggestionInteraction(interaction) {
  if (!interaction.inGuild()) return false;

  if (interaction.isButton() && interaction.customId === 'mm_suggestion_open') {
    await interaction.showModal(buildSuggestionModal());
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'mm_suggestion_modal') {
    const channel = await findSuggestionsChannel(interaction.guild);

    if (!channel) {
      await interaction.reply({
        content: 'Não encontrei o canal de sugestões. Avise a equipe do MangaMorph.',
        ephemeral: true
      });
      return true;
    }

    const title = interaction.fields.getTextInputValue('suggestion_title');
    const category = interaction.fields.getTextInputValue('suggestion_category');
    const idea = interaction.fields.getTextInputValue('suggestion_idea');
    const benefit = interaction.fields.getTextInputValue('suggestion_benefit');

    const embed = new EmbedBuilder()
      .setColor(0x6f7cff)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({ size: 128 })
      })
      .setTitle(`💡 ${title}`)
      .setDescription(idea)
      .addFields(
        { name: 'Área', value: category, inline: true },
        { name: 'Por que seria útil?', value: benefit }
      )
      .setFooter({ text: 'Vote abaixo • 👍 apoio  |  👎 não apoio' })
      .setTimestamp();

    const message = await channel.send({ embeds: [embed] });
    await message.react('👍').catch(() => {});
    await message.react('👎').catch(() => {});

    await interaction.reply({
      content: `Sua sugestão foi publicada em ${channel}. Obrigado por contribuir com o MangaMorph!`,
      ephemeral: true
    });

    return true;
  }

  return false;
}
