// Modelo de Gemini usado por los 5 endpoints que llaman a la API (generar-informe, roleplay,
// analizar-video, analizar-frases, ia-summary). Centralizado acá para que el próximo cambio de
// modelo (Google va dando de baja versiones con el tiempo) sea de una sola línea en vez de ocho.
export const GEMINI_MODEL = 'gemini-3.5-flash'
