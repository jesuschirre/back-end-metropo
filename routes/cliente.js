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

  

router.get("/clientes", async (req, res) => {
  try {
    // Consulta SQL con JOIN y Alias (AS):
    const [rows] = await db.query(`
      SELECT 
        c.*, 
        u.nombre AS nombre_usuario  
      FROM cliente c
      INNER JOIN usuarios u ON c.usuario_id = u.id
    `);
    
    res.json(rows);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener los clientes y sus nombres" });
  }
});

router.delete("/eliminar/:id", async (req, res) => {
  const { id } = req.params; // ID del cliente (de la tabla 'cliente')

  try {
    // 1. OBTENER el usuario_id (con desestructuración correcta)
    const [rows] = await db.query(
      'SELECT usuario_id FROM cliente WHERE id = ?',
      [id]
    );

    // 2. VALIDACIÓN: Si no hay cliente con ese ID, devolver 404
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    const usuario_id_a_eliminar = rows[0].usuario_id;
    
    // ELIMINAR registros dependientes (por el usuario_id)
    await db.query (
      'DELETE FROM contratos_publicidad WHERE id_anunciante = ?',
      [usuario_id_a_eliminar]
    );

    // Actualiza el rol en la tabla usuarios a "usuario"
    await db.query("UPDATE usuarios SET rol = 'usuario' WHERE id = ?", [usuario_id_a_eliminar]);
    
    await db.query(
      'DELETE FROM solicitudes_cliente WHERE usuario_id = ?',
      [usuario_id_a_eliminar]
    );
    
    // 4. ELIMINAR el registro principal de 'cliente' (por el id de cliente)
    await db.query(
        'DELETE FROM cliente WHERE id = ?',
        [id]
    );
    // 5. RESPUESTA EXITOSA (204 No Content es estándar para DELETE)
    res.status(204).send();

  } catch (error) {
    // 6. MANEJO DE ERRORES: Imprimir error y responder 500
    console.error("Error al ejecutar la eliminación en cascada:", error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar el cliente.' });
  }
});


// 🧮 Ruta para obtener estadísticas generales
router.get("/dash", async (req, res) => {
  try {
    // ✅ 1. Consultar total de usuarios
    const [usuarios] = await db.query(
      "SELECT COUNT(*) AS total_usuarios FROM usuarios"
    );

    // ✅ 2. Consultar total de clientes
    const [clientes] = await db.query(
      "SELECT COUNT(*) AS total_clientes FROM cliente"
    );

    // ✅ 3. Obtener los valores individuales
    const totalUsuarios = usuarios[0].total_usuarios;
    const totalClientes = clientes[0].total_clientes;

    // ✅ 4. Enviar respuesta al cliente
    res.json({
      mensaje: " Datos obtenidos correctamente",
      total_usuarios: totalUsuarios,
      total_clientes: totalClientes,
    });
  } catch (error) {
    console.error("❌ Error al obtener número de registros:", error);
    res
      .status(500)
      .json({ error: "Error al obtener número de registros", detalle: error.message });
  }
});

module.exports = router;