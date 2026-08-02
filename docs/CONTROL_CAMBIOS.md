# Control de cambios de PsicoPlataforma

## Flujo obligatorio

1. Crear una rama específica.
2. Confirmar Supabase y Vercel correctos.
3. No ejecutar escrituras productivas para probar una interfaz.
4. Revisar el diff.
5. Ejecutar `npm run verify`.
6. Probar el Preview de Vercel.
7. Aprobar Production.
8. Registrar commit, resultado y reversión.

## Datos y videos

Antes de modificar datos, respaldar filas e identificadores. Para videos, comprobar archivo, ruta, candidato, proceso, pregunta y ausencia de duplicados.

## Reversión

Cada cambio funcional debe tener un commit independiente. Usar `git revert HASH_DEL_COMMIT`; no usar `git reset --hard` sobre trabajo del usuario.

## Aprobación

Solo publicar con typecheck, pruebas, build, Preview y prueba funcional aprobados. En informes, comprobar web y PDF; en datos, conservar respaldo y conteo antes/después.
