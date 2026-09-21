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

export async function keepOldestAndDeleteRest(messages, label = 'painel') {
  const ordered = [...messages].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const primary = ordered[0] || null;
  let removed = 0;

  for (const duplicate of ordered.slice(1)) {
    await duplicate.delete().then(() => {
      removed += 1;
    }).catch((error) => {
      console.error(`[PANEL-GUARD] Falha ao excluir duplicata de ${label} (${duplicate.id}):`, error.message);
    });
  }

  return { primary, removed };
}
