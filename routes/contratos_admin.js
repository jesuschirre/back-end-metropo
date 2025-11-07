const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const fsSync = require('fs');
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
            html = html.replace(new RegExp(`{{\\s*${clave}\\s*}}`, 'g'), datos[clave] ?? 'No especificado');
        }
        return html;
    } catch (error) {
        console.error(`Error al procesar la plantilla ${nombrePlantilla}:`, error);
        return `<p>Error al cargar la plantilla de correo.</p>`;
    }
}

function generarPasswordTemporal() {
    return crypto.randomBytes(8).toString('hex');
}

function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

function validarDiasEmision(dias) {
    const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    return Array.isArray(dias) && dias.every(dia => typeof dia === 'string' && diasValidos.includes(dia.toLowerCase()));
}

async function generarPDFContrato(contratoId, connection, req, datosContrato) {
    const { cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio, precio_base, descuento, dias_emision } = datosContrato;
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfName = `contrato-${contratoId}-${Date.now()}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'Uploads', 'contratos');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, pdfName);
    const stream = fsSync.createWriteStream(pdfPath);
    doc.pipe(stream);
    const [[cliente]] = await connection.query('SELECT * FROM usuarios WHERE id = ?', [cliente_id]);
    const [[plan]] = await connection.query('SELECT nombre FROM planes WHERE id = ?', [plan_id]);
    const [[emisor]] = await connection.query('SELECT nombre, ruc, direccion, telefono, logo_url FROM configuracion LIMIT 1');
    const emisorInfo = emisor || { nombre: 'Metrópoli Radio', ruc: 'No disponible', direccion: 'No disponible', telefono: 'No disponible', logo_url: null };
    const clienteInfo = cliente || { nombre: 'No especificado', tipo_documento: 'DOC', numero_documento: 'No especificado', direccion: 'No especificada', correo: 'No especificado' };
    const planNombre = plan?.nombre || 'No especificado';
    const primaryColor = '#1E88E5';
    const grayColor = '#666666';
    const logoPath = path.join(__dirname, '..', 'Uploads', 'logo.png');
    if (fsSync.existsSync(logoPath)) { doc.image(logoPath, 50, 30, { width: 100 }); }
    doc.font('Helvetica-Bold').fontSize(16).fillColor(primaryColor).text(emisorInfo.nombre, { align: 'right' });
    doc.moveUp();
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    doc.text(`RUC: ${emisorInfo.ruc}`, { align: 'right' });
    doc.text(emisorInfo.direccion, { align: 'right' });
    doc.text(`Teléfono: ${emisorInfo.telefono}`, { align: 'right' });
    doc.moveDown(4);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(primaryColor).text('Contrato de Servicios Publicitarios', { align: 'center' });
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(12).fillColor('black');
    doc.text(`Contrato ID: ${contratoId}`, 50, doc.y);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, { align: 'right' });
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('Datos del Cliente');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor(grayColor);
    doc.text(`Nombre / Razón Social: ${clienteInfo.nombre}`, 50, doc.y);
    doc.text(`${clienteInfo.tipo_documento || 'DOC'}: ${clienteInfo.numero_documento || 'No especificado'}`, 50, doc.y);
    doc.text(`Dirección: ${clienteInfo.direccion || 'No especificada'}`, 50, doc.y);
    doc.text(`Email: ${clienteInfo.correo}`, 50, doc.y);
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('Detalles del Servicio Contratado');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(0.5);
    function addRow(item, description, value = '') {
        const yPos = doc.y;
        doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(item, 50, yPos, { width: 120 });
        doc.font('Helvetica').fontSize(11).fillColor(grayColor).text(description, 180, yPos, { width: 250 });
        doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(value, 450, yPos, { align: 'right', width: 100 });
        doc.y = yPos + Math.max(doc.heightOfString(item, { width: 120 }), doc.heightOfString(description, { width: 250 }), doc.heightOfString(value, { width: 100 }));
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(0.5).strokeColor('#E0E0E0').stroke();
        doc.moveDown(0.5);
    }
    addRow('Campaña', nombre_campana);
    addRow('Plan', planNombre);
    const formatDate = (dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    addRow('Periodo de Vigencia', `Del ${formatDate(fecha_inicio)} al ${formatDate(fecha_fin)}`);
    addRow('Días de Emisión', (Array.isArray(dias_emision) ? dias_emision.map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ') : 'No especificados'));
    if (descuento && parseFloat(descuento) > 0) {
        addRow('Precio Base', '', `S/ ${parseFloat(precio_base || 0).toFixed(2)}`);
        addRow('Descuento Aplicado', '', `- S/ ${parseFloat(descuento).toFixed(2)}`);
    }
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(1).strokeColor('black').stroke();
    doc.moveDown(0.5);
    addRow('MONTO FINAL', '', `S/ ${parseFloat(monto_acordado).toFixed(2)}`);
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('Guion y Detalles del Anuncio');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor(grayColor).text(detalles_anuncio || 'No se especificaron detalles.', { width: 500, align: 'justify' });
    const pageHeight = doc.page.height;
    doc.fontSize(8).fillColor(grayColor).text(`© ${new Date().getFullYear()} ${emisorInfo.nombre}. Todos los derechos reservados. Contacto: ${emisorInfo.telefono} | ${emisorInfo.direccion}`, 50, pageHeight - 50, { align: 'center', width: 500 });
    doc.end();
    return new Promise((resolve, reject) => {
        const finalPdfUrl = `${req.protocol}://${req.get('host')}/Uploads/contratos/${pdfName}`;
        stream.on('finish', () => { console.log(`PDF generado: ${pdfPath}`); resolve({ pdfUrl: finalPdfUrl, pdfPath, pdfName }); });
        stream.on('error', (err) => { console.error("Error al escribir el PDF:", err); reject(err); });
    });
}

