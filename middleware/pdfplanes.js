const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');

async function pdfporPlanes(connection) {
  try {
    // === CONFIGURACIÓN INICIAL ===
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfName = `reporte-planes-${Date.now()}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'Uploads', 'reportes');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, pdfName);

    const stream = fsSync.createWriteStream(pdfPath);
    doc.pipe(stream);

    // === ENCABEZADO ===
    doc
      .fontSize(20)
      .fillColor('#1E3A8A')
      .text(' REPORTE DE CONTRATOS POR PLAN', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor('#555')
      .text(`Generado el ${new Date().toLocaleDateString('es-PE')}`, { align: 'center' });
    doc.moveDown(2);

    // === CONSULTA SQL ===
    const [contratosPorPlan] = await connection.query(`
      SELECT 
        p.nombre AS nombre_plan,
        c.nombre_campana,
        c.estado,
        c.fecha_inicio,
        c.fecha_fin,
        u.nombre AS nombre_cliente
      FROM contratos_publicitarios c
      INNER JOIN planes p ON c.plan_id = p.id
      INNER JOIN usuarios u ON c.cliente_id = u.id
      ORDER BY p.nombre;
    `);

    if (contratosPorPlan.length === 0) {
      doc
        .fontSize(12)
        .fillColor('red')
        .text('No se encontraron contratos asociados a planes.', { align: 'center' });
      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve({ pdfPath, pdfName }));
        stream.on('error', reject);
      });
    }

    // === AGRUPAR POR PLAN ===
    const planesAgrupados = {};
    contratosPorPlan.forEach(c => {
      if (!planesAgrupados[c.nombre_plan]) planesAgrupados[c.nombre_plan] = [];
      planesAgrupados[c.nombre_plan].push(c);
    });

    // === CONTENIDO DEL PDF ===
    for (const [plan, contratos] of Object.entries(planesAgrupados)) {
      doc
        .fontSize(14)
        .fillColor('#1E40AF')
        .text(`PLAN: ${plan}`, { underline: true });
      doc.moveDown(0.8);

      // === Datos y tabla ===
      const table = {
        headers: [
          { label: 'Cliente', property: 'nombre_cliente', width: 100 },
          { label: 'Campaña', property: 'nombre_campana', width: 150 },
          { label: 'Estado', property: 'estado', width: 80 },
          { label: 'Inicio', property: 'fecha_inicio', width: 80 },
          { label: 'Fin', property: 'fecha_fin', width: 80 },
        ],
        datas: contratos.map(c => ({
          nombre_cliente: c.nombre_cliente,
          nombre_campana: c.nombre_campana,
          estado: c.estado,
          fecha_inicio: new Date(c.fecha_inicio).toLocaleDateString('es-PE'),
          fecha_fin: new Date(c.fecha_fin).toLocaleDateString('es-PE'),
        })),
      };

      const tableOptions = {
        prepareHeader: () => doc.fontSize(10).fillColor('black'),
        prepareRow: () => doc.fontSize(9).fillColor('black'),
        header: {
          fillColor: '#1E3A8A',
          textColor: 'black',
          fontSize: 10,
          font: 'Helvetica-Bold',
        },
        alternateRowColors: ['#F3F4F6', '#FFFFFF'], // gris claro / blanco
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
        `Reporte generado el ${new Date().toLocaleDateString('es-PE')} | © ${new Date().getFullYear()} Metrópoli Radio`,
        50,
        pageHeight - 40,
        { align: 'center', width: 500 }
      );

    doc.end();
    
    // === DEVOLVER RESULTADO ===
    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ pdfPath, pdfName }));
      stream.on('error', reject);
    });

  } catch (error) {
    console.error('Error al generar el reporte PDF por planes:', error);
    throw error;
  }
}

module.exports = { pdfporPlanes };