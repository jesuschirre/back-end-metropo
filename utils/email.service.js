const fs = require('fs').promises;
const path = require('path');
// Asumiendo que 'mailer.js' está en la misma carpeta 'utils'
// Si está en '../utils/mailer', ajusta la ruta
const { sendEmail } = require('../utils/mailer'); 

async function procesarPlantilla(nombrePlantilla, datos) {
    try {
        const rutaPlantilla = path.join(__dirname, '..', 'templates', `${nombrePlantilla}.html`);
        let html = await fs.readFile(rutaPlantilla, 'utf-8');
        for (const clave in datos) {
            html = html.replace(new RegExp(`{{\\s*${clave}\\s*}}`, 'g'), datos[clave] ?? 'No especificado');
        }
        return html;
    } catch (error) {
        console.error(`Error al procesar la plantilla ${nombrePlantilla}:`, error);
        return `<p>Error al cargar la plantilla de correo.</p>`;
    }
}

module.exports = {
    procesarPlantilla,
    sendEmail // Re-exportamos sendEmail para que el router solo importe este archivo
};