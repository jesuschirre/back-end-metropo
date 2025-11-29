const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");

// === Configuración Multer SOLO PARA AUDIO ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/audios/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  }
});

const upload = multer({ storage });

router.post(
  "/soliCon",
  upload.single("audio_anuncio"),
  async (req, res) => {
    try {
      //  ARCHIVO AUDIO OPCIONAL
      let audioUrl = null;

      if (req.file) {
        audioUrl = `http://localhost:3000/uploads/audios/${req.file.filename}`;
      }
      //  DATOS DE TEXTO 
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

      // Validación simple
      if (!cliente_id || !plan_id || !nombre_campana || !fecha_inicio || !monto_acordado) {
        return res.status(400).json({ message: "Faltan campos obligatorios." });
      }

      // Asegurar conversión del arreglo de días
      const diasEmisionJSON = JSON.stringify(JSON.parse(dias_emision));

      // Calcular fecha fin
      const fechaFin = new Date(fecha_inicio);
      fechaFin.setDate(fechaFin.getDate() + 30);
      
      let contratoPadre = contrato_padre_id;

      if (!contratoPadre || contratoPadre === "null" || contratoPadre === "" || contratoPadre === "undefined") {
        contratoPadre = null;
      }

      //  INSERTAR CONTRATO
      const [resultadoContrato] = await db.query(
        `INSERT INTO contratos_publicitarios 
        (cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado,
        estado, tipo_contrato, contrato_padre_id, detalles_anuncio, tags,
        fecha_creacion, fecha_actualizacion, duracion_valor, duracion_unidad,
        pdf_url, precio_base, descuento, dias_emision, anuncios_por_dia, urlAudio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cliente_id, plan_id, nombre_campana, fecha_inicio,
          fechaFin.toISOString().slice(0, 10), monto_acordado,
          "Pendiente_Activacion", tipo_contrato, contratoPadre,
          detalles_anuncio, tags, 0, "dias", null,
          parseFloat(precio_base) || 0,
          parseFloat(descuento) || 0,
          diasEmisionJSON,
          parseInt(anuncios_por_dia) || 0,
          audioUrl 
        ]
      );

      const contratoId = resultadoContrato.insertId;


      //  INSERTAR SOLICITUD DEL CLIENTE

      await db.query(
        `INSERT INTO solicitudes_cliente 
        (usuario_id, metodo_pago, comprobante_pago, monto, fecha_solicitud, estado, idContrato)
        VALUES (?, ?, ?, ?, NOW(), 'pendiente', ?)`,
        [cliente_id, metodo_pago, comprobante_pago, monto_acordado, contratoId]
      );

      return res.status(201).json({
        message: "Solicitud y contrato registrados correctamente.",
        contratoId
      });

    } catch (error) {
      console.error("ERROR EN /soliCon:", error);
      res.status(500).json({ message: "Error al registrar el contrato." });
    }
  }
);

module.exports = router;