router.post("/", async (req, res) => {
    const { cliente_id, nuevo_cliente_nombre, nuevo_cliente_email, nuevo_cliente_tipo_doc, nuevo_cliente_num_doc, nuevo_cliente_direccion, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio, precio_base, descuento, dias_emision } = req.body;
    if (!plan_id || !nombre_campana || !fecha_inicio || !fecha_fin || !monto_acordado) return res.status(400).json({ error: "Faltan campos obligatorios del contrato (Plan, Campaña, Fechas, Monto)." });
    if (!cliente_id && (!nuevo_cliente_nombre || !nuevo_cliente_email)) return res.status(400).json({ error: "Debe seleccionar un cliente existente o ingresar nombre y correo para uno nuevo." });
    if (nuevo_cliente_email && !validarEmail(nuevo_cliente_email)) return res.status(400).json({ error: "El correo electrónico del nuevo cliente no es válido." });
    if (dias_emision && !validarDiasEmision(dias_emision)) return res.status(400).json({ error: "Los días de emisión deben ser un array de días válidos (ej: ['lunes', 'miercoles'])." });
    const inicioDate = new Date(fecha_inicio + 'T00:00:00');
    const finDate = new Date(fecha_fin + 'T00:00:00');
    if (inicioDate >= finDate) return res.status(400).json({ error: "La fecha de fin debe ser estrictamente posterior a la fecha de inicio." });
    let connection;
    let pdfInfo = {};
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        let final_cliente_id = cliente_id;
        let isNewUser = false;
        let passwordTemporal = '';
        let nombreClienteFinal = nuevo_cliente_nombre;
        let emailClienteFinal = nuevo_cliente_email;
        if (nuevo_cliente_email) {
            const checkQuery = nuevo_cliente_num_doc ? 'SELECT id, nombre, correo FROM usuarios WHERE correo = ? OR numero_documento = ?' : 'SELECT id, nombre, correo FROM usuarios WHERE correo = ?';
            const checkParams = nuevo_cliente_num_doc ? [nuevo_cliente_email, nuevo_cliente_num_doc] : [nuevo_cliente_email];
            const [existingUser] = await connection.query(checkQuery, checkParams);
            if (existingUser.length > 0) {
                 console.log(`Usuario encontrado con correo ${nuevo_cliente_email} o doc ${nuevo_cliente_num_doc}. Usando ID: ${existingUser[0].id}`);
                 final_cliente_id = existingUser[0].id;
                 isNewUser = false;
                 nombreClienteFinal = existingUser[0].nombre;
                 emailClienteFinal = existingUser[0].correo;
                 await connection.query('UPDATE usuarios SET rol = "cliente" WHERE id = ?', [final_cliente_id]);
                 console.log(`Rol del usuario existente ${final_cliente_id} asegurado como 'cliente'.`);
            } else {
                isNewUser = true;
                passwordTemporal = generarPasswordTemporal();
                const hashedPassword = await bcrypt.hash(passwordTemporal, 10);
                const rolNuevoUsuario = 'cliente';
                const [newUserResult] = await connection.query(
                    'INSERT INTO usuarios (nombre, correo, password, rol, tipo_documento, numero_documento, direccion) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [nuevo_cliente_nombre, nuevo_cliente_email, hashedPassword, rolNuevoUsuario, nuevo_cliente_tipo_doc || null, nuevo_cliente_num_doc || null, nuevo_cliente_direccion || null]
                );
                final_cliente_id = newUserResult.insertId;
            }
        } else if (final_cliente_id) {
            const [[clienteExistente]] = await connection.query('SELECT nombre, correo FROM usuarios WHERE id = ?', [final_cliente_id]);
            if (!clienteExistente) throw new Error("El cliente seleccionado no existe.");
            nombreClienteFinal = clienteExistente.nombre;
            emailClienteFinal = clienteExistente.correo;
            await connection.query('UPDATE usuarios SET rol = "cliente" WHERE id = ?', [final_cliente_id]);
            console.log(`Rol del usuario seleccionado ${final_cliente_id} asegurado como 'cliente'.`);
        } else {
             throw new Error("No se especificó un cliente válido.");
        }
        const [[plan]] = await connection.query("SELECT max_anuncios_por_dia, nombre FROM planes WHERE id = ?", [plan_id]);
        if (!plan) throw new Error("El plan seleccionado no es válido.");
        const anunciosPorDiaRequeridos = plan.max_anuncios_por_dia;
        const nombrePlanFinal = plan.nombre;
        const fechasDeEmision = [];
        const diasSemana = { 'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6 };
        const diasSeleccionadosNum = (Array.isArray(dias_emision) ? dias_emision : []).map(dia => diasSemana[dia.toLowerCase()]).filter(num => num !== undefined);
        if (diasSeleccionadosNum.length === 0) throw new Error("No se seleccionaron días de emisión válidos.");
        let fechaActual = new Date(inicioDate);
        const fechaFinObj = new Date(finDate);
        while (fechaActual <= fechaFinObj) {
            if (diasSeleccionadosNum.includes(fechaActual.getDay())) {
                fechasDeEmision.push(fechaActual.toISOString().split('T')[0]);
            }
            fechaActual.setDate(fechaActual.getDate() + 1);
        }
        if (fechasDeEmision.length === 0) throw new Error("No hay días de emisión válidos en el rango de fechas seleccionado.");
        if (anunciosPorDiaRequeridos > 0 && fechasDeEmision.length > 0) {
            const [stockActual] = await connection.query(`SELECT fecha, anuncios_disponibles FROM anuncios_stock WHERE fecha IN (?) FOR UPDATE`, [fechasDeEmision]);
            const stockMap = new Map(stockActual.map(item => [item.fecha.toISOString().split('T')[0], item.anuncios_disponibles]));
            for (const fecha of fechasDeEmision) {
                const disponibles = stockMap.get(fecha) ?? 100;
                if (disponibles < anunciosPorDiaRequeridos) {
                    throw new Error(`Stock insuficiente para el día ${fecha}. Disponibles: ${disponibles}, Requeridos: ${anunciosPorDiaRequeridos}.`);
                }
            }
            const updateStockPromises = fechasDeEmision.map(fecha => {
                const sql = `INSERT INTO anuncios_stock (fecha, anuncios_disponibles) VALUES (?, GREATEST(0, 100 - ?)) ON DUPLICATE KEY UPDATE anuncios_disponibles = GREATEST(0, anuncios_disponibles - ?);`;
                return connection.query(sql, [fecha, anunciosPorDiaRequeridos, anunciosPorDiaRequeridos]);
            });
            await Promise.all(updateStockPromises);
        }
        const hoy = new Date().toISOString().slice(0, 10);
        const estadoContrato = (fecha_inicio <= hoy) ? 'Activo' : 'Programado';
        const queryContrato = `INSERT INTO contratos_publicitarios (cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio, estado, precio_base, descuento, dias_emision, anuncios_por_dia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [resultContrato] = await connection.query(queryContrato, [final_cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio || '', estadoContrato, precio_base || null, parseFloat(descuento) || 0, JSON.stringify(dias_emision || []), anunciosPorDiaRequeridos]);
        const nuevoContratoId = resultContrato.insertId;
        await connection.query('INSERT INTO locutor_tareas (contrato_id, estado) VALUES (?, "Pendiente")', [nuevoContratoId]);
        pdfInfo = await generarPDFContrato(nuevoContratoId, connection, req, { cliente_id: final_cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio, precio_base, descuento, dias_emision });
        await connection.query('UPDATE contratos_publicitarios SET pdf_url = ? WHERE id = ?', [pdfInfo.pdfUrl, nuevoContratoId]);
        await connection.commit();
        console.log(`Transacción completada para contrato ${nuevoContratoId}`);
        const datosComunesEmail = {
             nombre_cliente: nombreClienteFinal, nombre_campana, nombre_plan: nombrePlanFinal,
             dias_emision: (Array.isArray(dias_emision) ? dias_emision.map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ') : 'No especificados'),
             monto: parseFloat(monto_acordado).toFixed(2),
             fecha_inicio: new Date(inicioDate).toLocaleDateString('es-PE'),
             fecha_fin: new Date(finDate).toLocaleDateString('es-PE'),
             pdfUrl: pdfInfo.pdfUrl,
             current_year: new Date().getFullYear(),
             panel_cliente_url: process.env.FRONTEND_CLIENT_URL || `${req.protocol}://${req.get('host')}/cliente/dashboard`,
             panel_admin_url: process.env.FRONTEND_ADMIN_URL || `${req.protocol}://${req.get('host')}/contratos`
        };
        const templateCliente = isNewUser ? 'bienvenida_nuevo_cliente' : 'nuevo_contrato';
        const asuntoCliente = isNewUser ? `¡Bienvenido a Metrópoli Radio, ${nombreClienteFinal}!` : `Nuevo Contrato: ${nombre_campana}`;
        const htmlCliente = await procesarPlantilla(templateCliente, { ...datosComunesEmail, passwordTemporal: passwordTemporal || 'N/A' });
        await sendEmail({ to: emailClienteFinal, subject: asuntoCliente, htmlContent: htmlCliente, attachments: [{ filename: pdfInfo.pdfName, path: pdfInfo.pdfPath }] });
        console.log(`Correo enviado a cliente: ${emailClienteFinal}`);
        const [[adminConfig]] = await db.query("SELECT valor_config FROM configuracion_correo WHERE clave_config = 'admin_email_notificaciones'");
        if (adminConfig?.valor_config) {
            const htmlAdmin = await procesarPlantilla('admin_nuevo_contrato', { ...datosComunesEmail, email_cliente: emailClienteFinal });
            await sendEmail({ to: adminConfig.valor_config, subject: `Nuevo Contrato Creado - ${nombreClienteFinal}`, htmlContent: htmlAdmin, attachments: [{ filename: `COPIA-${pdfInfo.pdfName}`, path: pdfInfo.pdfPath }] });
            console.log(`Correo de notificación enviado a admin: ${adminConfig.valor_config}`);
        }
        res.status(201).json({ message: "Contrato creado, rol de usuario actualizado y correos enviados.", pdfUrl: pdfInfo.pdfUrl });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Error en la creación del contrato:", err);
        if (err.message.includes('Ya existe un usuario')) return res.status(409).json({ error: err.message });
        if (err.message.includes('Stock insuficiente')) return res.status(409).json({ error: err.message });
        return res.status(500).json({ error: `Error interno del servidor: ${err.message || 'Error desconocido'}` });
    } finally {
        if (connection) connection.release();
    }
});

