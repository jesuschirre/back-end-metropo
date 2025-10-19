// routes/vendedor.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// Obtener un vendedor por ID dinámico
// Obtener un vendedor usando el usuario_id
router.get('/usuario/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT * FROM cliente WHERE usuario_id = ?',
      [usuario_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(rows[0]);
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el Cliente' });
  }
});

  // Editar datos de un cliente usando el ID del usuario
  router.put('/:cliente_id', async (req, res) => {
    const { cliente_id } = req.params;
    const { notas, direccion, telefono, correo, estado, nombre, apellido } = req.body;

    try {
      const [result] = await db.query(
        `UPDATE cliente 
        SET notas = ?, direccion = ?, telefono = ?, correo = ?, estado = ?, nombre = ?, apellido = ?
        WHERE id = ?`,
        [notas, direccion, telefono, correo, estado, nombre, apellido, cliente_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Cliente no encontrado para este id' });
      }

      res.json({ message: 'Datos del cliente actualizados correctamente' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al actualizar el cliente' });
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