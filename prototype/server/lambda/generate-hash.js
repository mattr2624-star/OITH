const crypto = require('crypto');
const password = process.argv[2] || 'admin123';
const hash = crypto.createHash('sha256').update(password + 'oith_salt_2024').digest('hex');
console.log('Password:', password);
console.log('Hash:', hash);

