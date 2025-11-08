const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, isAdmin);

router.get("/", async (req, res) => {
    try {
        const [planes] = await db.query("SELECT * FROM planes ORDER BY precio ASC");
        
        // --- LOG DE DIAGNÓSTICO 1 ---
        // Esto nos dirá si la consulta a la base de datos trae algo.
        console.log("BACKEND: Planes obtenidos de la BD:", planes);
        // --- FIN DEL LOG ---

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

// El resto de las rutas (POST, PUT, DELETE) no necesitan cambios
router.post("/", async (req, res) => {
    try {
        const { nombre, precio, periodo, caracteristicas, destacado, deshabilitado, url_contratacion } = req.body;
        if (!nombre || !precio || !caracteristicas) {
            return res.status(400).json({ error: "Nombre, precio y características son obligatorios." });
        }
        const caracteristicasJSON = JSON.stringify(caracteristicas);
        const query = `INSERT INTO planes (nombre, precio, periodo, caracteristicas, destacado, deshabilitado, url_contratacion) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.query(query, [nombre, precio, periodo || '/mes', caracteristicasJSON, destacado || 0, deshabilitado || 0, url_contratacion]);
        res.status(201).json({ message: "Plan creado exitosamente.", id: result.insertId });
    } catch (err) {
        console.error("Error al crear el plan:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

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
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: "No se puede eliminar este plan porque está siendo usado por uno o más contratos." });
        }
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;