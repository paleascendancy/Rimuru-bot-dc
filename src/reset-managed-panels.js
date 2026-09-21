import 'dotenv/config';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits
} from 'discord.js';
import {
  messageEmbedText,
  messageHasCustomId,
  normalizePanelText
} from './panel-utils.js';

const { DISCORD_TOKEN } = process.env;
const PALE_GUILD_ID = '1513757281311916042';

if (!DISCORD_TOKEN) {
  console.error('[PANEL-RESET] DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function isTextChannel(channel) {
  return channel?.type === ChannelType.GuildText ||
    channel?.type === ChannelType.GuildAnnouncement;
}

function titleText(message) {
  return normalizePanelText(
    message.embeds.map((embed) => embed.title || '').join(' ')
  );
}

async function fetchMessages(channel, max = 500) {
  const found = [];
  let before;

  while (found.length < max) {
    const batch = await channel.messages.fetch({
      limit: Math.min(100, max - found.length),
      ...(before ? { before } : {})
    }).catch(() => null);

    if (!batch?.size) break;
    found.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }

  return found;
}

function paleFamilies(name) {
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
          const titles = titleText(message);
          return titles.includes('areascriativas') ||
            (text.includes('edicaodevideo') && text.includes('motiondesign') && text.includes('socialmedia'));
        }
      },
      {
        label: 'cargos de ferramentas',
        match: (message) => {
          const text = messageEmbedText(message);
          const titles = titleText(message);
          return titles.includes('ferramentas') ||
            (text.includes('capcut') && text.includes('aftereffects') && text.includes('premierepro'));
        }
      },
      {
        label: 'cargos de notificações',
        match: (message) => {
          const text = messageEmbedText(message);
          const titles = titleText(message);
          return titles.includes('notificacoes') ||
            (text.includes('anuncios') && text.includes('eventos') && text.includes('parcerias'));
        }
      },
      {
        label: 'cargos de cor do perfil',
        match: (message) => {
          const text = messageEmbedText(message);
          const titles = titleText(message);
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
      ['prioridades e fluxo', 'prioridadesefluxo'],
      ['rotina da equipe', 'rotinadaequipe']
    ];

    return markers.map(([label, marker]) => ({
      label,
      match: (message) => titleText(message).includes(marker)
    }));
  }

  return [];
}

function mangaMorphFamilies(name) {
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

async function resetChannel(channel, families, botId) {
  if (!families.length) return 0;
  const messages = await fetchMessages(channel);
  let removed = 0;
  const deleted = new Set();

  for (const family of families) {
    for (const message of messages) {
      if (deleted.has(message.id)) continue;
      if (message.author.id !== botId) continue;
      if (!family.match(message)) continue;

      await message.delete().then(() => {
        deleted.add(message.id);
        removed += 1;
        console.log(`[PANEL-RESET] #${channel.name}: removido ${family.label} antigo (${message.id}).`);
      }).catch((error) => {
        if (error?.code === 10008 || error?.rawError?.code === 10008) return;
        console.error(`[PANEL-RESET] Falha ao remover ${family.label} (${message.id}):`, error.message);
      });
    }
  }

  return removed;
}

client.once(Events.ClientReady, async () => {
  try {
    let total = 0;

    for (const guild of client.guilds.cache.values()) {
      const channels = await guild.channels.fetch();

      if (guild.id === PALE_GUILD_ID) {
        for (const channel of channels.values()) {
          if (!isTextChannel(channel)) continue;
          total += await resetChannel(
            channel,
            paleFamilies(channel.name),
            client.user.id
          );
        }
      }

      if (normalizePanelText(guild.name).includes('mangamorph')) {
        for (const channel of channels.values()) {
          if (!isTextChannel(channel)) continue;
          total += await resetChannel(
            channel,
            mangaMorphFamilies(channel.name),
            client.user.id
          );
        }
      }
    }

    console.log(`[PANEL-RESET] Limpeza concluída. Mensagens antigas removidas: ${total}.`);
  } catch (error) {
    console.error('[PANEL-RESET] Falha na limpeza:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
