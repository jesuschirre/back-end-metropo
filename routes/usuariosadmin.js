const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require('bcrypt'); // Necesario para encriptar la nueva contraseña
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// APLICAMOS LA SEGURIDAD A TODAS LAS RUTAS DE ESTE ARCHIVO
router.use(verifyToken, isAdmin);

// -------------------------------------------
// --- RUTAS CRUD PARA GESTIÓN DE USUARIOS ---
// -------------------------------------------

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

// POST: Crear un nuevo usuario (funcionalidad añadida)
router.post('/', async (req, res) => {
    const { nombre, correo, password, rol } = req.body;
    
    if (!nombre || !correo || !password || !rol) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios: nombre, correo, contraseña y rol.' });
    }

    try {
        const [existingUser] = await db.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
        if (existingUser.length > 0) {
            return res.status(409).json({ error: 'Ya existe un usuario con este correo electrónico.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await db.query(
            'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, correo, hashedPassword, rol]
        );

        res.status(201).json({ message: 'Usuario creado exitosamente.', id: result.insertId });
    } catch (err) {
        console.error("Error al crear usuario desde el panel de admin:", err);
        res.status(500).json({ error: 'Error interno del servidor al crear el usuario.' });
    }
});


// PUT: Actualizar un usuario por su ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol } = req.body;

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
    // Medida de seguridad: No permitir eliminar al usuario con ID 1 (superadmin)
    if (parseInt(id, 10) === 1) {
        return res.status(403).json({ error: "No se puede eliminar al administrador principal." });
    }

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