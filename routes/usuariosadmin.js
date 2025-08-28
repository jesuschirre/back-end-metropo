// back-end-metropo/routes/usuariosadmin.js

const express = require("express");
const router = express.Router();
const db = require("../db");

// Middleware de seguridad (muy recomendado para rutas de admin)
// const { verificarToken, verificarAdmin } = require('../middleware/auth');
// Para usarlo, añadirías verificarToken y verificarAdmin antes de async (req, res)

// GET: Obtener la lista completa de usuarios
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nombre, correo, rol FROM usuarios ORDER BY id ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener la lista de usuarios para admin:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT: Actualizar un usuario por su ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol } = req.body;

  // Validación simple de entrada
  if (!nombre || !correo || !rol) {
    return res.status(400).json({ error: "Faltan datos requeridos (nombre, correo, rol)." });
  }

  try {
    const [result] = await db.query(
      "UPDATE usuarios SET nombre = ?, correo = ?, rol = ? WHERE id = ?",
      [nombre, correo, rol, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    
    res.json({ message: "Usuario actualizado correctamente." });

  } catch (err) {
    // Manejar error de correo duplicado
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'El correo electrónico ya está en uso por otro usuario.' });
    }
    console.error(`Error al actualizar usuario con ID ${id}:`, err);
    res.status(500).json({ error: "Error interno del servidor al actualizar." });
  }
});

// DELETE: Eliminar un usuario por su ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      "DELETE FROM usuarios WHERE id = ?", 
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    res.json({ message: "Usuario eliminado correctamente." });

  } catch (err) {
    console.error(`Error al eliminar usuario con ID ${id}:`, err);
    res.status(500).json({ error: "Error interno del servidor al eliminar." });
  }
});

module.exports = router;