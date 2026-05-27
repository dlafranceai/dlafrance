(() => {
  const defaultConfig = {
    storeName: "D'La France",
    whatsappNumber: "5534996829438",
    whatsappGreeting: "Branch Tests",
    currency: "BRL",
    locale: "pt-BR",
    freeShippingFrom: 400,
    cartStorageKey: "dlf_cart_final_v2",
    useBackend: true,
    apiBaseUrl: "http://localhost:10000",
    requestTimeoutMs: 8000,
    endpoints: {
      products: "/api/products",
      product: "/api/products/:id",
      orders: "/api/orders",
      shipping: "/api/shipping"
    }
  };

  const runtime = window.DLF_RUNTIME && typeof window.DLF_RUNTIME === "object" ? window.DLF_RUNTIME : {};
  const merged = {
    ...defaultConfig,
    ...runtime,
    endpoints: {
      ...defaultConfig.endpoints,
      ...(runtime.endpoints || {})
    }
  };

  merged.useBackend = Boolean(merged.useBackend);
  merged.apiBaseUrl = normalizeBaseUrl(merged.apiBaseUrl);
  merged.whatsappNumber = sanitizePhone(merged.whatsappNumber);
  merged.endpoints = Object.fromEntries(
    Object.entries(merged.endpoints).map(([key, endpoint]) => [key, resolveEndpoint(endpoint, merged.apiBaseUrl)])
  );

  window.DLF_CONFIG = merged;

  function sanitizePhone(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function normalizeBaseUrl(value) {
    if (typeof value !== "string") return "";
    const clean = value.trim();
    if (!clean) return "";
    return clean.replace(/\/+$/, "");
  }

  function resolveEndpoint(endpoint, baseUrl) {
    if (typeof endpoint !== "string" || !endpoint) return endpoint;
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    if (!baseUrl) return endpoint;
    return endpoint.startsWith("/") ? `${baseUrl}${endpoint}` : `${baseUrl}/${endpoint}`;
  }
})();
