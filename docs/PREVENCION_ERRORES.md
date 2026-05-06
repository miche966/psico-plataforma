# 🛡️ Guía de Prevención de Errores Críticos: Psico-Plataforma

Este documento registra las lecciones aprendidas tras la crisis de sincronización y despliegue del 04/05/2026. Su objetivo es evitar la regresión de errores en la gestión de candidatos y el motor de informes.

## 1. Gestión de Candidatos y Visibilidad
### El Problema "Candidato Fantasma"
Históricamente, el sistema solo mostraba candidatos que existían en la tabla `candidatos`. Esto causaba que participantes de cargas masivas o links directos fueran invisibles.

### La Regla de Oro
**"La Actividad manda sobre la Ficha"**. 
Cualquier dashboard de gestión debe priorizar la tabla de `sesiones` y `respuestas_video`. Si hay actividad, el candidato DEBE mostrarse. Si no tiene ficha, se debe generar un objeto "Candidato Virtual" en el frontend combinando su email y nombre obtenido de la sesión.

---

## 2. Motor de Progreso (Baterías de Evaluación)
### Sincronización Híbrida
El progreso de un candidato es la suma de **Tests Psicométricos + Entrevistas de Video**.
- **Tests:** Se deben validar tanto por `UUID` como por `Slug` (ej: 'icar', 'hexaco').
- **Video:** Se identifica por un ID específico dentro del array `bateria_tests`.
- **Cálculo:** `(Tests Completados + Video Completado) / Total Batería`. 

**Importante:** Nunca asumas que el total de la batería es solo de tests. Siempre verifica si incluye un ID de video.

---

## 3. Integridad del Motor de Informes
### Tipado de Datos (TypeScript)
El motor de informes es el punto más sensible para el "Build" de Vercel. 
- **Propiedades de Ajuste:** La propiedad `ajusteCargo` debe usar consistentemente los nombres `score` y `analisis`. El uso de términos en español o con tildes (`puntuación`, `análisis`) en las interfaces romperá la compilación en producción.
- **InformeState:** Cualquier campo nuevo en el formulario del informe DEBE declararse primero en la interfaz `InformeState` en `app/informe/page.tsx`.

---

## 4. Protocolo de Despliegue en Vercel
Si tras realizar un `git push` no ves un nuevo despliegue en el panel de Vercel tras 60 segundos:

1. **Error de Webhook:** La conexión GitHub-Vercel puede estar caída. 
2. **Solución de Emergencia:** Ejecutar el comando de despliegue directo desde la terminal:
   ```powershell
   npx vercel --prod --yes
   ```
3. **Verificación de Rama:** Asegúrate de que Vercel esté apuntando a la rama `master`. Si trabajas en otra rama, Vercel la tratará como "Preview" y podría dar errores de acceso (403 Forbidden).

---

## 5. Check-list de Mantenimiento
Antes de cada entrega, verifica:
- [ ] ¿Aparecen los 46 candidatos del proceso de Pasantías?
- [ ] ¿El progreso de los completados marca 8/8?
- [ ] ¿El comando `npm run build` termina sin errores en local?

---
*Este documento es propiedad técnica de Psico-Plataforma 2.0*
