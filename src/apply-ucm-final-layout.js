import 'dotenv/config';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;
const UCM_GUILD_ID = '1155332928755224678';

if (!DISCORD_TOKEN) {
  console.error('[UCM-FINAL] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const CHANNEL_IDS = {
  announcements: '1550941029862084730',
  divulgacao: '1521501784214999080',
  parcerias: '1521706960527818823',
  sugestoesForum: '1521502328044257350',
  sugestoesDuplicada: '1552562262772809808',
  artes: '1523344624909946932',

  modelos: '1521501731773481001',
  tutorialAddon: '1521503006095315085',
  addonsMembros: '1550831020910321734',
  relatarBug: '1521502082467893258',
  starkLegacy: '1549576504013361223',

  construcoes: '1525241468938223827',
  vendasModelos: '1552364892349014066',

  ticketAntigo: '1156086511767408650',
  punicoes: '1156037018934055062'
};

const CATEGORY_NAMES = {
  comunidade: '「 UCM 」 COMUNIDADE',
  addons: '「 UCM 」 ADDONS',
  criacoes: '「 UCM 」 CRIAÇÕES',
  suporte: '「 UCM 」 SUPORTE',
  punicoes: '「 UCM 」 PUNIÇÕES'
};

const SUPPORT_TAGS = [
  { name: 'Bug', moderated: false },
  { name: 'Sugestão', moderated: false },
  { name: 'Addon', moderated: false },
  { name: 'Modelo', moderated: false },
  { name: 'Dúvida', moderated: false }
];

const normalize = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function canManage(channel, member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return channel.permissionsFor(member)?.has(PermissionFlagsBits.ManageChannels) ?? false;
}

async function getOrCreateCategory(guild, channels, name) {
  const same = channels
    .filter((channel) => channel?.type === ChannelType.GuildCategory && normalize(channel.name) === normalize(name))
    .sort((a, b) => {
      const aCount = channels.filter((child) => child.parentId === a.id).size;
      const bCount = channels.filter((child) => child.parentId === b.id).size;
      return bCount - aCount;
    });

  if (same.first()) return same.first();

  const created = await guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    reason: 'Organização final solicitada para o UCM Studios'
  });

  console.log(`[UCM-FINAL] Categoria criada: ${name}`);
  return created;
}

async function moveAndRename(guild, me, id, name, category) {
  const channel = await guild.channels.fetch(id).catch(() => null);
  if (!channel) {
    console.log(`[UCM-FINAL] Canal ausente: ${id} → ${name}`);
    return false;
  }

  if (!canManage(channel, me)) {
    console.error(`[UCM-FINAL] BLOQUEADO: ${channel.name} sem Gerenciar Canais.`);
    return false;
  }

  const options = { reason: 'Padronização final do UCM Studios' };
  if (channel.name !== name) options.name = name;
  if (channel.parentId !== category.id) {
    options.parent = category.id;
    options.lockPermissions = false;
  }

  if (Object.keys(options).length > 1) {
    await channel.edit(options);
  }

  console.log(`[UCM-FINAL] OK: ${name} → ${category.name}`);
  return true;
}

