# Baremo de las pruebas cognitivas

Qué es, cómo se usa en el informe y cómo se actualiza. Creado el 2026-10-07.

## Para qué sirve
El informe (pantalla y PDF) muestra en **II.B — Atención y Tareas** dos tarjetas:

- **Rendimiento en las pruebas** (de 0 a 5): los aciertos sumados de las pruebas cognitivas, en escala de 5.
- **Rango percentil** y una **valoración** (Bajo, Medio, Medio alto, Alto): la posición de la persona respecto de las
  personas ya evaluadas en la plataforma, **en cada prueba**.

Un porcentaje de aciertos por sí solo no se puede interpretar: depende de qué tan difícil sea la prueba. A 2026-10-07 la
mitad de las personas acierta 85 % o más en Verbal y solo 60 % en ICAR, así que un mismo 77 % es bajo en Verbal y alto en
ICAR. Por eso se convierte cada prueba a su propio percentil y recién después se promedian.

## Qué pruebas cuentan
Solo las cognitivas (`lib/testsCognitivos.ts`): **Razonamiento verbal, Razonamiento numérico, Razonamiento abstracto
(ICAR) y Atención al detalle**. Las pruebas situacionales (SJT y Tolerancia a la frustración) también guardan
`correctas` y `total`, pero miden criterio ante situaciones de trabajo y tienen efecto techo documentado: **no entran**.
Antes del cambio sí entraban y subían el resumen (en un caso real, de 3,3/5 a 3,8/5).

De cada prueba se toma la sesión finalizada más reciente.

## Cómo se calcula
1. Porcentaje de aciertos de la prueba (entero, 0 a 100).
2. Rango percentil en el baremo de esa prueba, con el criterio del punto medio:
   (personas por debajo + la mitad de las que empatan) ÷ total de personas, acotado entre 1 y 99.
3. El rango percentil de la tarjeta es el **promedio** de los percentiles de las pruebas que tienen baremo.
4. Valoración por cuartiles del grupo: menos de 25 **Bajo**, 25 a 49 **Medio**, 50 a 74 **Medio alto**, 75 o más **Alto**
   (mismos colores que las barras del informe: rojo, ámbar, azul y verde).

Si una prueba no tiene baremo, o tiene menos de **30 personas**, esa prueba no cuenta para el percentil. Si ninguna lo
tiene, la tarjeta muestra "Sin referencia" y no se inventa un número.

## Cómo se actualiza el baremo
```bash
npm run baremo:cognitivo
```
Lee las sesiones finalizadas (solo lectura), cuenta **una por persona y prueba** y reescribe
`lib/baremoCognitivoDatos.ts` (solo guarda cuántas personas hay con cada porcentaje de aciertos, sin datos personales).
Después hay que revisar el cambio y commitearlo. A 2026-10-07: Verbal 282 personas, Numérico 213, ICAR 291 y Atención al
detalle 292.

Conviene regenerarlo cada tanto (por ejemplo cada seis meses, o si cambia el tipo de postulantes o el banco de preguntas de
una prueba). Los informes ya guardados no guardan el percentil: se calcula al abrir el informe con el baremo vigente.

## Límites que hay que tener presentes
- Es una **referencia interna**: el grupo son las personas que pasaron por los procesos de la plataforma (en buena parte
  pasantías), no una muestra nacional ni una norma publicada. Un percentil "Alto" significa "alto respecto de este grupo".
- El promedio de los percentiles de varias pruebas puede esconder diferencias grandes entre ellas (una persona puede estar
  baja en Verbal y alta en ICAR). El detalle por prueba está en las barras de más abajo.
- El baremo se vuelve a calcular de vez en cuando, así que el percentil de una misma persona puede moverse un poco entre un
  informe y otro: se calcula al abrir el informe, con el baremo vigente.
- Hay **65 sesiones finalizadas importadas por CSV** (30/7/2026) que guardan solo `porcentaje: 80` de relleno, sin aciertos
  ni total. No son puntajes reales y **no cuentan** ni en el baremo ni en el informe. Si una persona solo tiene de esas, la
  sección II.B no se muestra.
- Es una orientación para la lectura del informe, no un diagnóstico.

## Dónde se usa
- Informe (pantalla y PDF), sección II.B.
- "Resumen ejecutivo" de Base de candidatos: el rango percentil cognitivo y el gráfico de aciertos por prueba frente a la mediana del grupo.
- Exportación a Excel del panel: columnas "Aciertos en pruebas cognitivas %" y "Rango Percentil Cognitivo".

## Código
- `lib/baremoCognitivo.ts`: percentil, valoración y resumen (funciones puras).
- `lib/baremoCognitivoDatos.ts`: datos generados.
- `lib/testsCognitivos.ts`: qué pruebas son cognitivas.
- `scripts/generar-baremo-cognitivo.ts`: genera los datos.
- `tests/baremo-cognitivo.test.ts`: pruebas del módulo.
