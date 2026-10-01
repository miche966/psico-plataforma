import { z } from 'zod'
import { SLUG_TO_ID } from './catalogoTests.ts'

// Un elemento de bateria_tests es un test del catalogo o 'entrevista:<id>'. Valores historicos en uso
// verificados contra la BD: todos caen en SLUG_TO_ID o en entrevista:<id>.
const slugTest = z.string().refine(s => s in SLUG_TO_ID || /^entrevista:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s), 'La batería incluye un test desconocido.')

export const procesoCamposSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre del proceso es obligatorio.').max(200, 'El nombre es demasiado largo.'),
  cargo: z.string().trim().min(1, 'El cargo es obligatorio.').max(200, 'El cargo es demasiado largo.'),
  descripcion: z.string().max(10000, 'La descripción es demasiado larga.').nullish(),
  descripcion_cargo: z.string().max(10000, 'La descripción del cargo es demasiado larga.').nullish(),
  competencias_requeridas: z.array(z.object({
    nombre: z.string().trim().min(1).max(100),
    nivel: z.string().trim().max(50),
  })).max(50, 'Hay demasiadas competencias.').nullish(),
  bateria_tests: z.array(slugTest).max(40, 'La batería tiene demasiados tests.').nullish(),
})

export const procesoIdSchema = z.object({ procesoId: z.guid('El identificador del proceso no es válido.') })

export const vinculoSchema = z.object({
  candidatoId: z.guid('El identificador del candidato no es válido.'),
  procesoId: z.guid('El identificador del proceso no es válido.'),
  slugPrimerTest: z.string().max(100).optional().transform(v => v || 'control'),
})

// Cada fila de la carga masiva se valida por separado: una fila mala se omite en vez de tirar abajo
// el archivo entero.
export const filaCandidatoSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  apellido: z.string().trim().max(100).optional().transform(v => v ?? ''),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
})

export const MAX_FILAS_CARGA = 1000

export const cargaMasivaSchema = z.object({
  candidatos: z.array(z.unknown()).min(1, 'Sin candidatos para cargar').max(MAX_FILAS_CARGA, `El archivo supera el máximo de ${MAX_FILAS_CARGA} candidatos por carga.`),
  // El cliente manda '' cuando la carga no es para un proceso puntual.
  procesoId: z.string().optional().transform(v => v ?? '').refine(v => v === '' || z.guid().safeParse(v).success, 'El identificador del proceso no es válido.'),
  slugPrimerTest: z.string().max(100).optional().transform(v => v || 'control'),
})
