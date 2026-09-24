const PALE_GUILD_ID = '1513757281311916042';

const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export function isPaleGuild(guild) {
  return Boolean(guild?.id && guild.id === PALE_GUILD_ID);
}

export function isMangaMorphGuild(guild) {
  if (!guild) return false;
  const configuredId = process.env.MANGAMORPH_GUILD_ID?.trim();
  if (configuredId) return guild.id === configuredId;
  return normalize(guild.name).includes('mangamorph');
}

export function isGenericGuild(guild) {
  return Boolean(guild) && !isPaleGuild(guild) && !isMangaMorphGuild(guild);
}

export { PALE_GUILD_ID };
