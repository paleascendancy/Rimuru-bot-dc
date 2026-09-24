import { ChannelType } from 'discord.js';
import { isGenericGuild } from './guild-profile.js';

const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const LEGACY_MM_CATEGORIES = new Set([
  'mminicio',
  'mmcontribuir',
  'mmsuporte',
  'mmobras'
]);

const LEGACY_MM_TOPICS = [
  'diretrizes oficiais leitura obrigatoria canal somente leitura',
  'entre para a equipe do mangamorph candidaturas abertas',
  'abra um atendimento privado com a equipe do mangamorph',
  'sugira obras para serem adicionadas ao site mangamorph'
];

function isLegacyTopic(topic = '') {
  const normalized = normalize(topic);
  return LEGACY_MM_TOPICS.some((marker) => normalized.includes(normalize(marker)));
}

function isLegacyMessage(message, botId) {
  if (message.author.id !== botId) return false;

  return message.embeds.some((embed) => {
    const text = normalize([
      embed.title,
      embed.description,
      embed.author?.name,
      embed.footer?.text
    ].filter(Boolean).join(' '));

    return (
      text.includes('codigodacomunidade') ||
      text.includes('candidaturasmangamorph') ||
      text.includes('centraldeatendimentomangamorph') ||
      text.includes('mangamorphcomunidadeoficial') ||
      text.includes('mangamorphequipe') ||
      text.includes('mangamorphsuporte')
    );
  });
}

export async function removeLegacyMangaMorphArtifacts(guild) {
  if (!isGenericGuild(guild)) return { removed: 0 };

  let removed = 0;
  let channels = await guild.channels.fetch();

  const categories = channels.filter((channel) =>
    channel?.type === ChannelType.GuildCategory &&
    LEGACY_MM_CATEGORIES.has(normalize(channel.name))
  );

  for (const category of categories.values()) {
    const children = channels.filter((channel) => channel?.parentId === category.id);

    for (const child of children.values()) {
      await child.delete('Remoção de canal MangaMorph criado acidentalmente pelo bot').then(() => {
        removed += 1;
      }).catch((error) => {
        console.error(`[MULTI-CLEANUP] Falha ao remover ${child.name} em ${guild.name}:`, error.message);
      });
    }

    await category.delete('Remoção de categoria MangaMorph criada acidentalmente pelo bot').then(() => {
      removed += 1;
    }).catch((error) => {
      console.error(`[MULTI-CLEANUP] Falha ao remover categoria ${category.name} em ${guild.name}:`, error.message);
    });
  }

  channels = await guild.channels.fetch();

  for (const channel of channels.values()) {
    if (!channel) continue;

    if (
      [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(channel.type) &&
      isLegacyTopic(channel.topic)
    ) {
      await channel.delete('Remoção de canal MangaMorph órfão criado acidentalmente pelo bot').then(() => {
        removed += 1;
      }).catch((error) => {
        console.error(`[MULTI-CLEANUP] Falha ao remover canal órfão ${channel.name} em ${guild.name}:`, error.message);
      });
    }
  }

  channels = await guild.channels.fetch();
  const botId = guild.client.user?.id;

  if (botId) {
    for (const channel of channels.values()) {
      if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) continue;

      const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
      if (!messages) continue;

      for (const message of messages.values()) {
        if (!isLegacyMessage(message, botId)) continue;

        await message.delete().then(() => {
          removed += 1;
        }).catch((error) => {
          if (error?.code === 10008 || error?.rawError?.code === 10008) return;
          console.error(`[MULTI-CLEANUP] Falha ao remover mensagem antiga em #${channel.name}:`, error.message);
        });
      }
    }
  }

  if (removed > 0) {
    console.log(`[MULTI-CLEANUP] ${guild.name} (${guild.id}): ${removed} artefato(s) MangaMorph removido(s).`);
  } else {
    console.log(`[MULTI-CLEANUP] ${guild.name} (${guild.id}): nenhum artefato MangaMorph restante.`);
  }

  return { removed };
}
