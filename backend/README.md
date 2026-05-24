# D'La France API (Render)

API simples para catálogo, pedido e frete.

## Rodar local

```bash
cd backend
npm install
npm run dev
```

API em `http://localhost:10000`.

## Variáveis de ambiente

- `PORT` (opcional): porta da API (padrão `10000`).
- `CORS_ORIGIN`: domínio do frontend (ex.: `https://loja.vercel.app`). Pode ser lista separada por vírgula.
- `FREE_SHIPPING_FROM`: valor mínimo para frete grátis (padrão `400`).
- `SHIPPING_BASE`: valor base do frete quando não é grátis (padrão `19.9`).

## Endpoints

- `GET /health`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `GET /api/shipping?cep=00000000&subtotal=149.9`
