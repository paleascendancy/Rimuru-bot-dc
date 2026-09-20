import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAINTENANCE_STEPS = [
  'fix-mangamorph-owner-role.js',
  'setup-pale-services.js',
  'configure-pale-channels.js',
  'setup-pale-staff-tasks.js',
  'setup-pale-about.js'
];

function runStep(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      stdio: 'inherit',
      env: process.env
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(
        signal
          ? `Etapa ${file} encerrada por sinal ${signal}.`
          : `Etapa ${file} terminou com código ${code}.`
      ));
    });
  });
}

for (const file of MAINTENANCE_STEPS) {
  console.log(`[MAINTENANCE] → ${file}`);
  await runStep(file);
}

console.log('[MAINTENANCE] Configurações do Discord concluídas.');
