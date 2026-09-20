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
  console.error('DISCORD_TOKEN não configurado.');
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

const ROLE_GROUPS = {
  staff: new Set(['dono', 'desenvolvedor', 'administrador', 'moderador', 'suporte']),
  leadership: new Set(['dono', 'desenvolvedor', 'administrador'])
};

const CHANNELS = {
  welcome: ['boasvindas'],
  rules: ['diretrizes'],
  announcements: ['comunicados'],
  roles: ['cargos'],
  general: ['geral', 'chatgeral'],
  arts: ['arteseedits', 'midiaeartes'],
  suggestions: ['sugestoes'],
  commands: ['comandos'],
  downloads: ['downloads'],
  presets: ['presetsexml', 'presetsexmls'],
  packs: ['packseoverlays'],
  audio: ['audiosesfx'],
  mudae: ['mudae'],
  poketwo: ['poketwo'],
  games: ['jogos', 'jogosgerais'],
  voiceChat: ['chatdevoz'],
  service: ['solicitarservico'],
  ticket: ['abrirticket'],
  staffChat: ['staff', 'chatstaff'],
  staffCommands: ['comandosstaff'],
  logs: ['logs', 'logsdoservidor'],
  archiveRecord: ['registroantigo', 'registro'],
  archiveRules: ['regrasantigas'],
  voiceEditing: ['edicao', 'loungeedicao'],
  voiceMusic: ['musica', 'loungemusica'],
  voiceGaming: ['gaming', 'loungegaming'],
  voiceAfk: ['afk', 'ausenteafk'],
  voiceStaff: ['reuniaostaff']
};

const TOPICS = {
  welcome: 'Recepção oficial da Pale Ascendancy • leia as diretrizes e descubra os principais canais.',
  rules: 'Regras e diretrizes oficiais da Pale Ascendancy • leitura obrigatória.',
  announcements: 'Comunicados, novidades e atualizações oficiais da Pale Ascendancy.',
  roles: 'Informações sobre cargos, funções, áreas criativas e identidade da comunidade.',
  general: 'Conversa principal da comunidade • criação, edição, design e assuntos gerais.',
  arts: 'Compartilhe seus edits, artes, trabalhos, portfólio e projetos criativos.',
  suggestions: 'Sugira melhorias para a comunidade, recursos, eventos, bots e organização.',
  commands: 'Canal dedicado ao uso de bots e comandos para manter os demais canais organizados.',
  downloads: 'Recursos e links permitidos para criação • compartilhe materiais úteis com contexto e créditos.',
  presets: 'Presets, XMLs e arquivos de projeto • informe software, versão e créditos quando necessário.',
  packs: 'Packs, overlays, texturas, fontes e elementos gráficos para trabalhos criativos.',
  audio: 'Áudios e efeitos sonoros para projetos • informe origem e créditos quando necessário.',
  mudae: 'Canal exclusivo para comandos e atividades do Mudae.',
  poketwo: 'Canal exclusivo para comandos e atividades do Pokétwo.',
  games: 'Minigames, brincadeiras e entretenimento com bots.',
  voiceChat: 'Chat de apoio para quem está nas salas de voz.',
  service: 'Solicite edição, design ou outros serviços criativos por atendimento privado.',
  ticket: 'Central privada para suporte, parceria, denúncia, candidatura e outros atendimentos.',
  staffChat: 'Comunicação operacional privada da equipe Pale Ascendancy.',
  staffCommands: 'Comandos administrativos e ferramentas internas da equipe.',
  logs: 'Registros automáticos de moderação, auditoria e ações administrativas.',
  archiveRecord: 'Conteúdo legado arquivado • acesso restrito à equipe.',
  archiveRules: 'Versão antiga das regras • mantida apenas para referência da equipe.'
};

async function findByAliases(channels, aliases, type) {
  const wanted = aliases.map(normalize);
  return channels.find((channel) =>
    channel?.type === type && wanted.includes(normalize(channel.name))
  ) || null;
}

function publicReadOnly() {
  return {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
    AddReactions: false
  };
}

function publicChat(slowmode = 5) {
  return {
    perms: {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      AddReactions: true,
      AttachFiles: true,
      EmbedLinks: true,
      UseExternalEmojis: true
    },
    slowmode
  };
}

async function allowBot(channel, botId) {
  await channel.permissionOverwrites.edit(botId, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: true,
    EmbedLinks: true,
    AttachFiles: true,
    AddReactions: true,
    ManageMessages: true
  }).catch(() => {});
}

async function applyTextConfig(guild, channel, config, roles) {
  if (!channel) return;

  const patch = {};
  if (config.topic !== undefined) patch.topic = config.topic;
  if (config.slowmode !== undefined) patch.rateLimitPerUser = config.slowmode;
  if (config.nsfw !== undefined) patch.nsfw = config.nsfw;
  await channel.edit(patch, 'Configuração profissional dos canais da Pale Ascendancy').catch((error) => {
    console.error(`[PA-CHANNELS] Falha ao editar ${channel.name}:`, error.message);
  });

  if (config.everyone) {
    await channel.permissionOverwrites.edit(guild.roles.everyone.id, config.everyone).catch(() => {});
  }

  if (config.member && roles.member) {
    await channel.permissionOverwrites.edit(roles.member.id, config.member).catch(() => {});
  }

  if (config.staff) {
    for (const role of roles.staff.values()) {
      await channel.permissionOverwrites.edit(role.id, config.staff).catch(() => {});
    }
  }

  if (config.leadership) {
    for (const role of roles.leadership.values()) {
      await channel.permissionOverwrites.edit(role.id, config.leadership).catch(() => {});
    }
  }

  await allowBot(channel, client.user.id);
}

