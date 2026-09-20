import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

let source = fs.readFileSync(indexPath, 'utf8');

if (!source.includes("apoio: { label: 'Apoiar o projeto'")) {
  source = source.replace(
    "  candidatura: { label: 'Candidatura para equipe', emoji: '📨' },",
    "  candidatura: { label: 'Candidatura para equipe', emoji: '📨' },\n  apoio: { label: 'Apoiar o projeto', emoji: '💙' },"
  );

  fs.writeFileSync(indexPath, source);
  console.log('Apoio financeiro adicionado às opções de ticket.');
} else {
  console.log('Apoio financeiro já está integrado às opções de ticket.');
}
