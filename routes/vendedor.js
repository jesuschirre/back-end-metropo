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
  const { nombre_tienda, descripcion, telefono, logo } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE vendedores 
       SET nombre_tienda = ?, descripcion = ?, telefono = ?, logo = ?
       WHERE id = ?`,
      [nombre_tienda, descripcion, telefono, logo, vendedor_id]
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


module.exports = router;