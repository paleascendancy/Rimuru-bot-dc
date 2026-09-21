import {
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';

const PALE_GUILD_ID = '1513757281311916042';

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export async function configureBumpChannel(client) {
  const guild = await client.guilds.fetch(PALE_GUILD_ID).catch(() => null);
  if (!guild) {
    console.log('[BUMP] Pale Ascendancy não encontrada.');
    return false;
  }

  const channels = await guild.channels.fetch();
  const roles = await guild.roles.fetch();

  const bump = channels.find((channel) =>
    channel?.type === ChannelType.GuildText &&
    normalize(channel.name) === 'bump'
  ) || null;

  if (!bump) {
    console.log('[BUMP] Canal #bump não encontrado.');
    return false;
  }

  const adminRoles = roles.filter((role) =>
    role.permissions.has(PermissionFlagsBits.Administrator) ||
    normalize(role.name) === 'administrador'
  );
  const keepOverwriteIds = new Set([
    guild.roles.everyone.id,
    client.user.id,
    ...adminRoles.keys()
  ]);

  for (const overwrite of bump.permissionOverwrites.cache.values()) {
    if (keepOverwriteIds.has(overwrite.id)) continue;
    await bump.permissionOverwrites.delete(overwrite.id).catch(() => {});
  }

  await bump.permissionOverwrites.edit(guild.roles.everyone.id, {
    ViewChannel: false
  });

  for (const role of adminRoles.values()) {
    await bump.permissionOverwrites.edit(role.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      UseApplicationCommands: true
    });
  }

  await bump.permissionOverwrites.edit(client.user.id, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: true,
    UseApplicationCommands: true
  });

  console.log('[BUMP] Canal #bump restrito a administradores.');
  return true;
}
