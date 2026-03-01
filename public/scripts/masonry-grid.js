(() => {
  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const getItems = (grid) =>
    [...grid.children].filter((child) =>
      child.classList.contains('card') || child.classList.contains('home-card')
    );

  const applyMasonry = (grid) => {
    const items = getItems(grid);
    if (items.length === 0) return;

    if (grid.dataset.randomize === 'true') {
      const fragment = document.createDocumentFragment();
      shuffle(items).forEach((item) => fragment.appendChild(item));
      grid.appendChild(fragment);
    }

    const resizeItem = (item) => {
      const styles = getComputedStyle(grid);
      const row = parseFloat(styles.getPropertyValue('grid-auto-rows'));
      const gap = parseFloat(styles.getPropertyValue('gap'));
      if (!row) return;
      item.style.gridRowEnd = 'auto';
      const height = item.scrollHeight || item.getBoundingClientRect().height;
      const span = Math.ceil((height + gap) / (row + gap));
      item.style.gridRowEnd = `span ${span}`;
    };

    const refresh = () => getItems(grid).forEach(resizeItem);
    const observer = new ResizeObserver(refresh);

    getItems(grid).forEach((item) => observer.observe(item));
    window.addEventListener('load', refresh, { once: true });
    window.addEventListener('resize', refresh);
    grid.dataset.masonryReady = 'true';
    refresh();
  };

  const init = () => {
    document
      .querySelectorAll('[data-masonry-grid], [data-masonry]')
      .forEach((grid) => applyMasonry(grid));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
