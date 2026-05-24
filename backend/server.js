const express = require("express");
const cors = require("cors");
const products = require("./data/products");

const app = express();
const port = Number(process.env.PORT || 10000);
const freeShippingFrom = Number(process.env.FREE_SHIPPING_FROM || 400);
const shippingBase = Number(process.env.SHIPPING_BASE || 19.9);
const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN || "*");

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "dlf-api",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/products", (_req, res) => {
  res.json(products);
});

app.get("/api/products/:id", (req, res) => {
  const product = products.find((item) => item.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: "Produto não encontrado." });
  }
  return res.json(product);
});

app.post("/api/orders", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const rawItems = Array.isArray(body.items) ? body.items : [];

  const items = rawItems
    .map((item) => ({
      id: String(item.id || "").trim(),
      name: String(item.name || "").trim(),
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      price: Number(item.price || 0)
    }))
    .filter((item) => item.id);

  if (!items.length) {
    return res.status(400).json({ error: "Pedido sem itens." });
  }

  const subtotalFromItems = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = Number(body.subtotal || subtotalFromItems);

  return res.status(201).json({
    id: `DLF-${Date.now()}`,
    status: "created",
    createdAt: new Date().toISOString(),
    channel: String(body.channel || "whatsapp"),
    notes: String(body.notes || ""),
    items,
    subtotal
  });
});

app.get("/api/shipping", (req, res) => {
  const cep = String(req.query.cep || "").replace(/\D+/g, "");
  const subtotal = Number(req.query.subtotal || 0);

  if (cep.length !== 8) {
    return res.status(400).json({
      error: "CEP inválido.",
      message: "Digite um CEP válido com 8 dígitos."
    });
  }

  const freeShipping = subtotal >= freeShippingFrom;
  const shippingCost = freeShipping ? 0 : shippingBase;

  return res.json({
    cep: formatCep(cep),
    subtotal,
    shippingCost,
    freeShipping,
    total: subtotal + shippingCost,
    etaBusinessDays: freeShipping ? "1-3" : "2-5",
    message: freeShipping
      ? "Você atingiu frete grátis. Entrega estimada de 1 a 3 dias úteis."
      : `Frete estimado em ${toCurrency(shippingCost)}. Entrega de 2 a 5 dias úteis.`
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno do servidor." });
});

app.listen(port, () => {
  console.log(`DLF API rodando na porta ${port}`);
});

function parseAllowedOrigins(value) {
  if (!value || value === "*") return true;
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatCep(cep) {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function toCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value || 0));
}
