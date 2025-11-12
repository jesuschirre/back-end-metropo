const express = require ("express")
const router = express.Router();
const db = require('../db');


router.get("/", async (req, res) => {
  try {
    const [tickets] = await db.query("SELECT * FROM tickets_soporte");
    res.json(tickets);
  } catch (error) {
    console.error("Error al traer todos los tickets:", error);
    res.status(500).json({ message: "Error al obtener los tickets" });
  }
});

router.post("/", async (req, res) => {
  const { cliente_id, asunto, categoria } = req.body;

  // Validación de campos obligatorios
  if (!cliente_id || !asunto || !categoria) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  try {
    // Inserción en la base de datos
    await db.query(
      `INSERT INTO tickets_soporte 
        (cliente_id, asunto, categoria, estado, prioridad, fecha_creacion) 
       VALUES (?, ?, ?, 'Abierto', 'Normal', NOW())`,
      [cliente_id, asunto, categoria]
    );

    // Respuesta de éxito
    res.status(201).json({ message: "Ticket creado exitosamente" });

  } catch (error) {
    console.error("Error al crear el ticket:", error);
    res.status(500).json({ error: "Error al crear el ticket" });
  }
});

module.exports = router;