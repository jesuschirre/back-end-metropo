// routes/vendedor.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// Obtener un vendedor por ID dinámico
// Obtener un vendedor usando el usuario_id
router.get('/vendedor/usuario/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT * FROM vendedores WHERE usuario_id = ?',
      [usuario_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Vendedor no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el vendedor' });
  }
});

// Editar datos de un vendedor usando el ID del usuario
router.put('/vendedor/:vendedor_id', async (req, res) => {
  const { vendedor_id } = req.params;
  const { nombre_tienda, descripcion, telefono, logo, banner } = req.body;
  try {
      const [result] = await db.query(
      `UPDATE vendedores 
      SET nombre_tienda = ?, descripcion = ?, telefono = ?, logo = ?, banner = ?
      WHERE id = ?`,
      [nombre_tienda, descripcion, telefono, logo, banner, vendedor_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vendedor no encontrado para este usuario' });
    }

    res.json({ message: 'Datos del vendedor actualizados correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el vendedor' });
  }
});

router.get("/banners", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT banner FROM vendedores WHERE banner IS NOT NULL AND banner != '' ORDER BY RAND() LIMIT 3"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener banners" });
  }
});

router.get("/clientes", async (req, res) =>{
  try {
    const [rows] = await db.query("SELECT id, usuario_id FROM cliente ");
    res.json(rows)
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener los clientes" });
  }
})

module.exports = router;