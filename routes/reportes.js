const express = require("express");
const router = express.Router();
const db = require("../db");
const { pdfreportesContratos, pdfporPlanes, pdfvidenciaC, pdfdema} = require("../middleware/generaraPDF");

router.get("/contratos", async (req, res) => {
  try {
    // Generar el PDF
    const { pdfPath, pdfName } = await pdfreportesContratos(db);
    // Enviar respuesta al cliente
    res.json({
      message: "PDF creado satisfactoriamente",
      file: pdfName,
      path: pdfPath
    });

  } catch (error) {
    console.error("Error al crear el PDF:", error);
    res.status(500).json({ message: "Error al crear el PDF." });
  }
});

router.get('/planes', async (req, res) => {
  try {
    const { pdfName } = await pdfporPlanes(db);
    res.json({
      message: 'PDF generado correctamente',
      file: pdfName,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al generar el PDF' });
  }
});

router.get('/estado', async (req, res) => {
    try {
        const { pdfName } = await pdfvidenciaC(db);
        res.json({
            file: pdfName,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al generar el PDF' });
    }
})

router.get('/demandado', async (req, res) => {
  try {
    const {pdfName} = await pdfdema(db);
    res.json({
      file: pdfName
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al generar el PDF' });
  }
})

module.exports = router;