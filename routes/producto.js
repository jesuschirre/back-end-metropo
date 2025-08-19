// routes/productos.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { verificarToken } = require("../middleware/auth");

// Crear un nuevo producto
router.post("/", verificarToken, async (req, res) => {
  const { nombre, descripcion, precio, stock, imagen, categoria_id } = req.body;
  const usuario_id = req.user.id; // ID del usuario que está logueado

  if (!nombre || !descripcion || !precio || !stock || !categoria_id) {
    return res.status(400).json({ error: "Todos los campos son obligatorios, incluyendo la categoría" });
  }

  try {
    // 1. Buscar el vendedor asociado a este usuario
    const [vendedorRows] = await db.query(
      "SELECT id FROM vendedores WHERE usuario_id = ?",
      [usuario_id]
    );

    if (vendedorRows.length === 0) {
      return res.status(400).json({ error: "No se encontró un vendedor asociado a este usuario" });
    }

    const vendedor_id = vendedorRows[0].id;

    // 2. Insertar el producto usando el vendedor_id real
    const [result] = await db.query(
      "INSERT INTO productos (vendedor_id, nombre, descripcion, precio, stock, imagen, categoria_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [vendedor_id, nombre, descripcion, precio, stock, imagen || null, categoria_id]
    );

    res.json({ message: "Producto creado correctamente", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear el producto" });
  }
});


// Obtener todos los productos con nombre de categoría
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, c.nombre AS categoria_nombre 
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener los productos" });
  }
});

// Obtener productos de un vendedor específico con categoría
router.get("/mis-productos", verificarToken, async (req, res) => {
  const vendedor_id = req.user.id;
  try {
    const [rows] = await db.query(`
      SELECT p.*, c.nombre AS categoria_nombre 
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      WHERE p.vendedor_id = ?
    `, [vendedor_id]);

    // Convertir precio a número
    const productos = rows.map(p => ({
      ...p,
      precio: Number(p.precio)
    }));

    res.json(productos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener los productos del vendedor" });
  }
});
  
router.get("/producto/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT p.*, c.nombre AS categoria_nombre 
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const producto = {
      ...rows[0],
      precio: Number(rows[0].precio),
    };

    res.json(producto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el producto" });
  }
});


module.exports = router;
