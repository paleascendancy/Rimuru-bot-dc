import 'dotenv/config';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;
const PALE_GUILD_ID = '1513757281311916042';

if (!DISCORD_TOKEN) {
  console.error('[PA-SERVICE-GUARD] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

function hasServiceButton(message) {
  return message.components.some((row) =>
    row.components.some((component) => component.customId === 'pa_service_open')
  );
}

function looksLikeServicePanel(message) {
  if (hasServiceButton(message)) return true;

  return message.embeds.some((embed) => {
    const title = normalize(embed.title || '');
    const author = normalize(embed.author?.name || '');
    const footer = normalize(embed.footer?.text || '');

    return (
      title.includes('solicitarumservico') ||
      (
        author.includes('paleascendancy') &&
        (title.includes('servico') || footer.includes('atendimento'))
      )
    );
  });
}

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(PALE_GUILD_ID).catch(() => null);
    if (!guild) {
      console.log('[PA-SERVICE-GUARD] Pale Ascendancy não encontrada.');
      return;
    }

    const channels = await guild.channels.fetch();
    const channel = channels.find((item) =>
      item?.type === ChannelType.GuildText &&
      ['solicitarservico', 'pedirservico'].includes(normalize(item.name))
    ) || null;

    if (!channel) {
      console.log('[PA-SERVICE-GUARD] Canal de solicitação de serviço não encontrado.');
      return;
    }

    const recent = await channel.messages.fetch({ limit: 100 });
    const panels = [...recent.values()]
      .filter(looksLikeServicePanel)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    if (panels.length <= 1) {
      console.log(`[PA-SERVICE-GUARD] Painéis encontrados: ${panels.length}. Nada para limpar.`);
      return;
    }

    const primary = panels[0];
    let removed = 0;

    for (const duplicate of panels.slice(1)) {
      await duplicate.delete().then(() => {
        removed += 1;
      }).catch((error) => {
        console.error(
          `[PA-SERVICE-GUARD] Não foi possível excluir a duplicata ${duplicate.id}:`,
          error.message
        );
      });
    }

    console.log(
      `[PA-SERVICE-GUARD] Painel original preservado (${primary.id}); ${removed} duplicata(s) removida(s).`
    );
  } catch (error) {
    console.error('[PA-SERVICE-GUARD] Falha ao verificar duplicatas:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