router.get("/", async (req, res) => {
    try {
        const query = `
            SELECT 
                c.*, 
                u.nombre AS nombre_cliente, 
                u.numero_documento, 
                p.nombre AS nombre_plan,
                lt.estado AS estado_locutor
            FROM contratos_publicitarios c 
            JOIN usuarios u ON c.cliente_id = u.id 
            JOIN planes p ON c.plan_id = p.id
            LEFT JOIN locutor_tareas lt ON c.id = lt.contrato_id
            ORDER BY c.fecha_creacion DESC
        `;
        const [contratos] = await db.query(query);
        const contratosFormateados = contratos.map(c => {
            try {
                const dias = (typeof c.dias_emision === 'string' && c.dias_emision.startsWith('[')) ? JSON.parse(c.dias_emision) : [];
                return { ...c, dias_emision: dias };
            } catch (parseError) {
                return { ...c, dias_emision: [] };
            }
        });
        res.json(contratosFormateados);
    } catch (err) {
        console.error("Error al obtener los contratos:", err);
        res.status(500).json({ error: "Error interno al obtener los contratos." });
    }
});

router.get("/:id", async (req, res) => {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: "ID de contrato inválido." });
    try {
        const query = `SELECT c.*, u.nombre AS nombre_cliente, u.numero_documento, u.correo AS correo_cliente, p.nombre AS nombre_plan FROM contratos_publicitarios c JOIN usuarios u ON c.cliente_id = u.id JOIN planes p ON c.plan_id = p.id WHERE c.id = ?`;
        const [contratos] = await db.query(query, [id]);
        if (contratos.length === 0) {
            return res.status(404).json({ error: "Contrato no encontrado." });
        }
        const contrato = contratos[0];
        try {
            const dias = (typeof contrato.dias_emision === 'string' && contrato.dias_emision.startsWith('[')) ? JSON.parse(contrato.dias_emision) : [];
            res.json({ ...contrato, dias_emision: dias });
        } catch (parseError) {
             res.json({ ...contrato, dias_emision: [] });
        }
    } catch (err) {
        console.error(`Error al obtener el contrato ${id}:`, err);
        res.status(500).json({ error: "Error interno al obtener el contrato." });
    }
});

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const {
        cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin,
        monto_acordado, detalles_anuncio, dias_emision, descuento, precio_base
    } = req.body;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [[contratoAntiguo]] = await connection.query('SELECT pdf_url FROM contratos_publicitarios WHERE id = ? FOR UPDATE', [id]);
        if (!contratoAntiguo) {
            throw new Error("Contrato no encontrado para actualizar.");
        }

        const queryUpdate = `
            UPDATE contratos_publicitarios SET
                cliente_id = ?, plan_id = ?, nombre_campana = ?, fecha_inicio = ?,
                fecha_fin = ?, monto_acordado = ?, detalles_anuncio = ?,
                dias_emision = ?, precio_base = ?, descuento = ?
            WHERE id = ?
        `;
        await connection.query(queryUpdate, [
            cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin,
            monto_acordado, detalles_anuncio, JSON.stringify(dias_emision || []),
            precio_base, descuento, id
        ]);

        const { pdfUrl } = await generarPDFContrato(id, connection, req, {
            cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin,
            monto_acordado, detalles_anuncio, precio_base, descuento, dias_emision
        });

        await connection.query('UPDATE contratos_publicitarios SET pdf_url = ? WHERE id = ?', [pdfUrl, id]);

        if (contratoAntiguo.pdf_url) {
            try {
                const nombrePdfAntiguo = path.basename(new URL(contratoAntiguo.pdf_url).pathname);
                const rutaPdfAntiguo = path.join(__dirname, '..', 'Uploads', 'contratos', nombrePdfAntiguo);
                await fs.unlink(rutaPdfAntiguo);
                console.log(`PDF antiguo eliminado: ${nombrePdfAntiguo}`);
            } catch (err) {
                console.warn("No se pudo eliminar el PDF antiguo:", err.message);
            }
        }
        
        await connection.commit();
        res.json({ message: "Contrato actualizado y nuevo PDF generado exitosamente." });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error(`Error al actualizar contrato ${id}:`, err);
        res.status(500).json({ error: `Error interno del servidor: ${err.message}` });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;