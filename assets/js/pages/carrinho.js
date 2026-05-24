document.addEventListener("DOMContentLoaded", () => {
  const list = DLF_UI.$("[data-cart-page-items]");
  const subtotal = DLF_UI.$("[data-page-subtotal]");
  const total = DLF_UI.$("[data-page-total]");
  const shipping = DLF_UI.$("[data-page-shipping]");
  const empty = DLF_UI.$("[data-cart-empty]");
  const checkoutButton = DLF_UI.$("[data-checkout]");
  const clearButton = DLF_UI.$("[data-clear-cart]");
  const notesField = DLF_UI.$("[data-notes]");

  if (!list || !subtotal || !total || !shipping || !empty || !checkoutButton || !clearButton || !notesField) return;

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
      DLF_UI.toast("Produto removido do carrinho.");
    }
  });

  checkoutButton.addEventListener("click", async () => {
    if (!DLF_CART.hasValidWhatsappNumber()) {
      DLF_UI.toast("Configure um número de WhatsApp válido em assets/js/runtime-config.js.");
      return;
    }

    const items = DLF_CART.getItems();
    if (!items.length) {
      DLF_UI.toast("Seu carrinho está vazio.");
      return;
    }

    checkoutButton.disabled = true;
    checkoutButton.textContent = "Preparando pedido...";

    try {
      const notes = notesField.value;
      const order = await DLF_API.createOrder({
        items,
        subtotal: DLF_CART.subtotal(),
        notes,
        channel: "whatsapp"
      });

      if (order?.fallback) {
        DLF_UI.toast("API indisponível. Pedido pronto e enviado pelo WhatsApp.");
      }

      DLF_UI.openWhatsAppChat(DLF_CART.buildMessage(notes), { sameTab: true });
    } catch (error) {
      console.error(error);
      DLF_UI.toast("Não foi possível iniciar o checkout. Tente novamente.");
    } finally {
      checkoutButton.disabled = false;
      checkoutButton.textContent = "Finalizar pelo WhatsApp";
    }
  });

  clearButton.addEventListener("click", () => {
    if (!DLF_CART.getItems().length) {
      DLF_UI.toast("O carrinho já está vazio.");
      return;
    }

    DLF_CART.clear();
    DLF_UI.toast("Carrinho limpo.");
  });

  document.addEventListener("dlf:cart", render);
  render();

  function render() {
    const items = DLF_CART.getItems();
    empty.hidden = items.length > 0;

    list.innerHTML = items.map((item) => `
      <article class="cart-item reveal">
        <img src="${item.image}" alt="${item.name}">
        <div>
          <h3>${item.name}</h3>
          <p>${item.size} · ${item.family}</p>
          <strong>${DLF_CART.format(item.price)}</strong>
          <div class="drawer-qty">
            <button type="button" data-dec="${item.id}" aria-label="Diminuir quantidade">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-inc="${item.id}" aria-label="Aumentar quantidade">+</button>
            <button type="button" class="remove" data-remove="${item.id}">Remover</button>
          </div>
        </div>
        <b>${DLF_CART.format(item.price * item.quantity)}</b>
      </article>`).join("");

    const subtotalValue = DLF_CART.subtotal();
    subtotal.textContent = DLF_CART.format(subtotalValue);
    total.textContent = DLF_CART.format(subtotalValue);
    DLF_UI.renderFreeShipping(shipping);

    checkoutButton.disabled = !items.length;
    clearButton.disabled = !items.length;
    if (!items.length) {
      list.innerHTML = "";
    }

    DLF_UI.reveal();
  }
});
