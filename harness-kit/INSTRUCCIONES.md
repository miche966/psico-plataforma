# 🛠️ Guía de Instalación del Ecosistema de Arneses

Sigue estos pasos para activar el blindaje automático en cualquier proyecto nuevo:

### 1. Preparar las Reglas
Copia los archivos `AGENTS.md.template` y `PROGRESS.md.template` a la raíz de tu proyecto y quítales la extensión `.template`. Personalízalos según las necesidades del nuevo proyecto.

### 2. Instalar el Validador
Copia la carpeta `scripts/` a tu proyecto. Puedes editar `validate-harness.js` para añadir reglas específicas de ese proyecto (como buscar otras palabras prohibidas).

### 3. Activar el Candado (Husky)
Ejecuta estos comandos en la terminal de tu nuevo proyecto:

```bash
# Instalar Husky
npm install husky --save-dev

# Inicializar Husky
npx husky-init

# Crear el gancho de pre-push (el candado)
# Nota: En Windows/PowerShell hazlo manualmente creando el archivo .husky/pre-push
```

### 4. Configurar el pre-push
Crea un archivo llamado `.husky/pre-push` y pega este contenido:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Iniciando Auditoría de Seguridad Pre-Push..."
npm run build && node scripts/validate-harness.js
```

---
**¡Listo!** Tu nuevo proyecto ahora está protegido por la Ingeniería de Arneses. 🛡️🚀
