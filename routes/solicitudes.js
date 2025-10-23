const express = require("express");
const router = express.Router();
const db = require("../db");
const fs = require("fs");
const path = require("path");
const { sendEmail } = require('../utils/mailer');
const PDFDocument = require('pdfkit');
const fss = require('fs').promises; // Usamos la versión de promesas de fs


// <-- ¡NUEVO! IMPORTAMOS LOS GUARDIANES
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// --- RUTAS PROTEGIDAS (CON GUARDIANES) ---
router.get("/solicitudes-vendedor", [verifyToken, isAdmin], async (req, res) => {
    // ... (CÓDIGO ORIGINAL SIN CAMBIOS)
    try {
        const [solicitudes] = await db.query(`SELECT s.id, s.usuario_id, u.nombre, u.correo, s.estado, s.fecha_solicitud, s.metodo_pago, s.monto, s.referencia_pago, s.comprobante_pago FROM solicitudes_cliente s INNER JOIN usuarios u ON s.usuario_id = u.id ORDER BY s.fecha_solicitud DESC`);
        res.json(solicitudes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al obtener las solicitudes" });
    }
});

// La función que ya proporcionaste para generar el PDF
async function generarPDFContrato(nuevoContratoId, connection, req, datosContrato) {
    const {
        cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin,
        monto_acordado, detalles_anuncio, precio_base, descuento, dias_emision
    } = datosContrato;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfName = `contrato-${nuevoContratoId}-${Date.now()}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'Uploads', 'contratos'); // Ruta corregida para 'uploads'
    await fss.mkdir(pdfDir, { recursive: true }); // Asegura que la carpeta exista
    const pdfPath = path.join(pdfDir, pdfName);
    const stream = require('fs').createWriteStream(pdfPath); // Aquí se usa la versión de callback de fs
    doc.pipe(stream);

    // --- Obtener datos adicionales (Simulación si no hay DB) ---
    // Si realmente no hay DB, estos datos deben venir en 'datosContrato' o ser mocks.
    // Para este ejemplo, voy a dejar las consultas como están, asumiendo una conexión mock o real
    // si el propósito es solo TESTEAR la generación de PDF.
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
    if (await fss.access(logoPath).then(() => true).catch(() => false)) {
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

router.post("/solicitudes-vendedor/aceptar", [verifyToken, isAdmin], async (req, res) => {
    let pdfUrl = null; 

    try {
        const { solicitud_id } = req.body;
        if (!solicitud_id) return res.status(400).json({ message: "Falta el ID de la solicitud" });

        // 1. Obtener la solicitud
        const [rows] = await db.query("SELECT * FROM solicitudes_cliente WHERE id = ?", [solicitud_id]);
        if (rows.length === 0) return res.status(404).json({ message: "No se encontró la solicitud" });
        
        const solicitud = rows[0];
        const usuario_id = solicitud.usuario_id;

        const [[usuario]] = await db.query('SELECT nombre, correo FROM usuarios WHERE id = ?', [usuario_id]);
        if (!usuario) return res.status(404).json({ message: "El usuario asociado no fue encontrado." });

        // 2. OBTENER DATOS DEL CONTRATO EXISTENTE Y PREPARAR DATOS PARA EL PDF
   
        const [contratos] = await db.query(
            "SELECT id_anunciante, fecha_inicio, fecha_fin, costo_total FROM contratos_publicidad WHERE id_anunciante = ?", 
            [usuario_id]
        );

        if (contratos.length === 0) {
            return res.status(404).json({ message: "No se encontró contrato de publicidad existente para el usuario." });
        }
        
        const contratoExistente = contratos[0];
        
        // Simular datos del contrato para la función generarPDFContrato.
        // Los campos FALTANTES se rellenan con datos de la solicitud o valores por defecto.
        const datosContratoPDF = {
            cliente_id: usuario_id,
            plan_id: 1, // <--- AJUSTAR: Obtener el ID del Plan si es necesario
            nombre_campana: `Contrato ${usuario.nombre}`, 
            fecha_inicio: contratoExistente.fecha_inicio,
            fecha_fin: contratoExistente.fecha_fin,
            
            // USAMOS costo_total EN LUGAR DE monto_acordado
            monto_acordado: contratoExistente.costo_total, 
            
            // CAMPOS QUE NO EXISTEN EN 'contratos_publicidad', USAMOS VALORES POR DEFECTO/SOLICITUD:
            detalles_anuncio: "Detalles estándar del contrato (no almacenados en la DB).",
            precio_base: contratoExistente.costo_total,
            descuento: 0, 
            dias_emision: ['Lunes', 'Miércoles', 'Viernes'] 
        };

        // 3. GENERAR EL PDF y obtener la URL
        const pdfResult = await generarPDFContrato(
            usuario_id, 
            db,        
            req,       
            datosContratoPDF
        );
        pdfUrl = pdfResult.pdfUrl; // URL generada
        
        // 4. ACTUALIZAR EL REGISTRO DE CONTRATO CON LA NUEVA URL
        await db.query(
            "UPDATE contratos_publicidad SET pdf_url = ? WHERE id_anunciante = ?", 
            [pdfUrl, usuario_id]
        );

        // 5. Actualizaciones de estado y rol
        await db.query("UPDATE solicitudes_cliente SET estado = 'aprobado' WHERE id = ?", [solicitud_id]);
        await db.query("UPDATE usuarios SET rol = 'cliente' WHERE id = ?", [usuario_id]);

        // 6. Insertar cliente
        await db.query("INSERT INTO cliente (usuario_id, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, 'activo')", 
            [usuario_id, contratoExistente.fecha_inicio, contratoExistente.fecha_fin]
        );

        // 7. Envío de correo electrónico de notificación (sin cambios)
        try {
            const templatePath = path.join(__dirname, '..', 'templates', 'applicationApproved.html');
            let htmlContent = fs.readFileSync(templatePath, 'utf8').replace('{{nombre}}', usuario.nombre);
            sendEmail({ to: usuario.correo, subject: '¡Tu solicitud ha sido aprobada!', htmlContent: htmlContent });
        } catch (emailError) {
            console.error("Solicitud aprobada, pero el correo de notificación falló:", emailError);
        }

        // 8. Respuesta final
        res.json({ 
            message: `Solicitud aceptada. Contrato PDF guardado en la DB.`,
            pdf_url: pdfUrl 
        });

    } catch (err) {
        console.error('Error al aceptar la solicitud y actualizar el contrato:', err);
        res.status(500).json({ message: "Error al aceptar la solicitud y actualizar el contrato", error: err.message });
    }
});

router.post("/solicitudes-vendedor/rechazar", [verifyToken, isAdmin], async (req, res) => {
    // ... (CÓDIGO ORIGINAL SIN CAMBIOS)
    try {
        const { solicitud_id, motivo } = req.body;
        if (!solicitud_id || !motivo) return res.status(400).json({ message: "Falta el ID de la solicitud y el motivo del rechazo." });
        const [rows] = await db.query("SELECT * FROM solicitudes_cliente WHERE id = ?", [solicitud_id]);
        if (rows.length === 0) return res.status(404).json({ message: "No se encontró la solicitud" });
        const usuario_id = rows[0].usuario_id;
        const [[usuario]] = await db.query('SELECT nombre, correo FROM usuarios WHERE id = ?', [usuario_id]);
        if (!usuario) return res.status(404).json({ message: "El usuario asociado no fue encontrado." });
        await db.query("DELETE FROM solicitudes_cliente WHERE id = ?", [solicitud_id]);
        await db.query("DELETE FROM contratos_publicidad WHERE id_anunciante = ?", [usuario_id]);
        try {
            const templatePath = path.join(__dirname, '..', 'templates', 'applicationRejected.html');
            let htmlContent = fs.readFileSync(templatePath, 'utf8');
            htmlContent = htmlContent.replace('{{nombre}}', usuario.nombre).replace('{{motivo}}', motivo);
            sendEmail({ to: usuario.correo, subject: 'Actualización sobre tu solicitud de vendedor', htmlContent: htmlContent });
        } catch (emailError) {
            console.error("Solicitud rechazada, pero el correo de notificación falló:", emailError);
        }
        res.json({ message: `Solicitud rechazada. Se ha notificado a ${usuario.nombre} con el motivo proporcionado.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al rechazar la solicitud" });
    }
});

module.exports = router;