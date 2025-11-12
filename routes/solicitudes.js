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
const { generarPDFContrato } = require ('../middleware/generaraPDF')

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


// RUTA AL ACEPTAR EL CONTRATO
router.post("/solicitudes-vendedor/aceptar", [verifyToken, isAdmin], async (req, res) => {
  try {
    const { solicitud_id } = req.body;
    if (!solicitud_id) return res.status(400).json({ message: "Falta el ID de la solicitud" });

    // Obtener solicitud
    const [rows] = await db.query("SELECT * FROM solicitudes_cliente WHERE id = ?", [solicitud_id]);
    if (rows.length === 0) return res.status(404).json({ message: "No se encontró la solicitud" });

    const solicitud = rows[0];
    const usuario_id = solicitud.usuario_id;

    // Obtener contrato asociado
    const [idcontrato] = await db.query(
      `SELECT idContrato FROM solicitudes_cliente WHERE id = ? LIMIT 1`, [solicitud_id]
    );

    if (idcontrato.length === 0 || !idcontrato[0].idContrato) {
      return res.status(404).json({ message: "No se encontró ningún contrato asociado a esta solicitud" });
    }

    const contratoId = idcontrato[0].idContrato;

    // Obtener datos del contrato
    const [contratos] = await db.query(
      `SELECT cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado,
              detalles_anuncio, precio_base, descuento, dias_emision
       FROM contratos_publicitarios WHERE id = ?`, 
      [contratoId]
    );

    if (contratos.length === 0) {
      return res.status(404).json({ message: "No se encontró el contrato de publicidad asociado." });
    }

    const contratoExistente = contratos[0];

    const datosContratoPDF = {
      cliente_id: usuario_id,
      plan_id: contratoExistente.plan_id,
      nombre_campana: contratoExistente.nombre_campana,
      fecha_inicio: contratoExistente.fecha_inicio,
      fecha_fin: contratoExistente.fecha_fin,
      monto_acordado: contratoExistente.monto_acordado,
      detalles_anuncio: contratoExistente.detalles_anuncio,
      precio_base: contratoExistente.precio_base,
      descuento: contratoExistente.descuento,
      dias_emision: contratoExistente.dias_emision
    };

    // Generar PDF
    const { pdfUrl } = await generarPDFContrato(contratoId, db, req, datosContratoPDF);

    // Actualizar contrato con URL del PDF
    await db.query("UPDATE contratos_publicitarios SET pdf_url = ? WHERE id = ?", [pdfUrl, contratoId]);
    
    // actualizar estado del contrato a Programado
    await db.query("UPDATE contratos_publicitarios SET estado = 'Programado' WHERE id = ?", [contratoId])

    // Cambiar estados
    await db.query("UPDATE solicitudes_cliente SET estado = 'aprobado' WHERE id = ?", [solicitud_id]);
    await db.query("UPDATE usuarios SET rol = 'cliente' WHERE id = ?", [usuario_id]);

    res.json({
      message: "Solicitud aceptada y PDF generado correctamente.",
      pdf_url: pdfUrl
    });

  } catch (err) {
    console.error('Error al aceptar la solicitud y actualizar el contrato:', err);
    res.status(500).json({ message: "Error al aceptar la solicitud y actualizar el contrato", error: err.message });
  }
});

router.post("/solicitudes-vendedor/rechazar", [verifyToken, isAdmin], async (req, res) => {
    try {
        const { solicitud_id, motivo } = req.body;

        if (!solicitud_id || !motivo) {
            return res.status(400).json({ message: "Falta el ID de la solicitud o el motivo del rechazo." });
        }

        // 1️⃣ Obtener la solicitud antes de eliminarla
        const [rows] = await db.query("SELECT * FROM solicitudes_cliente WHERE id = ?", [solicitud_id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "No se encontró la solicitud." });
        }

        const solicitud = rows[0];
        const usuario_id = solicitud.usuario_id;
        const contratoId = solicitud.idContrato; // Ya lo tenemos aquí antes de borrar

        // 2️⃣ Obtener los datos del usuario
        const [[usuario]] = await db.query("SELECT nombre, correo FROM usuarios WHERE id = ?", [usuario_id]);
        if (!usuario) {
            return res.status(404).json({ message: "El usuario asociado no fue encontrado." });
        }

        // 3️⃣ Eliminar la solicitud
        await db.query("DELETE FROM solicitudes_cliente WHERE id = ?", [solicitud_id]);

        // 4️⃣ Eliminar el contrato asociado si existe
        if (contratoId) {
            await db.query("DELETE FROM contratos_publicitarios WHERE id = ?", [contratoId]);
        }

        // 5️⃣ Enviar correo de notificación
        try {
            const templatePath = path.join(__dirname, '..', 'templates', 'applicationRejected.html');
            let htmlContent = fs.readFileSync(templatePath, 'utf8');
            htmlContent = htmlContent
                .replace('{{nombre}}', usuario.nombre)
                .replace('{{motivo}}', motivo);

            await sendEmail({
                to: usuario.correo,
                subject: 'Actualización sobre tu solicitud de vendedor',
                htmlContent
            });
        } catch (emailError) {
            console.error("Solicitud rechazada, pero el correo de notificación falló:", emailError);
        }

        // 6️⃣ Respuesta final
        res.json({
            message: `Solicitud rechazada. Se ha notificado a ${usuario.nombre} con el motivo proporcionado.`
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al rechazar la solicitud." });
    }
});


module.exports = router;