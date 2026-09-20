import fs from 'node:fs';

const file = new URL('./index.js', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

const unsafe = `async function findMemberRole(guild) {\n  if (MEMBER_ROLE_ID) {\n    const byId = await guild.roles.fetch(MEMBER_ROLE_ID).catch(() => null);\n    if (byId) return byId;\n  }\n\n  const roles = await guild.roles.fetch();\n  return roles.find((role) => normalize(role.name) === 'membro') || null;\n}`;

const safe = `async function findMemberRole(guild) {\n  if (MEMBER_ROLE_ID) {\n    const byId = await guild.roles.fetch(MEMBER_ROLE_ID).catch(() => null);\n    if (byId && normalize(byId.name) === 'membro') return byId;\n    if (byId) {\n      console.warn(\`[ROLE-SAFETY] MEMBER_ROLE_ID aponta para \\"\${byId.name}\\" em \${guild.name}; ignorando para evitar cargo incorreto.\`);\n    }\n  }\n\n  const roles = await guild.roles.fetch();\n  return roles.find((role) => normalize(role.name) === 'membro' && !role.managed) || null;\n}`;

if (source.includes(safe)) {
  console.log('[ROLE-SAFETY] Proteção de cargo Membro já aplicada.');
  process.exit(0);
}

if (!source.includes(unsafe)) {
  console.error('[ROLE-SAFETY] Trecho esperado de findMemberRole não encontrado; nenhuma alteração feita.');
  process.exit(1);
}

source = source.replace(unsafe, safe);
fs.writeFileSync(file, source, 'utf8');
console.log('[ROLE-SAFETY] Proteção de cargo Membro aplicada ao index.js.');
