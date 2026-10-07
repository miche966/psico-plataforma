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
| 3 | Protocolo nuevo: el navegador manda la elección cruda y el servidor corrige, test por test | **hecha** (Fases A a F, 2026-10-06) |
| 4 | El GET deja de devolver `respuesta_correcta` e `inverso`; se borra el cálculo de las páginas | **activa en los 19 tests** (18 desde 2026-10-06 e ICAR desde 2026-10-07); falta la limpieza final (Fase G) |

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
- **Fase D (2026-10-06)**: Creatividad, HEXACO, Comercial, Iniciativa-dinamismo, Integridad y Estrés laboral mandan el **valor crudo** (1 a 5,
  sin invertir) y el servidor invierte los ítems inversos (según `items.inverso`, que en modo estricto ya no viaja al navegador), calcula
  las medias por factor, `promedio_general` y `nivel_estres`. Se conserva el comportamiento con factores vacíos (Iniciativa guarda 0, el resto
  null). `respuestas.valor` sigue guardando el valor ya invertido, como en todo el histórico. Esas pantallas no muestran resultados al candidato.
- **Fase E (2026-10-06)**: DASS-21 y Big Five (`app/dass21`, `app/test`) mandan el valor crudo (0 a 3 / 1 a 5) y la telemetría del hook
  `useProctoring`; el servidor calcula (DASS: suma por subescala x 2; Big Five: inversión y medias, 0 si un factor no tiene ítems) y guarda
  `metricas_fraude` **saneada** (`lib/server/metricasFraude.ts`: solo los números y tipos de evento conocidos, hasta 200 eventos). La
  telemetría sigue siendo un dato informado por el navegador (el servidor no puede recalcularla); la pantalla de fin no la recibe.
- **Fase F (2026-10-06)**: ICAR en formato crudo. El nivel máximo y la rotación (`?max=` y `?norot=`), que antes viajaban en la URL sin
  firma, ahora van **firmados dentro del token** (`icar: { max, norot }` en `lib/server/evaluacionToken.ts`; `/api/evaluacion-link` los toma
  de la ruta `/icar?max=2&norot=1` que ya arma el panel, sin cambios en pantalla). El servidor arma el examen con esa configuración
  (`lib/server/icarConfig.ts`), usa el mismo filtro en el GET y en `finalize`, calcula `correctas/total/porcentaje/por_subtipo`, agrega
  `nivel_maximo` y guarda la telemetría saneada. Un token que no la fija (batería de `/evaluacion`, enlaces anteriores) cae a esto:
  en transición vale la URL, como siempre (los enlaces ya emitidos duran 30 días); con `icar` en `PUNTAJE_ESTRICTO` la URL se ignora y
  vale el examen completo (nivel 3 con rotación). Cambiar a mano la configuración del token invalida la firma. **Antes de activar el
  estricto de ICAR**: un enlace con `?max=1` emitido antes de esta fase pasaría a nivel 3; conviene activarlo cuando no queden enlaces
  ICAR anteriores en uso (30 días de vigencia como máximo) o aceptar ese cambio.

## Estado actual (2026-10-07)

**Modo estricto en producción en los 19 tests puntuables** (`PUNTAJE_ESTRICTO` en Vercel Production): 18 desde el 2026-10-06 e ICAR desde el
2026-10-07. La variable se recargó ese día con estos 19 nombres: verbal, numerico, atencion-detalle, tolerancia-frustracion, sjt-atencion, sjt-cobranzas,
sjt-comercial, sjt-legal, sjt-problemas, sjt-ventas, creatividad, hexaco, comercial, iniciativa-dinamismo, integridad, estres-laboral, bigfive, dass21 e icar
(se comprobó con `testsEstrictos()` que resuelven a los 19 ids puntuables, sin faltantes ni sobrantes: un nombre mal escrito se ignora en silencio).

Controles del 2026-10-07:
- `npm run audit:puntajes`: 3243 sesiones finalizadas, **18 difieren, las mismas 18 históricas** de la auditoría original (datos viejos explicados arriba).
  Ninguna sesión posterior al 2026-10-02 difiere.
