const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Protegemos todas las rutas de este archivo, solo los admins pueden gestionar planes.
router.use(verifyToken, isAdmin);

// GET /api/planes_admin - Obtener todos los planes
router.get("/", async (req, res) => {
    try {
        const [planes] = await db.query("SELECT * FROM planes ORDER BY precio ASC");
        // Convertimos el string JSON de características a un array real
        const planesConCaracteristicas = planes.map(plan => ({
            ...plan,
            caracteristicas: JSON.parse(plan.caracteristicas || '[]')
        }));
        res.json(planesConCaracteristicas);
    } catch (err) {
        console.error("Error al obtener los planes:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// POST /api/planes_admin - Crear un nuevo plan
router.post("/", async (req, res) => {
    try {
        const { nombre, precio, periodo, caracteristicas, destacado, deshabilitado, url_contratacion } = req.body;
        
        if (!nombre || !precio || !caracteristicas) {
            return res.status(400).json({ error: "Nombre, precio y características son obligatorios." });
        }
        
        // Convertimos el array de características a un string JSON para guardarlo en la BD
        const caracteristicasJSON = JSON.stringify(caracteristicas);
        
        const query = `INSERT INTO planes (nombre, precio, periodo, caracteristicas, destacado, deshabilitado, url_contratacion) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.query(query, [nombre, precio, periodo || '/mes', caracteristicasJSON, destacado || 0, deshabilitado || 0, url_contratacion]);
        
        res.status(201).json({ message: "Plan creado exitosamente.", id: result.insertId });
    } catch (err) {
        console.error("Error al crear el plan:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// PUT /api/planes_admin/:id - Actualizar un plan existente
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, precio, periodo, caracteristicas, destacado, deshabilitado, url_contratacion } = req.body;

        if (!nombre || !precio || !caracteristicas) {
            return res.status(400).json({ error: "Nombre, precio y características son obligatorios." });
        }

        const caracteristicasJSON = JSON.stringify(caracteristicas);

        const query = `UPDATE planes SET nombre = ?, precio = ?, periodo = ?, caracteristicas = ?, destacado = ?, deshabilitado = ?, url_contratacion = ? WHERE id = ?`;
        const [result] = await db.query(query, [nombre, precio, periodo, caracteristicasJSON, destacado, deshabilitado, url_contratacion, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Plan no encontrado." });
        }

        res.json({ message: "Plan actualizado exitosamente." });
    } catch (err) {
        console.error("Error al actualizar el plan:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// DELETE /api/planes_admin/:id - Borrar un plan
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const query = "DELETE FROM planes WHERE id = ?";
        const [result] = await db.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Plan no encontrado." });
        }

        res.json({ message: "Plan eliminado exitosamente." });
    } catch (err) {
        console.error("Error al eliminar el plan:", err);
        // Manejar error de clave foránea si un contrato usa este plan
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: "No se puede eliminar este plan porque está siendo usado por uno o más contratos." });
        }
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;