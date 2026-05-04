/**
 * 🛡️ Validador de Arneses: Psico-Plataforma 2.0
 * Este script verifica la integridad del código y el cumplimiento de las reglas del proyecto.
 */

const fs = require('fs');
const path = require('path');

const ROJO = '\x1b[31m';
const VERDE = '\x1b[32m';
const AMARILLO = '\x1b[33m';
const RESET = '\x1b[0m';

const ARCHIVOS_CRITICOS = [
  'app/informe/page.tsx',
  'components/InformePDF.tsx',
  'app/api/generar-informe/route.ts'
];

const PALABRAS_PROHIBIDAS = [
    'maravilloso', 'excepcionalmente', 'sublime', 'increíble', 'maravilla', 
    'rimbombante', 'extraordinario', 'magnífico'
];

function validar() {
    console.log(`${AMARILLO}🔍 Iniciando Validación de Arneses...${RESET}\n`);
    let errores = 0;

    // 1. Verificar existencia de archivos críticos
    ARCHIVOS_CRITICOS.forEach(file => {
        const fullPath = path.join(process.cwd(), file);
        if (!fs.existsSync(fullPath)) {
            console.log(`${ROJO}❌ Error: Archivo crítico no encontrado: ${file}${RESET}`);
            errores++;
        }
    });

    // 2. Buscar palabras prohibidas en el System Prompt
    const promptPath = path.join(process.cwd(), 'app/api/generar-informe/route.ts');
    if (fs.existsSync(promptPath)) {
        const content = fs.readFileSync(promptPath, 'utf8').toLowerCase();
        PALABRAS_PROHIBIDAS.forEach(word => {
            if (content.includes(word)) {
                console.log(`${ROJO}⚠️ Advertencia: El System Prompt contiene la palabra prohibida: "${word}"${RESET}`);
                errores++;
            }
        });
    }

    // 3. Verificar blindaje Anti-NaN en el informe
    const reportPath = path.join(process.cwd(), 'app/informe/page.tsx');
    if (fs.existsSync(reportPath)) {
        const content = fs.readFileSync(reportPath, 'utf8');
        if (!content.includes('isNaN') && !content.includes('normVal')) {
            console.log(`${AMARILLO}⚠️ Aviso: No se detectó lógica de validación isNaN en el informe principal.${RESET}`);
        }
    }

    // 4. Verificar Sincronización Web-PDF (Etiquetas ETQ)
    const pdfPath = path.join(process.cwd(), 'components/InformePDF.tsx');
    if (fs.existsSync(reportPath) && fs.existsSync(pdfPath)) {
        const webEtq = (fs.readFileSync(reportPath, 'utf8').match(/const ETQ: Record<string, string> = {[\s\S]*?}/g) || [])[0];
        const pdfEtq = (fs.readFileSync(pdfPath, 'utf8').match(/const ETQ: Record<string, string> = {[\s\S]*?}/g) || [])[0];
        
        if (webEtq && pdfEtq && webEtq.length !== pdfEtq.length) {
            console.log(`${AMARILLO}⚠️ Aviso: Los diccionarios ETQ de Web y PDF podrían estar desincronizados.${RESET}`);
        }
    }

    console.log(`\n${errores === 0 ? VERDE + '✅ Validación Exitosa: El sistema cumple con los estándares del arnés.' : ROJO + '❌ Validación Fallida: Se encontraron ' + errores + ' puntos de riesgo.'}${RESET}`);
}

validar();
