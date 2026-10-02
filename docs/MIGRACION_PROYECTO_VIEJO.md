# Migración del proyecto Supabase viejo al actual (2026-10-02)

Se rescató del proyecto viejo (`hgoumdjvusixbjkiexjd`) lo que el actual no tenía, **solo agregando filas** (nunca se
modificó ni se borró nada preexistente del actual). Herramientas: `scripts/migrar-viejo.ts` (migra; por defecto solo
informa), `scripts/revertir-migracion.ts` (deshace exactamente lo agregado) y el manifiesto
`docs/migracion-manifiesto-2026-10-02.json` (solo ids).

## Qué se agregó
| | Cantidad | Detalle |
|---|---|---|
| Sesiones finalizadas | **145** | Resultados de tests de la batería actual que faltaban (143 combinaciones candidato+proceso+test; en 2 hay dos tomas con puntajes distintos y se conservaron las dos). Conservan `id`, `iniciada_en` y `finalizada_en` originales (por eso no aparecen como "novedades") y `created_at` = `finalizada_en` |
| Respuestas | 40 | De 2 de esas sesiones (el resto se guardaba solo con `puntaje_bruto`) |
| Videos | 4 (≈85 MB) | Copiados del bucket viejo a R2 (privado) con la clave `entrevista/candidato actual/archivo.webm`; filas en `respuestas_video` |

Candidatos: **no se creó ninguno**. Los 322 del viejo ya existían en el actual (170 con el mismo id y 152 con el mismo
email y otro id); las sesiones se asociaron al candidato actual.

## Qué NO se importó, y por qué
| Qué | Cantidad | Motivo |
|---|---|---|
| Sesiones con un equivalente finalizado ya presente | 2184 | Ya estaban (otro id): importarlas habría duplicado resultados |
| Sesiones duplicadas dentro del viejo | 139 | El viejo guardaba dos copias idénticas; se importó una |
| Tests fuera de la batería actual | 689 | HEXACO (229), SJT Problemas (231) y una versión Likert antigua de Tolerancia (`d4e5f6a7-…-444444444444`, 229). Los informes muestran todos los resultados del candidato, así que importarlos los habría cambiado |
| Conflictos con una sesión sin terminar del actual | 10 | Quedaron afuera a pedido; decidir caso por caso |
| Candidatos traducidos por email con otro documento | 4 sesiones (5 candidatos) | Podrían ser personas distintas; a revisar a mano |
| Sesiones sin terminar | 59 | Sin valor |
| Videos con pregunta ausente en el actual | 4 | Su archivo no existe en el bucket viejo y la pregunta ya no está en la entrevista actual |
| Filas de video vacías | 19 | Sin archivo |

## Verificación
- "Foto" previa del actual (conteo y huella de cada tabla) comparada después: **todas las filas preexistentes idénticas**.
- `npm run audit:puntajes` sobre las 3232 sesiones finalizadas: las mismas 18 diferencias históricas explicadas en
  `docs/PUNTAJE_EN_SERVIDOR.md`; ninguna nueva.
- Se detectó y corrigió en el momento un error de la primera corrida: se habían insertado las dos copias de cada sesión
  duplicada del viejo (284 filas); se borraron las 139 sobrantes (todas del manifiesto) y la regla quedó corregida.

## Hallazgo del actual (sin tocar)
**120 respuestas de video del proyecto actual** (61 y 59) apuntan a dos preguntas (`c8b6562b…` y `b286ff6a…`, órdenes 1 y 2
de la entrevista `0a9591f0…`) que **ya no existen** en `preguntas_video`; solo están en el proyecto viejo. En el panel esos
videos salen sin el texto de la pregunta. No se restauraron porque, al pertenecer a la entrevista vigente, pasarían a
formar parte de las preguntas que reciben los postulantes. Decisión pendiente.

## Cómo revertir
```
node --experimental-strip-types scripts/revertir-migracion.ts docs/migracion-manifiesto-2026-10-02.json            # en seco
node --experimental-strip-types scripts/revertir-migracion.ts docs/migracion-manifiesto-2026-10-02.json --ejecutar # borra
```
Borra solo los ids del manifiesto y los 4 videos de R2 (el respaldo de las tablas tocadas se tomó antes de migrar).

## Decisiones posteriores
- **2026-10-02: no se exportan los 689 resultados de tests retirados** (HEXACO, SJT Problemas y la versión Likert de
  Tolerancia). Decisión del responsable de la plataforma: no hay necesidad prevista de reutilizarlos y conservarlos
  implicaría otra copia de datos personales fuera del sistema. Desaparecen al borrar el proyecto viejo; no afectan
  nada de lo que se ve hoy.
- Siguen sin resolver los 10 conflictos y los 5 candidatos con documento distinto; resolverlos requiere crear una clave de
  lectura nueva en el proyecto viejo (las anteriores están inutilizadas). Si no se resuelven antes de borrarlo, se pierden
  esos casos.

## Cierre del proyecto viejo
Con todo verificado: eliminar la clave `secret` creada para la migración, pausar el proyecto y, pasado un mes sin
problemas, borrarlo. Los videos del bucket viejo ya están en R2 (229 desde antes, 4 ahora).
