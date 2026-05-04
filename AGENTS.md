# 🛡️ Arnés de Ingeniería: Psico-Plataforma 2.0

Este documento define las reglas de oro y el marco de control para el desarrollo de la plataforma. Cualquier agente de IA que trabaje en este repositorio DEBE seguir estas directrices para asegurar la fiabilidad y el profesionalismo del sistema.

## 🏛️ Filosofía: "Consultoría de Élite"
El objetivo es producir informes psicométricos de nivel ejecutivo. No somos una herramienta masiva, somos un sistema de precisión.

### 1. Reglas de Redacción y Estilo (Crítico)
- **Prohibición de "Rimbombancia":** No usar adjetivos exagerados o palabras vacías (ej: "excepcionalmente talentoso", "maravilloso", "sublime").
- **Tono Técnico y Sobrio:** El lenguaje debe ser comedido, basado en evidencias y equilibrado. Se deben mencionar fortalezas y áreas de riesgo con la misma profesionalidad.
- **Enfoque de Negocio:** El análisis debe estar orientado a la toma de decisiones organizacional (Ajuste Persona-Cargo).

### 2. Blindaje de Datos (La Regla del "NaN")
- **Validación Total:** Ningún reporte debe mostrar jamás "NaN/5", "undefined" o campos vacíos.
- **Escudo de Tipado:** Antes de renderizar cualquier valor numérico, se debe usar la lógica de validación implementada (ver `app/informe/page.tsx`).
- **Mapeo de Cualitativos:** Valores de texto como "bajo", "medio", "alto" deben ser interceptados y convertidos a su representación numérica correspondiente para el motor de gráficos.

### 3. Sincronización Web-PDF
- **Espejo Exacto:** Cualquier cambio visual o de contenido realizado en `app/informe/page.tsx` DEBE ser replicado inmediatamente en `components/InformePDF.tsx`. El cliente debe descargar exactamente lo que ve en pantalla.

## 🗺️ Mapa de Navegación Crítica
- `app/informe/page.tsx`: Editor principal y motor de visualización de resultados.
- `components/InformePDF.tsx`: Motor de generación del documento oficial.
- `app/api/generar-informe/route.ts`: Sistema de Inteligencia Artificial (System Prompt Maestro).
- `lib/supabase.ts` & `lib/baremos.ts`: Lógica de datos y cálculos psicométricos.

## 🚀 Checkpoints de Despliegue
Antes de intentar un despliegue a Vercel, el agente DEBE:
1. Ejecutar `npm run build` localmente para atrapar errores de TypeScript.
2. Verificar que las interfaces `Sesion` e `InformeState` estén actualizadas.
3. Asegurar que las llamadas a funciones como `clrOf` tengan el número correcto de argumentos.

---
*Este arnés es la garantía de que el caballo (la IA) siempre sigue el camino del jinete (el Usuario).*
