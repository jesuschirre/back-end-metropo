const express = require("express");
const router = express.Router();
const db = require("../db");
const fs = require("fs");
const path = require("path");
const { sendEmail } = require('../utils/mailer');
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

router.post("/solicitudes-vendedor/aceptar", [verifyToken, isAdmin], async (req, res) => {
    // ... (CÓDIGO ORIGINAL SIN CAMBIOS)
    try {
        const { solicitud_id } = req.body;
        if (!solicitud_id) return res.status(400).json({ message: "Falta el ID de la solicitud" });
        const [rows] = await db.query("SELECT * FROM solicitudes_cliente WHERE id = ?", [solicitud_id]);
        if (rows.length === 0) return res.status(404).json({ message: "No se encontró la solicitud" });
        const usuario_id = rows[0].usuario_id;
        const [[usuario]] = await db.query('SELECT nombre, correo FROM usuarios WHERE id = ?', [usuario_id]);
        if (!usuario) return res.status(404).json({ message: "El usuario asociado no fue encontrado." });
        await db.query("UPDATE solicitudes_cliente SET estado = 'aprobado' WHERE id = ?", [solicitud_id]);
        await db.query("UPDATE usuarios SET rol = 'cliente' WHERE id = ?", [usuario_id]);
        await db.query("INSERT INTO cliente (usuario_id) VALUES (?)", [usuario_id])
        try {
            const templatePath = path.join(__dirname, '..', 'templates', 'applicationApproved.html');
            let htmlContent = fs.readFileSync(templatePath, 'utf8').replace('{{nombre}}', usuario.nombre);
            sendEmail({ to: usuario.correo, subject: '¡Tu solicitud de vendedor ha sido aprobada!', htmlContent: htmlContent });
        } catch (emailError) {
            console.error("Solicitud aprobada, pero el correo de notificación falló:", emailError);
        }
        res.json({ message: `Solicitud aceptada. Se ha notificado a ${usuario.nombre} por correo.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al aceptar la solicitud" });
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