import 'dotenv/config';
import {
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('[WELCOME-REPAIR] DISCORD_TOKEN não configurado.');
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

async function readableName(guild, id) {
  const member = await guild.members.fetch(id).catch(() => null);
  if (!member) return null;
  return member.displayName || member.user.globalName || member.user.username;
}

async function replaceMentions(value, guild) {
  if (typeof value !== 'string' || !value.includes('<@')) return value;

  const matches = [...value.matchAll(/<@!?(\d{17,20})>/g)];
  let output = value;

  for (const match of matches) {
    const name = await readableName(guild, match[1]);
    if (!name) continue;
    output = output.replaceAll(match[0], name);
  }

  return output;
}

async function repairEmbed(embed, guild) {
  const data = embed.toJSON();
  if (data.title) data.title = await replaceMentions(data.title, guild);
  if (data.description) data.description = await replaceMentions(data.description, guild);
  if (data.author?.name) data.author.name = await replaceMentions(data.author.name, guild);
  if (data.footer?.text) data.footer.text = await replaceMentions(data.footer.text, guild);

  if (Array.isArray(data.fields)) {
    for (const field of data.fields) {
      field.name = await replaceMentions(field.name, guild);
      field.value = await replaceMentions(field.value, guild);
    }
  }

  return EmbedBuilder.from(data);
}

client.once(Events.ClientReady, async () => {
  let repaired = 0;

  try {
    for (const guild of client.guilds.cache.values()) {
      const channels = await guild.channels.fetch();

      for (const channel of channels.values()) {
        if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) continue;
        if (!normalize(channel.name).includes('boasvindas')) continue;

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (!messages) continue;

        for (const message of messages.values()) {
          if (message.author.id !== client.user.id || !message.embeds.length) continue;

          const raw = JSON.stringify(message.embeds.map((embed) => embed.toJSON()));
          if (!/<@!?\d{17,20}>/.test(raw)) continue;

          const embeds = [];
          for (const embed of message.embeds) {
            embeds.push(await repairEmbed(embed, guild));
          }

          await message.edit({ embeds }).then(() => {
            repaired += 1;
          }).catch((error) => {
            console.error(`[WELCOME-REPAIR] Falha ao corrigir mensagem ${message.id}:`, error.message);
          });
        }
      }
    }

    console.log(`[WELCOME-REPAIR] Mensagens corrigidas: ${repaired}.`);
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
