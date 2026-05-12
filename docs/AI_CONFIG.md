# Configuración del Motor de IA

## Modelo Oficial
El modelo seleccionado y validado para la generación de informes psicométricos es:
**`gemini-2.5-flash-lite`**

## Reglas de Cambio de Modelo
1. **Invariabilidad**: El modelo NO debe cambiarse bajo ninguna circunstancia de forma autónoma por la IA.
2. **Autorización**: Cualquier cambio de modelo (ya sea por actualización, mejora o fallo) DEBE ser consultado y aprobado explícitamente por el USUARIO antes de su implementación.
3. **Persistencia**: Esta configuración debe mantenerse en todos los despliegues de la API (`app/api/generar-informe/route.ts`).

## Historial de Decisiones
- **2026-05-12**: Se establece `gemini-2.5-flash-lite` como modelo definitivo tras pruebas de estabilidad y compatibilidad con la API Key actual.