async function configureGuild(guild) {
  const channels = await guild.channels.fetch();
  const guildRoles = await guild.roles.fetch();

  const roles = {
    member: guildRoles.find((role) => normalize(role.name) === 'membro') || null,
    staff: guildRoles.filter((role) => ROLE_GROUPS.staff.has(normalize(role.name))),
    leadership: guildRoles.filter((role) => ROLE_GROUPS.leadership.has(normalize(role.name)))
  };

  const text = {};
  for (const [key, aliases] of Object.entries(CHANNELS)) {
    if (key.startsWith('voice')) continue;
    text[key] = await findByAliases(channels, aliases, ChannelType.GuildText);
  }

  const voice = {};
  for (const [key, aliases] of Object.entries(CHANNELS)) {
    if (!key.startsWith('voice')) continue;
    voice[key] = await findByAliases(channels, aliases, ChannelType.GuildVoice);
  }

  const readOnly = publicReadOnly();
  const leadershipPost = {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: true,
    EmbedLinks: true,
    AttachFiles: true
  };

  await applyTextConfig(guild, text.welcome, {
    topic: TOPICS.welcome,
    slowmode: 0,
    nsfw: false,
    everyone: readOnly
  }, roles);

  await applyTextConfig(guild, text.rules, {
    topic: TOPICS.rules,
    slowmode: 0,
    nsfw: false,
    everyone: readOnly
  }, roles);

  await applyTextConfig(guild, text.announcements, {
    topic: TOPICS.announcements,
    slowmode: 0,
    nsfw: false,
    everyone: readOnly,
    leadership: leadershipPost
  }, roles);

  await applyTextConfig(guild, text.roles, {
    topic: TOPICS.roles,
    slowmode: 0,
    nsfw: false,
    everyone: { ...readOnly, AddReactions: true }
  }, roles);

  for (const [key, slowmode] of [['general', 5], ['arts', 10], ['suggestions', 30], ['commands', 2], ['voiceChat', 3]]) {
    const profile = publicChat(slowmode);
    await applyTextConfig(guild, text[key], {
      topic: TOPICS[key],
      slowmode: profile.slowmode,
      nsfw: false,
      everyone: profile.perms
    }, roles);
  }

  for (const key of ['downloads', 'presets', 'packs', 'audio']) {
    await applyTextConfig(guild, text[key], {
      topic: TOPICS[key],
      slowmode: 15,
      nsfw: false,
      everyone: {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false,
        AddReactions: true
      },
      member: {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: true,
        AddReactions: true,
        AttachFiles: true,
        EmbedLinks: true
      }
    }, roles);
  }

  for (const key of ['mudae', 'poketwo', 'games']) {
    const profile = publicChat(2);
    await applyTextConfig(guild, text[key], {
      topic: TOPICS[key],
      slowmode: profile.slowmode,
      nsfw: false,
      everyone: profile.perms
    }, roles);
  }

  for (const key of ['service', 'ticket']) {
    await applyTextConfig(guild, text[key], {
      topic: TOPICS[key],
      slowmode: 0,
      nsfw: false,
      everyone: readOnly,
      staff: {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false
      }
    }, roles);
  }

  await applyTextConfig(guild, text.staffChat, {
    topic: TOPICS.staffChat,
    slowmode: 0,
    nsfw: false,
    everyone: { ViewChannel: false },
    staff: {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      AddReactions: true,
      AttachFiles: true,
      EmbedLinks: true
    }
  }, roles);

  await applyTextConfig(guild, text.staffCommands, {
    topic: TOPICS.staffCommands,
    slowmode: 2,
    nsfw: false,
    everyone: { ViewChannel: false },
    staff: {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      AddReactions: true,
      AttachFiles: true,
      EmbedLinks: true
    }
  }, roles);

  await applyTextConfig(guild, text.logs, {
    topic: TOPICS.logs,
    slowmode: 0,
    nsfw: false,
    everyone: { ViewChannel: false },
    staff: {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: false
    }
  }, roles);

  for (const key of ['archiveRecord', 'archiveRules']) {
    await applyTextConfig(guild, text[key], {
      topic: TOPICS[key],
      slowmode: 0,
      nsfw: false,
      everyone: { ViewChannel: false },
      staff: {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false
      }
    }, roles);
  }

  const publicVoicePerms = {
    ViewChannel: true,
    Connect: true,
    Speak: true,
    Stream: true,
    UseVAD: true
  };

  for (const key of ['voiceEditing', 'voiceMusic', 'voiceGaming', 'voiceAfk']) {
    const channel = voice[key];
    if (!channel) continue;
    await channel.permissionOverwrites.edit(guild.roles.everyone.id, publicVoicePerms).catch(() => {});
  }

  if (voice.voiceStaff) {
    await voice.voiceStaff.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false, Connect: false }).catch(() => {});
    for (const role of roles.staff.values()) {
      await voice.voiceStaff.permissionOverwrites.edit(role.id, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        Stream: true,
        UseVAD: true
      }).catch(() => {});
    }
  }

  if (voice.voiceAfk) {
    await guild.setAFKChannel(voice.voiceAfk, 'Configurar canal AFK oficial').catch(() => {});
    await guild.setAFKTimeout(300, 'Configurar tempo AFK para 5 minutos').catch(() => {});
  }

  console.log('[PA-CHANNELS] Todos os canais foram configurados de acordo com sua função.');
}

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(PALE_GUILD_ID).catch(() => null);
    if (!guild) {
      console.log('[PA-CHANNELS] Pale Ascendancy não encontrada neste bot.');
      return;
    }
    await configureGuild(guild);
  } catch (error) {
    console.error('[PA-CHANNELS] Falha geral:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
