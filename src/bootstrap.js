import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PREPARE_STEPS = [
  'dedupe-managed-panels.js',
  'setup-pale-staff-tasks.js',
  'repair-pale-community-panels.js',
  'integrate-reaction-roles.js',
  'integrate-suggestions.js',
  'integrate-financial-support.js',
  'integrate-pale-services.js',
  'integrate-pale.js',
  'integrate-member-role-safety.js',
  'integrate-mangamorph-admin.js',
  'unpack-mangamorph-pro-tools.js',
  'integrate-mangamorph-pro-tools.js',
  'integrate-mangamorph-webhooks.js',
  'integrate-welcome-manager.js',
  'fix-welcome-mention.js',
  'integrate-live-preview.js',
  'integrate-embed-studio.js',
  'fix-embed-studio-emoji.js'
];

function runStep(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      stdio: 'inherit',
      env: process.env
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(
        signal
          ? `Etapa ${file} encerrada por sinal ${signal}.`
          : `Etapa ${file} terminou com código ${code}.`
      ));
    });
  });
}

async function bootstrap() {
  console.log('[BOOT] Preparando integrações locais do Rimuru...');

  for (const file of PREPARE_STEPS) {
    console.log(`[BOOT] → ${file}`);
    await runStep(file);
  }

  console.log('[BOOT] Integrações prontas. Iniciando cliente principal...');
  await import('./index.js');
}

bootstrap().catch((error) => {
  console.error('[BOOT] Falha durante a inicialização:', error);
  process.exit(1);
});
