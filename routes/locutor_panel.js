const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, isLocutor, isLocutorOrAdmin, isAdmin } = require('../middleware/authMiddleware');

router.get('/tareas', [verifyToken, isLocutorOrAdmin], async (req, res) => {
    try {
        const query = `
            SELECT 
                lt.id as tarea_id, 
                lt.estado, 
                c.*,
                u.nombre as nombre_cliente
            FROM locutor_tareas lt
            JOIN contratos_publicitarios c ON lt.contrato_id = c.id
            JOIN usuarios u ON c.cliente_id = u.id
            WHERE lt.estado = 'Pendiente' 
            ORDER BY c.fecha_inicio ASC;
        `;
        const [tareas] = await db.query(query);
        const tareasFormateadas = tareas.map(t => ({...t, dias_emision: JSON.parse(t.dias_emision || '[]')}));
        res.json(tareasFormateadas);
    } catch (err) {
        console.error("Error al obtener tareas pendientes:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

router.get('/tareas/aceptadas', [verifyToken, isLocutor], async (req, res) => {
    try {
        const locutorId = req.user.id;
        const query = `
            SELECT 
                lt.id as tarea_id, 
                lt.estado, 
                c.*,
                u.nombre as nombre_cliente
            FROM locutor_tareas lt
            JOIN contratos_publicitarios c ON lt.contrato_id = c.id
            JOIN usuarios u ON c.cliente_id = u.id
            WHERE lt.estado = 'Aceptada' AND lt.locutor_id = ? AND c.fecha_fin >= CURDATE()
            ORDER BY lt.fecha_actualizacion DESC;
        `;
        const [tareas] = await db.query(query, [locutorId]);
        const tareasFormateadas = tareas.map(t => ({...t, dias_emision: JSON.parse(t.dias_emision || '[]')}));
        res.json(tareasFormateadas);
    } catch (err) {
        console.error("Error al obtener tareas aceptadas del locutor:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

router.get('/tareas/aceptadas-admin', [verifyToken, isAdmin], async (req, res) => {
    try {
        const query = `
            SELECT 
                lt.id as tarea_id, 
                lt.estado, 
                c.*,
                u_cliente.nombre as nombre_cliente, 
                u_locutor.nombre as nombre_locutor
            FROM locutor_tareas lt
            JOIN contratos_publicitarios c ON lt.contrato_id = c.id
            JOIN usuarios u_cliente ON c.cliente_id = u_cliente.id
            LEFT JOIN usuarios u_locutor ON lt.locutor_id = u_locutor.id
            WHERE lt.estado = 'Aceptada' AND c.fecha_fin >= CURDATE()
            ORDER BY lt.fecha_actualizacion DESC;
        `;
        const [tareas] = await db.query(query);
        const tareasFormateadas = tareas.map(t => ({...t, dias_emision: JSON.parse(t.dias_emision || '[]')}));
        res.json(tareasFormateadas);
    } catch (err) {
        console.error("Error al obtener el historial de administrador:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

router.put('/tareas/:id/aceptar', [verifyToken, isLocutorOrAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const locutorIdParaGuardar = user.rol === 'locutor' ? user.id : null;
        const query = `UPDATE locutor_tareas SET estado = 'Aceptada', locutor_id = ? WHERE id = ? AND estado = 'Pendiente'`;
        const [result] = await db.query(query, [locutorIdParaGuardar, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "La tarea no se encontró o ya fue gestionada." });
        }
        res.json({ message: "Tarea aceptada correctamente." });
    } catch (err) {
        console.error("Error al aceptar la tarea:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

router.get('/tareas/vencidas', [verifyToken, isLocutor], async (req, res) => {
    try {
        const query = `
            SELECT 
                lt.id as tarea_id, lt.estado, c.*, 
                u.nombre as nombre_cliente,
                ul.nombre as nombre_locutor
            FROM locutor_tareas lt
            JOIN contratos_publicitarios c ON lt.contrato_id = c.id
            JOIN usuarios u ON c.cliente_id = u.id
            LEFT JOIN usuarios ul ON lt.locutor_id = ul.id
            WHERE lt.estado = 'Aceptada' AND c.fecha_fin < CURDATE()
            ORDER BY c.fecha_fin DESC;
        `;
        const [tareas] = await db.query(query);
        const tareasFormateadas = tareas.map(t => ({...t, dias_emision: JSON.parse(t.dias_emision || '[]')}));
        res.json(tareasFormateadas);
    } catch (err) {
        console.error("Error al obtener tareas vencidas del locutor:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

router.get('/tareas/vencidas-admin', [verifyToken, isAdmin], async (req, res) => {
    try {
        const query = `
            SELECT 
                lt.id as tarea_id, lt.estado, c.*, 
                u_cliente.nombre as nombre_cliente, 
                u_locutor.nombre as nombre_locutor
            FROM locutor_tareas lt
            JOIN contratos_publicitarios c ON lt.contrato_id = c.id
            JOIN usuarios u_cliente ON c.cliente_id = u_cliente.id
            LEFT JOIN usuarios u_locutor ON lt.locutor_id = u_locutor.id
            WHERE lt.estado = 'Aceptada' AND c.fecha_fin < CURDATE()
            ORDER BY c.fecha_fin DESC;
        `;
        const [tareas] = await db.query(query);
        const tareasFormateadas = tareas.map(t => ({...t, dias_emision: JSON.parse(t.dias_emision || '[]')}));
        res.json(tareasFormateadas);
    } catch (err) {
        console.error("Error al obtener tareas vencidas para admin:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

router.get('/tareas/retiradas', [verifyToken, isLocutor], async (req, res) => {
    try {
        const locutorId = req.user.id;
        const query = `
            SELECT 
                lt.id as tarea_id, lt.estado, c.*, u.nombre as nombre_cliente
            FROM locutor_tareas lt
            JOIN contratos_publicitarios c ON lt.contrato_id = c.id
            JOIN usuarios u ON c.cliente_id = u.id
            WHERE lt.estado = 'Retirada' AND lt.locutor_id = ?
            ORDER BY lt.fecha_actualizacion DESC;
        `;
        const [tareas] = await db.query(query, [locutorId]);
        const tareasFormateadas = tareas.map(t => ({...t, dias_emision: JSON.parse(t.dias_emision || '[]')}));
        res.json(tareasFormateadas);
    } catch (err) {
        console.error("Error al obtener tareas retiradas del locutor:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

router.get('/tareas/retiradas-admin', [verifyToken, isAdmin], async (req, res) => {
    try {
        const query = `
            SELECT 
                lt.id as tarea_id, lt.estado, c.*, 
                u_cliente.nombre as nombre_cliente, 
                u_locutor.nombre as nombre_locutor
            FROM locutor_tareas lt
            JOIN contratos_publicitarios c ON lt.contrato_id = c.id
            JOIN usuarios u_cliente ON c.cliente_id = u_cliente.id
            LEFT JOIN usuarios u_locutor ON lt.locutor_id = u_locutor.id
            WHERE lt.estado = 'Retirada'
            ORDER BY lt.fecha_actualizacion DESC;
        `;
        const [tareas] = await db.query(query);
        const tareasFormateadas = tareas.map(t => ({...t, dias_emision: JSON.parse(t.dias_emision || '[]')}));
        res.json(tareasFormateadas);
    } catch (err) {
        console.error("Error al obtener tareas retiradas para admin:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

router.put('/tareas/:id/retirar', [verifyToken, isLocutorOrAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        let query;
        let queryParams;

        if (user.rol === 'locutor') {
            query = `
                UPDATE locutor_tareas lt
                JOIN contratos_publicitarios c ON lt.contrato_id = c.id
                SET lt.estado = 'Retirada'
                WHERE lt.id = ? 
                  AND lt.estado = 'Aceptada'
                  AND c.fecha_fin < CURDATE();
            `;
            queryParams = [id];
        } else if (user.rol === 'admin') {
            query = `
                UPDATE locutor_tareas lt
                JOIN contratos_publicitarios c ON lt.contrato_id = c.id
                SET lt.estado = 'Retirada'
                WHERE lt.id = ? 
                  AND lt.estado = 'Aceptada'
                  AND c.fecha_fin < CURDATE();
            `;
            queryParams = [id];
        } else {
             return res.status(403).json({ error: "No tienes permisos para esta acción." });
        }
        
        const [result] = await db.query(query, queryParams);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "La tarea no se encontró, no está aceptada, o aún no ha vencido." });
        }
        res.json({ message: "Tarea retirada (archivada) correctamente." });
    } catch (err) {
        console.error("Error al retirar la tarea:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;