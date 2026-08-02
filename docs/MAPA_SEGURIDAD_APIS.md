# Mapa de seguridad de APIs

Este mapa evita aplicar autenticación administrativa a rutas que forman parte del acceso público del evaluado.

## Rutas públicas con validación de evaluación

| Ruta | Uso | Protección esperada |
|---|---|---|
| `/api/r2-presigned` | URL de carga de video R2 | Token, candidato, proceso, entrevista y prefijo de ruta |
| `/api/supabase-presigned` | Fallback de carga Supabase | Token, candidato, proceso, entrevista y prefijo de ruta |
| `/api/roleplay` chat | Conversación IA | Sin escritura productiva; límites y validación de entrada |
| `/api/roleplay` evaluar | Guardado del resultado | Token válido y cliente server-side |
| `/api/evaluacion-access` | Acceso del candidato | Token o datos de acceso definidos por el flujo |

## Rutas administrativas

Estas rutas deben exigir sesión administrativa server-side antes de leer o escribir datos del panel:

- `/api/recordatorio`;
- `/api/evaluacion-link`;
- `/api/progreso-evaluacion`;
- generación automática de informes iniciada desde el panel;
- análisis de videos solicitado desde el panel.

## Reglas

1. La clave service role solo puede utilizarse en servidor.
2. Las rutas públicas no deben aceptar un candidato o proceso arbitrario sin token.
3. El error no debe devolver secretos, SQL ni rutas internas.
4. Toda escritura debe ser idempotente o estar protegida contra duplicados.
5. Toda modificación de esta clasificación debe incluir una prueba de acceso autorizado y otra de rechazo.
