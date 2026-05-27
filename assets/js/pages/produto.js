document.addEventListener("DOMContentLoaded", async () => {
  const page = DLF_UI.$("[data-product-page]");
  const related = DLF_UI.$("[data-related-products]");

  if (!page || !related) return;

  try {
    const products = await DLF_UI.loadProducts();
    const params = new URLSearchParams(location.search);
    const paramId = params.get("id") || "";
    const fallbackId = products[0]?.id || "";
    const product = await DLF_API.getProduct(paramId || fallbackId);

    if (!product) {
      page.innerHTML = '<div class="empty-state"><strong>Produto não encontrado.</strong><p>Volte ao catálogo e escolha outro perfume.</p></div>';
      related.innerHTML = products.slice(0, 4).map(DLF_UI.productCard).join("");
      DLF_UI.bindProductActions(related);
      DLF_UI.reveal();
      return;
    }

    const tags = Array.isArray(product.tags) ? product.tags : [];
    const gallery = Array.isArray(product.gallery) && product.gallery.length ? product.gallery : [product.poster || product.image];
    const stockLimit = Math.max(1, Math.floor(Number(product.stock || 30)));
    const installments = Math.max(1, Number(product.installments || 1));

    document.title = `${product.name} | D'La France`;
    page.innerHTML = `
      <section class="detail-gallery reveal">
        <div class="detail-main-image"><img src="${DLF_UI.posterImg(product)}" alt="${product.name}" data-main-image></div>
        <div class="thumbs">
          ${gallery.map((img, index) => {
            const src = String(img || "").startsWith("assets/") ? String(img) : `assets/img/produtos/${img}`;
            return `<button type="button" class="${index === 0 ? "active" : ""}" data-thumb="${src}"><img src="${src}" alt="${product.name} imagem ${index + 1}"></button>`;
          }).join("")}
        </div>
      </section>
      <aside class="detail-info reveal">
        <nav class="breadcrumb"><a href="/">Início</a><span>/</span><a href="/produtos">Perfumes</a><span>/</span><strong>${product.name}</strong></nav>
        <span class="kicker">${product.category} · ${product.family}</span>
        <h1>${product.name}</h1>
        <p>${product.subtitle || ""}</p>
        <div class="note-row">${tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
        <div class="detail-price">${product.oldPrice ? `<del>${DLF_CART.format(product.oldPrice)}</del>` : ""}<strong>${DLF_CART.format(product.price)}</strong><small>${installments}x de ${DLF_CART.format(product.price / installments)} sem juros</small></div>
        <div class="stock">${stockLimit <= 5 ? `Últimas ${stockLimit} unidades.` : `${stockLimit} unidades em estoque.`}</div>
        <div class="qty-line"><span>Quantidade</span><div><button type="button" data-minus>−</button><strong data-qty>1</strong><button type="button" data-plus>+</button></div></div>
        <button type="button" class="btn primary full" data-detail-buy>Adicionar ao carrinho</button>
        <button type="button" class="btn line full" data-whatsapp>Falar com consultor</button>
        <div class="shipping-card"><label>Calcular entrega<input type="text" placeholder="Seu CEP" data-cep inputmode="numeric" maxlength="9"></label><button type="button" data-shipping>Consultar</button><small data-shipping-result>Frete e prazo serão confirmados pelo WhatsApp.</small></div>
      </aside>
      <section class="detail-description reveal">
        <h2>Descrição</h2>
        <p>${product.description || ""}</p>
        <div class="notes-grid">
          <article><h3>Notas de saída</h3><ul>${(product.topNotes || []).map((note) => `<li>${note}</li>`).join("")}</ul></article>
          <article><h3>Notas de coração</h3><ul>${(product.heartNotes || []).map((note) => `<li>${note}</li>`).join("")}</ul></article>
          <article><h3>Notas de fundo</h3><ul>${(product.baseNotes || []).map((note) => `<li>${note}</li>`).join("")}</ul></article>
        </div>
      </section>`;

    let qty = 1;
    const qtyLabel = DLF_UI.$("[data-qty]", page);

    const updateQtyView = () => {
      qtyLabel.textContent = String(qty);
    };

    DLF_UI.$("[data-minus]", page).addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      updateQtyView();
    });

    DLF_UI.$("[data-plus]", page).addEventListener("click", () => {
      qty = Math.min(stockLimit, qty + 1);
      updateQtyView();
      if (qty === stockLimit) {
        DLF_UI.toast("Quantidade máxima deste produto no estoque atingida.");
      }
    });

    DLF_UI.$("[data-detail-buy]", page).addEventListener("click", () => {
      DLF_CART.add(product, qty);
      DLF_UI.toast(`${product.name} adicionado ao carrinho.`);
      DLF_UI.openDrawer();
    });

    DLF_UI.$$("[data-thumb]", page).forEach((button) => {
      button.addEventListener("click", () => {
        DLF_UI.$$("[data-thumb]", page).forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        const main = DLF_UI.$("[data-main-image]", page);
        main.src = button.dataset.thumb;
      });
    });

    const cepInput = DLF_UI.$("[data-cep]", page);
    const shippingResult = DLF_UI.$("[data-shipping-result]", page);

    cepInput.addEventListener("input", () => {
      const digits = cepInput.value.replace(/\D+/g, "").slice(0, 8);
      cepInput.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    });

    DLF_UI.$("[data-shipping]", page).addEventListener("click", async () => {
      const cleanCep = cepInput.value.replace(/\D+/g, "");
      if (cleanCep.length < 8) {
        shippingResult.textContent = "Digite um CEP válido com 8 dígitos.";
        return;
      }

      shippingResult.textContent = "Consultando...";
      try {
        const simulatedSubtotal = qty * Number(product.price || 0);
        const result = await DLF_API.calculateShipping(cleanCep, simulatedSubtotal);
        shippingResult.textContent = result.message || "Frete e prazo serão confirmados no WhatsApp.";
      } catch (error) {
        console.error(error);
        shippingResult.textContent = "Não foi possível consultar agora. Tente novamente.";
      }
    });

    const similar = products
      .filter((item) => item.id !== product.id && item.category === product.category)
      .slice(0, 4);

    related.innerHTML = similar.length
      ? similar.map(DLF_UI.productCard).join("")
      : products.filter((item) => item.id !== product.id).slice(0, 4).map(DLF_UI.productCard).join("");

    DLF_UI.bindProductActions(related);
    DLF_UI.reveal();
  } catch (error) {
    console.error(error);
    page.innerHTML = '<div class="empty-state"><strong>Não foi possível carregar este produto.</strong><p>Tente novamente em alguns instantes.</p></div>';
    related.innerHTML = "";
  }
});
