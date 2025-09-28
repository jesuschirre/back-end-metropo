const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/mailer');
const crypto = require('crypto');

router.use(verifyToken, isAdmin);

async function procesarPlantilla(nombrePlantilla, datos) {
    try {
        const rutaPlantilla = path.join(__dirname, '..', 'templates', `${nombrePlantilla}.html`);
        let html = await fs.readFile(rutaPlantilla, 'utf-8');
        for (const clave in datos) {
            html = html.replace(new RegExp(`{{${clave}}}`, 'g'), datos[clave] || 'No especificado');
        }
        return html;
    } catch (error) {
        console.error(`Error al procesar la plantilla ${nombrePlantilla}:`, error);
        return `<p>Error al cargar la plantilla de correo.</p>`;
    }
}

// Función para generar una contraseña temporal segura
function generarPasswordTemporal() {
    return crypto.randomBytes(8).toString('hex'); // Genera una cadena aleatoria de 16 caracteres
}

// Función para validar el formato de email
function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Función para validar días de emisión
function validarDiasEmision(dias) {
    const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    return Array.isArray(dias) && dias.every(dia => diasValidos.includes(dia.toLowerCase()));
}

// Función para generar el PDF
async function generarPDFContrato(nuevoContratoId, connection, req, datosContrato) {
    const {
        cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin,
        monto_acordado, detalles_anuncio, precio_base, descuento, dias_emision
    } = datosContrato;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfName = `contrato-${nuevoContratoId}-${Date.now()}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'Uploads', 'contratos');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, pdfName);
    const stream = require('fs').createWriteStream(pdfPath);
    doc.pipe(stream);

    // Obtener datos adicionales
    const [clienteData] = await connection.query('SELECT * FROM usuarios WHERE id = ?', [cliente_id]);
    const [planData] = await connection.query('SELECT nombre FROM planes WHERE id = ?', [plan_id]);
    const [emisorData] = await connection.query('SELECT nombre, ruc, direccion, telefono FROM configuracion');
    const emisor = emisorData[0] || { nombre: 'Metrópoli Radio', ruc: 'No disponible', direccion: 'No disponible', telefono: 'No disponible' };
    const cliente = clienteData[0] || { nombre: 'No especificado', tipo_documento: 'DOC', numero_documento: 'No especificado', direccion: 'No especificada', correo: 'No especificado' };
    const planNombre = planData[0]?.nombre || 'No especificado';

    // Estilos
    const primaryColor = '#1E88E5'; // Azul
    const secondaryColor = '#4CAF50'; // Verde para el monto final
    const grayColor = '#666666';

    // Encabezado
    const logoPath = path.join(__dirname, '..', 'Uploads', 'logo.png');
    if (await fs.access(logoPath).then(() => true).catch(() => false)) {
        doc.image(logoPath, 50, 30, { width: 100 });
    }
    doc.font('Helvetica-Bold').fontSize(16).fillColor(primaryColor).text(emisor.nombre, 200, 30, { align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    doc.text(`RUC: ${emisor.ruc}`, 200, 50, { align: 'right' });
    doc.text(emisor.direccion, 200, 65, { align: 'right' });
    doc.text(`Teléfono: ${emisor.telefono}`, 200, 80, { align: 'right' });
    
    // Título
    doc.moveDown(4);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(primaryColor).text('Contrato de Servicios Publicitarios', { align: 'center' });
    doc.moveDown(1);
    
    // Información del contrato
    doc.font('Helvetica').fontSize(12).fillColor('black');
    doc.text(`Contrato ID: ${nuevoContratoId}`, 50, doc.y);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-PE')}`, 50, doc.y + 15);
    doc.moveDown(2);

    // Sección: Datos del Cliente
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('Datos del Cliente');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor(grayColor);
    doc.text(`Nombre / Razón Social: ${cliente.nombre}`, 50, doc.y);
    doc.text(`${cliente.tipo_documento || 'DOC'}: ${cliente.numero_documento || 'No especificado'}`, 50, doc.y);
    doc.text(`Dirección: ${cliente.direccion || 'No especificada'}`, 50, doc.y);
    doc.text(`Email: ${cliente.correo}`, 50, doc.y);
    doc.moveDown(2);

    // Sección: Detalles del Servicio Contratado
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('Detalles del Servicio Contratado');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(0.5);

    // Función para añadir filas a la tabla
    function addRow(item, description, value = '') {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(item, 50, doc.y, { width: 120 });
        doc.font('Helvetica').fontSize(11).fillColor(grayColor).text(description, 180, doc.y, { width: 250 });
        doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(value, 450, doc.y, { align: 'right', width: 100 });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(0.5).strokeColor('#E0E0E0').stroke();
    }

    addRow('Campaña', nombre_campana);
    addRow('Plan', planNombre);
    addRow('Periodo de Vigencia', `Del ${new Date(fecha_inicio).toLocaleDateString('es-PE')} al ${new Date(fecha_fin).toLocaleDateString('es-PE')}`);
    addRow('Días de Emisión', dias_emision.map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ') || 'No especificados');
    if (descuento > 0) {
        addRow('Precio Base', '', `S/ ${parseFloat(precio_base).toFixed(2)}`);
        addRow('Descuento Aplicado', '', `- S/ ${parseFloat(descuento).toFixed(2)}`);
    }
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(1).strokeColor('black').stroke();
    doc.moveDown(0.5);
    addRow('MONTO FINAL', '', `S/ ${parseFloat(monto_acordado).toFixed(2)}`, secondaryColor);

    // Sección: Detalles del Anuncio
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('Guion y Detalles del Anuncio');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor(grayColor).text(detalles_anuncio || 'No se especificaron detalles.', { width: 500, align: 'justify' });

    // Pie de página
    const pageHeight = doc.page.height;
    doc.fontSize(8).fillColor(grayColor).text(
        `© ${new Date().getFullYear()} ${emisor.nombre}. Todos los derechos reservados. Contacto: ${emisor.telefono} | ${emisor.direccion}`,
        50, pageHeight - 50, { align: 'center', width: 500 }
    );

    doc.end();
    return new Promise((resolve, reject) => {
        const finalPdfUrl = `${req.protocol}://${req.get('host')}/Uploads/contratos/${pdfName}`;
        stream.on('finish', () => resolve({ pdfUrl: finalPdfUrl, pdfPath, pdfName }));
        stream.on('error', reject);
    });
}

