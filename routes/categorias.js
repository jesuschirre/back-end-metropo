// routes/categorias.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// Obtener todas las categorías (solo lo importante: id y nombre)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, nombre FROM categorias");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener las categorías" });
  }
})

module.exports = router;