require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const products = require('./data/products');

const app = express();
const port = Number(process.env.PORT || 10000);
const freeShippingFrom = Number(process.env.FREE_SHIPPING_FROM || 400);
const shippingBase = Number(process.env.SHIPPING_BASE || 19.9);

// Security middlewares
app.use(helmet());

// CORS: allow a controlled list of origins via CORS_ORIGIN (comma separated)
const rawCors = String(process.env.CORS_ORIGIN || '').trim();
const allowedOrigins = rawCors ? rawCors.split(',').map(s => s.trim()).filter(Boolean) : [];

app.use(cors({
  origin: function(origin, callback) {
    // allow non-browser clients (curl, server-to-server) which have no origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    const hostname = origin.replace(/^https?:\/\//, '').split(':')[0];
    if (allowedOrigins.includes(origin) || allowedOrigins.includes(hostname)) return callback(null, true);
    return callback(new Error('CORS: Origin not allowed'));
  },
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '1mb' }));

// Basic rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'dlf-api', timestamp: new Date().toISOString() });
});

app.get('/api/products', (_req, res) => {
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const product = products.find((item) => item.id === id);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
  return res.json(product);
});

app.post('/api/orders', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const rawItems = Array.isArray(body.items) ? body.items : [];

  const items = rawItems
    .map((item) => ({
      id: String(item.id || '').trim(),
      name: String(item.name || '').trim().slice(0, 250),
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      price: Number(item.price || 0)
    }))
    .filter((item) => item.id && Number.isFinite(item.price) && item.price >= 0 && Number.isFinite(item.quantity));

  if (!items.length) return res.status(400).json({ error: 'Pedido sem itens.' });

  // Recompute subtotal from items (ignore/tolerate client subtotal)
  const subtotalFromItems = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const customerRaw = body.customer && typeof body.customer === 'object' ? body.customer : null;
  const customer = customerRaw
    ? {
        name: String(customerRaw.name || '').slice(0, 250),
        phone: String(customerRaw.phone || '').replace(/\D+/g, '')
      }
    : null;

  const order = {
    id: `DLF-${Date.now()}`,
    status: 'created',
    createdAt: new Date().toISOString(),
    channel: String(body.channel || 'whatsapp').slice(0, 50),
    notes: String(body.notes || '').slice(0, 1000),
    items,
    subtotal: subtotalFromItems,
    customer
  };

  return res.status(201).json(order);
});

app.get('/api/shipping', (req, res) => {
  const cep = String(req.query.cep || '').replace(/\D+/g, '');
  const subtotal = Number(req.query.subtotal || 0);

  if (cep.length !== 8) {
    return res.status(400).json({ error: 'CEP inválido.', message: 'Digite um CEP válido com 8 dígitos.' });
  }

  const freeShipping = subtotal >= freeShippingFrom;
  const shippingCost = freeShipping ? 0 : shippingBase;

  return res.json({
    cep: formatCep(cep),
    subtotal,
    shippingCost,
    freeShipping,
    total: subtotal + shippingCost,
    etaBusinessDays: freeShipping ? '1-3' : '2-5',
    message: freeShipping ? 'Você atingiu frete grátis. Entrega estimada de 1 a 3 dias úteis.' : `Frete estimado em ${toCurrency(shippingCost)}. Entrega de 2 a 5 dias úteis.`
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.use((error, _req, res, _next) => {
  console.error(error && error.stack ? error.stack : error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(port, () => {
  console.log(`DLF API rodando na porta ${port}`);
});

function formatCep(cep) {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function toCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}
