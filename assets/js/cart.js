const DLF_CART = (() => {
  const config = window.DLF_CONFIG;
  const key = config.cartStorageKey || "dlf_cart_final_v2";
  const legacyKey = "dlf_cart_final_v1";
  const maxFallbackQuantity = 30;
  let memoryItems = [];
  let storageAvailable;

  function read() {
    const rawItems = readRawItems();
    const items = sanitizeItems(rawItems);
    memoryItems = items;
    return items;
  }

  function save(items) {
    const safeItems = sanitizeItems(items);
    memoryItems = safeItems;

    if (canUseStorage()) {
      try {
        localStorage.setItem(key, JSON.stringify(safeItems));
        if (localStorage.getItem(legacyKey)) {
          localStorage.removeItem(legacyKey);
        }
      } catch (error) {
        console.warn("Não foi possível salvar o carrinho no localStorage.", error);
      }
    }

    document.dispatchEvent(new CustomEvent("dlf:cart", {
      detail: {
        items: safeItems,
        count: safeItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: safeItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      }
    }));
  }

  function getItems() {
    return read();
  }

  function add(product, quantity = 1) {
    if (!product || !product.id) return;

    const items = read();
    const productId = String(product.id);
    const productData = getCatalogMap().get(productId) || product;
    const maxQuantity = resolveMaxQuantity(productData);
    const delta = Math.max(1, Math.floor(Number(quantity || 1)));
    const index = items.findIndex((item) => item.id === productId);

    if (index === -1) {
      items.push({ ...buildItemSnapshot(productData), quantity: clampQuantity(delta, maxQuantity) });
    } else {
      items[index] = {
        ...items[index],
        ...buildItemSnapshot(productData),
        quantity: clampQuantity(items[index].quantity + delta, maxQuantity)
      };
    }

    save(items);
  }

  function update(id, quantity) {
    const productId = String(id || "").trim();
    if (!productId) return;

    const items = read();
    const index = items.findIndex((item) => item.id === productId);
    if (index === -1) return;

    const product = getCatalogMap().get(productId);
    const maxQuantity = resolveMaxQuantity(product);
    const nextQuantity = clampQuantity(quantity, maxQuantity);

    if (nextQuantity <= 0) {
      items.splice(index, 1);
    } else {
      items[index] = { ...items[index], quantity: nextQuantity };
    }

    save(items);
  }

  function remove(id) {
    const productId = String(id || "").trim();
    if (!productId) return;
    save(read().filter((item) => item.id !== productId));
  }

  function clear() {
    save([]);
  }

  function count() {
    return read().reduce((sum, item) => sum + item.quantity, 0);
  }

  function subtotal() {
    return read().reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function format(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.currency
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  function remainingForFreeShipping() {
    return Math.max(0, config.freeShippingFrom - subtotal());
  }

  function hasValidWhatsappNumber() {
    return isValidWhatsappNumber(sanitizePhone(config.whatsappNumber));
  }

  function buildMessage(notes = "") {
    const items = read();

    if (!items.length) {
      return `Olá! Vim pelo site da ${config.storeName} e gostaria de ajuda para escolher um perfume.`;
    }

    const lines = [
      `Olá! Vim pelo site da ${config.storeName} e quero fazer este pedido:`,
      ""
    ];

    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.name} (${item.size})`);
      lines.push(`   Quantidade: ${item.quantity}`);
      lines.push(`   Valor unitário: ${format(item.price)}`);
      lines.push(`   Total item: ${format(item.price * item.quantity)}`);
    });

    lines.push("", `Itens no carrinho: ${count()}`);
    lines.push(`Subtotal: ${format(subtotal())}`);
    lines.push("Frete/retirada: a combinar");

    if (notes && String(notes).trim()) {
      lines.push("", `Observações: ${String(notes).trim()}`);
    }

    lines.push("", "Pode confirmar disponibilidade, prazo e forma de pagamento?");
    return lines.join("\n");
  }

  function whatsappUrl(message) {
    const number = sanitizePhone(config.whatsappNumber);
    if (!isValidWhatsappNumber(number)) return null;

    const base = String(config.whatsappBaseUrl || "https://wa.me").replace(/\/+$/, "");
    return `${base}/${number}?text=${encodeURIComponent(String(message || ""))}`;
  }

  function readRawItems() {
    if (!canUseStorage()) {
      return memoryItems;
    }

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }

      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        const legacyItems = JSON.parse(legacyRaw);
        localStorage.setItem(key, JSON.stringify(legacyItems));
        localStorage.removeItem(legacyKey);
        return legacyItems;
      }
    } catch (error) {
      console.warn("Não foi possível ler o carrinho salvo. Usando memória temporária.", error);
    }

    return memoryItems;
  }

  function sanitizeItems(items) {
    const catalog = getCatalogMap();
    const safeItems = [];

    (Array.isArray(items) ? items : []).forEach((rawItem) => {
      const id = String(rawItem?.id || "").trim();
      if (!id) return;

      const product = catalog.get(id);
      const maxQuantity = resolveMaxQuantity(product);
      const quantity = clampQuantity(rawItem.quantity, maxQuantity);
      if (quantity <= 0) return;

      const baseItem = product ? buildItemSnapshot(product) : {
        id,
        name: String(rawItem.name || "Produto"),
        category: String(rawItem.category || "Perfume"),
        family: String(rawItem.family || ""),
        price: sanitizePrice(rawItem.price),
        image: normalizeImage(rawItem.image),
        size: String(rawItem.size || "50ml")
      };

      safeItems.push({ ...baseItem, quantity });
    });

    return safeItems;
  }

  function buildItemSnapshot(product) {
    return {
      id: String(product.id),
      name: String(product.name || "Produto"),
      category: String(product.category || "Perfume"),
      family: String(product.family || ""),
      price: sanitizePrice(product.price),
      image: normalizeImage(product.image),
      size: String(product.size || "50ml")
    };
  }

  function normalizeImage(image) {
    const value = String(image || "").trim();
    if (!value) return "assets/img/brand/mark.svg";
    if (/^https?:\/\//i.test(value) || value.startsWith("assets/")) return value;
    return `assets/img/produtos/${value}`;
  }

  function sanitizePrice(value) {
    const amount = Number(value || 0);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }

  function resolveMaxQuantity(product) {
    const stock = Number(product?.stock);
    if (!Number.isFinite(stock)) return maxFallbackQuantity;
    return Math.max(1, Math.min(maxFallbackQuantity, Math.floor(stock)));
  }

  function clampQuantity(value, maxQuantity) {
    const quantity = Math.floor(Number(value));
    if (!Number.isFinite(quantity)) return 1;
    if (quantity <= 0) return 0;
    return Math.min(quantity, Math.max(1, Math.floor(Number(maxQuantity || maxFallbackQuantity))));
  }

  function getCatalogMap() {
    return new Map((Array.isArray(window.DLF_PRODUCTS) ? window.DLF_PRODUCTS : []).map((product) => [product.id, product]));
  }

  function sanitizePhone(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function isValidWhatsappNumber(number) {
    return number.length >= 10 && number.length <= 15;
  }

  function canUseStorage() {
    if (typeof storageAvailable === "boolean") return storageAvailable;

    try {
      const probeKey = "__dlf_storage_probe__";
      localStorage.setItem(probeKey, "1");
      localStorage.removeItem(probeKey);
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }

    return storageAvailable;
  }

  return {
    getItems,
    add,
    update,
    remove,
    clear,
    count,
    subtotal,
    format,
    remainingForFreeShipping,
    buildMessage,
    whatsappUrl,
    hasValidWhatsappNumber
  };
})();
