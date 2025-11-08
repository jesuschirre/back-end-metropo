const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require('bcrypt');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Seguridad: Solo Admins pueden gestionar clientes y visitantes desde aquí
router.use(verifyToken, isAdmin);

// --- RUTAS CRUD PARA CLIENTES Y VISITANTES ('cliente', 'usuario') ---

// GET: Obtener la lista de Clientes y Visitantes
router.get("/", async (req, res) => {
  try {
    // ---- Filtramos SOLO 'cliente' y 'usuario' ----
    const [rows] = await db.query(
      "SELECT id, nombre, correo, rol FROM usuarios WHERE rol IN ('cliente', 'usuario') ORDER BY id ASC"
    );
    // ---------------------------------------------
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener la lista de clientes/visitantes:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST: Crear nuevo Cliente o Visitante
router.post('/', async (req, res) => {
    const { nombre, correo, password, rol } = req.body;
    if (!nombre || !correo || !password || !rol) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    // ---- Validación: Solo permite 'cliente' o 'usuario' ----
    if (!['cliente', 'usuario'].includes(rol)) {
        return res.status(400).json({ error: 'El rol proporcionado no es válido (solo cliente o usuario).' });
    }
    // --------------------------------------------------------
    try {
        const [existingUser] = await db.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
        if (existingUser.length > 0) {
            return res.status(409).json({ error: 'Ya existe un usuario con este correo.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, correo, hashedPassword, rol]
        );
        res.status(201).json({ message: 'Usuario externo creado.', id: result.insertId });
    } catch (err) {
        console.error("Error al crear cliente/visitante:", err);
        res.status(500).json({ error: 'Error interno al crear usuario.' });
    }
});

// PUT: Actualizar Cliente o Visitante
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol } = req.body;
  if (!nombre || !correo || !rol) {
    return res.status(400).json({ error: "Faltan datos requeridos." });
  }
  // ---- Validación: Solo permite 'cliente' o 'usuario' ----
  if (!['cliente', 'usuario'].includes(rol)) {
    return res.status(400).json({ error: 'El rol proporcionado no es válido (solo cliente o usuario).' });
  }
  // --------------------------------------------------------
  try {
    // Asegurarse de que solo se actualicen usuarios que YA SON cliente o usuario
    const [result] = await db.query(
      "UPDATE usuarios SET nombre = ?, correo = ?, rol = ? WHERE id = ? AND rol IN ('cliente', 'usuario')",
      [nombre, correo, rol, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado o no es cliente/visitante." });
    }
    res.json({ message: "Usuario actualizado." });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'El correo ya está en uso.' });
    }
    console.error(`Error al actualizar usuario ${id}:`, err);
    res.status(500).json({ error: "Error interno al actualizar." });
  }
});

// DELETE: Eliminar Cliente o Visitante
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // ---- Filtro: Asegurarse de que solo se borren roles cliente o usuario ----
    const [result] = await db.query(
      "DELETE FROM usuarios WHERE id = ? AND rol IN ('cliente', 'usuario')",
      [id]
    );
    // ----------------------------------------------------------------------
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado o no es cliente/visitante." });
    }
    res.json({ message: "Usuario eliminado." });
  } catch (err) {
    console.error(`Error al eliminar usuario ${id}:`, err);
    res.status(500).json({ error: "Error interno al eliminar." });
  }
});

// ¡IMPORTANTE! Exportar el router
module.exports = router;