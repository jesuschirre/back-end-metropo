const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');

async function pdfdema(connection) {
  try {
    // 1) Obtengo los plan_id que tienen la máxima cantidad de contratos (maneja empates)
    const [planMasDemandadoIds] = await connection.query(`
      SELECT plan_id
      FROM (
        SELECT plan_id, COUNT(*) AS cnt
        FROM contratos_publicitarios
        GROUP BY plan_id
      ) AS t
      WHERE cnt = (
        SELECT MAX(cnt) FROM (
          SELECT COUNT(*) AS cnt
          FROM contratos_publicitarios
          GROUP BY plan_id
        ) AS t2
      );
    `);

    if (!planMasDemandadoIds || planMasDemandadoIds.length === 0) {
      throw new Error('No se encontraron contratos para determinar el plan más demandado.');
    }

    // Extraigo los ids en un array para usar en IN (...)
    const ids = planMasDemandadoIds.map(r => r.plan_id);
    const idsPlaceholders = ids.map(() => '?').join(',');

    // 2) Traigo todos los contratos que correspondan a esos plan_id
    const [contratos] = await connection.query(
      `
      SELECT 
        p.id AS plan_id,
        p.nombre AS nombre_plan,
        c.nombre_campana,
        c.estado,
        c.fecha_inicio,
        c.fecha_fin,
        u.nombre AS nombre_cliente
      FROM contratos_publicitarios c
      INNER JOIN planes p ON c.plan_id = p.id
      INNER JOIN usuarios u ON c.cliente_id = u.id
      WHERE c.plan_id IN (${idsPlaceholders})
      ORDER BY p.nombre, c.fecha_inicio;
      `,
      ids
    );

    if (!contratos || contratos.length === 0) {
      throw new Error('No se encontraron contratos para el/los plan(es) más demandado(s).');
    }

    // === GENERAR PDF ===
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfName = `reporte-plan-mas-demandado-${Date.now()}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'Uploads', 'reportes');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, pdfName);

    const stream = fsSync.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Encabezado
    doc
      .fontSize(20)
      .fillColor('#1E3A8A')
      .text('REPORTE: PLAN MÁS DEMANDADO', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor('#555')
      .text(`Generado el ${new Date().toLocaleDateString('es-PE')}`, { align: 'center' })
      .moveDown(1.5);

    // Agrupar por plan y crear una tabla por cada plan
    const planesAgrupados = {};
    contratos.forEach(c => {
      if (!planesAgrupados[c.nombre_plan]) planesAgrupados[c.nombre_plan] = [];
      planesAgrupados[c.nombre_plan].push(c);
    });

    for (const [plan, lista] of Object.entries(planesAgrupados)) {
      doc
        .fontSize(14)
        .fillColor('#0F172A')
        .text(`PLAN: ${plan}`);
      doc.moveDown(0.6);

      const table = {
        headers: [
          { label: 'Cliente', property: 'nombre_cliente', width: 120 },
          { label: 'Campaña', property: 'nombre_campana', width: 150 },
          { label: 'Estado', property: 'estado', width: 70 },
          { label: 'Inicio', property: 'fecha_inicio', width: 80 },
          { label: 'Fin', property: 'fecha_fin', width: 80 },
        ],
        datas: lista.map(c => ({
          nombre_cliente: c.nombre_cliente,
          nombre_campana: c.nombre_campana,
          estado: c.estado,
          fecha_inicio: c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString('es-PE') : '',
          fecha_fin: c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString('es-PE') : '',
        })),
      };

      const tableOptions = {
        prepareHeader: () => doc.fontSize(10).fillColor('black'),
        prepareRow: () => doc.fontSize(9).fillColor('black'),
        header: {
          fillColor: '#1E3A8A',
          textColor: 'white',
          fontSize: 10,
          font: 'Helvetica-Bold',
        },
        alternateRowColors: ['#F3F4F6', '#FFFFFF'],
        padding: 5,
      };

      // Esperar a que termine la tabla antes de seguir
      // pdfkit-table devuelve una promesa si usas la versión que la soporta; si no, puedes quitar await
      // y confiar en la serialización del documento.
      // Aquí uso await por si tu versión lo soporta.
      // Si tu versión no devuelve promesa, elimina 'await' de la siguiente línea.
      await doc.table(table, tableOptions);

      doc.moveDown(1.2);
    }

    // Pie de página
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

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ pdfPath, pdfName }));
      stream.on('error', reject);
    });

  } catch (error) {
    console.error('Error al generar PDF del plan más demandado:', error);
    throw error;
  }
}

module.exports = { pdfdema };