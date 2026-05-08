# Bitácora de Resolución de Auditoría - PsicoPlataforma (Mayo 2026)

Este documento detalla la intervención técnica realizada para estabilizar el motor de generación de informes psicométricos, resolviendo inconsistencias matemáticas y lógicas detectadas durante el despliegue de producción.

## 1. Problema A: Puntajes Fuera de Escala (Valores > 5.0)

### Características del Problema
Se detectaron valores anómalos en el informe (ejemplo: `12.5/5`) en las secciones de Competencias y Bienestar Laboral. Las barras de progreso se desbordaban visualmente, comprometiendo la validez técnica del documento.

### Causa Raíz (Análisis Técnico)
El archivo `app/informe/page.tsx` contenía lógica duplicada. Mientras que el encabezado del informe usaba una función de normalización, las secciones inferiores (mapeadas dinámicamente) tenían fórmulas manuales embebidas en los bucles `.map()`. Estas fórmulas intentaban normalizar datos crudos (escalas de 0-25 o 0-100) de forma inconsistente, permitiendo que valores sin procesar llegaran a la interfaz de usuario.

### Resolución
- **Centralización (DRY):** Se eliminaron todas las fórmulas manuales de los componentes de renderizado.
- **Data Guardian:** Se implementó y forzó el uso de la función `parseVal(valor, factor)` como único punto de entrada de datos. Esta función actúa como un filtro de seguridad que aplica `Math.min(5, ...)` y normaliza automáticamente cualquier escala (25 o 100) a la escala estándar de 5.0.
- **Unificación de Estado:** Se alinearon los nombres de las variables (`vNorm`, `normVal`) para evitar confusiones en los cálculos de la UI.

---

## 2. Problema B: Inconsistencia en Lógica de Inversión (Aciertos vs. Errores)

### Características del Problema
En el apartado de "Precisión en Datos Numéricos", candidatos de alto rendimiento obtenían puntajes extremadamente bajos (`0.8/5`), mientras que en "Datos de Texto" el comportamiento era inconsistente.

### Causa Raíz
El sistema aplicaba una **Inversión Global** a cualquier factor que contuviera la palabra "errores" en su nombre. 
- La prueba de **Texto** reporta errores cometidos (0 es excelente).
- La prueba de **Números** reporta errores encontrados/aciertos (Un valor alto es excelente).
Al invertir ambos, se estaba "saboteando" el buen desempeño en la prueba de números, restando el acierto del máximo de 5 puntos.

### Resolución
Se implementó una **Inversión Lógica Selectiva**:
```javascript
if (key === 'errores_texto') {
  val = 5 - val; // Invertir fallos cometidos
}
// errores_numeros se mantiene directo porque mide hallazgos exitosos.
```

---

## 3. Problema C: Alucinaciones Numéricas de la IA

### Características del Problema
La IA (Gemini) generaba narrativas que mencionaban los puntajes incorrectos (ej: "El candidato tiene 12.5 puntos"), incluso cuando la barra visual ya había sido corregida.

### Causa Raíz
La IA recibía el objeto de datos crudo (`sesiones`) sin procesar. Si la base de datos contenía un valor de 12.5, la IA lo interpretaba como la verdad absoluta y lo redactaba en el informe.

### Resolución
Se creó la función `sanitizarPuntajes`, que limpia y normaliza todos los valores numéricos del objeto de datos **antes** de enviarlos al prompt de la IA. Esto asegura que Gemini solo trabaje con datos dentro del rango 0-5.

---

## 4. Mejoras Estéticas (Pulido de Producción)

- **Decimales Inteligentes:** Se reemplazó `.toFixed(1)` por `Number(v.toFixed(1))`. Esto elimina el `.0` en números redondos (ej: de `5.0` a `5`), manteniendo la precisión en valores intermedios (ej: `4.2`).
- **Nomenclatura:** Se refinaron los diccionarios de etiquetas (`ETQ`) para asegurar que los factores en el informe sean claros y profesionales.

---

**Estado Final:** El motor de informes se encuentra en la versión **V5.0_FINAL**, estabilizado, documentado y sincronizado con el repositorio principal.
