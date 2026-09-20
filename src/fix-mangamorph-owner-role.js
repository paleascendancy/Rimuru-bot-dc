import 'dotenv/config';
import {
  Client,
  Events,
  GatewayIntentBits
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('[OWNER-ROLE] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

client.once(Events.ClientReady, async () => {
  try {
    for (const guild of client.guilds.cache.values()) {
      if (!normalize(guild.name).includes('mangamorph')) continue;

      const roles = await guild.roles.fetch();
      const protectedRoles = roles.filter((role) => normalize(role.name) === 'mangamorph');

      if (!protectedRoles.size) {
        console.log(`[OWNER-ROLE] Nenhum cargo MangaMorph encontrado em ${guild.name}.`);
        continue;
      }

      await guild.members.fetch().catch(() => null);
      const ownerId = guild.ownerId;

      for (const role of protectedRoles.values()) {
        if (role.managed) {
          console.log(`[OWNER-ROLE] Cargo gerenciado ${role.name} ignorado.`);
          continue;
        }

        if (!role.editable) {
          console.warn(`[OWNER-ROLE] Cargo ${role.name} não é editável pelo bot; ajuste a hierarquia do bot se necessário.`);
          continue;
        }

        let removed = 0;
        for (const member of role.members.values()) {
          if (member.id === ownerId) continue;
          await member.roles.remove(role, 'Cargo MangaMorph é exclusivo do dono do servidor').catch((error) => {
            console.error(`[OWNER-ROLE] Falha ao remover de ${member.user.tag}:`, error.message);
          });
          removed += 1;
        }

        const owner = await guild.members.fetch(ownerId).catch(() => null);
        if (owner && !owner.roles.cache.has(role.id)) {
          await owner.roles.add(role, 'Cargo MangaMorph reservado ao dono').catch((error) => {
            console.error('[OWNER-ROLE] Falha ao garantir cargo no dono:', error.message);
          });
        }

        await role.edit({ mentionable: false }, 'Proteger cargo exclusivo do dono').catch(() => {});
        console.log(`[OWNER-ROLE] ${role.name}: removido de ${removed} membro(s); mantido apenas no dono.`);
      }
    }
  } catch (error) {
    console.error('[OWNER-ROLE] Falha na correção:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
