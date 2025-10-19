const express = require("express");
const router = express.Router();
const db = require("../db");

// soli
router.post("/soliCon", async (req, res) => {
  try {
    const {
      usuario_id,
      metodo_pago,
      monto,
      comprobante_pago,
      nombre,
      identificacion,
      nombre_publicidad,
      total_dias,
      direccion
    } = req.body;

    // Validar campos obligatorios
    if (!usuario_id || !metodo_pago || !monto || !comprobante_pago) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    // Verificar si el usuario ya tiene una solicitud pendiente
    const [solicitud] = await db.query(
      "SELECT * FROM solicitudes_cliente WHERE usuario_id = ? AND estado = 'pendiente'",
      [usuario_id]
    );

    if (solicitud.length > 0) {
      return res.status(409).json({ message: "Ya tienes una solicitud pendiente" });
    }

    // Insertar solicitud del cliente
    await db.query(
      `INSERT INTO solicitudes_cliente 
      (usuario_id, metodo_pago, comprobante_pago, monto, fecha_solicitud, estado)
      VALUES (?, ?, ?, ?, NOW(), 'pendiente')`,
      [usuario_id, metodo_pago, comprobante_pago, monto]
    );

    // Insertar contrato de publicidad
    await db.query(
     `INSERT INTO contratos_publicidad 
      (id_anunciante, nombre_anunciante, ruc_dni_anunciante, nombre_sistema_publicitado, 
      duracion_segundos, frecuencia_diaria, total_dias, fecha_inicio, fecha_fin,
      costo_total, forma_pago, estado_contrato, direccion)
      VALUES (?, ?, ?, ?, 30, 30, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?, 'activo', ?)`,
      [
        usuario_id,       // id_anunciante
        nombre,           // nombre_anunciante
        identificacion,   // ruc_dni_anunciante
        nombre_publicidad,// nombre_sistema_publicitado
        total_dias,       // total_dias
        monto,      // costo_total
        metodo_pago,      // forma_pago
        direccion         // direccion
      ]
    );

    res.status(201).json({
      message: "¡Solicitud enviada correctamente!",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al enviar la solicitud" });
  }
});

module.exports = router;