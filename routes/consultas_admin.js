const express = require("express");
const router = express.Router();
const axios = require('axios'); 

/**
 * @route   GET /api/consultas_admin/documento/:numero
 * @desc    Consulta un DNI o RUC en una API externa
 * @access  Private (Admin Only)
 */
router.get('/documento/:numero', async (req, res) => {
    const { numero } = req.params;

    if (!numero || (numero.length !== 8 && numero.length !== 11)) {
        return res.status(400).json({ error: 'El documento debe ser un DNI (8 dígitos) o un RUC (11 dígitos).' });
    }

    const tipoDoc = numero.length === 8 ? 'dni' : 'ruc';

    try {
        let response;
        if (tipoDoc === 'dni') {
            const tokenDNI = process.env.TOKEN_APISNET_DNI;
            if (!tokenDNI || tokenDNI === 'TU_TOKEN_REAL_DE_APIS_NET_PE_VA_AQUI') {
                throw new Error('El token para la API de DNI no está configurado en el servidor.');
            }
            
            response = await axios.get(`https://api.apis.net.pe/v1/dni?numero=${numero}`, {
                headers: {
                    'Referer': 'https://apis.net.pe/consulta-dni-api',
                    'Authorization': `Bearer ${tokenDNI}`
                }
            });

            // Devolvemos una respuesta estandarizada
            res.json({
                nombreCompleto: `${response.data.nombres} ${response.data.apellidoPaterno} ${response.data.apellidoMaterno}`.trim(),
                documento: response.data.numeroDocumento,
                tipo: 'DNI'
            });

        } else { // tipoDoc === 'ruc'
            const tokenRUC = process.env.TOKEN_APIPERU_RUC;
            
            response = await axios.get(`https://apiperu.dev/api/ruc/${numero}?api_token=${tokenRUC}`);
            
            if (response.data && response.data.success) {
                // Devolvemos una respuesta estandarizada
                res.json({
                    nombreCompleto: response.data.data.nombre_o_razon_social,
                    documento: response.data.data.ruc,
                    direccion: response.data.data.direccion_completa,
                    tipo: 'RUC'
                });
            } else {
                throw new Error(response.data.message || 'La API no pudo encontrar datos para este RUC.');
            }
        }
    } catch (error) {
        console.error(`Error al consultar ${tipoDoc} ${numero}:`, error.response ? error.response.data : error.message);
        res.status(500).json({ error: `No se pudo obtener la información. Verifique el documento o intente más tarde.` });
    }
});

module.exports = router;