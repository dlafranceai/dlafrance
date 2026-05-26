const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'assets', 'js', 'runtime-config.js');

const cfg = {
  whatsappNumber: process.env.WHATSAPP_NUMBER || '',
  useBackend: String(process.env.USE_BACKEND || 'false').toLowerCase() === 'true',
  apiBaseUrl: process.env.API_BASE_URL || ''
};

fs.writeFileSync(out, 'window.DLF_RUNTIME=' + JSON.stringify(cfg, null, 2) + ';\n');
console.log('Generated', out);
