const express = require("express");
const router = express.Router();
const db = require("../db"); // conexión a la BD
const multer = require("multer");
const fs = require("fs");
const path = require("path");


// Crear carpeta uploads si no existe (en la raíz del backend)
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configurar multer para guardar archivos en la carpeta 'uploads'
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Crear una solicitud de vendedor con datos de pago y archivo
router.post(
  "/solicitar-vendedor",
  upload.single("comprobante_pago"),
  async (req, res) => {
    try {
      const { usuario_id, metodo_pago, monto, referencia_pago } = req.body;
      const comprobante_pago = req.file ? req.file.filename : null;

      if (
        !usuario_id ||
        !metodo_pago ||
        !monto ||
        !referencia_pago ||
        !comprobante_pago
      ) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
      }

      const [solicitud] = await db.query(
        "SELECT * FROM solicitudes_vendedor WHERE usuario_id = ? AND estado = 'pendiente'",
        [usuario_id]
      );

      if (solicitud.length > 0) {
        return res
          .status(400)
          .json({ message: "Ya tienes una solicitud pendiente" });
      }

      await db.query(
        `INSERT INTO solicitudes_vendedor 
          (usuario_id, metodo_pago, comprobante_pago, monto, referencia_pago) 
          VALUES (?, ?, ?, ?, ?)`,
        [usuario_id, metodo_pago, comprobante_pago, monto, referencia_pago]
      );

      res.json({ message: "Solicitud enviada correctamente y en revisión" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al enviar la solicitud" });
    }
  }
);

// Ruta para obtener todas las solicitudes de vendedor
router.get("/solicitudes-vendedor", async (req, res) => {
  try {
    const [solicitudes] = await db.query(
      `SELECT 
         s.id, 
         s.usuario_id, 
         u.nombre, 
         u.correo, 
         s.estado, 
         s.fecha_solicitud,
         s.metodo_pago,
         s.monto,
         s.referencia_pago,
         s.comprobante_pago
       FROM solicitudes_vendedor s
       INNER JOIN usuarios u ON s.usuario_id = u.id
       ORDER BY s.fecha_solicitud DESC`
    );
    res.json(solicitudes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener las solicitudes" });
  }
});

router.post("/solicitudes-vendedor/aceptar", async (req, res) => {
  try {
    const { solicitud_id } = req.body;

    if (!solicitud_id) {
      return res.status(400).json({ message: "Falta el ID de la solicitud" });
    }

    // Buscar solicitud
    const [rows] = await db.query(
      "SELECT * FROM solicitudes_vendedor WHERE id = ?",
      [solicitud_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No se encontró la solicitud" });
    }

    const usuario_id = rows[0].usuario_id;

    // Marcar como aprobada
    await db.query(
      "UPDATE solicitudes_vendedor SET estado = 'aprobada' WHERE id = ?",
      [solicitud_id]
    );

    // Insertar en vendedores si no existe
    await db.query(
      "INSERT IGNORE INTO vendedores (usuario_id) VALUES (?)",
      [usuario_id]
    );

    await db.query(
      "UPDATE usuarios SET rol = 'vendedor' WHERE id = ?",
      [usuario_id]
    );

    res.json({
      message: "Solicitud aceptada con éxito",
      solicitud: rows[0],
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al aceptar la solicitud" });
  }
});

module.exports = router;