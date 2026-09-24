import {
  EmbedBuilder,
  OAuth2Scopes,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';

const rimuruCommand = new SlashCommandBuilder()
  .setName('rimuru')
  .setDescription('Informações e diagnóstico do Rimuru')
  .addSubcommand((subcommand) => subcommand.setName('ajuda').setDescription('Mostra os principais recursos disponíveis'))
  .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Verifica se o bot está funcionando neste servidor'))
  .addSubcommand((subcommand) => subcommand.setName('diagnostico').setDescription('Verifica permissões importantes do bot neste servidor'));

const REQUIRED_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.UseApplicationCommands
];

const PERMISSION_LABELS = new Map([
  [PermissionFlagsBits.ViewChannel, 'Ver canais'],
  [PermissionFlagsBits.SendMessages, 'Enviar mensagens'],
  [PermissionFlagsBits.EmbedLinks, 'Inserir links'],
  [PermissionFlagsBits.AttachFiles, 'Anexar arquivos'],
  [PermissionFlagsBits.ReadMessageHistory, 'Ver histórico'],
  [PermissionFlagsBits.AddReactions, 'Adicionar reações'],
  [PermissionFlagsBits.ManageMessages, 'Gerenciar mensagens'],
  [PermissionFlagsBits.ManageChannels, 'Gerenciar canais'],
  [PermissionFlagsBits.ManageRoles, 'Gerenciar cargos'],
  [PermissionFlagsBits.ManageWebhooks, 'Gerenciar webhooks'],
  [PermissionFlagsBits.ManageNicknames, 'Gerenciar apelidos'],
  [PermissionFlagsBits.CreatePublicThreads, 'Criar threads públicas'],
  [PermissionFlagsBits.CreatePrivateThreads, 'Criar threads privadas'],
  [PermissionFlagsBits.SendMessagesInThreads, 'Enviar em threads'],
  [PermissionFlagsBits.UseApplicationCommands, 'Usar comandos de aplicativo']
]);

export async function registerGenericCommands(guild) {
  const commands = await guild.commands.fetch().catch(() => null);
  if (!commands) return false;
  const data = rimuruCommand.toJSON();
  const existing = commands.find((command) => command.name === data.name);
  if (existing) await existing.edit(data);
  else await guild.commands.create(data);
  console.log(`[MULTI] ${guild.name}: /rimuru registrado.`);
  return true;
}

export async function setupGenericGuild(guild) {
  await registerGenericCommands(guild).catch((error) => {
    console.error(`[MULTI] Falha ao registrar comandos em ${guild.name}:`, error.message);
  });
}

export async function handleGenericInteraction(interaction) {
  if (!interaction.inGuild() || !interaction.isChatInputCommand() || interaction.commandName !== 'rimuru') return false;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'ajuda') {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Rimuru • Ajuda')
      .setDescription(
        'O Rimuru foi adaptado para funcionar em vários servidores sem alterar canais ou cargos automaticamente.\n\n' +
        '**Recursos disponíveis**\n' +
        '• `/boas-vindas` — configurar mensagens de entrada\n' +
        '• `/rimuru status` — verificar conexão\n' +
        '• `/rimuru diagnostico` — conferir permissões\n\n' +
        'Recursos específicos da Pale Ascendancy e do MangaMorph continuam isolados apenas nos servidores originais.'
      )
      .setFooter({ text: `Servidor: ${interaction.guild.name}` });
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (subcommand === 'status') {
    const me = await interaction.guild.members.fetchMe().catch(() => null);
    const embed = new EmbedBuilder()
      .setColor(me ? 0x57f287 : 0xed4245)
      .setTitle('Rimuru • Status')
      .setDescription(me ? `✅ Online em **${interaction.guild.name}**.\nServidor ID: \`${interaction.guild.id}\`` : 'Não consegui confirmar minha presença neste servidor.');
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (subcommand === 'diagnostico') {
    const me = await interaction.guild.members.fetchMe().catch(() => null);
    if (!me) {
      await interaction.reply({ content: 'Não consegui carregar minhas permissões neste servidor.', ephemeral: true });
      return true;
    }
    const missing = REQUIRED_PERMISSIONS.filter((permission) => !me.permissions.has(permission));
    const text = missing.length ? missing.map((permission) => `• ${PERMISSION_LABELS.get(permission) || permission.toString()}`).join('\n') : 'Nenhuma permissão importante está faltando.';
    const embed = new EmbedBuilder()
      .setColor(missing.length ? 0xf0b232 : 0x57f287)
      .setTitle('Rimuru • Diagnóstico')
      .setDescription(missing.length ? `Alguns recursos podem não funcionar por falta destas permissões:\n\n${text}` : '✅ As permissões principais estão disponíveis.')
      .setFooter({ text: 'O Rimuru não exige permissão de Administrador.' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  return false;
}

export async function buildInviteUrl(client) {
  return client.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: REQUIRED_PERMISSIONS
  });
}