router.post("/", async (req, res) => {
    const {
        cliente_id, nuevo_cliente_nombre, nuevo_cliente_email, nuevo_cliente_tipo_doc,
        nuevo_cliente_num_doc, nuevo_cliente_direccion, plan_id,
        nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio,
        precio_base, descuento, dias_emision
    } = req.body;

    // Validaciones
    if (!plan_id || !nombre_campana || !fecha_inicio || !fecha_fin || !monto_acordado) {
        return res.status(400).json({ error: "Faltan campos obligatorios del contrato." });
    }
    if (!cliente_id && (!nuevo_cliente_nombre || !nuevo_cliente_email)) {
        return res.status(400).json({ error: "Debe seleccionar un cliente existente o crear uno nuevo." });
    }
    if (nuevo_cliente_email && !validarEmail(nuevo_cliente_email)) {
        return res.status(400).json({ error: "El correo electrónico proporcionado no es válido." });
    }
    if (dias_emision && !validarDiasEmision(dias_emision)) {
        return res.status(400).json({ error: "Los días de emisión deben ser un array de días válidos (lunes, martes, etc.)." });
    }
    if (new Date(fecha_inicio) >= new Date(fecha_fin)) {
        return res.status(400).json({ error: "La fecha de fin debe ser posterior a la fecha de inicio." });
    }

    const connection = await db.getConnection();
    let datosParaEmail = {};

    try {
        await connection.beginTransaction();

        let final_cliente_id = cliente_id;
        let isNewUser = false;
        let passwordTemporal = '';

        if (nuevo_cliente_email) {
            isNewUser = true;
            const [existingUser] = await connection.query('SELECT id FROM usuarios WHERE correo = ? OR numero_documento = ?', [nuevo_cliente_email, nuevo_cliente_num_doc]);
            if (existingUser.length > 0) throw new Error('Ya existe un usuario con ese correo o número de documento.');
            passwordTemporal = generarPasswordTemporal();
            const hashedPassword = await bcrypt.hash(passwordTemporal, 10);
            const [newUserResult] = await connection.query(
                'INSERT INTO usuarios (nombre, correo, password, rol, tipo_documento, numero_documento, direccion) VALUES (?, ?, ?, "vendedor", ?, ?, ?)',
                [nuevo_cliente_nombre, nuevo_cliente_email, hashedPassword, nuevo_cliente_tipo_doc, nuevo_cliente_num_doc, nuevo_cliente_direccion]
            );
            final_cliente_id = newUserResult.insertId;
        } else {
            await connection.query('UPDATE usuarios SET rol = "vendedor" WHERE id = ? AND rol = "usuario"', [final_cliente_id]);
        }

        const hoy = new Date().toISOString().slice(0, 10);
        const estadoContrato = (fecha_inicio <= hoy) ? 'Activo' : 'Programado';

        const queryContrato = `INSERT INTO contratos_publicitarios (cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio, estado, precio_base, descuento, dias_emision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [resultContrato] = await connection.query(queryContrato, [
            final_cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin,
            monto_acordado, detalles_anuncio, estadoContrato,
            precio_base || null, descuento || 0, JSON.stringify(dias_emision || [])
        ]);
        const nuevoContratoId = resultContrato.insertId;

        // Generar PDF
        const { pdfUrl, pdfPath, pdfName } = await generarPDFContrato(nuevoContratoId, connection, req, {
            cliente_id: final_cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin,
            monto_acordado, detalles_anuncio, precio_base, descuento, dias_emision
        });

        await connection.query('UPDATE contratos_publicitarios SET pdf_url = ? WHERE id = ?', [pdfUrl, nuevoContratoId]);

        const [clienteData] = await connection.query('SELECT nombre, correo FROM usuarios WHERE id = ?', [final_cliente_id]);
        const [planData] = await connection.query('SELECT nombre FROM planes WHERE id = ?', [plan_id]);
        datosParaEmail = { isNewUser, cliente_nombre: clienteData[0].nombre, cliente_email: clienteData[0].correo, plan_nombre: planData[0].nombre, passwordTemporal };

        await connection.commit();

        // Enviar correos electrónicos
        const templateCliente = datosParaEmail.isNewUser ? 'bienvenida_nuevo_vendedor' : 'nuevo_contrato';
        const asuntoCliente = datosParaEmail.isNewUser ? `¡Bienvenido a Metrópoli Radio, ${datosParaEmail.cliente_nombre}!` : `Nuevo Contrato: ${nombre_campana}`;
        const htmlCliente = await procesarPlantilla(templateCliente, {
            nombre_cliente: datosParaEmail.cliente_nombre,
            nombre_campana: nombre_campana,
            nombre_plan: datosParaEmail.plan_nombre,
            dias_emision: dias_emision.map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ') || 'No especificados',
            monto: parseFloat(monto_acordado).toFixed(2),
            fecha_inicio: new Date(fecha_inicio).toLocaleDateString('es-PE'),
            fecha_fin: new Date(fecha_fin).toLocaleDateString('es-PE'),
            pdfUrl: pdfUrl,
            passwordTemporal: datosParaEmail.passwordTemporal,
            current_year: new Date().getFullYear(),
            panel_cliente_url: `${req.protocol}://${req.get('host')}/cliente/contratos`
        });

        await sendEmail({ 
            to: datosParaEmail.cliente_email, 
            subject: asuntoCliente, 
            htmlContent: htmlCliente,
            attachments: [{ filename: pdfName, path: pdfPath }]
        });

        const [[adminConfig]] = await db.query("SELECT valor_config FROM configuracion_correo WHERE clave_config = 'admin_email_notificaciones'");
        if (adminConfig && adminConfig.valor_config) {
            const htmlAdmin = await procesarPlantilla('admin_nuevo_contrato', {
                nombre_cliente: datosParaEmail.cliente_nombre,
                email_cliente: datosParaEmail.cliente_email,
                nombre_campana: nombre_campana,
                nombre_plan: datosParaEmail.plan_nombre,
                dias_emision: dias_emision.map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ') || 'No especificados',
                monto: parseFloat(monto_acordado).toFixed(2),
                fecha_inicio: new Date(fecha_inicio).toLocaleDateString('es-PE'),
                fecha_fin: new Date(fecha_fin).toLocaleDateString('es-PE'),
                current_year: new Date().getFullYear(),
                panel_admin_url: `${req.protocol}://${req.get('host')}/admin/contratos`
            });
            await sendEmail({ 
                to: adminConfig.valor_config, 
                subject: `Nuevo Contrato - ${datosParaEmail.cliente_nombre}`, 
                htmlContent: htmlAdmin, 
                attachments: [{ filename: `COPIA-${pdfName}`, path: pdfPath }]
            });
        }

        res.status(201).json({
            message: "Contrato creado, PDF generado y correos enviados exitosamente.",
            pdfUrl: pdfUrl,
        });
    } catch (err) {
        await connection.rollback();
        console.error("Error en la transacción:", err);
        if (err.message.includes('Ya existe un usuario')) return res.status(409).json({ error: err.message });
        return res.status(500).json({ error: `Error interno del servidor: ${err.message}` });
    } finally {
        connection.release();
    }
});

