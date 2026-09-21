import 'dotenv/config';
import {
  Client,
  Events,
  GatewayIntentBits
} from 'discord.js';
import { setupPaleCommunity, PALE_COMMUNITY_GUILD_ID } from './pale-community.js';

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('[PANEL-REPAIR] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(PALE_COMMUNITY_GUILD_ID).catch(() => null);
    if (!guild) {
      console.log('[PANEL-REPAIR] Pale Ascendancy não encontrada.');
      return;
    }

    await setupPaleCommunity(guild);
    console.log('[PANEL-REPAIR] Painéis de comunidade da Pale Ascendancy restaurados.');
  } catch (error) {
    console.error('[PANEL-REPAIR] Falha ao restaurar painéis:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
