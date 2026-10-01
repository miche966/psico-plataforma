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
// Se escanean TODOS los archivos rastreados: antes scratch/ estaba excluido y por eso una service_role
// y una anon key del proyecto Supabase viejo estuvieron meses en el repo publico sin que nada avisara.
const auditFiles = tracked;
const literalSecretPatterns = [
  { name: 'service role literal', regex: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"]eyJ[a-zA-Z0-9_-]{20,}/i },
  { name: 'JWT literal', regex: /['"]eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}['"]/ },
  { name: 'clave de API de Google literal', regex: /AIzaSy[A-Za-z0-9_-]{30,}/ },
  { name: 'clave secreta de Supabase literal', regex: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'contraseña SMTP literal', regex: /(?:EMAIL_PASS|SMTP_PASS|EMAIL_PASSWORD)\s*[:=]\s*['"][^'"]{8,}['"]/i }
];
const ignoredExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.woff', '.woff2']);
for (const file of auditFiles) {
  if (ignoredExtensions.has(path.extname(file).toLowerCase())) continue;
  let text; try { text = fs.readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
  for (const pattern of literalSecretPatterns) if (pattern.regex.test(text)) failures.push('Posible ' + pattern.name + ' en ' + file);
}
if (failures.length) { console.error('Validación de repositorio FALLIDA:'); for (const failure of failures) console.error('- ' + failure); process.exit(1); }
console.log('Validación de repositorio OK (' + tracked.length + ' archivos rastreados, sin secretos literales detectados en código operativo)');
