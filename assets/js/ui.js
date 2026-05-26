const DLF_UI = (() => {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  let products = [];
  let productsPromise = null;
  let revealObserver = null;
  const boundProductActionScopes = new WeakSet();

  function productImg(product) {
    const image = String(product?.image || "").trim();
    if (!image) return "assets/img/brand/mark.svg";
    return image.startsWith("assets/") ? image : `assets/img/produtos/${image}`;
  }

  function posterImg(product) {
    const poster = String(product?.poster || product?.image || "").trim();
    if (!poster) return "assets/img/brand/mark.svg";
    return poster.startsWith("assets/") ? poster : `assets/img/produtos/${poster}`;
  }

  function productUrl(product) {
    return `produto.html?id=${encodeURIComponent(product.id)}`;
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function toast(message) {
    const el = $("[data-toast]");
    if (!el) return;

    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("is-visible"), 2600);
  }

  function updateCartCount() {
    const count = DLF_CART.count();
    $$("[data-cart-count]").forEach((el) => {
      el.textContent = count;
    });
  }

  function highlightCurrentNav() {
    const links = $$("[data-nav] a");
    if (!links.length) return;

    const currentPath = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const currentQuery = location.search ? location.search.slice(1) : "";
    const currentRef = currentQuery ? `${currentPath}?${currentQuery}` : currentPath;

    let activeLink = links.find((link) => normalizeHref(link.getAttribute("href")).toLowerCase() === currentRef);

    if (!activeLink && currentPath === "produto.html") {
      activeLink = links.find((link) => {
        const { path, query } = splitHref(normalizeHref(link.getAttribute("href")).toLowerCase());
        return path === "produtos.html" && !query;
      });
    }

    if (!activeLink) {
      activeLink = links.find((link) => splitHref(normalizeHref(link.getAttribute("href")).toLowerCase()).path === currentPath);
    }

    links.forEach((link) => {
      const isActive = link === activeLink;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function normalizeHref(value) {
    return String(value || "").trim().replace(/^\.\//, "").replace(/^\/+/, "");
  }

  function splitHref(href) {
    const [path, query = ""] = href.split("?");
    return { path, query };
  }

  function productCard(product) {
    const old = product.oldPrice ? `<del>${DLF_CART.format(product.oldPrice)}</del>` : "";
    const tags = Array.isArray(product.tags) ? product.tags : [];
    const installments = Math.max(1, Number(product.installments || 1));

    return `
      <article class="product-card reveal" data-product-id="${product.id}">
        <a class="product-card__media" href="${productUrl(product)}" aria-label="Ver ${product.name}">
          <img src="${productImg(product)}" alt="${product.name}" loading="lazy">
          <span>${product.badge || "Coleção"}</span>
        </a>
        <div class="product-card__body">
          <div class="product-card__meta">${product.category} · ${product.family}</div>
          <h3><a href="${productUrl(product)}">${product.name}</a></h3>
          <p>${product.mood || ""}</p>
          <div class="product-card__tags">${tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join("")}</div>
          <div class="product-card__price">${old}<strong>${DLF_CART.format(product.price)}</strong></div>
          <small>${installments}x de ${DLF_CART.format(product.price / installments)} sem juros</small>
          <div class="product-card__actions">
            <button type="button" data-buy="${product.id}">Comprar</button>
            <button type="button" class="ghost" data-quick="${product.id}">Espiar</button>
          </div>
        </div>
      </article>`;
  }

  function renderFreeShipping(target) {
    if (!target) return;

    const total = DLF_CART.subtotal();
    const goal = Math.max(1, Number(window.DLF_CONFIG.freeShippingFrom || 0));
    const remaining = Math.max(0, goal - total);
    const pct = Math.min(100, Math.round((total / goal) * 100));

    if (remaining <= 0) {
      target.innerHTML = "<strong>Você ganhou frete grátis.</strong><div class=\"shipping-bar\"><span style=\"width:100%\"></span></div>";
      return;
    }

    target.innerHTML = `<strong>Faltam ${DLF_CART.format(remaining)} para frete grátis.</strong><div class="shipping-bar"><span style="width:${pct}%"></span></div>`;
  }

  function drawerItem(item) {
    return `
      <article class="drawer-item">
        <img src="${item.image}" alt="${item.name}">
        <div>
          <h3>${item.name}</h3>
          <p>${item.size} · ${item.category}</p>
          <strong>${DLF_CART.format(item.price * item.quantity)}</strong>
          <div class="drawer-qty">
            <button type="button" data-dec="${item.id}" aria-label="Diminuir quantidade">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-inc="${item.id}" aria-label="Aumentar quantidade">+</button>
            <button type="button" class="remove" data-remove="${item.id}">Remover</button>
          </div>
        </div>
      </article>`;
  }

  function bindDrawerActions() {
    const list = $("[data-drawer-items]");
    if (!list || list.dataset.bound === "1") return;

    list.dataset.bound = "1";
    list.addEventListener("click", (event) => {
      const inc = event.target.closest("[data-inc]");
      if (inc) {
        const item = DLF_CART.getItems().find((entry) => entry.id === inc.dataset.inc);
        if (item) DLF_CART.update(item.id, item.quantity + 1);
        return;
      }

      const dec = event.target.closest("[data-dec]");
      if (dec) {
        const item = DLF_CART.getItems().find((entry) => entry.id === dec.dataset.dec);
        if (item) DLF_CART.update(item.id, item.quantity - 1);
        return;
      }

      const remove = event.target.closest("[data-remove]");
      if (remove) {
        DLF_CART.remove(remove.dataset.remove);
        toast("Produto removido.");
      }
    });
  }

  function renderDrawer() {
    const list = $("[data-drawer-items]");
    const total = $("[data-drawer-subtotal]");
    const shipping = $("[data-drawer-shipping]");
    if (!list || !total) return;

    const items = DLF_CART.getItems();
    list.innerHTML = items.length
      ? items.map(drawerItem).join("")
      : '<div class="empty-state"><strong>Carrinho vazio.</strong><p>Adicione um perfume para continuar.</p></div>';

    total.textContent = DLF_CART.format(DLF_CART.subtotal());
    renderFreeShipping(shipping);
  }

  function openDrawer() {
    renderDrawer();
    $("[data-drawer]")?.classList.add("is-open");
    $("[data-overlay]")?.classList.add("is-open");
    document.body.classList.add("no-scroll");
  }

  function closeDrawer() {
    $("[data-drawer]")?.classList.remove("is-open");
    $("[data-quick-view]")?.classList.remove("is-open");
    $("[data-overlay]")?.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
  }

  function openQuick(id) {
    const product = products.find((item) => item.id === id);
    const modal = $("[data-quick-view]");
    if (!product || !modal) return;

    const installments = Math.max(1, Number(product.installments || 1));
    const tags = Array.isArray(product.tags) ? product.tags : [];

    modal.innerHTML = `
      <button type="button" class="quick-close" data-close aria-label="Fechar">×</button>
      <img src="${posterImg(product)}" alt="${product.name}">
      <div>
        <span class="kicker">${product.category} · ${product.family}</span>
        <h2>${product.name}</h2>
        <p>${product.description || ""}</p>
        <div class="note-row">${tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
        <div class="modal-price"><strong>${DLF_CART.format(product.price)}</strong><small>${installments}x de ${DLF_CART.format(product.price / installments)} sem juros</small></div>
        <button type="button" class="btn primary" data-buy="${product.id}">Adicionar ao carrinho</button>
        <a class="btn line" href="${productUrl(product)}">Ver página do produto</a>
      </div>`;

    modal.classList.add("is-open");
    $("[data-overlay]")?.classList.add("is-open");
    document.body.classList.add("no-scroll");

    $("[data-close]", modal)?.addEventListener("click", closeDrawer);
    bindProductActions(modal);
  }

  function bindProductActions(scope = document) {
    if (!scope || boundProductActionScopes.has(scope)) return;

    boundProductActionScopes.add(scope);
    scope.addEventListener("click", (event) => {
      const buyButton = event.target.closest("[data-buy]");
      if (buyButton && scope.contains(buyButton)) {
        const product = products.find((item) => item.id === buyButton.dataset.buy);
        if (!product) return;
        DLF_CART.add(product, 1);
        toast(`${product.name} adicionado ao carrinho.`);
        openDrawer();
        return;
      }

      const quickButton = event.target.closest("[data-quick]");
      if (quickButton && scope.contains(quickButton)) {
        openQuick(quickButton.dataset.quick);
      }
    });
  }

  function openWhatsAppChat(message, { sameTab = false } = {}) {
    const url = DLF_CART.whatsappUrl(message);

    if (!url) {
      toast("Número de WhatsApp inválido. Ajuste em assets/js/runtime-config.js.");
      return false;
    }

    if (sameTab) {
      location.href = url;
      return true;
    }

    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      location.href = url;
    }
    return true;
  }

  async function checkoutFromDrawer() {
    if (!DLF_CART.hasValidWhatsappNumber()) {
      toast("Configure um número de WhatsApp válido em assets/js/runtime-config.js.");
      return;
    }

    const items = DLF_CART.getItems();
    if (!items.length) {
      toast("Seu carrinho está vazio.");
      return;
    }

    const order = await DLF_API.createOrder({ items, subtotal: DLF_CART.subtotal(), channel: "whatsapp" });
    if (order?.fallback) {
      toast("API indisponível. Pedido preparado localmente e enviado no WhatsApp.");
    }

    openWhatsAppChat(DLF_CART.buildMessage(), { sameTab: true });
  }

  function setupHeader() {
    $("[data-menu-toggle]")?.addEventListener("click", () => $("[data-nav]")?.classList.toggle("is-open"));
    $("[data-cart-open]")?.addEventListener("click", openDrawer);

    $$("[data-close-drawer], [data-overlay]").forEach((el) => {
      el.addEventListener("click", closeDrawer);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDrawer();
    });

    $("[data-drawer-checkout]")?.addEventListener("click", () => {
      checkoutFromDrawer().catch((error) => {
        console.error(error);
        toast("Não foi possível iniciar o checkout. Tente novamente.");
      });
    });

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-whatsapp]");
      if (!trigger) return;

      event.preventDefault();
      openWhatsAppChat(window.DLF_CONFIG.whatsappGreeting);
    });

    $("[data-search-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const q = new FormData(event.currentTarget).get("q") || "";
      location.href = `produtos.html?busca=${encodeURIComponent(String(q))}`;
    });

    highlightCurrentNav();
  }

  function reveal() {
    const elements = $$(".reveal:not(.is-visible)");
    if (!elements.length) return;

    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08 });
    }

    elements.forEach((el) => revealObserver.observe(el));
  }

  async function loadProducts() {
    if (!productsPromise) {
      productsPromise = DLF_API.getProducts()
        .then((data) => {
          products = Array.isArray(data) ? data : [];
          return products;
        })
        .catch((error) => {
          console.error("Falha ao carregar catálogo.", error);
          products = [];
          return products;
        });
    }

    return productsPromise;
  }

  function init() {
    setupHeader();
    bindDrawerActions();
    updateCartCount();
    renderDrawer();
    reveal();

    document.addEventListener("dlf:cart", () => {
      updateCartCount();
      renderDrawer();
    });
  }

  return {
    $,
    $$,
    normalize,
    loadProducts,
    productCard,
    bindProductActions,
    reveal,
    productImg,
    posterImg,
    productUrl,
    toast,
    openDrawer,
    init,
    renderFreeShipping,
    openWhatsAppChat
  };
})();

// Inicializa o UI mesmo que o script seja carregado após o evento DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", DLF_UI.init);
} else {
  try {
    DLF_UI.init();
  } catch (err) {
    console.error("Falha ao inicializar DLF_UI:", err);
  }
}
