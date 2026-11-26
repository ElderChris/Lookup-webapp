/* =============================================================================
   coverDesigns.js — Disegni delle copertine delle librerie
   =============================================================================
   Le 15 decorazioni (pattern, icone, glifi) che ogni utente sceglie in
   "Personalizza" (preferenza `coverDesign` salvata sul server). Usate da
   ui-helpers.libraryCoverData, dalle schede delle librerie e dal selettore
   delle impostazioni.
   ============================================================================= */

/* ------------------------------------------------------------------
   CATALOGO DELLE GRAFICHE COVER LIBRERIA — 15 design
   ------------------------------------------------------------------
   15 grafiche minimali selezionabili dalle impostazioni del profilo
   come "decorazione" della propria libreria. Sono raggruppate in tre
   famiglie (pattern, icone, glifi tipografici). Tutte usano
   currentColor così si adattano al tema cromatico scelto: per le
   librerie personali la decorazione è più morbida, per gli enti più
   strutturata (lo stile cambia leggermente in base al tipo).
   ------------------------------------------------------------------ */
export const LIBRARY_COVER_DESIGNS = [
  /* ---- PATTERN (decorazioni astratte di sfondo) ------------------ */
  {
    key: 'p-dots',
    name: 'Pois',
    kind: 'pattern',
    render() {
      let s = '';
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 12; c++)
          s += `<circle cx="${c * 18 + 10}" cy="${r * 18 + 12}" r="2" fill="currentColor" opacity="0.45"/>`;
      return s;
    },
  },
  {
    key: 'p-stripes',
    name: 'Righe',
    kind: 'pattern',
    render() {
      let s = '<g transform="rotate(-30 100 70)">';
      for (let i = -8; i < 22; i++)
        s += `<line x1="${i * 16}" y1="-30" x2="${i * 16}" y2="170" stroke="currentColor" stroke-width="2.5" opacity="0.30"/>`;
      return s + '</g>';
    },
  },
  {
    key: 'p-waves',
    name: 'Onde',
    kind: 'pattern',
    render() {
      let s = '';
      for (let r = 0; r < 5; r++) {
        let d = `M 0 ${r * 32 + 24}`;
        for (let x = 0; x <= 200; x += 20)
          d += ` Q ${x + 10} ${r * 32 + 24 + ((x / 20) % 2 ? 10 : -10)} ${x + 20} ${r * 32 + 24}`;
        s += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" opacity="0.40"/>`;
      }
      return s;
    },
  },
  {
    key: 'p-grid',
    name: 'Griglia',
    kind: 'pattern',
    render() {
      let s = '';
      for (let x = 20; x < 200; x += 20)
        s += `<line x1="${x}" y1="0" x2="${x}" y2="140" stroke="currentColor" stroke-width="1" opacity="0.30"/>`;
      for (let y = 20; y < 140; y += 20)
        s += `<line x1="0" y1="${y}" x2="200" y2="${y}" stroke="currentColor" stroke-width="1" opacity="0.30"/>`;
      return s;
    },
  },
  {
    key: 'p-circles',
    name: 'Cerchi',
    kind: 'pattern',
    render() {
      return `
        <circle cx="100" cy="70" r="60" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.30"/>
        <circle cx="100" cy="70" r="44" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.40"/>
        <circle cx="100" cy="70" r="28" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.50"/>
        <circle cx="100" cy="70" r="12" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.65"/>`;
    },
  },

  /* ---- ICONE (un soggetto centrale a tema lettura) --------------- */
  {
    key: 'i-book-open',
    name: 'Libro aperto',
    kind: 'icon',
    render() {
      return `<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.75">
        <path d="M40 95 Q100 75 100 50 Q100 75 160 95 L 160 38 Q100 18 100 38 Q100 18 40 38 Z"/>
        <line x1="100" y1="38" x2="100" y2="95"/>
        <line x1="55" y1="50" x2="88" y2="46"/>
        <line x1="55" y1="62" x2="88" y2="58"/>
        <line x1="55" y1="74" x2="88" y2="70"/>
        <line x1="112" y1="46" x2="145" y2="50"/>
        <line x1="112" y1="58" x2="145" y2="62"/>
        <line x1="112" y1="70" x2="145" y2="74"/>
      </g>`;
    },
  },
  {
    key: 'i-shelf',
    name: 'Scaffale',
    kind: 'icon',
    render() {
      let s =
        '<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.75">';
      // due ripiani
      s += '<line x1="36" y1="62" x2="164" y2="62" stroke-width="3"/>';
      s += '<line x1="36" y1="108" x2="164" y2="108" stroke-width="3"/>';
      // libri sul ripiano alto
      [40, 52, 62, 75, 88, 98, 110, 122, 134, 148].forEach((x, i) => {
        const h = 22 + (i % 3) * 4,
          w = i % 2 ? 9 : 11;
        s += `<rect x="${x}" y="${62 - h}" width="${w}" height="${h}" fill="currentColor" fill-opacity="0.35" stroke-width="1.5"/>`;
      });
      // libri sul ripiano basso
      [40, 54, 66, 78, 92, 104, 118, 132, 146].forEach((x, i) => {
        const h = 24 + (i % 2) * 5,
          w = i % 3 ? 10 : 12;
        s += `<rect x="${x}" y="${108 - h}" width="${w}" height="${h}" fill="currentColor" fill-opacity="0.35" stroke-width="1.5"/>`;
      });
      return s + '</g>';
    },
  },
  {
    key: 'i-stack',
    name: 'Pila',
    kind: 'icon',
    render() {
      return `<g fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="2.5" opacity="0.85">
        <rect x="55" y="100" width="90" height="14" rx="2"/>
        <rect x="48" y="84"  width="104" height="14" rx="2"/>
        <rect x="60" y="68"  width="80"  height="14" rx="2"/>
        <rect x="50" y="52"  width="100" height="14" rx="2"/>
        <rect x="64" y="36"  width="72"  height="14" rx="2"/>
      </g>`;
    },
  },
  {
    key: 'i-feather',
    name: "Penna d'oca",
    kind: 'icon',
    render() {
      return `<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">
        <path d="M140 28 Q60 50 56 116 L80 100 Q100 70 140 28 Z" fill="currentColor" fill-opacity="0.30"/>
        <line x1="80" y1="100" x2="56" y2="116"/>
        <line x1="56" y1="116" x2="32" y2="124"/>
        <path d="M76 78 Q100 70 130 50" stroke-width="1.5"/>
        <path d="M70 90 Q90 84 120 64" stroke-width="1.5"/>
      </g>`;
    },
  },
  {
    key: 'i-bookmark',
    name: 'Segnalibro',
    kind: 'icon',
    render() {
      return `<g opacity="0.85">
        <path d="M85 22 L115 22 L115 118 L100 105 L85 118 Z"
              fill="currentColor" fill-opacity="0.40"
              stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="100" cy="50" r="6" fill="currentColor" fill-opacity="0.8"/>
      </g>`;
    },
  },

  /* ---- GLIFI TIPOGRAFICI (lettera/segno grande al centro) -------- */
  {
    key: 'g-section',
    name: 'Paragrafo §',
    kind: 'glyph',
    render() {
      return `<text x="100" y="98" text-anchor="middle" font-family="serif" font-style="italic" font-size="120" fill="currentColor" opacity="0.7">§</text>`;
    },
  },
  {
    key: 'g-aldus',
    name: 'Foglia di Aldo ❧',
    kind: 'glyph',
    render() {
      return `<text x="100" y="100" text-anchor="middle" font-family="serif" font-size="110" fill="currentColor" opacity="0.75">❧</text>`;
    },
  },
  {
    key: 'g-fleuron',
    name: 'Fiorone ☙',
    kind: 'glyph',
    render() {
      return `<text x="100" y="100" text-anchor="middle" font-family="serif" font-size="110" fill="currentColor" opacity="0.75">☙</text>`;
    },
  },
  {
    key: 'g-amp',
    name: 'Et &amp;',
    kind: 'glyph',
    render() {
      return `<text x="100" y="100" text-anchor="middle" font-family="serif" font-style="italic" font-size="120" fill="currentColor" opacity="0.7">&amp;</text>`;
    },
  },
  {
    key: 'g-monogram',
    name: 'Monogramma',
    kind: 'glyph',
    render(opts) {
      const ch = opts && opts.letter ? opts.letter : 'A';
      return `<text x="100" y="100" text-anchor="middle" font-family="serif" font-size="110" fill="currentColor" opacity="0.85">${ch}</text>`;
    },
  },
];

/* Mappa rapida per chiave → design */
export const LIBRARY_COVER_DESIGN_MAP = Object.fromEntries(
  LIBRARY_COVER_DESIGNS.map((d) => [d.key, d])
);
