# Puntaje de los tests calculado en el servidor

Estado de la migración del cálculo de `puntaje_bruto` del navegador al servidor. El plan completo y las
decisiones están en la sesión del 2026-10-02; este documento deja lo que hay que saber para retomarlo.

## Por qué
Hasta ahora cada página de test corrige en el navegador y el servidor guarda `puntaje_bruto` tal cual
(`app/api/evaluacion/public-data/route.ts`, acción `finalize`). Un candidato con su enlace válido podía mandar un
puntaje inventado, y el mismo endpoint le entregaba la clave de corrección (`items.respuesta_correcta`).
Pendiente abierto en `docs/RIESGOS_ACEPTADOS.md`.

## Etapas
| Etapa | Qué | Estado |
|---|---|---|
| 0 | Datos y auditoría de solo lectura (`npm run audit:puntajes`) | hecha (2026-10-02) |
| 1 | Módulo puro `lib/server/puntuacion.ts` + `tests/puntuacion.test.ts` | hecha (2026-10-02) |
| 2 | Modo paralelo en `finalize` (`lib/server/puntajeSombra.ts`: el servidor recalcula y compara, sigue guardando lo del navegador) y reversión de la sesión si falla el guardado de respuestas | hecha (2026-10-02) |
| 3 | Protocolo nuevo: el navegador manda la elección cruda y el servidor corrige, test por test | pendiente |
| 4 | El GET deja de devolver `respuesta_correcta` e `inverso`; se borra el cálculo de las páginas | pendiente |

## Reglas que no se pueden romper
- La forma de `puntaje_bruto` no cambia (nombres y anidación de claves): informe, panel, estadísticas, PDF y
  `generar-informe` clasifican por nombre de clave.
- `respuestas.valor` conserva su semántica actual (invertido en los Likert, 0/1 en los tests con clave).
- Fuera de alcance: Role Play (Gemini sobre una transcripción del cliente), Frases incompletas (sin puntaje) y
  la entrevista en video.

## Hallazgos de la auditoría histórica (3087 sesiones finalizadas)
`npm run audit:puntajes` recalcula cada sesión desde `respuestas` + `items` y la compara con lo guardado.
Resultado al 2026-10-02: 3069 coinciden o no tienen respuestas; **18 difieren, todas explicadas por datos viejos**:
- 11 sesiones de Big Five (29/4 al 5/5/2026) guardaron las respuestas de toda la batería (435 filas, 17 tests) en
  la sesión de Big Five.
- 4 sesiones con filas repetidas del mismo ítem (inserción doble de versiones antiguas).
- 3 sesiones de SJT Comercial cuyas respuestas son de ítems de otro test.
- Los puntajes de DASS-21, Verbal, Numérico, Atención al detalle, Integridad, HEXACO y los SJT coinciden al 100 %.
- **Banco compartido**: las 131 sesiones de SJT Cobranzas (`e9b2…9999`) responden los 20 ítems que viven bajo
  Tolerancia a la frustración (`e5f6…5555`); el módulo lo refleja en `bancoDeItems`. La página `sjt-cobranzas` usa un
  tercer id (`c3d4…3333`) sin sesiones ni ítems. Falta confirmar con el negocio si es intencional.

## No se puede recalcular desde las respuestas
`metricas_fraude` (telemetría del navegador; se conserva, saneada), `nivel_maximo` de ICAR (viene de la URL: hay que
firmarlo en el token en la Etapa 3) y los tests sin puntaje (Frases, Role Play).

## Cómo revisar el modo paralelo (etapa 2)
- En cada `finalize` el servidor recalcula el puntaje y, **solo si algo no coincide**, deja una línea en los logs de
  Vercel: `[PUNTAJE SOMBRA] difiere test=<8 primeros del id> sesion=<8> claves=...` (el navegador mandó otro puntaje que
  el que salen de sus respuestas) o `[PUNTAJE SOMBRA] rechazaria ...` (ítem ajeno, repetido o valor fuera de rango).
  Que no haya líneas significa que coincide. No hay datos personales en el log.
- Comprobación completa sobre lo ya guardado: `npm run audit:puntajes` (recalcula las sesiones finalizadas). Las 18
  diferencias históricas explicadas arriba son esperables; cualquier diferencia nueva hay que investigarla.
- Criterio para pasar a la etapa 3: unos días de tráfico real sin líneas `[PUNTAJE SOMBRA]` y la auditoría sin
  diferencias nuevas.
- `finalize` ahora revierte la sesión a `iniciado` si falla el guardado de las respuestas (antes quedaba finalizada y el
  reintento del candidato recibía "ya completada", perdiendo las respuestas).

## Etapa 3 (plan aprobado 2026-10-06): protocolo crudo, grupo por grupo
- **Fase A (servidor, 2026-10-06)**: `finalize` acepta `formato: 'crudo'`: el navegador manda solo la elección (`opcion` = índice de la
  opción, o `null` si se agotó el tiempo; en Likert/DASS, `valor` crudo con una respuesta por ítem) y el servidor calcula el
  `puntaje_bruto` (`puntuarCrudo` en `lib/server/puntuacion.ts`), guarda las `respuestas` y devuelve un `resumen` para la pantalla de
  fin. Lo que el pedido traiga como `puntaje_bruto` se ignora salvo `metricas_fraude`, saneada (`lib/server/metricasFraude.ts`; solo
  Big Five, DASS-21 e ICAR). ICAR todavía no admite el formato crudo (su universo de ítems depende de parámetros de la URL sin firma).
- **Modo estricto**: la variable `PUNTAJE_ESTRICTO` (ids o slugs separados por comas, se lee en ejecución) hace que para esos tests el
  servidor rechace el protocolo anterior (400, "recargá la página") y que el GET deje de enviar `respuesta_correcta` e `inverso`.
- Las pantallas siguen usando el protocolo anterior hasta que se migre cada grupo (B: Verbal y Numérico; C: Atención al detalle,
  Tolerancia y SJT; D: Likert y Estrés; E: DASS-21 y Big Five; F: ICAR). El estricto se activa horas después de desplegar cada grupo.
- **Fase B (2026-10-06, 58cd90a)**: Verbal y Numérico mandan solo la opción elegida (`finalizarTestCrudo` en `lib/finalizarTest.ts`) y la
  pantalla de fin usa el `resumen` del servidor. Nota: la pantalla de fin de Numérico nunca mostró el nivel (la variable `nivel` no se usa).
- **Fase C (2026-10-06)**: Atención al detalle, Tolerancia a la frustración y los 6 SJT (atención, cobranzas, comercial, legal, problemas,
  ventas) pasan al formato crudo; las 8 páginas pierden `respuesta_correcta` y todo el cálculo local. **SJT Cobranzas estaba roto desde
  la consolidación de agosto (7a18d01)**: la página pedía los ítems con el id `c3d4…3333`, que no tiene ítems ni sesiones; la última
  sesión guardada es del 29/07 y ningún proceso lo usa hoy. Ahora usa el id del catálogo (`e9b2…9999`) y el GET lee los ítems con
  `bancoDeItems()` (los del banco de Tolerancia), igual que `finalize`. El id `c3d4…3333` sigue en la lista de ids aceptados de la ruta
  (inofensivo; sin datos).
