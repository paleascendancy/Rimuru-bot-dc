import 'dotenv/config';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits
} from 'discord.js';
import {
  keepOldestAndDeleteRest,
  messageEmbedText,
  messageHasCustomId,
  normalizePanelText
} from './panel-utils.js';

const { DISCORD_TOKEN } = process.env;
const PALE_GUILD_ID = '1513757281311916042';

if (!DISCORD_TOKEN) {
  console.error('[PANEL-GUARD] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function isTextChannel(channel) {
  return channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement;
}

function findChannel(channels, names) {
  const wanted = new Set(names.map(normalizePanelText));
  return channels.find((channel) =>
    isTextChannel(channel) && wanted.has(normalizePanelText(channel.name))
  ) || null;
}

function messageTitleText(message) {
  return normalizePanelText(message.embeds.map((embed) => embed.title || '').join(' '));
}

async function dedupeFamily(channel, messages, botId, label, predicate) {
  if (!channel || !messages) return 0;

  const matches = [...messages.values()].filter((message) =>
    message.author.id === botId && predicate(message)
  );

  if (matches.length <= 1) return 0;

  const { removed } = await keepOldestAndDeleteRest(matches, label);
  if (removed > 0) {
    console.log(`[PANEL-GUARD] ${channel.guild.name} / #${channel.name}: ${label} → ${removed} duplicata(s) removida(s).`);
  }
  return removed;
}

async function scanChannel(channel, families, botId) {
  if (!channel) return 0;
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return 0;

  let removed = 0;
  for (const family of families) {
    removed += await dedupeFamily(channel, messages, botId, family.label, family.match);
  }
  return removed;
}

function paleFamiliesForChannel(name) {
  const normalized = normalizePanelText(name);

  if (['solicitarservico', 'pedirservico'].includes(normalized)) {
    return [{
      label: 'solicitação de serviço',
      match: (message) => {
        const text = messageEmbedText(message);
        return messageHasCustomId(message, 'pa_service_open') ||
          text.includes('solicitarumservico') ||
          (
            text.includes('paleascendancyservicos') &&
            text.includes('atendimentoprofissional')
          );
      }
    }];
  }

  if (['sobreacomunidade', 'nossacomunidade', 'institucional'].includes(normalized)) {
    return [{
      label: 'sobre a comunidade',
      match: (message) => {
        const text = messageEmbedText(message);
        return text.includes('sobreacomunidade') ||
          text.includes('editoresdepromocaoeservicos') ||
          text.includes('criatividadeorganizacaoeentrega');
      }
    }];
  }

  if (['sugestoes', 'sugestao'].includes(normalized)) {
    return [{
      label: 'central de sugestões',
      match: (message) => {
        const text = messageEmbedText(message);
        return messageHasCustomId(message, 'pa_suggestion_open') ||
          text.includes('centraldesugestoespaleascendancy') ||
          text.includes('sugestoesclarassao');
      }
    }];
  }

  if (normalized === 'cargos') {
    return [
      {
        label: 'introdução de cargos',
        match: (message) => {
          const text = messageEmbedText(message);
          return text.includes('personalizeseuperfil') ||
            text.includes('paleascendancyidentidade');
        }
      },
      {
        label: 'cargos de áreas criativas',
        match: (message) => {
          const text = messageEmbedText(message);
          const titles = messageTitleText(message);
          return titles.includes('areascriativas') ||
            (text.includes('edicaodevideo') && text.includes('motiondesign') && text.includes('socialmedia'));
        }
      },
      {
        label: 'cargos de ferramentas',
        match: (message) => {
          const text = messageEmbedText(message);
          const titles = messageTitleText(message);
          return titles.includes('ferramentas') ||
            (text.includes('capcut') && text.includes('aftereffects') && text.includes('premierepro'));
        }
      },
      {
        label: 'cargos de notificações',
        match: (message) => {
          const text = messageEmbedText(message);
          const titles = messageTitleText(message);
          return titles.includes('notificacoes') ||
            (text.includes('anuncios') && text.includes('eventos') && text.includes('parcerias'));
        }
      },
      {
        label: 'cargos de cor do perfil',
        match: (message) => {
          const text = messageEmbedText(message);
          const titles = messageTitleText(message);
          return titles.includes('cordoperfil') ||
            (text.includes('crimson') && text.includes('azure') && text.includes('silver'));
        }
      }
    ];
  }

  if (['tarefas', 'stafftarefas'].includes(normalized)) {
    const markers = [
      ['manual da equipe', 'funcoestarefaseresponsabilidades'],
      ['direção', 'donodirecao'],
      ['desenvolvedor', 'desenvolvedor'],
      ['administrador', 'administrador'],
      ['moderador', 'moderador'],
      ['suporte', 'suporte'],
      ['prioridades e fluxo', 'prioridadese fluxo'.replace(/ /g, '')],
      ['rotina da equipe', 'rotinadaequipe']
    ];

    return markers.map(([label, marker]) => ({
      label,
      match: (message) => messageTitleText(message).includes(marker)
    }));
  }

  return [];
}

function mangaMorphFamiliesForChannel(name) {
  const normalized = normalizePanelText(name);

  if (normalized === 'regras') {
    return [{
      label: 'regras MangaMorph',
      match: (message) => {
        const text = messageEmbedText(message);
        return text.includes('codigodacomunidade') ||
          text.includes('regrasdomangamorph') ||
          text.includes('mangamorphcomunidadeoficial');
      }
    }];
  }

  if (['candidaturas', 'candidatura'].includes(normalized)) {
    return [{
      label: 'candidaturas MangaMorph',
      match: (message) => {
        const text = messageEmbedText(message);
        return messageHasCustomId(message, 'mm_application_open') ||
          text.includes('candidaturasmangamorph') ||
          text.includes('mangamorphequipe');
      }
    }];
  }

  if (['abrirticket', 'ticket', 'suporte'].includes(normalized)) {
    return [{
      label: 'central de atendimento MangaMorph',
      match: (message) => {
        const text = messageEmbedText(message);
        return messageHasCustomId(message, 'mm_ticket_open') ||
          text.includes('centraldeatendimentomangamorph') ||
          text.includes('mangamorphsuporte');
      }
    }];
  }

  return [];
}

client.once(Events.ClientReady, async () => {
  try {
    let totalRemoved = 0;

    for (const guild of client.guilds.cache.values()) {
      const channels = await guild.channels.fetch();

      if (guild.id === PALE_GUILD_ID) {
        for (const channel of channels.values()) {
          if (!isTextChannel(channel)) continue;
          const families = paleFamiliesForChannel(channel.name);
          if (!families.length) continue;
          totalRemoved += await scanChannel(channel, families, client.user.id);
        }
      }

      if (normalizePanelText(guild.name).includes('mangamorph')) {
        for (const channel of channels.values()) {
          if (!isTextChannel(channel)) continue;
          const families = mangaMorphFamiliesForChannel(channel.name);
          if (!families.length) continue;
          totalRemoved += await scanChannel(channel, families, client.user.id);
        }
      }
    }

    console.log(`[PANEL-GUARD] Varredura concluída. Duplicatas removidas: ${totalRemoved}.`);
  } catch (error) {
    console.error('[PANEL-GUARD] Falha na varredura de painéis:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
