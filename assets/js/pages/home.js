document.addEventListener("DOMContentLoaded", async () => {
  const grid = DLF_UI.$("[data-home-products]");
  const featured = DLF_UI.$("[data-featured-card]");

  if (!grid) return;

  try {
    const products = await DLF_UI.loadProducts();

    if (!products.length) {
      grid.innerHTML = '<div class="empty-state span-all"><strong>Não foi possível carregar o catálogo.</strong><p>Tente atualizar a página em instantes.</p></div>';
      return;
    }

    grid.innerHTML = products.map(DLF_UI.productCard).join("");
    DLF_UI.bindProductActions(grid);

    const featuredProduct = products.find((product) => product.id === "velvet-rose") || products[0];
    if (featured && featuredProduct) {
      featured.innerHTML = `
        <img src="${DLF_UI.posterImg(featuredProduct)}" alt="${featuredProduct.name}">
        <div>
          <span class="kicker">Fragrância em destaque</span>
          <h2>${featuredProduct.name}</h2>
          <p>${featuredProduct.description || ""}</p>
          <a class="btn primary" href="${DLF_UI.productUrl(featuredProduct)}">Conhecer perfume</a>
        </div>`;
    }

    DLF_UI.reveal();
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<div class="empty-state span-all"><strong>Ocorreu um erro ao carregar a home.</strong><p>Atualize a página para tentar novamente.</p></div>';
  }
});
