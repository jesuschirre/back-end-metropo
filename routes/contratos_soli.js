const express = require("express");
const router = express.Router();
const db = require("../db");

// 📄 Ruta para registrar una solicitud y un contrato relacionados
router.post("/soliCon", async (req, res) => {
  try {
    // ==============================
    // 1️⃣ Extraer datos del cuerpo
    // ==============================
    const {
      cliente_id,
      plan_id,
      nombre_campana,
      fecha_inicio,
      monto_acordado,
      tipo_contrato,
      contrato_padre_id,
      detalles_anuncio,
      tags,
      precio_base,
      descuento,
      dias_emision,
      anuncios_por_dia,
      metodo_pago,
      comprobante_pago
    } = req.body;

    // Validar datos mínimos
    if (!plan_id || !nombre_campana || !fecha_inicio || !monto_acordado) {
      return res.status(400).json({ error: "Faltan campos obligatorios." });
    }

    // ==============================
    // 2️⃣ Calcular fecha de fin (30 días después)
    // ==============================
    const fechaFin = new Date(fecha_inicio);
    fechaFin.setDate(fechaFin.getDate() + 30);
    const diasEmisionJSON = JSON.stringify(dias_emision || []);

    // ==============================
    // 3️⃣ Insertar contrato publicitario
    // ==============================
    const [resultadoContrato] = await db.query(
      `INSERT INTO contratos_publicitarios 
      (cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado,
       estado, tipo_contrato, contrato_padre_id, detalles_anuncio, tags,
       fecha_creacion, fecha_actualizacion, duracion_valor, duracion_unidad,
       pdf_url, precio_base, descuento, dias_emision, anuncios_por_dia)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [
        cliente_id, plan_id, nombre_campana, fecha_inicio,
        fechaFin.toISOString().slice(0, 10), monto_acordado,
        "Pendiente_Activacion", tipo_contrato, contrato_padre_id || null,
        detalles_anuncio, tags, 0, "dias", null,
        parseFloat(precio_base) || 0, parseFloat(descuento) || 0,
        diasEmisionJSON, parseInt(anuncios_por_dia) || 0
      ]
    );

    const contratoId = resultadoContrato.insertId; // Guardar ID del contrato

    // ==============================
    // 4️⃣ Insertar solicitud del cliente (ya con el ID del contrato)
    // ==============================
    await db.query(
      `INSERT INTO solicitudes_cliente 
      (usuario_id, metodo_pago, comprobante_pago, monto, fecha_solicitud, estado, idContrato)
      VALUES (?, ?, ?, ?, NOW(), 'pendiente', ?)`,
      [cliente_id, metodo_pago, comprobante_pago, monto_acordado, contratoId]
    );

    // ==============================
    // 5️⃣ Responder al cliente
    // ==============================
    res.status(201).json({
      message: "✅ Solicitud y contrato registrados correctamente.",
      contratoId
    });

  } catch (err) {
    console.error("❌ Error en /soliCon:", err);
    res.status(500).json({ message: "Error al registrar la solicitud o el contrato." });
  }
});

module.exports = router;