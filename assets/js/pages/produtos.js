document.addEventListener("DOMContentLoaded", async () => {
  const grid = DLF_UI.$("[data-products-grid]");
  const form = DLF_UI.$("[data-filter-form]");
  const count = DLF_UI.$("[data-count]");
  const clearButton = DLF_UI.$("[data-clear]");

  if (!grid || !form || !count || !clearButton) return;

  const params = new URLSearchParams(location.search);
  form.search.value = params.get("busca") || params.get("q") || "";
  form.category.value = params.get("categoria") || "";
  form.family.value = params.get("familia") || "";
  form.sort.value = params.get("ordem") || "default";

  const syncUrl = (filters) => {
    const nextParams = new URLSearchParams();

    if (filters.search) nextParams.set("busca", filters.search);
    if (filters.category) nextParams.set("categoria", filters.category);
    if (filters.family) nextParams.set("familia", filters.family);
    if (filters.sort && filters.sort !== "default") nextParams.set("ordem", filters.sort);

    const query = nextParams.toString();
    const nextUrl = query ? `produtos.html?${query}` : "produtos.html";
    history.replaceState({}, "", nextUrl);
  };

  try {
    const products = await DLF_UI.loadProducts();

    const render = () => {
      const data = new FormData(form);
      const rawSearch = String(data.get("search") || "").trim();
      const search = DLF_UI.normalize(rawSearch);
      const category = String(data.get("category") || "");
      const familyRaw = String(data.get("family") || "").trim();
      const family = DLF_UI.normalize(familyRaw);
      const sort = String(data.get("sort") || "default");

      let result = products.filter((product) => {
        const text = DLF_UI.normalize([
          product.name,
          product.category,
          product.family,
          product.mood,
          product.description,
          ...(Array.isArray(product.tags) ? product.tags : []),
          ...(Array.isArray(product.topNotes) ? product.topNotes : []),
          ...(Array.isArray(product.heartNotes) ? product.heartNotes : []),
          ...(Array.isArray(product.baseNotes) ? product.baseNotes : [])
        ].join(" "));

        return (!search || text.includes(search))
          && (!category || product.category === category)
          && (!family || text.includes(family));
      });

      if (sort === "price_asc") result = [...result].sort((a, b) => a.price - b.price);
      if (sort === "price_desc") result = [...result].sort((a, b) => b.price - a.price);
      if (sort === "name") result = [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      count.textContent = String(result.length);
      grid.innerHTML = result.length
        ? result.map(DLF_UI.productCard).join("")
        : '<div class="empty-state span-all"><strong>Nenhum perfume encontrado.</strong><p>Tente remover filtros ou buscar por outra nota olfativa.</p></div>';

      syncUrl({ search: rawSearch, category, family: familyRaw, sort });
      DLF_UI.bindProductActions(grid);
      DLF_UI.reveal();
    };

    form.addEventListener("input", render);
    form.addEventListener("change", render);

    clearButton.addEventListener("click", () => {
      form.reset();
      history.replaceState({}, "", "produtos.html");
      render();
    });

    render();
  } catch (error) {
    console.error(error);
    count.textContent = "0";
    grid.innerHTML = '<div class="empty-state span-all"><strong>Erro ao carregar catálogo.</strong><p>Tente novamente em alguns instantes.</p></div>';
  }
});
