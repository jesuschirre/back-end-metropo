function validarEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }
    
    function validarDiasEmision(dias) {
        const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        return Array.isArray(dias) && dias.every(dia => typeof dia === 'string' && diasValidos.includes(dia.toLowerCase()));
    }
    
    module.exports = {
        validarEmail,
        validarDiasEmision
    };