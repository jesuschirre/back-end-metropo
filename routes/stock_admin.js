const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/stock_admin/disponibilidad
 * @desc    Consulta la disponibilidad de anuncios para un rango de fechas.
 * @access  Private (Admin Only)
 * @query   ?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
 */
router.get('/disponibilidad', verifyToken, isAdmin, async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: 'Se requieren fecha_inicio y fecha_fin.' });
    }

    try {
        const connection = await db.getConnection();
        const [stock] = await connection.query(
            `SELECT fecha, anuncios_disponibles FROM anuncios_stock WHERE fecha BETWEEN ? AND ? ORDER BY fecha ASC`,
            [fecha_inicio, fecha_fin]
        );
        connection.release();
        
        res.json(stock);
    } catch (err) {
        console.error("Error al consultar disponibilidad de stock:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;