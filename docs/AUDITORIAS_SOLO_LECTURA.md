# Auditorías de solo lectura

## Integridad de datos

Ejecutar `npm run audit:integrity` para consultar candidatos, procesos, relaciones, sesiones, videos e informes. El script no contiene `insert`, `update`, `upsert` ni `delete`; solo lee datos mediante REST y muestra conteos y hallazgos. No corrige automáticamente ningún registro.

Antes de ejecutar, verificar que `.env.local` apunte al proyecto Supabase correcto. No compartir la salida completa si contiene identificadores productivos.

## Codificación

Ejecutar `npm run audit:encoding` para detectar patrones compatibles con texto mal codificado. El resultado es diagnóstico: no reemplaza textos automáticamente. Cada corrección debe revisarse en la pantalla web y en el PDF.

## Regla de corrección

Los hallazgos deben exportarse y revisarse antes de cualquier migración. Toda corrección de datos requiere respaldo, simulación, conteo antes/después y commit o script reversible.
