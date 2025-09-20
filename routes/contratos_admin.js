const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/mailer');

// APLICAMOS LA SEGURIDAD A TODAS LAS RUTAS DE ESTE ARCHIVO
router.use(verifyToken, isAdmin);

// FUNCIÓN HELPER PARA PROCESAR PLANTILLAS
async function procesarPlantilla(nombrePlantilla, datos) {
    try {
        const rutaPlantilla = path.join(__dirname, '..', 'templates', `${nombrePlantilla}.html`);
        let html = await fs.promises.readFile(rutaPlantilla, 'utf-8');
        for (const clave in datos) {
            html = html.replace(new RegExp(`{{${clave}}}`, 'g'), datos[clave]);
        }
        return html;
    } catch (error) {
        console.error(`Error al procesar la plantilla ${nombrePlantilla}:`, error);
        return `<p>Error al cargar la plantilla de correo. Por favor, contacte a soporte.</p>`;
    }
}

// -------------------------------------------
// --- ENDPOINT PRINCIPAL PARA CREAR CONTRATOS ---
// -------------------------------------------

router.post("/", async (req, res) => {
    const {
        cliente_id, nuevo_cliente_nombre, nuevo_cliente_email, plan_id,
        nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio,
    } = req.body;

    if (!plan_id || !nombre_campana || !fecha_inicio || !fecha_fin || !monto_acordado) {
        return res.status(400).json({ error: "Faltan campos obligatorios del contrato." });
    }
    if (!cliente_id && (!nuevo_cliente_nombre || !nuevo_cliente_email)) {
        return res.status(400).json({ error: "Debe seleccionar un cliente existente o crear uno nuevo." });
    }

    const connection = await db.getConnection();
    let pdfUrl = '';
    let datosParaEmail = {};

    try {
        await connection.beginTransaction();

        let final_cliente_id = cliente_id;
        let isNewUser = false;
        let passwordTemporal = '';
        
        if (nuevo_cliente_email) {
            isNewUser = true;
            const [existingUser] = await connection.query('SELECT id FROM usuarios WHERE correo = ?', [nuevo_cliente_email]);
            if (existingUser.length > 0) throw new Error('Ya existe un usuario con ese correo electrónico.');
            
            passwordTemporal = `Metropoli${new Date().getFullYear()}`;
            const hashedPassword = await bcrypt.hash(passwordTemporal, 10);
            const [newUserResult] = await connection.query(
                'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, "vendedor")',
                [nuevo_cliente_nombre, nuevo_cliente_email, hashedPassword]
            );
            final_cliente_id = newUserResult.insertId;
        } else {
            await connection.query('UPDATE usuarios SET rol = "vendedor" WHERE id = ? AND rol = "usuario"', [final_cliente_id]);
        }
        
        const hoy = new Date().toISOString().slice(0, 10);
        const estadoContrato = (fecha_inicio <= hoy) ? 'Activo' : 'Programado';
        
        const queryContrato = `INSERT INTO contratos_publicitarios (cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const [resultContrato] = await connection.query(queryContrato, [
            final_cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio, estadoContrato
        ]);
        const nuevoContratoId = resultContrato.insertId;

        const pdfPromise = new Promise(async (resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const pdfName = `contrato-${nuevoContratoId}-${Date.now()}.pdf`;
            const pdfDir = path.join(__dirname, '..', 'uploads', 'contratos');
            fs.mkdirSync(pdfDir, { recursive: true });
            const pdfPath = path.join(pdfDir, pdfName);
            const stream = fs.createWriteStream(pdfPath);
            doc.pipe(stream);
            
            // --- INICIO DEL CONTENIDO COMPLETO DEL PDF ---
            const [clienteData] = await connection.query('SELECT nombre, correo FROM usuarios WHERE id = ?', [final_cliente_id]);
            const [planData] = await connection.query('SELECT nombre FROM planes WHERE id = ?', [plan_id]);
            const [emisorData] = await connection.query('SELECT nombre, ruc, direccion, telefono FROM configuracion');
            const emisor = emisorData[0];
            const cliente = clienteData[0];
            const planNombre = planData[0].nombre;

            // --- HEADER ---
            const logoPath = path.join(__dirname, '..', 'uploads', 'logo.png');
            if (fs.existsSync(logoPath)) doc.image(logoPath, 50, 45, { width: 100 });
            doc.fontSize(16).font('Helvetica-Bold').text(emisor.nombre, 200, 50, { align: 'right' });
            doc.fontSize(10).font('Helvetica').text(`RUC: ${emisor.ruc}`, 200, 70, { align: 'right' });
            doc.text(emisor.direccion, 200, 85, { align: 'right' });
            doc.text(`Teléfono: ${emisor.telefono}`, 200, 100, { align: 'right' });
            doc.moveDown(4);
            doc.fontSize(18).font('Helvetica-Bold').text('Contrato de Servicios Publicitarios', { align: 'center' });
            doc.moveDown(2);
            doc.fontSize(12).font('Helvetica').text(`Contrato ID: ${nuevoContratoId}`);
            doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-PE')}`);
            doc.moveDown();
            doc.font('Helvetica-Bold').text('Datos del Cliente:');
            doc.font('Helvetica').text(`   Nombre: ${cliente.nombre}`);
            doc.text(`   Email: ${cliente.correo}`);
            doc.moveDown(2);
            doc.font('Helvetica-Bold').text('Detalles del Servicio Contratado:');
            doc.moveDown();
            const tableTop = doc.y;
            doc.fontSize(10).font('Helvetica-Bold').text('Concepto', 50, tableTop).text('Detalle', 180, tableTop).text('Valor', 450, tableTop, { align: 'right' });
            doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).strokeColor("#cccccc").stroke();
            doc.moveDown(2);
            function addRow(item, description, value = '') {
                doc.font('Helvetica-Bold').text(item, 50, doc.y);
                doc.font('Helvetica').text(description, 180, doc.y, { width: 250 });
                doc.font('Helvetica-Bold').text(value, 450, doc.y, { align: 'right' });
                doc.moveDown(1.5);
            }
            addRow('Campaña', nombre_campana);
            addRow('Plan', planNombre);
            addRow('Periodo de Vigencia', `Del ${new Date(fecha_inicio).toLocaleDateString('es-PE')} al ${new Date(fecha_fin).toLocaleDateString('es-PE')}`);
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#cccccc").stroke();
            doc.moveDown(0.5);
            addRow('MONTO TOTAL', '', `S/ ${parseFloat(monto_acordado).toFixed(2)}`);
            doc.moveDown(2);
            doc.fontSize(12).font('Helvetica-Bold').text('Guion y Detalles del Anuncio:');
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').text(detalles_anuncio || 'No se especificaron detalles.', { width: 500, align: 'justify' });
            doc.fontSize(8).text('Este documento es una representación oficial del acuerdo de servicios.', 50, 750, { align: 'center', width: 500 });
            // --- FIN DEL CONTENIDO DEL PDF ---
            
            doc.end();

            const finalPdfUrl = `${req.protocol}://${req.get('host')}/uploads/contratos/${pdfName}`;
            stream.on('finish', () => resolve(finalPdfUrl));
            stream.on('error', reject);
        });

        pdfUrl = await pdfPromise;
        await connection.query('UPDATE contratos_publicitarios SET pdf_url = ? WHERE id = ?', [pdfUrl, nuevoContratoId]);

        const [clienteData] = await connection.query('SELECT nombre, correo FROM usuarios WHERE id = ?', [final_cliente_id]);
        const [planData] = await connection.query('SELECT nombre FROM planes WHERE id = ?', [plan_id]);
        datosParaEmail = { isNewUser, cliente_nombre: clienteData[0].nombre, cliente_email: clienteData[0].correo, plan_nombre: planData[0].nombre, passwordTemporal };

        await connection.commit();

    } catch (err) {
        await connection.rollback();
        console.error("Error en la transacción:", err);
        if (err.message.includes('Ya existe un usuario')) return res.status(409).json({ error: err.message });
        return res.status(500).json({ error: "Error interno del servidor durante la transacción." });
    } finally {
        connection.release();
    }

    // --- ENVÍO DE CORREO (POST-TRANSACCIÓN) ---
    try {
        const templateCliente = datosParaEmail.isNewUser ? 'bienvenida_nuevo_vendedor' : 'nuevo_contrato';
        const asuntoCliente = datosParaEmail.isNewUser ? `¡Bienvenido a Metrópoli Radio, ${datosParaEmail.cliente_nombre}!` : `Nuevo Contrato: ${nombre_campana}`;
        const htmlCliente = await procesarPlantilla(templateCliente, {
            nombre_cliente: datosParaEmail.cliente_nombre,
            nombre_campana: nombre_campana,
            pdfUrl: pdfUrl,
            passwordTemporal: datosParaEmail.passwordTemporal,
            fecha_inicio: new Date(fecha_inicio).toLocaleDateString('es-PE')
        });
        sendEmail({ to: datosParaEmail.cliente_email, subject: asuntoCliente, htmlContent: htmlCliente });

        const [[adminConfig]] = await db.query("SELECT valor_config FROM configuracion_correo WHERE clave_config = 'admin_email_notificaciones'");
        if (adminConfig && adminConfig.valor_config) {
            const htmlAdmin = await procesarPlantilla('admin_nuevo_contrato', {
                nombre_cliente: datosParaEmail.cliente_nombre,
                email_cliente: datosParaEmail.cliente_email,
                nombre_campana: nombre_campana,
                nombre_plan: datosParaEmail.plan_nombre,
                monto: monto_acordado,
                fecha_inicio: new Date(fecha_inicio).toLocaleDateString('es-PE'),
                fecha_fin: new Date(fecha_fin).toLocaleDateString('es-PE')
            });
            sendEmail({ to: adminConfig.valor_config, subject: `Nuevo Contrato Registrado - ${datosParaEmail.cliente_nombre}`, htmlContent: htmlAdmin });
        }
    } catch (emailError) {
        console.error("Contrato guardado, pero falló el envío de correos post-transacción:", emailError);
    }
    
    res.status(201).json({
        message: "Contrato creado y PDF generado exitosamente.",
        pdfUrl: pdfUrl,
    });
});

// --- ENDPOINTS GET ---
router.get("/", async (req, res) => {
  try {
    const query = `SELECT c.*, u.nombre AS nombre_cliente, p.nombre AS nombre_plan FROM contratos_publicitarios c JOIN usuarios u ON c.cliente_id = u.id JOIN planes p ON c.plan_id = p.id ORDER BY c.fecha_creacion DESC`;
    const [contratos] = await db.query(query);
    res.json(contratos);
  } catch (err) {
    console.error("Error al obtener los contratos:", err);
    res.status(500).json({ error: "Error al obtener los contratos." });
  }
});

router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const query = `SELECT c.*, u.nombre AS nombre_cliente, p.nombre AS nombre_plan FROM contratos_publicitarios c JOIN usuarios u ON c.cliente_id = u.id JOIN planes p ON c.plan_id = p.id WHERE c.id = ?`;
        const [contratos] = await db.query(query, [id]);
        if (contratos.length === 0) return res.status(404).json({ error: "Contrato no encontrado." });
        res.json(contratos[0]);
    } catch (err) {
        console.error(`Error al obtener el contrato ${id}:`, err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;