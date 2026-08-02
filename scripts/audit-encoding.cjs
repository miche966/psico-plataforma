const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
const ignored = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.woff', '.woff2'])
const patterns = [/Ã./g, /Â./g, /�/g]
const findings = []
for (const file of tracked) {
  if (ignored.has(path.extname(file).toLowerCase())) continue
  let text
  try { text = fs.readFileSync(file, 'utf8') } catch { continue }
  const matches = patterns.flatMap(pattern => text.match(pattern) || [])
  if (matches.length) findings.push({ file, occurrences: matches.length })
}
console.log(JSON.stringify({ modo: 'solo_lectura', archivos_afectados: findings.length, hallazgos: findings }, null, 2))
