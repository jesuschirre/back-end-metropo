const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
// Leemos las claves del archivo .env que cargará Node
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'utf-8');
const IV = Buffer.from(process.env.ENCRYPTION_IV, 'utf-8');

function encryptPassword(password) {
  if (!password) return '';
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, IV);
  let encrypted = cipher.update(password, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function decryptPassword(encryptedPassword) {
  if (!encryptedPassword) return '';
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, IV);
    let decrypted = decipher.update(encryptedPassword, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error("Error al desencriptar:", error);
    return '';
  }
}

module.exports = { encryptPassword, decryptPassword };