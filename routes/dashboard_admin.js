const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, isAdmin);

/**
 * @route   GET /api/dashboard_admin/stats
 * @desc    Obtiene todas las estadísticas clave para el dashboard del administrador.
 * @access  Private (Admin Only)
 */
router.get('/stats', async (req, res) => {
    const connection = await db.getConnection();
    try {
        // --- 1. MÉTRICAS PRINCIPALES (TARJETAS) ---
        const [metrics] = await connection.query(`
            SELECT 
                (SELECT COUNT(id) FROM usuarios WHERE rol != 'admin') as totalUsuarios,
                (SELECT COUNT(id) FROM contratos_publicitarios) as totalContratos,
                (SELECT COUNT(id) FROM contratos_publicitarios WHERE estado = 'Activo') as contratosActivos,
                (SELECT COUNT(id) FROM solicitudes_cliente WHERE estado = 'pendiente') as solicitudesPendientes,
                (SELECT SUM(monto_acordado) FROM contratos_publicitarios 
                 WHERE DATE_FORMAT(fecha_creacion, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')) as ingresosMesActual
        `);

        // --- 2. GRÁFICO DE INGRESOS ---
        const [monthlyRevenueFromDB] = await connection.query(`
            SELECT DATE_FORMAT(fecha_creacion, '%Y-%m') as mes, SUM(monto_acordado) as total
            FROM contratos_publicitarios
            WHERE fecha_creacion >= DATE_FORMAT(NOW() - INTERVAL 5 MONTH, '%Y-%m-01')
            GROUP BY mes ORDER BY mes ASC;
        `);
        const revenueMap = new Map(monthlyRevenueFromDB.map(item => [item.mes, parseFloat(item.total)]));
        const revenueLabels = [];
        const revenueData = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const mesKey = date.toISOString().slice(0, 7);
            revenueLabels.push(mesKey);
            revenueData.push(revenueMap.get(mesKey) || 0);
        }
        const revenueChart = { data: { labels: revenueLabels, datasets: [{ data: revenueData }] } };

        // --- 3. GRÁFICO DE ESTADO DE CONTRATOS ---
        const [contractStatus] = await connection.query(`SELECT estado, COUNT(id) as count FROM contratos_publicitarios GROUP BY estado`);
        const contractStatusChart = {
            data: {
                labels: contractStatus.map(s => s.estado),
                datasets: [{
                    data: contractStatus.map(s => s.count),
                    backgroundColor: ['#1E88E5', '#4CAF50', '#FFCA28', '#EF5350', '#607D8B', '#9E9E9E'].slice(0, contractStatus.length),
                }]
            }
        };
        
        // --- 4. GRÁFICO DE DÍAS DE EMISIÓN POPULARES ---
        const [allEmissionDays] = await connection.query(`SELECT dias_emision FROM contratos_publicitarios WHERE dias_emision IS NOT NULL AND dias_emision != '[]'`);
        const diasCount = allEmissionDays.reduce((acc, row) => {
            try {
                const dias = JSON.parse(row.dias_emision || '[]');
                dias.forEach(dia => { acc[dia] = (acc[dia] || 0) + 1; });
            } catch (e) { /* Ignora JSON inválido */ }
            return acc;
        }, {});
        const emissionDaysChart = {
            data: {
                labels: Object.keys(diasCount),
                datasets: [{ data: Object.values(diasCount) }]
            }
        };

        // --- 5. TABLA DE PRÓXIMOS VENCIMIENTOS (CON FECHAS FORMATEADAS) ---
        const [upcomingExpirations] = await connection.query(`
            SELECT c.id, c.nombre_campana, DATE_FORMAT(c.fecha_fin, '%d/%m/%Y') as fecha_fin, c.dias_emision, u.nombre as nombre_cliente
            FROM contratos_publicitarios c JOIN usuarios u ON c.cliente_id = u.id
            WHERE c.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND c.estado IN ('Activo', 'Por_Vencer')
            ORDER BY c.fecha_fin ASC LIMIT 5
        `);
        const formattedExpirations = upcomingExpirations.map(exp => ({
            ...exp,
            dias_emision: JSON.parse(exp.dias_emision || '[]').map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ') || 'Todos los días'
        }));

        // --- 6. TABLA DE ACTIVIDAD RECIENTE (CON FECHAS FORMATEADAS) ---
        const [recentActivity] = await connection.query(`
            SELECT c.id, c.nombre_campana, DATE_FORMAT(c.fecha_creacion, '%d/%m/%Y') as fecha_creacion, c.dias_emision, u.nombre as nombre_cliente
            FROM contratos_publicitarios c JOIN usuarios u ON c.cliente_id = u.id
            ORDER BY c.fecha_creacion DESC LIMIT 5
        `);
        const formattedActivity = recentActivity.map(act => ({
            ...act,
            dias_emision: JSON.parse(act.dias_emision || '[]').map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ') || 'Todos los días'
        }));

        // --- 7. OBTENER LOS PLANES ---
        const [planes] = await connection.query("SELECT * FROM planes ORDER BY precio ASC");
        const planesConCaracteristicas = planes.map(plan => ({
            ...plan,
            caracteristicas: JSON.parse(plan.caracteristicas || '[]')
        }));

        // --- RESPUESTA FINAL CONSOLIDADA ---
        res.json({
            stats: {
                totalUsuarios: metrics[0].totalUsuarios || 0,
                contratosActivos: metrics[0].contratosActivos || 0,
                totalContratos: metrics[0].totalContratos || 0,
                solicitudesPendientes: metrics[0].solicitudesPendientes || 0,
                ingresosTotales: parseFloat(metrics[0].ingresosMesActual || 0).toFixed(2)
            },
            charts: {
                revenue: revenueChart,
                contractStatus: contractStatusChart,
                emissionDays: emissionDaysChart
            },
            expirations: formattedExpirations,
            activity: formattedActivity,
            planes: planesConCaracteristicas
        });

    } catch (err) {
        console.error("Error al obtener las estadísticas del dashboard:", err);
        res.status(500).json({ error: `Error interno del servidor: ${err.message}` });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;