async function deleteIfOnlyBotContent(channel, botId, label) {
  if (!channel?.isTextBased?.() || channel.type === ChannelType.GuildForum) return false;

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return false;

  const hasUserContent = messages.some((message) => message.author.id !== botId);
  if (hasUserContent) {
    console.log(`[UCM-FINAL] Preservado ${label}: há mensagens de usuários.`);
    return false;
  }

  await channel.delete(`Remover ${label} redundante após reorganização do UCM Studios`);
  console.log(`[UCM-FINAL] Removido ${label} redundante.`);
  return true;
}

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(UCM_GUILD_ID).catch(() => null);
    if (!guild) {
      console.error('[UCM-FINAL] UCM Studios não encontrado.');
      return;
    }

    const me = await guild.members.fetchMe();
    let channels = await guild.channels.fetch();

    console.log(
      `[UCM-FINAL] Permissões: admin=${me.permissions.has(PermissionFlagsBits.Administrator)} gerenciar-canais=${me.permissions.has(PermissionFlagsBits.ManageChannels)}`
    );

    const comunidade = await getOrCreateCategory(guild, channels, CATEGORY_NAMES.comunidade);
    channels = await guild.channels.fetch();
    const addons = await getOrCreateCategory(guild, channels, CATEGORY_NAMES.addons);
    channels = await guild.channels.fetch();
    const criacoes = await getOrCreateCategory(guild, channels, CATEGORY_NAMES.criacoes);
    channels = await guild.channels.fetch();
    const suporte = await getOrCreateCategory(guild, channels, CATEGORY_NAMES.suporte);
    channels = await guild.channels.fetch();
    const punicoes = await getOrCreateCategory(guild, channels, CATEGORY_NAMES.punicoes);

    await moveAndRename(guild, me, CHANNEL_IDS.announcements, '📢・anúncios', comunidade);
    await moveAndRename(guild, me, CHANNEL_IDS.divulgacao, '📣・divulgação', comunidade);
    await moveAndRename(guild, me, CHANNEL_IDS.parcerias, '🤝・parcerias', comunidade);
    const suggestionsMoved = await moveAndRename(guild, me, CHANNEL_IDS.sugestoesForum, '💡・sugestões', comunidade);
    if (!suggestionsMoved) {
      let suggestions = (await guild.channels.fetch()).find((channel) =>
        channel?.type === ChannelType.GuildText &&
        normalize(channel.name) === normalize('💡・sugestões')
      ) || null;

      if (!suggestions) {
        suggestions = await guild.channels.create({
          name: '💡・sugestões',
          type: ChannelType.GuildText,
          parent: comunidade.id,
          topic: 'Envie sugestões para melhorar a comunidade UCM Studios.',
          reason: 'Canal de sugestões solicitado para a comunidade'
        });
        console.log('[UCM-FINAL] Criado: 💡・sugestões');
      } else if (suggestions.parentId !== comunidade.id && canManage(suggestions, me)) {
        await suggestions.setParent(comunidade.id, { lockPermissions: false });
      }
    }
    await moveAndRename(guild, me, CHANNEL_IDS.artes, '🎨・artes', comunidade);

    await moveAndRename(guild, me, CHANNEL_IDS.modelos, '🧩・modelos', addons);
    await moveAndRename(guild, me, CHANNEL_IDS.tutorialAddon, '📘・tutorial-addon', addons);
    await moveAndRename(guild, me, CHANNEL_IDS.addonsMembros, '🧩・addons-dos-membros', addons);
    await moveAndRename(guild, me, CHANNEL_IDS.relatarBug, '🐛・relatar-bug', addons);
    await moveAndRename(guild, me, CHANNEL_IDS.starkLegacy, '💎・stark-legacy', addons);

    channels = await guild.channels.fetch();
    let ajudaAddons = channels.find((channel) =>
      channel?.type === ChannelType.GuildText && normalize(channel.name) === normalize('💬・ajuda-addons')
    ) || null;

    if (!ajudaAddons) {
      ajudaAddons = await guild.channels.create({
        name: '💬・ajuda-addons',
        type: ChannelType.GuildText,
        parent: addons.id,
        topic: 'Dúvidas rápidas sobre addons, instalação, compatibilidade e desenvolvimento.',
        reason: 'Canal de ajuda solicitado para a área de addons'
      });
      console.log('[UCM-FINAL] Criado: 💬・ajuda-addons');
    } else if (ajudaAddons.parentId !== addons.id && canManage(ajudaAddons, me)) {
      await ajudaAddons.setParent(addons.id, { lockPermissions: false });
    }

    await moveAndRename(guild, me, CHANNEL_IDS.construcoes, '🧱・construções', criacoes);
    await moveAndRename(guild, me, CHANNEL_IDS.vendasModelos, '🛒・vendas-de-modelos', criacoes);

    await moveAndRename(guild, me, CHANNEL_IDS.punicoes, '⚖️・punições', punicoes);

    channels = await guild.channels.fetch();
    let supportForum = channels.find((channel) =>
      channel?.type === ChannelType.GuildForum && normalize(channel.name) === normalize('🎫・suporte')
    ) || null;

    if (!supportForum) {
      supportForum = await guild.channels.create({
        name: '🎫・suporte',
        type: ChannelType.GuildForum,
        parent: suporte.id,
        topic: 'Abra um post para receber ajuda. Escolha a tag que melhor descreve sua solicitação.',
        availableTags: SUPPORT_TAGS,
        defaultAutoArchiveDuration: 1440,
        reason: 'Fórum central de suporte do UCM Studios'
      });
      console.log('[UCM-FINAL] Criado fórum: 🎫・suporte com tags Bug, Sugestão, Addon, Modelo e Dúvida.');
    } else {
      await supportForum.edit({
        parent: suporte.id,
        availableTags: SUPPORT_TAGS,
        topic: 'Abra um post para receber ajuda. Escolha a tag que melhor descreve sua solicitação.',
        reason: 'Padronização do fórum de suporte do UCM Studios'
      }).catch((error) => {
        console.error('[UCM-FINAL] Falha ao atualizar fórum de suporte:', error.message);
      });
    }

    // Junta as duas sugestões: preserva o fórum antigo e remove o canal redundante apenas se não houver conteúdo de membros.
    const duplicateSuggestions = await guild.channels.fetch(CHANNEL_IDS.sugestoesDuplicada).catch(() => null);
    if (duplicateSuggestions) {
      await deleteIfOnlyBotContent(duplicateSuggestions, client.user.id, 'canal de sugestões duplicado');
    }

    // O fórum de suporte substitui o antigo canal de abertura de ticket, mas não apagamos conteúdo de membros.
    const oldTicket = await guild.channels.fetch(CHANNEL_IDS.ticketAntigo).catch(() => null);
    if (oldTicket) {
      const removed = await deleteIfOnlyBotContent(oldTicket, client.user.id, 'canal antigo de ticket');
      if (!removed && canManage(oldTicket, me)) {
        await oldTicket.edit({
          name: '🎫・ticket-antigo',
          parent: suporte.id,
          lockPermissions: false,
          reason: 'Preservar histórico antigo de suporte sem misturar com o novo fórum'
        }).catch(() => {});
      }
    }

    channels = await guild.channels.fetch();

    // Remove categorias antigas somente quando estiverem vazias.
    for (const category of channels.filter((channel) => channel?.type === ChannelType.GuildCategory).values()) {
      if ([comunidade.id, addons.id, criacoes.id, suporte.id, punicoes.id].includes(category.id)) continue;

      const normalized = normalize(category.name);
      const removable = [
        'ucmmembros',
        'membros',
        'ucmcomunidade',
        'ucmsos',
        'sos'
      ].includes(normalized);

      if (!removable) continue;

      const children = channels.filter((channel) => channel.parentId === category.id);
      if (children.size > 0) continue;

      await category.delete('Remover categoria antiga vazia após reorganização final do UCM')
        .then(() => console.log(`[UCM-FINAL] Categoria antiga removida: ${category.name}`))
        .catch(() => {});
    }

    let finalChannels = await guild.channels.fetch();

    let finalSuggestions = finalChannels.find((channel) =>
      [ChannelType.GuildText, ChannelType.GuildForum].includes(channel?.type) &&
      normalize(channel.name) === normalize('💡・sugestões')
    ) || null;

    if (!finalSuggestions) {
      finalSuggestions = await guild.channels.create({
        name: '💡・sugestões',
        type: ChannelType.GuildText,
        parent: comunidade.id,
        topic: 'Envie sugestões para melhorar a comunidade UCM Studios.',
        reason: 'Garantir canal único de sugestões no layout final'
      });
      console.log('[UCM-FINAL] Garantido: 💡・sugestões em 「 UCM 」 COMUNIDADE');
      finalChannels = await guild.channels.fetch();
    }

    const categories = finalChannels
      .filter((channel) => channel?.type === ChannelType.GuildCategory)
      .map((channel) => channel.name);

    console.log(`[UCM-FINAL] Categorias finais: ${categories.join(' | ')}`);
    console.log('[UCM-FINAL] Organização concluída.');
  } catch (error) {
    console.error('[UCM-FINAL] Falha geral:', error);
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN).catch((error) => {
  console.error('[UCM-FINAL] Falha no login:', error.message);
  process.exit(1);
});
