export const normalizePanelText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export function messageHasCustomId(message, customId) {
  return message.components.some((row) =>
    row.components.some((component) => component.customId === customId)
  );
}

export function messageEmbedText(message) {
  return normalizePanelText(
    message.embeds.map((embed) => [
      embed.title,
      embed.description,
      embed.author?.name,
      embed.footer?.text
    ].filter(Boolean).join(' ')).join(' ')
  );
}

export function oldestMessage(messages) {
  return [...messages].sort((a, b) => a.createdTimestamp - b.createdTimestamp)[0] || null;
}

export function newestMessage(messages) {
  return [...messages].sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0] || null;
}

export async function keepNewestAndDeleteRest(messages, label = 'painel') {
  const ordered = [...messages].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const primary = ordered[0] || null;
  let removed = 0;

  for (const oldMessage of ordered.slice(1)) {
    await oldMessage.delete().then(() => {
      removed += 1;
    }).catch((error) => {
      if (error?.code === 10008 || error?.rawError?.code === 10008) return;
      console.error(`[PANEL-GUARD] Falha ao excluir mensagem antiga de ${label} (${oldMessage.id}):`, error.message);
    });
  }

  return { primary, removed };
}
