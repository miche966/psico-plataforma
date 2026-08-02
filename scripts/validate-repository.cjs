const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = process.cwd();
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const failures = [];
const forbiddenTracked = /(^|\/)(\.env(?:\..*)?|\.vercel)(\/|$)|\.bak$/i;
for (const file of tracked) if (forbiddenTracked.test(file)) failures.push('Archivo sensible o temporal rastreado: ' + file);
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
for (const required of ['.env*', '.vercel', '*.bak']) if (!gitignore.split(/\r?\n/).some(line => line.trim() === required)) failures.push('Falta en .gitignore: ' + required);
const auditFiles = tracked.filter(file => !file.startsWith('scratch/'));
const literalSecretPatterns = [
  { name: 'service role literal', regex: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"]eyJ[a-zA-Z0-9_-]{20,}/i },
  { name: 'JWT literal', regex: /['"]eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}['"]/ },
  { name: 'contraseña SMTP literal', regex: /(?:EMAIL_PASS|SMTP_PASS|EMAIL_PASSWORD)\s*[:=]\s*['"][^'"]{8,}['"]/i }
];
const ignoredExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.woff', '.woff2']);
for (const file of auditFiles) {
  if (ignoredExtensions.has(path.extname(file).toLowerCase())) continue;
  let text; try { text = fs.readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
  for (const pattern of literalSecretPatterns) if (pattern.regex.test(text)) failures.push('Posible ' + pattern.name + ' en ' + file);
}
if (failures.length) { console.error('Validación de repositorio FALLIDA:'); for (const failure of failures) console.error('- ' + failure); process.exit(1); }
if (tracked.some(file => file.startsWith('scratch/'))) console.warn('Aviso: existen archivos históricos en scratch/; no se escanean ni deben crecer.');
console.log('Validación de repositorio OK (' + tracked.length + ' archivos rastreados, sin secretos literales detectados en código operativo)');
