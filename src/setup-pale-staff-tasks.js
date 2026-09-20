import 'dotenv/config';
import {
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;
const PALE_GUILD_ID = '1513757281311916042';

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN não configurado.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const STAFF_NAMES = new Set(['dono', 'desenvolvedor', 'administrador', 'moderador', 'suporte']);

function roleLabel(roles, normalizedName, fallback) {
  const role = roles.find((item) => normalize(item.name) === normalizedName);
  return role ? `${role}` : fallback;
}

function buildEmbeds(guild, roles) {
  const owner = roleLabel(roles, 'dono', '**Dono / Direção**');
  const developer = roleLabel(roles, 'desenvolvedor', '**Desenvolvedor**');
  const administrator = roleLabel(roles, 'administrador', '**Administrador**');
  const moderator = roleLabel(roles, 'moderador', '**Moderador**');
  const support = roleLabel(roles, 'suporte', '**Suporte**');

  return [
    new EmbedBuilder()
      .setColor(0x7b61ff)
      .setAuthor({ name: 'Pale Ascendancy • Manual da Staff', iconURL: guild.iconURL({ size: 128 }) || client.user.displayAvatarURL() })
      .setTitle('✅ FUNÇÕES, TAREFAS E RESPONSABILIDADES')
      .setDescription(
        'Este canal é o **manual operacional da staff**. Ele define responsabilidades, limites, prioridades e como encaminhar cada situação.\n\n' +
        `**Fluxo de responsabilidade**\n${owner} → ${developer} / ${administrator} → ${moderator} → ${support}\n\n` +
        '**Regra central:** resolva o que pertence à sua função. Quando precisar escalar, envie contexto, evidências, o que já foi feito e o que precisa ser decidido.'
      )
      .setFooter({ text: 'Pale Ascendancy • Organização interna' }),

    new EmbedBuilder()
      .setColor(0x9b7cff)
      .setTitle('👑 DONO / DIREÇÃO')
      .setDescription(
        '**Missão:** definir rumo, prioridades e decisões finais da Pale Ascendancy.\n\n' +
        '**Responsabilidades**\n' +
        '• visão, posicionamento, metas e prioridades do projeto;\n' +
        '• aprovação de mudanças grandes no servidor, serviços e identidade;\n' +
        '• promoções, rebaixamentos, entrada e saída da staff;\n' +
        '• decisões financeiras, despesas, investimentos e parcerias importantes;\n' +
        '• políticas para clientes, comunidade, segurança e operação;\n' +
        '• resolução final de conflitos ou exceções que ultrapassem a Administração;\n' +
        '• controle dos acessos mais sensíveis e definição dos responsáveis por cada área.\n\n' +
        '**Rotina**\n' +
        '• revisar pendências críticas; acompanhar resultados; redefinir prioridades; validar mudanças irreversíveis.\n\n' +
        '**Evitar**\n' +
        '• centralizar tarefas simples; tomar decisões críticas sem registro quando houver punição grave, dinheiro, segurança ou acesso envolvido.'
      ),

    new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🧩 DESENVOLVEDOR')
      .setDescription(
        `**Cargo:** ${developer}\n**Missão:** manter a parte técnica confiável, segura e funcional.\n\n` +
        '**Responsabilidades**\n' +
        '• desenvolver e manter site, bots, automações e integrações;\n' +
        '• corrigir bugs, falhas de permissões e problemas de funcionamento;\n' +
        '• revisar código e testar antes de alterações relevantes;\n' +
        '• cuidar de deploys, APIs, banco de dados e serviços externos;\n' +
        '• preservar variáveis de ambiente, tokens e credenciais;\n' +
        '• manter logs técnicos, backups e plano de recuperação quando necessário;\n' +
        '• investigar lentidão, quedas e erros recorrentes;\n' +
        '• documentar mudanças que afetem usuários ou staff.\n\n' +
        '**Antes de publicar**\n' +
        '`1.` medir impacto; `2.` testar; `3.` preservar dados/configuração; `4.` ter reversão; `5.` registrar.\n\n' +
        '**Escalar para Direção** quando houver custo, perda de dados, mudança estrutural, acesso sensível ou grande impacto.'
      ),

    new EmbedBuilder()
      .setColor(0x4e73df)
      .setTitle('🛡️ ADMINISTRADOR')
      .setDescription(
        `**Cargo:** ${administrator}\n**Missão:** garantir que servidor e equipe funcionem corretamente no dia a dia.\n\n` +
        '**Responsabilidades**\n' +
        '• organizar categorias, canais, cargos, permissões e acessos;\n' +
        '• supervisionar Moderadores e Suporte;\n' +
        '• conferir tickets importantes e atendimentos atrasados;\n' +
        '• aplicar decisões administrativas aprovadas pela Direção;\n' +
        '• revisar punições graves e casos de conflito;\n' +
        '• proteger canais privados, logs e dados internos;\n' +
        '• treinar e acompanhar novos membros da staff;\n' +
        '• redistribuir tarefas e cobrar pendências operacionais;\n' +
        '• manter padrão de atendimento e conduta.\n\n' +
        '**Checklist**\n' +
        'Permissões corretas • canais funcionando • tickets sem abandono • denúncias tratadas • logs disponíveis • staff alinhada.\n\n' +
        '**Escalar** estratégia/dinheiro → Direção; infraestrutura/segurança técnica → Desenvolvedor.'
      ),

    new EmbedBuilder()
      .setColor(0x3f8cff)
      .setTitle('⚔️ MODERADOR')
      .setDescription(
        `**Cargo:** ${moderator}\n**Missão:** manter a comunidade segura, organizada e dentro das diretrizes.\n\n` +
        '**Responsabilidades**\n' +
        '• acompanhar conversas e agir em violações claras;\n' +
        '• orientar primeiro quando o caso for leve e corrigível;\n' +
        '• aplicar advertência, timeout ou medidas permitidas de forma proporcional;\n' +
        '• remover spam, flood, golpes, links suspeitos e conteúdo indevido;\n' +
        '• intervir em brigas, perseguição, provocação e assédio;\n' +
        '• preservar contexto e evidências de casos relevantes;\n' +
        '• encaminhar denúncias sensíveis à Administração;\n' +
        '• evitar debates públicos sobre decisões internas.\n\n' +
        '**Procedimento**\n' +
        '`1.` identificar regra → `2.` conferir contexto → `3.` agir proporcionalmente → `4.` registrar → `5.` escalar se necessário.\n\n' +
        '**Nunca:** punir por opinião pessoal, abusar do cargo ou apagar evidências importantes.'
      ),

    new EmbedBuilder()
      .setColor(0x42a5f5)
      .setTitle('🎫 SUPORTE')
      .setDescription(
        `**Cargo:** ${support}\n**Missão:** ser o primeiro ponto de contato para dúvidas, tickets e solicitações.\n\n` +
        '**Responsabilidades**\n' +
        '• responder com educação, clareza e objetividade;\n' +
        '• entender o pedido antes de encaminhar;\n' +
        '• coletar serviço/problema, referências, prazo, prints e contexto;\n' +
        '• classificar suporte, denúncia, parceria, candidatura e serviço;\n' +
        '• manter o usuário informado quando depender de outra função;\n' +
        '• técnico → Desenvolvedor; conflito/denúncia → Moderação/Administração;\n' +
        '• concluir apenas quando o usuário souber o resultado ou próximo passo.\n\n' +
        '**Solicitação de serviço**\n' +
        'Confirmar escopo, referência, prazo e orçamento informado. **Não prometer preço, entrega ou resultado sem autorização de quem executará o trabalho.**'
      ),

    new EmbedBuilder()
      .setColor(0x2b2f3a)
      .setTitle('📋 PRIORIDADES E FLUXO')
      .setDescription(
        '🔴 **P0 — Crítico:** invasão, vazamento, bot comprometido, perda de dados ou risco imediato → Dev + Admin + Direção.\n' +
        '🟠 **P1 — Alto:** falha importante, denúncia grave, cliente bloqueado ou impacto em muitos membros → responsável + Admin.\n' +
        '🟡 **P2 — Normal:** ticket, dúvida, conflito simples ou ajuste operacional → Suporte/Moderação.\n' +
        '🟢 **P3 — Melhoria:** sugestão, estética, organização e otimização → fila de tarefas.\n\n' +
        '**Ao assumir uma tarefa**\n' +
        '`1.` confirmar → `2.` registrar contexto → `3.` informar que assumiu → `4.` executar/encaminhar → `5.` informar resultado → `6.` fechar.\n\n' +
        '**Handoff correto:** resumo + evidências + o que já foi tentado + decisão necessária.\n\n' +
        '**Privacidade:** detalhes de tickets, denúncias, clientes e decisões internas ficam somente nos canais necessários.'
      ),

    new EmbedBuilder()
      .setColor(0x232833)
      .setTitle('🗓️ ROTINA DA EQUIPE')
      .setDescription(
        '**Durante o dia:** verificar tickets, denúncias, falhas e pendências da própria função.\n' +
        '**Ao sair:** deixar contexto claro do que ficou pendente.\n' +
        '**Semanalmente:** revisar problemas repetidos, tickets atrasados, sugestões úteis e melhorias de processo.\n' +
        '**Sempre:** alinhamentos em `💬・staff`; ações que precisam de histórico em `📊・logs`.\n\n' +
        '🎬 **Editor de Elite** e 🎨 **Editor** são cargos criativos. Eles **não são staff administrativa automaticamente** e não recebem poderes administrativos por causa do cargo.'
      )
      .setFooter({ text: 'Pale Ascendancy • Clareza de função evita conflito e retrabalho' })
  ];
}

async function syncPanels(channel, embeds) {
  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);

  for (const embed of embeds) {
    const title = embed.data.title;
    const matches = recent?.filter((message) =>
      message.author.id === client.user.id &&
      message.embeds.some((existing) => existing.title === title)
    );

    const primary = matches?.first() || null;
    if (primary) {
      await primary.edit({ embeds: [embed] });
      const duplicates = matches.filter((message) => message.id !== primary.id);
      for (const duplicate of duplicates.values()) await duplicate.delete().catch(() => {});
    } else {
      await channel.send({ embeds: [embed] });
    }
  }
}

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(PALE_GUILD_ID).catch(() => null);
    if (!guild) {
      console.log('[PA-STAFF] Pale Ascendancy não encontrada.');
      return;
    }

    const channels = await guild.channels.fetch();
    const roles = await guild.roles.fetch();
    const staffCategory = channels.find((channel) =>
      channel?.type === ChannelType.GuildCategory && normalize(channel.name) === 'paequipe'
    ) || null;

    let tasks = channels.find((channel) =>
      channel?.type === ChannelType.GuildText && ['tarefas', 'stafftarefas'].includes(normalize(channel.name))
    ) || null;

    if (!tasks) {
      tasks = await guild.channels.create({
        name: '✅・tarefas',
        type: ChannelType.GuildText,
        parent: staffCategory?.id || null,
        topic: 'Manual interno da staff • funções, responsabilidades, prioridades e fluxo de trabalho.',
        reason: 'Criar manual operacional da staff da Pale Ascendancy'
      });
    } else {
      await tasks.edit({
        name: '✅・tarefas',
        parent: staffCategory?.id || tasks.parentId,
        topic: 'Manual interno da staff • funções, responsabilidades, prioridades e fluxo de trabalho.'
      }).catch(() => {});
    }

    await tasks.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false }).catch(() => {});

    const staffRoles = roles.filter((role) => STAFF_NAMES.has(normalize(role.name)));
    for (const role of staffRoles.values()) {
      await tasks.permissionOverwrites.edit(role.id, {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false,
        SendMessagesInThreads: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        AddReactions: false
      }).catch(() => {});
    }

    await tasks.permissionOverwrites.edit(client.user.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      EmbedLinks: true,
      ManageMessages: true
    }).catch(() => {});

    await syncPanels(tasks, buildEmbeds(guild, roles));

    const detectedStaff = [...staffRoles.values()].map((role) => role.name).join(', ') || 'nenhum cargo identificado';
    console.log(`[PA-STAFF] Cargos verificados: ${detectedStaff}`);
    console.log('[PA-STAFF] ✅・tarefas configurado com manual detalhado.');
  } catch (error) {
    console.error('[PA-STAFF] Falha ao configurar manual da staff:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
