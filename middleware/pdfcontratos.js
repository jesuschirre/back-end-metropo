const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');

async function pdfreportesContratos(connection) {
  try {
    // === CONSULTA SQL ===
    const [datosContrato] = await connection.query(`
      SELECT c.nombre_campana, c.estado, c.fecha_inicio, c.fecha_fin, u.nombre AS cliente
      FROM contratos_publicitarios c
      INNER JOIN usuarios u ON c.cliente_id = u.id
      ORDER BY c.fecha_inicio DESC;
    `);

    // === CONFIGURACIÓN INICIAL ===
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfName = `reporte-contratos-${Date.now()}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'Uploads', 'reportes');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, pdfName);

    const stream = fsSync.createWriteStream(pdfPath);
    doc.pipe(stream);

    // === ENCABEZADO ===
    const logoPath = path.join(__dirname, '..', 'Uploads', 'logo.png');
    try {
      await fs.access(logoPath);
      doc.image(logoPath, 50, 30, { width: 80 });
    } catch {}

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#1E88E5')
      .text('Reporte de Contratos Publicitarios', { align: 'center' })
      .moveDown(1);

    doc
      .fontSize(10)
      .fillColor('#555')
      .text(`Generado el ${new Date().toLocaleDateString('es-PE')}`, {
        align: 'center',
      });
    doc.moveDown(2);

    // === TABLA CON pdfkit-table ===
    const table = {
      headers: [
        { label: 'Cliente', property: 'cliente', width: 120 },
        { label: 'Campaña', property: 'nombre_campana', width: 130 },
        { label: 'Estado', property: 'estado', width: 100 },
        { label: 'Inicio', property: 'fecha_inicio', width: 80 },
        { label: 'Fin', property: 'fecha_fin', width: 80 },
      ],
      datas: datosContrato.map(c => ({
        cliente: c.cliente,
        nombre_campana: c.nombre_campana || 'Sin nombre',
        estado: c.estado || 'Desconocido',
        fecha_inicio: new Date(c.fecha_inicio).toLocaleDateString('es-PE'),
        fecha_fin: new Date(c.fecha_fin).toLocaleDateString('es-PE'),
      })),
    };

    const tableOptions = {
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10).fillColor('black'),
      prepareRow: () => doc.font('Helvetica').fontSize(9).fillColor('black'),
      header: {
        fillColor: '#1E88E5', // Azul encabezado
        fontSize: 10,
      },
      alternateRowColors: ['#F9FAFB', '#FFFFFF'],
      padding: 5,
    };

    await doc.table(table, tableOptions);
    doc.moveDown(2);

    // === PIE DE PÁGINA ===
    const pageHeight = doc.page.height;
    doc
      .fontSize(8)
      .fillColor('#666')
      .text(
        `Reporte generado el ${new Date().toLocaleDateString('es-PE')} | © ${new Date().getFullYear()} Metrópoli Radio`,
        50,
        pageHeight - 40,
        { align: 'center', width: 500 }
      );

    // === FINALIZAR ===
    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ pdfPath, pdfName }));
      stream.on('error', reject);
    });

  } catch (error) {
    console.error('Error al generar el reporte PDF:', error);
    throw error;
  }
}

module.exports = { pdfreportesContratos };