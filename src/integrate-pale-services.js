import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const palePath = path.join(__dirname, 'pale.js');

let source = fs.readFileSync(palePath, 'utf8');
let changed = false;

if (!source.includes("servico: ['Solicitar serviço', '💼']")) {
  source = source.replace(
    "    suporte: ['Suporte geral', '🛟'],",
    "    servico: ['Solicitar serviço', '💼'],\n    suporte: ['Suporte geral', '🛟'],"
  );
  changed = true;
}

if (!source.includes("customId === 'pa_service_open'")) {
  source = source.replace(
    "  if (interaction.isButton() && interaction.customId === 'pa_ticket_open') {",
    "  if (interaction.isButton() && interaction.customId === 'pa_service_open') {\n    await createPaleTicket(interaction, 'servico');\n    return true;\n  }\n\n  if (interaction.isButton() && interaction.customId === 'pa_ticket_open') {"
  );
  changed = true;
}

if (!source.includes("{ label: 'Solicitar serviço', value: 'servico', emoji: '💼' }")) {
  source = source.replace(
    "      .addOptions(\n        { label: 'Suporte geral', value: 'suporte', emoji: '🛟' },",
    "      .addOptions(\n        { label: 'Solicitar serviço', value: 'servico', emoji: '💼' },\n        { label: 'Suporte geral', value: 'suporte', emoji: '🛟' },"
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(palePath, source);
  console.log('Pale services integration: pale.js preparado.');
} else {
  console.log('Pale services integration: já aplicada.');
}
