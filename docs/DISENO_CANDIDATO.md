# Diseño de las pantallas del candidato

Concepto: **papel y marcador**. Las pruebas psicométricas son hojas de respuestas: burbujas que se rellenan y textos que se subrayan.
Lo único llamativo es la selección (burbuja llena y texto resaltado como con marcador); el resto es quieto y legible.

## Piezas

| Qué | Dónde |
|---|---|
| Variables y clases (`.pp-*`) | `app/candidato.css` (todo vive bajo `.pp`; no toca el panel de administración) |
| Fuentes | `app/layout.tsx` con `next/font` (se sirven desde el propio dominio, no hace falta tocar la CSP) |
| Marca y marco (`Marco`, `Marca`) | `components/candidato/Marco.tsx` |
| Logo: icono (burbuja marcada sobre cuadrado verde) y nombre con la "o" de burbuja | `components/Logo.tsx`; el icono de la pestana es `app/icon.svg` (mismo dibujo) |
| Pantallas de estado (carga, error, guardado fallido, fin, aviso, contacto) | `components/candidato/Estados.tsx` |
| Pruebas (`PruebaEleccion`, `PruebaEscala`, `MarcoPrueba`, `ListaOpciones`) | `components/candidato/Prueba.tsx` |
| Icono de la pestaña | `app/icon.svg` |

## Decisiones

- **Paleta**: papel `#EEF1EE`, tinta pino `#12332E`, acción pino `#17594E`, marcador `#F5D547`; ámbar y carmesí solo para el tiempo y los errores. Un solo color de acento (antes cada test tenía el suyo).
- **Tipografía**: Literata para enunciados, títulos y cifras que cambian a la vista (tiempo, avance); Lexend para la interfaz (diseñada para leer con fluidez). Se descartó Atkinson Hyperlegible porque dibuja el cero con barra y la interfaz muestra números por todos lados.
- **Textos**: voseo, sin emojis, sin etiquetas en mayúsculas. El nombre visible es solo "PsicoPlataforma".
- **Accesibilidad**: opciones de al menos 3,5 rem de alto, foco visible, `prefers-reduced-motion`, temporizadores con `role="timer"` y aviso a lectores de pantalla solo al entrar en cada tramo, controles con etiqueta (los íconos solos no llevan significado).
- **Dos toques seguidos** en una escala ya no responden también la pregunta siguiente (se ignora el segundo si llega antes de 350 ms).
- La revisión de cámara del portal ya no dice "Cámara lista" / "Micrófono detectado" sin comprobarlo: solo lo dice cuando el flujo realmente está activo.

## Cómo agregar una prueba nueva

1. Estado y guardado como en las demás páginas (no cambian).
2. La parte visual: `PantallaCarga` / `PantallaError` / `PantallaGuardadoFallido` / `PantallaSiguiente` / `PantallaFin` y `PruebaEleccion` (una correcta por pregunta) o `PruebaEscala` (de acuerdo / en desacuerdo). Si el contenido es especial (como ICAR), `MarcoPrueba` + `ListaOpciones`.
3. Nada de estilos en línea ni colores nuevos: si falta algo, se agrega una clase `.pp-*` en `app/candidato.css`.

## Pendiente

Panel de administración, informe y estadísticas no se tocaron (etapa 3): conservan el estilo anterior. El login, la verificación en dos pasos y la recuperación de contraseña sí usan este sistema.
