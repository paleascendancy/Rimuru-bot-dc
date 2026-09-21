import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { setupPaleCommunity } from './pale-community.js';

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export async function setupPaleRuntime(guild) {
  const me = await guild.members.fetchMe().catch(() => null);
  if (me?.manageable && me.nickname !== 'Pale Ascendancy') {
    await me.setNickname('Pale Ascendancy', 'Identidade visual do bot neste servidor').catch(() => {});
  }

  const roles = await guild.roles.fetch().catch(() => null);
  const channels = await guild.channels.fetch().catch(() => null);
  if (!roles || !channels) return;

  const memberRole = roles.find((role) => normalize(role.name) === 'membro') || null;
  const suggestions = channels.find((channel) =>
    channel?.type === ChannelType.GuildText && normalize(channel.name) === 'sugestoes'
  ) || null;

  const bump = channels.find((channel) =>
    channel?.type === ChannelType.GuildText && normalize(channel.name) === 'bump'
  ) || null;

  if (suggestions && memberRole) {
    await suggestions.permissionOverwrites.edit(memberRole.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: false,
      SendMessagesInThreads: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
      AddReactions: true
    }).catch(() => {});
  }

  if (bump) {
    const adminRoles = roles.filter((role) =>
      role.permissions.has(PermissionFlagsBits.Administrator) ||
      normalize(role.name) === 'administrador'
    );
    const keepOverwriteIds = new Set([
      guild.roles.everyone.id,
      guild.client.user.id,
      ...adminRoles.keys()
    ]);

    for (const overwrite of bump.permissionOverwrites.cache.values()) {
      if (keepOverwriteIds.has(overwrite.id)) continue;
      await bump.permissionOverwrites.delete(overwrite.id).catch(() => {});
    }

    await bump.permissionOverwrites.edit(guild.roles.everyone.id, {
      ViewChannel: false
    }).catch(() => {});

    for (const role of adminRoles.values()) {
      await bump.permissionOverwrites.edit(role.id, {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: true,
        UseApplicationCommands: true
      }).catch(() => {});
    }

    await bump.permissionOverwrites.edit(guild.client.user.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      UseApplicationCommands: true
    }).catch(() => {});

    console.log('[Pale Ascendancy] Canal #bump restrito a administradores.');
  }

  await setupPaleCommunity(guild).catch((error) => {
    console.error('[Pale Ascendancy] Falha ao preparar comunidade:', error);
  });

  console.log(`[Pale Ascendancy] Runtime preparado.`);
}
