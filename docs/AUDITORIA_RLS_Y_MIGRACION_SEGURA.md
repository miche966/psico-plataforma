# Auditoria RLS y migracion segura

Fecha: 2026-08-02

## Resultado confirmado

La anon key pudo leer una fila de estas tablas:

- candidatos
- procesos
- sesiones
- respuestas_video
- informes_psicometricos

Las tablas progreso_evaluaciones y recordatorios_evaluacion no devolvieron filas en la prueba.

La prueba fue solo de lectura. No se ejecutaron INSERT, UPDATE ni DELETE.

## Consecuencia

La proteccion actual no debe considerarse suficiente para las tablas principales. Activar RLS sin migrar primero las lecturas y escrituras del navegador puede bloquear evaluaciones existentes.

## No aplicar todavia

No ejecutar una migracion RLS generica con politicas globales ni politicas USING (true).

## Orden obligatorio

1. Identificar todos los accesos directos desde el navegador.
2. Migrar progresivamente las operaciones sensibles a endpoints de servidor.
3. Validar token, candidato, proceso y evaluacion en cada endpoint.
4. Crear politicas RLS especificas.
5. Probar con anon, evaluado y administrador.
6. Aplicar primero en un entorno de prueba.
7. Promover solo despues de las pruebas funcionales.

## Estado

Pendiente de migracion gradual. No se modifico la base de datos.