router.get("/", async (req, res) => {
    try {
        const query = `SELECT c.*, u.nombre AS nombre_cliente, u.numero_documento, p.nombre AS nombre_plan 
                       FROM contratos_publicitarios c 
                       JOIN usuarios u ON c.cliente_id = u.id 
                       JOIN planes p ON c.plan_id = p.id 
                       ORDER BY c.fecha_creacion DESC`;
        const [contratos] = await db.query(query);
        const contratosFormateados = contratos.map(c => ({
            ...c, 
            dias_emision: JSON.parse(c.dias_emision || '[]')
        }));
        res.json(contratosFormateados);
    } catch (err) {
        console.error("Error al obtener los contratos:", err);
        res.status(500).json({ error: "Error al obtener los contratos." });
    }
});

router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const query = `SELECT c.*, u.nombre AS nombre_cliente, u.numero_documento, p.nombre AS nombre_plan 
                       FROM contratos_publicitarios c 
                       JOIN usuarios u ON c.cliente_id = u.id 
                       JOIN planes p ON c.plan_id = p.id 
                       WHERE c.id = ?`;
        const [contratos] = await db.query(query, [id]);
        if (contratos.length === 0) return res.status(404).json({ error: "Contrato no encontrado." });
        const contratoFormateado = {
            ...contratos[0], 
            dias_emision: JSON.parse(contratos[0].dias_emision || '[]')
        };
        res.json(contratoFormateado);
    } catch (err) {
        console.error("Error al obtener el contrato:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;