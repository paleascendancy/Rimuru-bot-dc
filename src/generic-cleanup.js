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

export async function removeLegacyMangaMorphArtifacts(guild) {
  if (!isGenericGuild(guild)) return { removed: 0 };

  const channels = await guild.channels.fetch();
  const categories = channels.filter((channel) =>
    channel?.type === ChannelType.GuildCategory &&
    LEGACY_MM_CATEGORIES.has(normalize(channel.name))
  );

  let removed = 0;

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

  if (removed > 0) {
    console.log(`[MULTI-CLEANUP] ${guild.name} (${guild.id}): ${removed} artefatos MangaMorph removidos.`);
  }

  return { removed };
}
