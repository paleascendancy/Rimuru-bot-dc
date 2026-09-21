import 'dotenv/config';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;
const PALE_GUILD_ID = '1513757281311916042';

if (!DISCORD_TOKEN) {
  console.error('[BUMP] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(PALE_GUILD_ID).catch(() => null);
    if (!guild) {
      console.log('[BUMP] Pale Ascendancy não encontrada.');
      return;
    }

    const channels = await guild.channels.fetch();
    const roles = await guild.roles.fetch();

    const bump = channels.find((channel) =>
      channel?.type === ChannelType.GuildText &&
      normalize(channel.name) === 'bump'
    ) || null;

    if (!bump) {
      console.log('[BUMP] Canal #bump não encontrado.');
      return;
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
  } catch (error) {
    console.error('[BUMP] Falha ao configurar #bump:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
