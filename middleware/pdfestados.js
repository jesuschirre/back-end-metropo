const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const PDFDocument2 = require('pdfkit-table');

async function pdfvidenciaC(connection) {
  try {
    const doc = new PDFDocument2({ size: 'A4', margin: 50 });
    const pdfName = `reporte-estados-${Date.now()}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'Uploads', 'reportes');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, pdfName);
    const stream = fsSync.createWriteStream(pdfPath);
    doc.pipe(stream);

    const estados = ['Pendiente_Activacion', 'Programado', 'Activo', 'Vencido', 'Cancelado'];
    const resultados = {};

    for (const estado of estados) {
      const [rows] = await connection.query(`
        SELECT 
          nombre_campana, 
          estado, 
          fecha_inicio, 
          fecha_fin
        FROM contratos_publicitarios
        WHERE estado = ?;
      `, [estado]);

      // Conversión de fechas a formato legible antes de usarlas
      resultados[estado] = rows.map(row => ({
        ...row,
        fecha_inicio: formatearFecha(row.fecha_inicio),
        fecha_fin: formatearFecha(row.fecha_fin),
      }));
    }

    // === ENCABEZADO ===
    doc
      .fontSize(20)
      .fillColor('#1E3A8A')
      .text('REPORTE DE CONTRATOS POR ESTADO', { align: 'center' });
    doc.moveDown(2);

    // === TABLAS POR ESTADO ===
    for (const estado of estados) {
      const contratos = resultados[estado];
      const estadoTitulo = estado.replace('_', ' ');

      doc
        .fontSize(14)
        .fillColor('#1E40AF')
        .text(`Estado: ${estadoTitulo}`);
      doc.moveDown(0.5);

      if (contratos.length === 0) {
        doc
          .fontSize(11)
          .fillColor('gray')
          .text('No hay contratos con este estado.', { indent: 20 });
        doc.moveDown(1);
        continue;
      }

      const table = {
        headers: [
          { label: "Campaña", property: 'nombre_campana', width: 250 },
          { label: "Fecha Inicio", property: 'fecha_inicio', width: 100 },
          { label: "Fecha Fin", property: 'fecha_fin', width: 100 },
        ],
        datas: contratos,
      };

      const tableOptions = {
        prepareHeader: () => doc.fontSize(10).fillColor('black'),
        prepareRow: () => doc.fontSize(9).fillColor('black'),
        header: {
          fillColor: '#1D4ED8',
          textColor: 'black',
          fontSize: 10,
          font: 'Helvetica-Bold',
        },
        alternateRowColors: ['#F3F4F6', '#FFFFFF'],
        padding: 5,
      };

      await doc.table(table, tableOptions);
      doc.moveDown(1.5);
    }

    // === PIE DE PÁGINA ===
    const pageHeight = doc.page.height;
    doc
      .fontSize(8)
      .fillColor('#666')
      .text(
        `Generado el ${new Date().toLocaleDateString('es-PE')} | © ${new Date().getFullYear()} Metrópoli Radio`,
        50,
        pageHeight - 40,
        { align: 'center', width: 500 }
      );

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ pdfName, pdfPath }));
      stream.on('error', reject);
    });

  } catch (error) {
    console.error('Error al generar el reporte PDF:', error);
    throw error;
  }
}

// Función auxiliar para formatear fechas sin mostrar N/A
function formatearFecha(value) {
  if (!value) return 'N/A';
  try {
    const fecha = new Date(value);
    if (isNaN(fecha)) return 'N/A';
    // Formato: dd/mm/yyyy
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  } catch {
    return 'N/A';
  }
}

module.exports = { pdfvidenciaC };