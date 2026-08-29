const initialiseScrollSpyRails = () => {
  document.querySelectorAll<HTMLElement>('[data-scrollspy-nav]').forEach((nav) => {
    if (nav.dataset.scrollspyReady === 'true') return;
    nav.dataset.scrollspyReady = 'true';

    const links = Array.from(nav.querySelectorAll<HTMLElement>('[data-scrollspy-link]'));
    const items = links.flatMap((link) => {
      const id = link.dataset.scrollspyLink;
      const target = id ? document.getElementById(id) : null;
      return target ? [{ link, target }] : [];
    });

    if (!items.length) return;

    const containerSelector = nav.dataset.scrollspyContainer;
    const container = containerSelector
      ? document.querySelector<HTMLElement>(containerSelector)
      : null;
    const scrollSource: Window | HTMLElement = container ?? window;

    const setActive = (activeLink: HTMLElement) => {
      links.forEach((link) => {
        const active = link === activeLink;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };

    let frame = 0;
    const update = () => {
      frame = 0;
      const threshold = container
        ? container.getBoundingClientRect().top + Math.min(64, container.clientHeight * 0.14)
        : window.innerHeight * 0.28;
      const current = [...items]
        .reverse()
        .find(({ target }) => target.getBoundingClientRect().top <= threshold) ?? items[0];
      setActive(current.link);
    };

    scrollSource.addEventListener('scroll', () => {
      if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    links.forEach((link) => link.addEventListener('click', () => setActive(link)));
    update();
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseScrollSpyRails, { once: true });
} else {
  initialiseScrollSpyRails();
}

document.addEventListener('astro:page-load', initialiseScrollSpyRails);
