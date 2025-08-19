const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/planes - Obtiene todos los planes de precios
router.get('/', async (req, res) => {
  try {
    const [planes] = await db.query('SELECT * FROM planes ORDER BY precio ASC');
    
    // El campo 'caracteristicas' se guarda como string JSON, lo parseamos.
    // (Nota: algunas librerías de DB lo hacen automáticamente)
    const planesFormateados = planes.map(plan => ({
      ...plan,
      caracteristicas: JSON.parse(plan.caracteristicas)
    }));

    res.json(planesFormateados);
  } catch (err) {
    console.error("Error al obtener los planes:", err);
    res.status(500).json({ error: 'Error interno del servidor al obtener los planes.' });
  }
});

module.exports = router;