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
| 2 | Modo paralelo en `finalize` (el servidor recalcula y compara, sigue guardando lo del navegador) | pendiente |
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
