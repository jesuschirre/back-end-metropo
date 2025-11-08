const crypto = require('crypto');

function generarPasswordTemporal() {
    return crypto.randomBytes(8).toString('hex');
}

module.exports = {
    generarPasswordTemporal
};