- Los registros de Vercel solo se conservan unas horas, así que no sirven para revisar días atrás: el control sólido es la auditoría de la base.
- **Primera prueba completa en modo estricto (2026-10-07):** un candidato descartable completó Verbal desde el navegador con un enlace firmado de
  producción. Quedó guardado 17/20 (85 %) con las 20 respuestas, igual al recálculo; el GET ya no envía `respuesta_correcta` ni `inverso` y el formato
  viejo recibe 400. Ningún candidato **real** cerró todavía una prueba en estricto (la actividad es esporádica: las últimas sesiones reales finalizadas son
  del 29/9); la auditoría de la base seguirá siendo el control a revisar cuando haya tráfico real.
- **Error encontrado en esa prueba y corregido (PR #14):** `finalize` solo cerraba sesiones en estado `iniciado`. Una sesión `pendiente` (la deja
  la asignación desde el panel o /unirse y la página del test no avisa el inicio) respondía 409 y no guardaba nada. Ahora acepta `iniciado` y `pendiente`;
  las ya finalizadas siguen excluidas. Verificado en producción con una sesión pendiente (12/20 guardado por el servidor, ignorando un puntaje inflado del
  pedido, y un segundo envío no duplica respuestas).

### ICAR en el modo estricto (activado el 2026-10-07)
Condición original: que no queden enlaces ICAR anteriores a la Fase F en uso. Esos enlaces pueden llevar `?max=` y `?norot=` **sin firma** y, con el estricto, la
URL se ignora: un enlace de nivel básico pasaría a nivel 3. Vigencia máxima de los enlaces: 30 días, o sea los emitidos hasta el 2026-10-06 vencen el
**2026-11-05**. Antes de activarlo: revisar que no haya sesiones ICAR sin finalizar de candidatos a quienes se les dio un nivel distinto del completo
(al 2026-10-07 había 4 sesiones ICAR sin finalizar, todas de mayo y agosto, con enlaces ya vencidos).

**Se activó el 2026-10-07, antes del 2026-11-05**, con este criterio: las 296 pruebas ICAR finalizadas con nivel registrado usaron todas el nivel 3, y
se confirmó con quien arma los enlaces que siempre se usa el nivel completo y con rotación; los enlaces viejos con `?max=` o `?norot=` se ignoran y dan ese mismo examen.
El único efecto posible sería para un enlace viejo emitido con un nivel menor o sin rotación: pasaría a nivel 3 con rotación.

Comandos usados (la lista de nombres es la de "Estado actual"):

```bash
npx vercel@62.7.0 env rm PUNTAJE_ESTRICTO production --yes
printf '%s' "<los 18 nombres separados por comas>,icar" | npx vercel@62.7.0 env add PUNTAJE_ESTRICTO production --sensitive
npx vercel@62.7.0 redeploy psico-plataforma.vercel.app
```

Verificación hecha en producción con un candidato descartable (borrado al terminar): el GET de los 19 tests no envía `respuesta_correcta` ni `inverso`;
un pedido de ICAR con `nivel_max=1&sin_rotacion=1` en la URL devuelve el examen completo (niveles 1 a 3, con rotación); el formato viejo recibe 400
("recargá la página"); una prueba en formato crudo guardó 7 de 20 correctas, igual al recálculo, ignorando el puntaje inflado del pedido, con
`nivel_maximo` 3. Marcha atrás: volver a cargar la variable sin `icar` y redesplegar.

### Fase G (cierre): ya se puede empezar a partir del 2026-10-14
Con los 19 tests en estricto (ICAR desde el 2026-10-07): quitar la rama del protocolo viejo de `finalize` y `compararPuntajeEnSombra` (`lib/server/puntajeSombra.ts`), borrar el
cálculo y los campos `respuesta_correcta`/`inverso` que queden en las páginas, actualizar este documento y cerrar la fila de
`docs/RIESGOS_ACEPTADOS.md`. Hacerlo recién cuando haya al menos una semana de tráfico real en estricto sin diferencias en `npm run audit:puntajes`.
