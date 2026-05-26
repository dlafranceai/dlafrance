const DLF_API = (() => {
  const config = window.DLF_CONFIG;

  async function getProducts() {
    if (!config.useBackend) return cloneProducts(window.DLF_PRODUCTS);
    try {
      return await fetchJson(config.endpoints.products);
    } catch (error) {
      console.warn("Falha ao buscar produtos no backend. Usando catálogo local.", error);
      return cloneProducts(window.DLF_PRODUCTS);
    }
  }

  async function getProduct(id) {
    const productId = String(id || "").trim();
    if (!productId) return null;

    if (!config.useBackend) {
      return findLocalProduct(productId);
    }

    try {
      const url = config.endpoints.product.replace(":id", encodeURIComponent(productId));
      return await fetchJson(url, { allow404: true });
    } catch (error) {
      console.warn(`Falha ao buscar produto ${productId} no backend.`, error);
      return findLocalProduct(productId);
    }
  }

  async function createOrder(payload) {
    const safePayload = sanitizeOrderPayload(payload);

    if (!config.useBackend) {
      return buildDraftOrder(safePayload);
    }

    try {
      return await fetchJson(config.endpoints.orders, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safePayload)
      });
    } catch (error) {
      console.warn("Falha ao criar pedido no backend. Criando pedido local para não bloquear checkout.", error);
      return { ...buildDraftOrder(safePayload), fallback: true, fallbackReason: error.message };
    }
  }

  async function calculateShipping(cep, subtotal) {
    const cleanCep = String(cep || "").replace(/\D+/g, "");
    const safeSubtotal = Number(subtotal || 0);

    if (!cleanCep) {
      return {
        cep: "",
        subtotal: safeSubtotal,
        freeShipping: safeSubtotal >= config.freeShippingFrom,
        message: "Digite um CEP válido para consultar entrega."
      };
    }

    if (!config.useBackend) {
      return localShippingQuote(cleanCep, safeSubtotal);
    }

    try {
      const query = new URLSearchParams({ cep: cleanCep, subtotal: String(safeSubtotal) });
      return await fetchJson(`${config.endpoints.shipping}?${query.toString()}`);
    } catch (error) {
      console.warn("Falha ao calcular frete no backend. Usando resposta local.", error);
      return localShippingQuote(cleanCep, safeSubtotal);
    }
  }

  function sanitizeOrderPayload(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    const items = Array.isArray(data.items) ? data.items : [];
    const sanitizedItems = items
      .map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || "").slice(0, 250),
        quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
        price: Number(item.price || 0)
      }))
      .filter((item) => item.id && Number.isFinite(item.price));

    const customer = data.customer && typeof data.customer === 'object'
      ? {
          name: String(data.customer.name || '').slice(0, 250),
          phone: String(data.customer.phone || '').replace(/\D+/g, '')
        }
      : null;

    return {
      items: sanitizedItems,
      subtotal: Number(data.subtotal || 0),
      notes: String(data.notes || '').slice(0, 1000),
      channel: String(data.channel || 'whatsapp'),
      customer
    };
  }

  function localShippingQuote(cep, subtotal) {
    const freeShipping = subtotal >= config.freeShippingFrom;
    const message = freeShipping
      ? "Você atingiu frete grátis. Prazo e detalhes serão confirmados no WhatsApp."
      : "Frete e prazo serão confirmados pela loja no WhatsApp.";

    return { cep, subtotal, freeShipping, message };
  }

  function buildDraftOrder(payload) {
    return {
      id: `DLF-${Date.now()}`,
      status: "draft",
      createdAt: new Date().toISOString(),
      channel: "whatsapp",
      ...payload
    };
  }

  function findLocalProduct(id) {
    return window.DLF_PRODUCTS.find((product) => product.id === id) || null;
  }

  function cloneProducts(products) {
    return (Array.isArray(products) ? products : []).map((product) => ({ ...product }));
  }

  async function fetchJson(url, options = {}) {
    const { timeoutMs = config.requestTimeoutMs, allow404 = false, ...fetchOptions } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(fetchOptions.headers || {})
        }
      });

      if (allow404 && response.status === 404) return null;

      if (!response.ok) {
        throw new Error(`Erro ${response.status} ao acessar ${url}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return response.json();
      }

      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("A API retornou um formato inválido.");
      }
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Tempo de resposta da API excedido.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return { getProducts, getProduct, createOrder, calculateShipping };
})();
