/* =============================================================
   INDICE DELLE PAGINE LEGALI (privacy.html, terms.html)
   - Schermi larghi: indice sempre aperto, a destra e fisso.
   - Schermi stretti: indice richiudibile in cima, si chiude dopo
     aver scelto una sezione.
   - Evidenzia la sezione che si sta leggendo (aria-current).
   Lo scorrimento morbido verso la sezione e' quello del browser
   (scroll-behavior: smooth, disattivato con "riduci movimento");
   senza questo script i link dell'indice funzionano comunque.
   ============================================================= */
(function () {
  const toc = document.querySelector('.legal-toc');
  if (!toc) return;
  const box = toc.querySelector('.legal-toc__box');
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const sections = links
    .map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))))
    .filter(Boolean);
  const wide = window.matchMedia('(min-width: 960px)');

  // Indice aperto sugli schermi larghi, chiuso su quelli stretti
  const syncOpen = () => {
    box.open = wide.matches;
    toc.classList.toggle('is-wide', wide.matches);
  };
  syncOpen();
  wide.addEventListener('change', syncOpen);

  // Sugli schermi larghi l'indice resta sempre aperto
  box.querySelector('summary').addEventListener('click', (e) => {
    if (wide.matches) e.preventDefault();
  });

  // Sezione scelta dall'indice: resta evidenziata anche quando, in fondo
  // alla pagina, non puo' salire fino in cima (sezioni finali brevi)
  let chosen = null;
  links.forEach((a) => {
    a.addEventListener('click', () => {
      chosen = a.hash.slice(1);
      if (!wide.matches) box.open = false;
    });
  });
  ['wheel', 'touchstart', 'keydown'].forEach((type) =>
    window.addEventListener(
      type,
      () => {
        chosen = null;
      },
      { passive: true }
    )
  );

  // Sezione attiva: l'ultima il cui titolo ha superato l'intestazione
  // fissa; in fondo alla pagina, l'ultima sezione
  const header = document.querySelector('.site-header');
  // Altezza reale dell'intestazione fissa: la barra dell'indice (schermi
  // stretti) si appoggia subito sotto
  const syncTop = () => {
    if (header) {
      document.documentElement.style.setProperty('--legal-toc-top', `${header.offsetHeight}px`);
    }
  };
  syncTop();
  window.addEventListener('resize', syncTop);
  let ticking = false;
  function update() {
    ticking = false;
    // Fin dove arrivano le parti fisse in alto: intestazione e, su schermi
    // stretti, la barra dell'indice
    const fixedBottom = wide.matches
      ? header
        ? header.offsetHeight
        : 0
      : toc.querySelector('.legal-toc__summary').getBoundingClientRect().bottom;
    const offset = fixedBottom + 48;
    let current = sections[0];
    for (const s of sections) {
      if (s.getBoundingClientRect().top - offset <= 0) current = s;
    }
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) {
      const picked = chosen && document.getElementById(chosen);
      const visible = picked && picked.getBoundingClientRect().top < window.innerHeight;
      current = visible ? picked : sections[sections.length - 1];
    }
    links.forEach((a) => {
      const active = current && a.hash === `#${current.id}`;
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('hashchange', onScroll);
  update();
})();
