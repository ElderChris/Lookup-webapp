/* =============================================================================
   ui.js — Rendering e wiring DOM
   =============================================================================
   L'oggetto UI contiene tutti i metodi che producono HTML e collegano event
   handler agli elementi del DOM. Dipende da API per i dati, ma non viceversa.

   Cosa contiene (~1800 righe):
   - Render: bookCard, libraryCard, postCard, nearbyCard, stars, ridgeline
   - Wiring: avatar menu, like chips, follow buttons, post composer
   - Components: notification bell, profile dropdown, admin link, toast,
     confirm modal, popover
   - Init: initMobileNav, highlightActiveNav, initAuthToggle, etc.
   ============================================================================= */

import { API } from './legacy/api.js';
import {
  LIBRARY_COVER_DESIGNS,
  LIBRARY_COVER_DESIGN_MAP,
  LOAN_STATUS_LABEL,
  LOAN_STATUS_HINT,
  LOAN_STATUS_ORDER,
} from './data.js';

export const UI = {
  /* =============================================================
     v2.5 — Icone SVG inline minimali.
     Generate da Claude (Anthropic) per Lookup.
     Tutte 24×24 viewBox, stroke 1.8 px, currentColor, line-cap round.
     Pensate per essere coerenti come "tratto" — la stessa mano grafica.
     ============================================================= */
  ICON: {
    explore:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z"/><path d="M9 4 V17.5 M15 6.5 V20"/><circle cx="17" cy="14" r="2.4"/><path d="M18.8 15.8 L21 18"/></svg>',
    stats:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 V10"/><path d="M10 20 V4"/><path d="M16 20 V13"/><path d="M22 20 V7"/><path d="M3 20 H23"/></svg>',
    loans:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5 H17 A2 2 0 0 1 19 7 V13 A2 2 0 0 1 17 15 H10 L6 19 V15 H5 A2 2 0 0 1 3 13 Z"/><path d="M7 9 H15"/><path d="M7 12 H12"/></svg>',
    publish:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4 H14 L19 9 V20 A1 1 0 0 1 18 21 H5 A1 1 0 0 1 4 20 V5 A1 1 0 0 1 5 4 Z"/><path d="M14 4 V9 H19"/><path d="M11.5 12 V17.5 M8.75 14.75 H14.25"/></svg>',
    admin:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z"/><path d="M9 12 L11 14 L15 10"/></svg>',
  },

  /** Helper: ritorna l'SVG inline per la chiave richiesta. */
  icon(key) {
    return this.ICON[key] || '';
  },

  /** Render scheda libro */
  /* =============================================================
     RECENSIONI E STELLE (v1.4)
     Componenti UI per visualizzare la valutazione media (stelle d'oro
     coerenti con la palette editoriale) e renderizzare la lista delle
     recensioni e il form per scriverne una nuova.
     ============================================================= */

  /** Genera l'HTML di 5 stelle dorate con il riempimento corrispondente
      al valore numerico (0..5, decimali ammessi). Stato per posizione:
      - "full" se la stella i-esima è interamente coperta
      - "half" se è coperta a metà (decimale fra .25 e .75)
      - "empty" altrimenti
      Opzioni:
        - count: se presente, mostra "X recensioni" accanto
        - asLink: stringa href → avvolge in un <a> linkato
        - size: 'sm' | 'md' | 'lg' (default 'md')
        - showAverage: true mostra il valore numerico accanto */
  renderStars(rating, opts = {}) {
    const { count, asLink, size = 'md', showAverage = true } = opts;
    const r = Math.max(0, Math.min(5, +rating || 0));
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const diff = r - (i - 1);
      let state;
      if (diff >= 0.75) state = 'full';
      else if (diff >= 0.25) state = 'half';
      else state = 'empty';
      stars.push(this._starSVG(state, i));
    }
    const avgLbl = showAverage && r > 0 ? `<span class="stars__avg">${r.toFixed(1)}</span>` : '';
    const countLbl =
      count !== undefined && count !== null
        ? `<span class="stars__count">${
            count === 0
              ? 'Nessuna recensione'
              : `${count} ${count === 1 ? 'recensione' : 'recensioni'}`
          }</span>`
        : '';
    const inner = stars.join('') + avgLbl + countLbl;
    const cls = `stars stars--${size}` + (asLink ? ' stars--link' : '');
    return asLink
      ? `<a class="${cls}" href="${asLink}">${inner}</a>`
      : `<span class="${cls}">${inner}</span>`;
  },

  /** Singola stella SVG nei 3 stati (full/half/empty). Per la metà si
      duplicano due path: lo sfondo (outline) e il riempimento clippato
      a 50% di larghezza via clip-path inline. Le stelle sono SVG inline
      per garantire stroke/fill coerenti col colore --color-gold. */
  _starSVG(state, idx) {
    const path = 'M12 2 L14.5 9 L22 9 L16 13.5 L18.2 21 L12 16.5 L5.8 21 L8 13.5 L2 9 L9.5 9 Z';
    if (state === 'full') {
      return `<svg class="star star--full" viewBox="0 0 24 24" aria-hidden="true">
        <path d="${path}"/></svg>`;
    }
    if (state === 'half') {
      // Lo stesso path disegnato due volte: l'outline sempre, il fill
      // limitato dal clip-path inline alla metà sinistra del viewBox.
      return `<svg class="star star--half" viewBox="0 0 24 24" aria-hidden="true">
        <path class="star__outline" d="${path}"/>
        <path class="star__fill" d="${path}" style="clip-path: inset(0 50% 0 0);"/></svg>`;
    }
    return `<svg class="star star--empty" viewBox="0 0 24 24" aria-hidden="true">
      <path d="${path}"/></svg>`;
  },

  /** Card di una recensione. `person` e' chi mostrare: l'autore per le
      ricevute, il destinatario per le scritte. */
  _reviewCard(r, person, { lead = '', href = '', footer = '', extraClass = '' } = {}) {
    const esc = (v) => this._escapeHtml(v);
    const name = person?.displayName || person?.username || 'Utente';
    const avatar = person?.avatarUrl
      ? `<img src="${esc(person.avatarUrl)}" alt="">`
      : esc(name.trim()[0].toUpperCase());
    const dateLabel = new Date(r.createdAt).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return `
        <article class="review-card ${extraClass}">
          <div class="review-card__head">
            <a href="${esc(href)}" class="review-card__author">
              <span class="review-card__avatar cover--classic" aria-hidden="true">${avatar}</span>
              <span class="review-card__author-info">
                ${lead ? `<span class="review-card__lead">${lead}</span>` : ''}
                <span class="review-card__name">${esc(name)}</span>
                <span class="review-card__user">@${esc(person?.username || '')}</span>
              </span>
            </a>
            <div class="review-card__meta">
              ${UI.renderStars(r.rating, { size: 'sm', showAverage: false })}
              <time class="review-card__date" datetime="${esc(r.createdAt)}">
                <span class="review-card__date-rel">${UI.timeAgo(r.createdAt)}</span>
                <span class="review-card__date-abs">${dateLabel}</span>
              </time>
            </div>
          </div>
          <p class="review-card__text">${esc(r.text)}</p>
          ${footer}
        </article>`;
  },

  /** Recensioni ricevute da un utente (dal server). `reviews` evita una
      seconda richiesta quando la pagina le ha gia' caricate. */
  async renderReviewsList(container, targetUserId, { reviews } = {}) {
    let list = reviews;
    if (!list) {
      try {
        list = (await window.LB_API.users.listReviews(targetUserId, { limit: 100 })).data;
      } catch (_err) {
        container.innerHTML = `<p class="alert alert--error">
          Server non raggiungibile: impossibile caricare le recensioni.</p>`;
        return;
      }
    }
    if (!list.length) {
      container.innerHTML = `<p class="alert alert--info">
        Ancora nessuna recensione per questa libreria.
      </p>`;
      return;
    }
    container.innerHTML = list
      .map((r) =>
        this._reviewCard(r, r.reviewer, {
          href: r.reviewer ? `library.html?id=${encodeURIComponent(r.reviewer.id)}` : '#',
        })
      )
      .join('');
  },

  /** Recensioni SCRITTE da un utente (dal server), con il destinatario e
      i pulsanti Modifica (porta alla sua libreria) e Cancella. */
  async renderReviewsByReviewerList(container, reviewerId) {
    let list;
    try {
      list = (await window.LB_API.users.listReviewsWritten(reviewerId, { limit: 100 })).data;
    } catch (_err) {
      container.innerHTML = `<p class="alert alert--error">
        Server non raggiungibile: impossibile caricare le recensioni.</p>`;
      return;
    }
    if (!list.length) {
      container.innerHTML = `<p class="alert alert--info">
        Non hai ancora scritto nessuna recensione. Dopo aver concluso un
        prestito potrai valutare la libreria del prestatore.
      </p>`;
      return;
    }
    container.innerHTML = list
      .map((r) => {
        const targetHref = r.target
          ? `library.html?id=${encodeURIComponent(r.target.id)}#recensioni`
          : '#';
        return this._reviewCard(r, r.target, {
          lead: 'Hai recensito',
          href: targetHref,
          extraClass: 'review-card--written',
          footer: `
          <div class="review-card__footer">
            <a href="${targetHref}" class="btn btn--ghost btn--small">✎ Modifica</a>
            <button type="button" class="btn btn--ghost btn--small"
                    data-review-delete="${this._escapeHtml(r.targetUserId)}">
              🗑 Cancella
            </button>
          </div>`,
        });
      })
      .join('');

    // Un solo gestore anche se la lista viene ridisegnata
    container.onclick = async (e) => {
      const btn = e.target.closest('[data-review-delete]');
      if (!btn) return;
      if (!confirm('Cancellare definitivamente questa recensione?')) return;
      try {
        await window.LB_API.users.deleteMyReview(btn.dataset.reviewDelete);
        UI.toast('Recensione cancellata.', 'info');
        UI.renderReviewsByReviewerList(container, reviewerId);
      } catch (err) {
        UI.toast(err.message || 'Impossibile cancellare la recensione.', 'error');
      }
    };
  },

  /** Form per scrivere o aggiornare la propria recensione (5 stelle +
      testo). Il server decide se si puo' recensire: serve un prestito
      concluso con l'utente, e non si recensisce se stessi. */
  async renderReviewForm(container, targetUserId, onSubmit) {
    const me = window.LB_UI.currentUser();
    if (!me) {
      container.innerHTML = `<p class="alert alert--info" style="margin: 0;">
        <a href="login.html">Accedi</a> o <a href="register.html">registrati</a>
        per lasciare una recensione a questa libreria.
      </p>`;
      return;
    }

    let state;
    try {
      state = await window.LB_API.users.getMyReview(targetUserId);
    } catch (_err) {
      container.innerHTML = `<p class="alert alert--error" style="margin: 0;">
        Server non raggiungibile: impossibile verificare se puoi recensire.</p>`;
      return;
    }
    if (state.reason === 'self') {
      container.innerHTML = `<p class="alert alert--info" style="margin: 0;">
        Questa è la tua libreria — qui leggi le recensioni che gli altri lasciano per te.
      </p>`;
      return;
    }
    if (!state.canReview) {
      container.innerHTML = `<p class="alert alert--info" style="margin: 0;">
        Per recensire questa libreria devi prima aver concluso almeno un prestito.
        Le recensioni sono ancorate a un'esperienza reale di scambio: prendi in prestito
        un volume, restituiscilo, e dopo la conferma del prestatore potrai lasciare la
        tua valutazione.
      </p>`;
      return;
    }

    const existing = state.review;
    const initialRating = existing ? existing.rating : 0;
    const initialText = existing ? existing.text : '';

    container.innerHTML = `
      <form class="review-form" novalidate>
        <h3 class="review-form__title">
          ${existing ? 'Aggiorna la tua recensione' : 'Lascia una recensione'}
        </h3>
        <p class="review-form__intro">
          Racconta in poche righe la tua esperienza con questa libreria.
          Bastano <strong>20 caratteri</strong>.
        </p>
        <div class="review-form__stars" role="radiogroup" aria-label="Valutazione da 1 a 5 stelle">
          ${[1, 2, 3, 4, 5]
            .map(
              (n) => `
            <button type="button" class="review-form__star" data-value="${n}"
                    role="radio" aria-checked="false" aria-label="${n} ${n === 1 ? 'stella' : 'stelle'}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2 L14.5 9 L22 9 L16 13.5 L18.2 21 L12 16.5 L5.8 21 L8 13.5 L2 9 L9.5 9 Z"/>
              </svg>
            </button>`
            )
            .join('')}
          <span class="review-form__rating-label">Seleziona un voto</span>
        </div>
        <div class="form__group">
          <label class="form__label" for="review-text">La tua recensione</label>
          <textarea id="review-text" class="form__input" rows="4"
                    placeholder="Com'è stata l'esperienza? Cortesia, cura dei volumi, puntualità…"
                    minlength="20" maxlength="2000" required>${this._escapeHtml(initialText)}</textarea>
          <small class="form__help">
            <span id="review-char-count">${initialText.length}</span>/20 minimi
          </small>
        </div>
        <div class="form__row" style="justify-content: flex-end; gap: 0.75rem;">
          ${existing ? `<button type="button" class="btn btn--ghost" id="review-delete-btn">Elimina</button>` : ''}
          <button type="submit" class="btn btn--primary">
            <span class="btn__icon" aria-hidden="true">${existing ? '✓' : '+'}</span>
            ${existing ? 'Aggiorna' : 'Pubblica recensione'}
          </button>
        </div>
        <div class="review-form__error alert alert--error" role="alert" hidden></div>
      </form>`;

    // === wiring ===
    const form = container.querySelector('.review-form');
    const starBtns = form.querySelectorAll('.review-form__star');
    const ratingLbl = form.querySelector('.review-form__rating-label');
    const textArea = form.querySelector('#review-text');
    const charCount = form.querySelector('#review-char-count');
    const errBox = form.querySelector('.review-form__error');
    let currentRating = initialRating;

    function paintStars(value, isHover = false) {
      starBtns.forEach((btn, i) => {
        const n = i + 1;
        btn.classList.toggle('is-filled', n <= value);
        btn.setAttribute('aria-checked', String(n === currentRating));
      });
      const labels = ['', 'Inadeguato', 'Insufficiente', 'Discreto', 'Buono', 'Eccellente'];
      ratingLbl.textContent = value > 0 ? labels[value] : 'Seleziona un voto';
    }
    paintStars(currentRating);

    starBtns.forEach((btn, i) => {
      const n = i + 1;
      btn.addEventListener('click', () => {
        currentRating = n;
        paintStars(currentRating);
      });
      btn.addEventListener('mouseenter', () => paintStars(n, true));
      btn.addEventListener('mouseleave', () => paintStars(currentRating));
      btn.addEventListener('focus', () => paintStars(n, true));
      btn.addEventListener('blur', () => paintStars(currentRating));
    });

    textArea.addEventListener('input', () => {
      charCount.textContent = textArea.value.length;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.hidden = true;
      if (currentRating === 0) {
        errBox.hidden = false;
        errBox.textContent = 'Scegli una valutazione da 1 a 5 stelle.';
        return;
      }
      const text = textArea.value.trim();
      if (text.length < 20) {
        errBox.hidden = false;
        errBox.textContent = 'Il testo della recensione deve essere lungo almeno 20 caratteri.';
        return;
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const review = await window.LB_API.users.createReview(targetUserId, {
          rating: currentRating,
          text,
        });
        UI.toast(existing ? 'Recensione aggiornata.' : 'Recensione pubblicata. Grazie!', 'success');
        if (typeof onSubmit === 'function') onSubmit({ review, updated: !!existing });
      } catch (err) {
        errBox.hidden = false;
        errBox.textContent = err.message || 'Impossibile salvare la recensione.';
        submitBtn.disabled = false;
      }
    });

    // pulsante elimina (solo se esiste già la recensione)
    const delBtn = form.querySelector('#review-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm('Eliminare definitivamente la tua recensione?')) return;
        try {
          await window.LB_API.users.deleteMyReview(targetUserId);
          UI.toast('Recensione eliminata.', 'info');
          if (typeof onSubmit === 'function') onSubmit({ deleted: true });
        } catch (err) {
          errBox.hidden = false;
          errBox.textContent = err.message || 'Impossibile eliminare la recensione.';
        }
      });
    }
  },

  /** Escape minimo per inserire testo utente in HTML senza problemi. */
  _escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /** Formato leggibile "X tempo fa" — versione completa (settimane,
      mesi, anni). Usato nelle recensioni e nella timeline prestiti. */
  timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.round(diff / 1000);
    const min = Math.round(diff / 60000);
    const h = Math.round(diff / 3600000);
    const d = Math.round(diff / 86400000);
    const w = Math.round(diff / (7 * 86400000));
    const mo = Math.round(diff / (30 * 86400000));
    const y = Math.round(diff / (365 * 86400000));
    if (sec < 60) return 'pochi secondi fa';
    if (min < 60) return min === 1 ? 'un minuto fa' : `${min} minuti fa`;
    if (h < 24) return h === 1 ? "un'ora fa" : `${h} ore fa`;
    if (d < 7) return d === 1 ? 'un giorno fa' : `${d} giorni fa`;
    if (w < 5) return w === 1 ? 'una settimana fa' : `${w} settimane fa`;
    if (mo < 12) return mo === 1 ? 'un mese fa' : `${mo} mesi fa`;
    return y === 1 ? 'un anno fa' : `${y} anni fa`;
  },

  /** Renderizza la timeline orizzontale a 5 stati di un prestito.
      Disegna 5 nodi (cerchi) connessi da linee. Il nodo dello stato
      corrente è ingrossato; quelli già attraversati sono pieni con
      colore bordeaux; quelli futuri sono "ghost" (outline soft).
      Ogni nodo mostra l'etichetta e — sotto — la data di transizione
      se l'abbiamo. La timeline è visualmente centrata sul nodo
      "Prestato" (3° su 5 = posizione centrale per disegno). */
  renderLoanTimeline(loan, opts = {}) {
    const { compact = false } = opts;
    const states = LOAN_STATUS_ORDER; // ['requested', ..., 'returned']
    const currentIdx = states.indexOf(loan.status);

    // Mappa: stato → timestamp di transizione (se presente)
    const tsMap = {
      requested: loan.requested_at,
      confirmed: loan.confirmed_at,
      borrowed: loan.borrowed_at,
      returning: loan.returning_at,
      returned: loan.returned_at,
    };

    const nodes = states
      .map((st, i) => {
        const reached = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const ts = tsMap[st];
        const cls = ['loan-timeline__node'];
        if (reached) cls.push('is-reached');
        if (isCurrent) cls.push('is-current');
        const tsLabel = ts ? `<span class="loan-timeline__date">${UI.timeAgo(ts)}</span>` : '';
        // Linea connettrice (tranne dopo l'ultimo)
        const connector =
          i < states.length - 1
            ? `<span class="loan-timeline__connector ${i < currentIdx ? 'is-reached' : ''}"></span>`
            : '';
        return `
        <li class="${cls.join(' ')}">
          <span class="loan-timeline__dot" aria-hidden="true">
            ${
              reached
                ? `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12 L10 17 L19 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                : `<span class="loan-timeline__index">${i + 1}</span>`
            }
          </span>
          <span class="loan-timeline__label">${LOAN_STATUS_LABEL[st]}</span>
          ${tsLabel}
          ${connector}
        </li>`;
      })
      .join('');

    return `
      <div class="loan-timeline${compact ? ' loan-timeline--compact' : ''}">
        <ol class="loan-timeline__list" aria-label="Stato del prestito">
          ${nodes}
        </ol>
        ${compact ? '' : `<p class="loan-timeline__hint">${LOAN_STATUS_HINT[loan.status]}</p>`}
      </div>`;
  },

  /** Modale "Rifiuta la richiesta di prestito": motivazione obbligatoria
      (almeno 10 caratteri), inviata al backend con l'azione `reject`.
      `loan` e' l'oggetto dell'API; `onDone` viene chiamata a rifiuto
      avvenuto. */
  openRejectLoanModal(loan, onDone) {
    const modal = document.createElement('div');
    modal.className = 'return-wizard';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'reject-title');
    modal.innerHTML = `
      <div class="return-wizard__backdrop" data-close></div>
      <div class="return-wizard__panel">
        <button type="button" class="return-wizard__close" aria-label="Chiudi" data-close>×</button>
        <h2 id="reject-title">Rifiuta la richiesta</h2>
        <p style="color: var(--color-ink-soft); margin-bottom: 1.2rem;">
          Stai per rifiutare la richiesta di
          <strong>${this._escapeHtml(loan.requester?.displayName || '')}</strong> per il volume
          <em>${this._escapeHtml(loan.book?.title || '')}</em>. Aggiungi una breve motivazione:
          la vedrà nella sua pagina dei prestiti.
        </p>
        <div class="form__group">
          <label class="form__label" for="reject-reason">Motivazione</label>
          <textarea id="reject-reason" class="form__input" rows="3" maxlength="500"
            placeholder="Esempio: il volume è già impegnato per un altro prestito, riprova fra due settimane."
            minlength="10" required></textarea>
          <small class="form__help">Minimo 10 caratteri.</small>
        </div>
        <div class="return-wizard__actions">
          <button type="button" class="btn btn--ghost" data-close>Annulla</button>
          <button type="button" class="btn btn--primary" data-reject-confirm>Rifiuta richiesta</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    function close() {
      modal.remove();
      document.removeEventListener('keydown', onKey);
    }
    document.addEventListener('keydown', onKey);
    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) close();
    });
    const confirmBtn = modal.querySelector('[data-reject-confirm]');
    confirmBtn.addEventListener('click', async () => {
      const reason = modal.querySelector('#reject-reason').value.trim();
      if (reason.length < 10) {
        UI.toast('La motivazione deve essere lunga almeno 10 caratteri.', 'error');
        return;
      }
      confirmBtn.disabled = true;
      try {
        await window.LB_API.loans.reject(loan.id, reason);
        window.LB_API.cache.invalidate('loans:');
        UI.toast("Richiesta rifiutata. Chi l'ha inviata riceverà una notifica.", 'info');
        close();
        if (typeof onDone === 'function') onDone();
      } catch (err) {
        UI.toast(err.message || 'Operazione non riuscita.', 'error');
        confirmBtn.disabled = false;
      }
    });
    setTimeout(() => modal.querySelector('#reject-reason').focus(), 50);
  },

  /** Chat di un prestito (messaggi dal backend: /api/loans/:id/messages).
      `loan` e' l'oggetto restituito dall'API (book, requester, lender,
      role, status, unreadCount). Con la chat aperta i messaggi vengono
      segnati come letti (POST /api/loans/:id/read) e si chiama
      `opts.onRead`. Per i prestiti rifiutati o annullati la chat resta
      utilizzabile ma appare attenuata, con lo stato del prestito.
      Restituisce { refresh } per ricaricare i messaggi su notifica. */
  renderLoanChat(container, loan, opts = {}) {
    const me = window.LB_UI.currentUser();
    const isParticipant = me && (me.id === loan.requester?.id || me.id === loan.lender?.id);
    if (!isParticipant) {
      container.innerHTML = '';
      return { refresh: () => {} };
    }
    const other = me.id === loan.requester.id ? loan.lender : loan.requester;
    const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();
    const startOpen = opts.startOpen !== false;
    const CLOSED_LABEL = { rejected: 'Prestito rifiutato', cancelled: 'Prestito annullato' };
    const closedLabel = CLOSED_LABEL[loan.status];
    let unread = loan.unreadCount || 0;

    container.innerHTML = `
      <div class="loan-chat ${startOpen ? 'is-open' : ''} ${closedLabel ? 'loan-chat--closed' : ''}">
        <button type="button" class="loan-chat__toggle" aria-expanded="${startOpen}">
          <span aria-hidden="true">💬</span>
          <span class="loan-chat__toggle-label">Chat con ${this._escapeHtml(other?.displayName || 'utente')}</span>
          ${closedLabel ? `<span class="loan-listitem__status loan-listitem__status--${loan.status} loan-chat__state">${closedLabel}</span>` : ''}
          ${unread > 0 ? `<span class="loan-chat__unread-badge">${unread} nuov${unread === 1 ? 'o' : 'i'}</span>` : ''}
          <span class="loan-chat__caret" aria-hidden="true">▾</span>
        </button>
        <div class="loan-chat__panel" ${startOpen ? '' : 'hidden'}>
          <div class="loan-chat__messages" role="log" aria-live="polite">
            <p class="loan-chat__status">Caricamento dei messaggi…</p>
          </div>
          <form class="loan-chat__form" novalidate>
            <textarea class="loan-chat__input" rows="2"
                      placeholder="Scrivi un messaggio…" maxlength="2000"
                      aria-label="Messaggio"></textarea>
            <button type="submit" class="btn btn--primary btn--small loan-chat__send">
              <span aria-hidden="true">↦</span> Invia
            </button>
          </form>
        </div>
      </div>`;

    const root = container.querySelector('.loan-chat');
    const toggle = root.querySelector('.loan-chat__toggle');
    const panel = root.querySelector('.loan-chat__panel');
    const messagesEl = root.querySelector('.loan-chat__messages');
    const form = root.querySelector('.loan-chat__form');
    const input = root.querySelector('.loan-chat__input');
    const sendBtn = root.querySelector('.loan-chat__send');

    const bubble = (m) => {
      const isMine = m.sender?.id === me.id;
      return `
        <div class="chat-msg chat-msg--user ${isMine ? 'chat-msg--mine' : ''}">
          <span class="chat-msg__avatar cover--classic" aria-hidden="true">${this._escapeHtml(initial(m.sender?.displayName))}</span>
          <div class="chat-msg__bubble">
            <div class="chat-msg__text">${this._escapeHtml(m.body)}</div>
            <div class="chat-msg__time">${UI.timeAgo(m.createdAt)}</div>
          </div>
        </div>`;
    };
    const scrollToEnd = () => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    // Con la chat aperta, i messaggi arrivati risultano letti
    async function markReadIfOpen() {
      if (!root.classList.contains('is-open') || unread === 0) return;
      try {
        await window.LB_API.loans.markRead(loan.id);
        unread = 0;
        toggle.querySelector('.loan-chat__unread-badge')?.remove();
        if (typeof opts.onRead === 'function') opts.onRead(loan.id);
      } catch {
        /* resta non letto: si riprova al prossimo aggiornamento */
      }
    }

    async function refresh({ incoming = false } = {}) {
      try {
        const res = await window.LB_API.loans.listMessages(loan.id, { limit: 100 });
        const list = res.data || [];
        if (incoming) unread = Math.max(unread, 1);
        messagesEl.innerHTML = list.length
          ? list.map(bubble).join('')
          : '<p class="loan-chat__status">Nessun messaggio. Scrivi tu per primo.</p>';
        scrollToEnd();
        markReadIfOpen();
      } catch {
        messagesEl.innerHTML =
          '<p class="loan-chat__status">Impossibile caricare i messaggi. Riprova tra poco.</p>';
      }
    }

    toggle.addEventListener('click', () => {
      const isOpen = root.classList.toggle('is-open');
      panel.hidden = !isOpen;
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        scrollToEnd();
        input.focus();
        markReadIfOpen();
      }
    });

    // Enter (senza Shift) invia; Shift+Enter va a capo
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      sendBtn.disabled = true;
      try {
        const msg = await window.LB_API.loans.sendMessage(loan.id, { body: text });
        input.value = '';
        messagesEl.querySelector('.loan-chat__status')?.remove();
        messagesEl.insertAdjacentHTML('beforeend', bubble(msg));
        scrollToEnd();
        if (typeof opts.onUpdate === 'function') opts.onUpdate();
      } catch (err) {
        UI.toast(err.message || 'Messaggio non inviato. Riprova.', 'error');
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    });

    refresh();
    return { refresh: () => refresh({ incoming: true }) };
  },

  renderBookCard(book, user, options = {}) {
    const owner = user || API.getUser(book.owner_id);
    const coverStyle = `style="background: ${book.cover_gradient};"`;
    const me = window.LB_UI.currentUser();
    const liked = me && API.isLiked(me.id, book.id);
    const isOwn = me && +book.owner_id === +me.id;
    const likeChip =
      me && !isOwn
        ? `<button type="button" class="like-chip auth-only ${liked ? 'is-liked' : ''}"
                 data-book-id="${book.id}" aria-pressed="${!!liked}"
                 aria-label="${liked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}">
           <svg viewBox="0 0 24 24" aria-hidden="true">
             <path d="M12 20 C12 20 3 14 3 8 C3 5 5 3.5 7.2 3.5 C9 3.5 10.6 4.7 12 6.6 C13.4 4.7 15 3.5 16.8 3.5 C19 3.5 21 5 21 8 C21 14 12 20 12 20 Z"
                   fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
           </svg>
         </button>`
        : '';
    const isbnClean = (book.isbn || '').replace(/[^\d]/g, '');
    const coverImg = isbnClean
      ? `<img class="book-card__cover-img" loading="lazy" alt=""
              src="https://covers.openlibrary.org/b/isbn/${isbnClean}-M.jpg?default=false"
              onload="this.classList.add('is-loaded')"
              onerror="this.style.display='none'" />`
      : '';
    // v2.6: tag "novità" + aura per libri aggiunti di recente.
    // Attivo solo se options.highlightRecent === true (così solo nella
    // sezione "Novità da chi segui" sulla home, non ovunque).
    const isRecent = options.highlightRecent && API.isBookRecent(book);
    const cardClasses = ['book-card'];
    if (!book.available) cardClasses.push('book-card--unavailable');
    if (isRecent) cardClasses.push('book-card--recent');
    const recentBadge = isRecent
      ? '<span class="book-card__recent-badge" aria-label="Aggiunto di recente">✦ Novità</span>'
      : '';
    return `
      <a href="book-detail.html?id=${book.id}" class="${cardClasses.join(' ')}">
        ${recentBadge}
        ${likeChip}
        <div class="book-card__cover book-card__cover--placeholder" ${coverStyle}>
          ${coverImg}
          <span class="book-card__cover-title">${book.title}</span>
        </div>
        <span class="book-card__category">${book.category}</span>
        <h3 class="book-card__title">${book.title}</h3>
        <p class="book-card__author">${book.author}, ${book.year}</p>
        <div class="book-card__meta">
          <span>${book.owner_city ?? (owner ? owner.city : '')}</span>
          <span>${book.available ? 'Disponibile' : 'In prestito'}</span>
        </div>
      </a>`;
  },

  /* Handler delegato per i cuori "mi piace" sovrapposti alle card.
     Intercetta il click sul cuore impedendo la navigazione del link
     contenitore, alterna il like e aggiorna icona + notifiche. */
  /* -------------------------------------------------------------
     COMPONENTE TAG-INPUT (BISAC, multi-tag con autocomplete)
     Sostituisce il vecchio <select> categoria nelle pagine di
     ricerca e pubblicazione. L'utente digita una o più lettere
     e vede subito i tag che le contengono, raggruppati per
     macro-area; tappando un suggerimento lo aggiunge come "chip".
     I tag selezionati sono recuperabili via container.getTags()
     ed è possibile reagire al cambio tramite onChange.
     ------------------------------------------------------------- */
  initTagInput(container, opts = {}) {
    const {
      placeholder = 'Aggiungi un genere (digita per cercare)…',
      initial = [],
      onChange = () => {},
      maxTags = 8,
      hiddenName = null, // se valorizzato, scrive un input nascosto con valori CSV per i form classici
    } = opts;

    const allTags = API.getAllCategoryTags();
    let selected = [...initial];
    let activeIdx = -1; // riga evidenziata nel dropdown

    container.classList.add('tag-input');
    container.innerHTML = `
      <div class="tag-input__chips" aria-live="polite"></div>
      <input type="text" class="tag-input__field" placeholder="${placeholder}" autocomplete="off" />
      <div class="tag-input__dropdown" role="listbox" hidden></div>
      ${hiddenName ? `<input type="hidden" name="${hiddenName}" class="tag-input__hidden" />` : ''}`;
    const chipsBox = container.querySelector('.tag-input__chips');
    const input = container.querySelector('.tag-input__field');
    const dropdown = container.querySelector('.tag-input__dropdown');
    const hidden = container.querySelector('.tag-input__hidden');

    function commit() {
      onChange(selected.slice());
      if (hidden) hidden.value = selected.join(',');
    }
    function paintChips() {
      chipsBox.innerHTML = selected
        .map(
          (t, i) =>
            `<span class="tag-chip">
           <span class="tag-chip__label">${t}</span>
           <button type="button" class="tag-chip__x" data-i="${i}" aria-label="Rimuovi ${t}">×</button>
         </span>`
        )
        .join('');
      chipsBox.querySelectorAll('.tag-chip__x').forEach((btn) =>
        btn.addEventListener('click', () => {
          selected.splice(+btn.dataset.i, 1);
          paintChips();
          commit();
          input.focus();
        })
      );
    }
    function addTag(tag) {
      if (!tag || selected.includes(tag) || selected.length >= maxTags) return false;
      if (!allTags.includes(tag)) return false;
      selected.push(tag);
      paintChips();
      commit();
      input.value = '';
      closeDropdown();
      return true;
    }
    function openDropdown(items) {
      if (!items.length) {
        closeDropdown();
        return;
      }
      dropdown.innerHTML = items
        .map((t, i) => {
          const parent = API.getCategoryParent(t);
          // evidenzia la parte di testo che combacia con la query
          const q = input.value.trim();
          const re = q
            ? new RegExp('(' + q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'i')
            : null;
          const labelHtml = re ? t.replace(re, '<mark>$1</mark>') : t;
          return `<div class="tag-opt ${i === activeIdx ? 'is-active' : ''}" role="option" data-tag="${t}">
                  <span>${labelHtml}</span>
                  ${parent ? `<span class="tag-opt__parent">${parent}</span>` : ''}
                </div>`;
        })
        .join('');
      dropdown.hidden = false;
      dropdown.querySelectorAll('.tag-opt').forEach((el) =>
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          addTag(el.dataset.tag);
        })
      );
    }
    function closeDropdown() {
      dropdown.hidden = true;
      activeIdx = -1;
    }
    function recompute() {
      const q = input.value.trim().toLowerCase();
      const items = allTags
        .filter((t) => !selected.includes(t) && (!q || t.toLowerCase().includes(q)))
        .slice(0, 12);
      openDropdown(items);
    }

    input.addEventListener('focus', recompute);
    input.addEventListener('input', () => {
      activeIdx = -1;
      recompute();
    });
    input.addEventListener('keydown', (e) => {
      const opts = [...dropdown.querySelectorAll('.tag-opt')];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(opts.length - 1, activeIdx + 1);
        recompute();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(0, activeIdx - 1);
        recompute();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (opts[activeIdx]) addTag(opts[activeIdx].dataset.tag);
        else if (opts.length === 1) addTag(opts[0].dataset.tag);
      } else if (e.key === 'Backspace' && !input.value && selected.length) {
        selected.pop();
        paintChips();
        commit();
      } else if (e.key === 'Escape') closeDropdown();
    });
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) closeDropdown();
    });

    paintChips();
    if (hidden) hidden.value = selected.join(',');

    // API esposta sul container per chiamanti esterni
    container.getTags = () => selected.slice();
    container.setTags = (arr) => {
      selected = arr.slice();
      paintChips();
      commit();
    };
    return container;
  },

  /** v2.5: ridimensiona e centra-crop un'immagine in un quadrato di
      lato `size` px. Restituisce un data URL JPEG ottimizzato.
      Usato per la foto profilo (riadattata a quadrato → renderizzata
      a cerchio via CSS border-radius). */
  cropImageToSquare(dataUrl, size = 320, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Crop quadrato centrato
        const src = Math.min(img.width, img.height);
        const sx = (img.width - src) / 2;
        const sy = (img.height - src) / 2;
        ctx.drawImage(img, sx, sy, src, src, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('image-load-failed'));
      img.src = dataUrl;
    });
  },

  /** v2.5: collega il menu a tendina al cerchio dell'avatar nel profilo.
      Apre un drop-menu con due voci:
        • "Carica foto…" → apre file input
        • "Rimuovi foto" → resetta (visibile solo se foto esistente)
      Dopo l'upload, l'immagine viene ridimensionata/crop in un quadrato
      di 320px e salvata sul server (PATCH /api/users/me, avatarDataUrl).
      `onChange` viene invocato dopo il salvataggio (es. per ricaricare). */
  wireAvatarMenu(avatarEl, onChange) {
    if (!avatarEl || avatarEl.dataset.wired === '1') return;
    avatarEl.dataset.wired = '1';
    const me = window.LB_UI.currentUser();
    if (!me) return;
    const hasPhoto = !!me.avatar_url;

    // Salva (o rimuove con null) la foto sul server, poi rilegge la sessione
    // perche' la barra di navigazione mostri subito la foto nuova
    async function saveAvatar(avatarDataUrl, okMessage) {
      try {
        await window.LB_API.users.updateMe({ avatarDataUrl });
        await window.LB_UI.refreshCurrentUser();
        UI.toast(okMessage, avatarDataUrl ? 'success' : 'info');
        if (onChange) onChange();
      } catch (err) {
        UI.toast(err.message || 'Impossibile aggiornare la foto profilo.', 'error');
      }
    }

    // Crea il menu (rimosso quando si chiude)
    function buildMenu() {
      const menu = document.createElement('div');
      menu.className = 'avatar-menu';
      menu.setAttribute('role', 'menu');
      menu.innerHTML = `
        <button type="button" class="avatar-menu__item" data-action="upload" role="menuitem">
          <span aria-hidden="true">📷</span> ${hasPhoto ? 'Cambia foto…' : 'Carica foto…'}
        </button>
        ${
          hasPhoto
            ? `
        <button type="button" class="avatar-menu__item avatar-menu__item--danger"
                data-action="remove" role="menuitem">
          <span aria-hidden="true">✕</span> Rimuovi foto
        </button>`
            : ''
        }`;
      // Posiziona il menu sotto l'avatar
      const rect = avatarEl.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = rect.bottom + 8 + 'px';
      menu.style.left = rect.left + 'px';
      document.body.appendChild(menu);
      return menu;
    }
    function closeMenu() {
      const existing = document.querySelector('.avatar-menu');
      if (existing) existing.remove();
    }

    avatarEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = document.querySelector('.avatar-menu');
      if (existing) {
        closeMenu();
        return;
      }
      const menu = buildMenu();
      menu.addEventListener('click', (ev) => {
        const action = ev.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        closeMenu();
        if (action === 'remove') {
          if (!confirm('Vuoi davvero rimuovere la foto profilo?')) return;
          saveAvatar(null, 'Foto profilo rimossa.');
        } else if (action === 'upload') {
          // Crea input file nascosto
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.addEventListener('change', async (ev) => {
            const file = ev.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              UI.toast('Il file supera il limite di 5 MB.', 'error');
              return;
            }
            const reader = new FileReader();
            reader.onload = async (re) => {
              try {
                const cropped = await UI.cropImageToSquare(re.target.result, 320, 0.85);
                await saveAvatar(cropped, 'Foto profilo aggiornata.');
              } catch (err) {
                UI.toast("Impossibile elaborare l'immagine.", 'error');
              }
            };
            reader.readAsDataURL(file);
          });
          input.click();
        }
      });
    });

    // Anche con tastiera (Enter/Space)
    avatarEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        avatarEl.click();
      }
    });

    document.addEventListener('click', () => closeMenu());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  },

  /** v2.2: Inietta un link "Admin" nella nav header solo per utenti
      con is_admin=true. Inserito dopo "Profilo" se presente.
      v2.5: icona SVG inline coerente con le altre nav icons. */
  initAdminLink() {
    const me = window.LB_UI.currentUser();
    if (!me || !me.is_admin) return;
    const nav = document.querySelector('header .site-nav');
    if (!nav) return;
    if (nav.querySelector('a[href="admin.html"]')) return;
    const adminLink = document.createElement('a');
    adminLink.href = 'admin.html';
    adminLink.className = 'nav-admin nav-icon';
    adminLink.setAttribute('aria-label', 'Pannello amministrazione');
    adminLink.setAttribute('title', 'Pannello amministrazione');
    // v2.5 quick fix: solo icona, niente label
    adminLink.innerHTML = UI.ICON.admin.replace('<svg ', '<svg class="nav-icon__svg" ');
    // Inserisci prima del bottone "Pubblica" (così l'ordine è
    // Esplora · Stats · Prestiti · Admin · Pubblica)
    const publishLink = nav.querySelector('a.nav-publish');
    if (publishLink) {
      nav.insertBefore(adminLink, publishLink);
    } else {
      nav.appendChild(adminLink);
    }
  },

  /* v2.4: rendering condiviso dei post — composer + feed.
     Usato da profile.html (tab Post), library.html (tab Post sul
     profilo pubblico), index.html (aggiornamenti recenti). */

  /* Post delle librerie (dal server). Una reazione per utente, si
     pubblica con almeno un volume, una segnalazione per post. */
  POST_MAX_LENGTH: 500,
  REACTION_EMOJI: ['👍', '❤️', '👏', '🤔'],

  /** Composer dei post. options.canPublish: se l'utente ha almeno un
      volume (se assente lo chiede al server); options.onPublished. */
  async renderPostComposer(container, options = {}) {
    const me = window.LB_UI.currentUser();
    if (!me) {
      container.innerHTML = '';
      return;
    }
    let canPublish = options.canPublish;
    if (canPublish === undefined) {
      try {
        const res = await window.LB_API.books.list({ ownerId: me.id, limit: 1 });
        canPublish = res.pagination.total > 0;
      } catch (_err) {
        canPublish = true; // decide il server alla pubblicazione
      }
    }
    if (!canPublish) {
      container.innerHTML = `
        <div class="post-composer post-composer--locked">
          <p>📝 <strong>Pubblica almeno un volume</strong> per poter scrivere aggiornamenti
          sulla tua libreria. <a href="add-book.html">Aggiungi il primo volume</a>.</p>
        </div>`;
      return;
    }
    const max = UI.POST_MAX_LENGTH;
    container.innerHTML = `
      <form class="post-composer" id="post-composer-form">
        <div class="post-composer__avatar" aria-hidden="true">
          ${
            me.avatar_url
              ? `<img class="post-composer__avatar-img" src="${this._escapeHtml(me.avatar_url)}" alt="">`
              : this._escapeHtml(UI._initials(me.display_name || me.username))
          }
        </div>
        <div class="post-composer__body">
          <textarea name="content" class="post-composer__textarea" rows="3"
                    maxlength="${max}"
                    placeholder="Condividi un aggiornamento sulla tua libreria…" required></textarea>
          <div class="post-composer__bar">
            <span class="post-composer__count" id="post-count">0 / ${max}</span>
            <button type="submit" class="btn btn--primary btn--small">Pubblica</button>
          </div>
        </div>
      </form>`;
    const form = container.querySelector('#post-composer-form');
    const ta = form.querySelector('textarea');
    const counter = container.querySelector('#post-count');
    const submitBtn = form.querySelector('button[type="submit"]');
    ta.addEventListener('input', () => {
      counter.textContent = `${ta.value.length} / ${max}`;
      counter.classList.toggle('is-near-limit', ta.value.length > max * 0.85);
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = ta.value.trim();
      if (!content) {
        UI.toast('Il post non può essere vuoto.', 'error');
        return;
      }
      submitBtn.disabled = true;
      try {
        await window.LB_API.posts.create({ content });
        UI.toast('Post pubblicato.', 'success');
        ta.value = '';
        counter.textContent = `0 / ${max}`;
        if (options.onPublished) options.onPublished();
      } catch (err) {
        UI.toast(err.message || 'Pubblicazione non riuscita. Riprova.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  },

  /** Iniziali (massimo due) da un nome. */
  _initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  },

  /** Elenco di post (DTO del server: author, reactionsByEmoji,
      myReactions, reportedByMe, createdAt). */
  renderPostsFeed(container, posts, options = {}) {
    const me = window.LB_UI.currentUser();
    if (posts.length === 0) {
      container.innerHTML = `<p class="posts-empty">${options.emptyMessage || 'Nessun post ancora.'}</p>`;
      return;
    }
    container.innerHTML = posts.map((p) => UI._renderPostCard(p, me, options)).join('');
    UI._wirePostsFeed(container, options);
  },

  _renderPostCard(post, me, options) {
    const esc = (v) => this._escapeHtml(v);
    const author = post.author || { id: '', displayName: 'Utente', username: '' };
    const authorHref = `library.html?id=${encodeURIComponent(author.id)}`;
    const isMine = !!me && author.id === me.id;
    const myReaction = (post.myReactions || [])[0] || null;
    const showAuthor = options.showAuthor !== false;
    const authorAvatarInner = author.avatarUrl
      ? `<img class="post-card__avatar-img" src="${esc(author.avatarUrl)}" alt="">`
      : esc(UI._initials(author.displayName || author.username));

    const reactionsHtml = UI.REACTION_EMOJI.map((em) => {
      const count = (post.reactionsByEmoji || {})[em] || 0;
      const mine = myReaction === em;
      return `<button type="button" class="post-reaction ${mine ? 'is-mine' : ''} ${count > 0 ? 'has-count' : ''}"
                      data-post-react="${esc(post.id)}" data-emoji="${em}" data-mine="${mine}"
                      aria-pressed="${mine}" title="Reagisci con ${em}">
        <span class="post-reaction__emoji" aria-hidden="true">${em}</span>
        ${count > 0 ? `<span class="post-reaction__count">${count}</span>` : ''}
      </button>`;
    }).join('');

    const deleteBtn = isMine
      ? `<button type="button" class="post-card__delete" data-post-delete="${esc(post.id)}"
                 title="Elimina post" aria-label="Elimina post">🗑</button>`
      : '';

    return `
      <article class="post-card" data-post-id="${esc(post.id)}">
        ${
          showAuthor
            ? `
        <header class="post-card__head">
          <a href="${authorHref}" class="post-card__avatar" aria-hidden="true">
            ${authorAvatarInner}
          </a>
          <div class="post-card__author">
            <a href="${authorHref}" class="post-card__name">${esc(author.displayName || author.username)}</a>
            <span class="post-card__time">${UI.timeAgo(post.createdAt)}</span>
          </div>
          ${deleteBtn}
        </header>`
            : `
        <header class="post-card__head post-card__head--anon">
          <span class="post-card__time">${UI.timeAgo(post.createdAt)}</span>
          ${deleteBtn}
        </header>`
        }
        <p class="post-card__content">${UI._escapePostContent(post.content)}</p>
        <footer class="post-card__foot">
          <div class="post-card__reactions" role="group" aria-label="Reazioni">
            ${reactionsHtml}
          </div>
          ${
            me && !isMine
              ? `
            <button type="button" class="post-card__report ${post.reportedByMe ? 'is-reported' : ''}"
                    data-post-report="${esc(post.id)}"
                    title="${post.reportedByMe ? 'Già segnalato' : 'Segnala come inappropriato'}"
                    ${post.reportedByMe ? 'disabled' : ''}>
              ${post.reportedByMe ? '⚐ Segnalato' : '⚐ Segnala'}
            </button>`
              : ''
          }
        </footer>
      </article>`;
  },

  _escapePostContent(s) {
    const div = document.createElement('div');
    div.textContent = s || '';
    // Trasforma i \n in <br> dopo l'escape
    return div.innerHTML.replace(/\n/g, '<br>');
  },

  _wirePostsFeed(container, options = {}) {
    // Un solo gestore anche se l'elenco viene ridisegnato
    container.onclick = async (e) => {
      const reactBtn = e.target.closest('[data-post-react]');
      const reportBtn = e.target.closest('[data-post-report]');
      const deleteBtn = e.target.closest('[data-post-delete]');
      if (!reactBtn && !reportBtn && !deleteBtn) return;

      if ((reactBtn || reportBtn) && !window.LB_UI.currentUser()) {
        UI.toast(
          reactBtn ? 'Accedi per reagire ai post.' : 'Accedi per segnalare un post.',
          'info'
        );
        return;
      }
      try {
        if (reactBtn) {
          const { postReact: id, emoji, mine } = reactBtn.dataset;
          // Stessa emoji: la si toglie; un'altra: sostituisce la precedente
          if (mine === 'true') await window.LB_API.posts.unreact(id, emoji);
          else await window.LB_API.posts.react(id, emoji);
          if (options.onChange) options.onChange();
        }
        if (reportBtn) {
          UI._openReportModal(reportBtn.dataset.postReport, options.onChange);
        }
        if (deleteBtn) {
          if (!confirm('Eliminare definitivamente questo post?')) return;
          await window.LB_API.posts.remove(deleteBtn.dataset.postDelete);
          UI.toast('Post eliminato.', 'info');
          if (options.onChange) options.onChange();
        }
      } catch (err) {
        UI.toast(err.message || 'Operazione non riuscita. Riprova.', 'error');
      }
    };
  },

  _openReportModal(postId, onDone) {
    // Modal ad-hoc usato solo qui — costruito on-demand
    const existing = document.getElementById('report-post-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.id = 'report-post-modal';
    modal.innerHTML = `
      <div class="admin-modal__backdrop" data-modal-close></div>
      <div class="admin-modal__card" role="dialog" aria-modal="true" aria-labelledby="report-post-title">
        <h3 class="admin-modal__title" id="report-post-title">Segnala questo post</h3>
        <form id="report-post-form" class="form">
          <div class="form__group">
            <label class="form__label" for="report-reason">Motivo</label>
            <select id="report-reason" name="reason" class="form__input" required>
              <option value="offensive">Contenuto offensivo</option>
              <option value="spam">Spam o pubblicità</option>
              <option value="off-topic">Off-topic / non pertinente</option>
              <option value="violence">Incitamento alla violenza o odio</option>
              <option value="other">Altro</option>
            </select>
          </div>
          <div class="form__group">
            <label class="form__label" for="report-note">Dettagli (facoltativo)</label>
            <textarea id="report-note" name="note" rows="3" maxlength="300" class="form__input"
                      placeholder="Aggiungi contesto se necessario…"></textarea>
          </div>
          <div class="admin-modal__actions">
            <button type="button" class="btn btn--ghost" data-modal-close>Annulla</button>
            <button type="submit" class="btn btn--primary btn--danger">Invia segnalazione</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    modal
      .querySelectorAll('[data-modal-close]')
      .forEach((el) => el.addEventListener('click', () => modal.remove()));
    modal.querySelector('#report-post-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = modal.querySelector('#report-reason').value;
      const note = modal.querySelector('#report-note').value.trim();
      try {
        await window.LB_API.posts.report(postId, note ? { reason, note } : { reason });
        UI.toast('Segnalazione inviata. Un moderatore la esaminerà.', 'success');
        modal.remove();
        if (onDone) onDone();
      } catch (err) {
        if (err.code === 'ALREADY_REPORTED') {
          UI.toast('Hai già segnalato questo post.', 'info');
          modal.remove();
          if (onDone) onDone();
        } else {
          UI.toast(err.message || 'Segnalazione non riuscita. Riprova.', 'error');
        }
      }
    });
  },

  initLikeChips() {
    if (this._likeChipsInit) return;
    this._likeChipsInit = true;
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.like-chip');
      if (!chip) return;
      e.preventDefault();
      e.stopPropagation();
      const me = window.LB_UI.currentUser();
      if (!me) return;
      const bookId = +chip.dataset.bookId;
      const nowLiked = API.toggleLike(bookId);
      chip.classList.toggle('is-liked', nowLiked);
      chip.setAttribute('aria-pressed', String(nowLiked));
      const path = chip.querySelector('path');
      if (path) path.setAttribute('fill', nowLiked ? 'currentColor' : 'none');
      if (this._refreshNotifications) this._refreshNotifications();
    });
  },

  /** Render griglia libri */
  renderBooksGrid(container, books, options = {}) {
    if (!books.length) {
      container.innerHTML = `<p class="alert alert--info">Nessun libro trovato con i filtri correnti.</p>`;
      return;
    }
    container.innerHTML = books.map((b) => this.renderBookCard(b, null, options)).join('');
    container.classList.add('stagger');
  },

  /* -------------------------------------------------------------
     Render dei RISULTATI DI RICERCA in formato elenco leggibile.
     Pensato per explore.html: ogni riga mette in evidenza la
     posizione del volume (dove si trova fisicamente, il dato più
     importante per chi cerca un prestito di prossimità) e lo stato
     di disponibilità con un badge animato a colori d'accento.
     Le righe entrano con un'animazione a cascata. ------------- */
  renderSearchResults(container, books) {
    if (!books.length) {
      container.innerHTML = `<p class="alert alert--info">Nessun libro trovato con i filtri correnti. Prova ad allargare il raggio o a cambiare categoria.</p>`;
      return;
    }
    container.innerHTML = books
      .map((b, i) => {
        const owner = API.getUser(b.owner_id);
        const isOrg = owner && window.LB_UI.isOrganization(owner);
        const ownerLabel = owner ? owner.display_name : 'Sconosciuto';
        const place = owner ? owner.city || '—' : '—';
        const availBadge = b.available
          ? `<span class="result-badge result-badge--available">
             <span class="result-badge__dot" aria-hidden="true"></span>Disponibile
           </span>`
          : `<span class="result-badge result-badge--loaned">In prestito</span>`;

        return `
        <a href="book-detail.html?id=${b.id}" class="result-item" style="--i: ${i};">
          <div class="result-item__cover" style="background: ${b.cover_gradient};" aria-hidden="true">
            <span>${b.title.split(' ').slice(0, 3).join(' ')}</span>
          </div>
          <div class="result-item__main">
            <span class="result-item__category">${b.category}</span>
            <h3 class="result-item__title">${b.title}</h3>
            <p class="result-item__author">${b.author} · ${b.year}</p>
            <div class="result-item__place">
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" class="result-item__pin">
                <path d="M12 2 C 8 2, 5 5, 5 9 c 0 5, 7 13, 7 13 s 7 -8, 7 -13 c 0 -4, -3 -7, -7 -7 z"
                      fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <circle cx="12" cy="9" r="2.5" fill="currentColor"/>
              </svg>
              <span class="result-item__place-text">
                <strong>${place}</strong>
                <span class="result-item__owner">${isOrg ? '🏛 ' : ''}libreria di ${ownerLabel}</span>
              </span>
            </div>
          </div>
          <div class="result-item__aside">
            ${availBadge}
            <span class="result-item__cta" aria-hidden="true">vedi dettagli →</span>
          </div>
        </a>`;
      })
      .join('');
  },

  /** Gestione navigazione mobile */
  initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    if (!toggle || !nav) return;

    // Beta 9: focus trap + ESC close per accessibilita' mobile
    const openMenu = () => {
      nav.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      // Focus sul primo link del menu per screen reader + tastiera
      const firstLink = nav.querySelector('a');
      if (firstLink) firstLink.focus();
      document.body.style.overflow = 'hidden'; // previene scroll pagina
    };
    const closeMenu = () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      toggle.focus(); // ridà focus al toggle per continuita' tastiera
    };
    const toggleMenu = () => {
      if (nav.classList.contains('open')) closeMenu();
      else openMenu();
    };

    toggle.addEventListener('click', toggleMenu);

    // ESC per chiudere (accessibilita' keyboard)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        closeMenu();
      }
    });

    // Focus trap: TAB dall'ultimo link torna al primo, SHIFT+TAB dal primo va all'ultimo
    nav.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !nav.classList.contains('open')) return;
      const links = nav.querySelectorAll('a, button');
      if (links.length === 0) return;
      const first = links[0];
      const last = links[links.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  },

  /** Evidenzia voce di menu attiva */
  highlightActiveNav() {
    const current = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.site-nav a').forEach((link) => {
      if (link.getAttribute('href') === current) link.classList.add('active');
    });
  },

  /**
   * Beta 9: Feedback offline. Aggiunge un badge fisso in alto se navigator.onLine
   * ritorna false, e lo rimuove quando torna online.
   */
  initOfflineBadge() {
    // Crea il badge se non esiste
    if (!document.querySelector('.offline-badge')) {
      const badge = document.createElement('div');
      badge.className = 'offline-badge';
      badge.textContent = '⚠️ Sei offline';
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-live', 'polite');
      document.body.appendChild(badge);
    }
    const update = () => {
      if (navigator.onLine) {
        document.body.classList.remove('is-offline');
      } else {
        document.body.classList.add('is-offline');
      }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  },

  /** Notifiche toast */
  toast(message, type = 'info') {
    const t = document.createElement('div');
    t.className = `alert alert--${type}`;
    t.setAttribute('role', 'status');
    t.textContent = message;
    t.style.cssText =
      'position:fixed;top:5rem;right:1.5rem;z-index:1000;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.15);';
    document.body.appendChild(t);
    setTimeout(() => (t.style.opacity = '0'), 3000);
    setTimeout(() => t.remove(), 3500);
  },

  /* -------------------------------------------------------------
     Card "Libreria utente" — mini-profilo con bio e conteggio libri.
     Distingue visivamente le librerie-ente dalle librerie-persona.
     ------------------------------------------------------------- */
  renderLibraryCard(user) {
    const initial = (user.display_name || user.username || '?').trim()[0].toUpperCase();
    const bookLabel = user.book_count === 1 ? 'volume' : 'volumi';
    const isOrg = window.LB_UI.isOrganization(user);
    const typeBadge = isOrg
      ? `<span class="library-card__type library-card__type--org">${window.LB_UI.orgCategoryLabel((API.getOrgProfile(user.id) || {}).org_category)}</span>`
      : '<span class="library-card__type">Libreria personale</span>';
    return `
      <a href="library.html?id=${user.id}" class="library-card">
        <div class="library-card__head">
          <div class="library-card__avatar" aria-hidden="true">${initial}</div>
          <div>
            <h3 class="library-card__name">${user.display_name}</h3>
            <span class="library-card__city">${user.city || '—'}</span>
          </div>
        </div>
        ${typeBadge}
        <p class="library-card__bio">${user.bio || 'Nessuna biografia disponibile.'}</p>
        <div class="library-card__footer">
          <span class="library-card__count">${user.book_count} ${bookLabel}</span>
          <span class="library-card__link">visita →</span>
        </div>
      </a>`;
  },

  /* -------------------------------------------------------------
     Card "Libreria vicino a te" — variante ricca del componente
     libreria, con copertina generata, distanza dichiarata e numero
     di volumi disponibili al prestito messo graficamente in risalto.
     ------------------------------------------------------------- */
  renderNearbyLibraryCard(lib) {
    const { themeClass, design, letter } = window.LB_UI.libraryCoverData(lib, lib.prefs);
    const isOrg = window.LB_UI.isOrganization(lib);

    /* Distanza in linguaggio naturale */
    const dist = lib.distance_km;
    const distLabel =
      dist < 1
        ? `a ${Math.round(dist * 1000)} m da te`
        : `a ${dist.toFixed(1).replace('.', ',')} km da te`;

    /* Descrizione breve: il motto personalizzato se presente,
       altrimenti la biografia, altrimenti un testo neutro. */
    const shortDesc =
      lib.prefs && lib.prefs.motto
        ? `«${lib.prefs.motto}»`
        : lib.bio ||
          (isOrg
            ? 'Libreria di comunità aperta al prestito.'
            : 'Collezione privata condivisa con la comunità.');

    /* Tipo: badge in alto a sinistra con icona dedicata. */
    const typeLabel = isOrg
      ? window.LB_UI.orgCategoryLabel((API.getOrgProfile(lib.id) || {}).org_category)
      : 'Libreria personale';
    const typeIcon = isOrg ? '🏛' : '📖';
    const typeClass = isOrg ? 'nearby-card--org' : 'nearby-card--person';

    /* Avviso visivo "pochi volumi disponibili": quando la libreria ha
       <= 2 libri disponibili, il blocco numero+etichetta pulsa con un
       bordo arancione che attira l'attenzione (caso 0 = grigio). */
    const lowStock = lib.available_count > 0 && lib.available_count <= 2;
    const emptyStock = lib.available_count === 0;
    const availClass =
      (emptyStock ? ' nearby-card__avail-num--zero' : '') +
      (lowStock ? ' nearby-card__avail-num--low' : '');
    const blockClass = lowStock ? ' nearby-card__avail-block--low' : '';
    const availLbl = lib.available_count === 1 ? 'libro disponibile' : 'libri disponibili';

    return `
      <a href="library.html?id=${lib.id}" class="nearby-card ${typeClass}">
        <div class="nearby-card__cover ${themeClass}">
          <svg class="nearby-card__art" viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice"
               xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            ${design.render({ letter })}
          </svg>
          <span class="nearby-card__type">
            <span class="nearby-card__type-ico" aria-hidden="true">${typeIcon}</span>
            ${typeLabel}
          </span>
          ${
            API.isLibraryFresh(lib)
              ? `
            <span class="nearby-card__fresh" title="Libreria aperta da poco">
              <span aria-hidden="true">✦</span> Appena aperta
            </span>`
              : ''
          }
        </div>
        <div class="nearby-card__body">
          <h3 class="nearby-card__name">${lib.display_name}</h3>
          ${(() => {
            // v1.4: piccolo riepilogo recensioni sotto al nome, coerente
            // col resto della scheda (font-mono, color soft).
            // v2.6: se non ci sono recensioni, placeholder mantengo
            // lo stesso spazio per non rompere il layout di tutte le card.
            const s = API.getReviewSummary(lib.id);
            if (s.count === 0) {
              return '<div class="nearby-card__stars nearby-card__stars--empty"><span class="nearby-card__no-reviews">Nessuna recensione ancora</span></div>';
            }
            return `<div class="nearby-card__stars">
              ${UI.renderStars(s.average, { count: s.count, size: 'sm', showAverage: true })}
            </div>`;
          })()}
          <p class="nearby-card__desc">${shortDesc}</p>

          <div class="nearby-card__hilite">
            <div class="nearby-card__place-block">
              <span class="nearby-card__place-line">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M12 2 C8.7 2 6 4.7 6 8 c 0 5, 6 13, 6 13 s 6 -8, 6 -13 c 0 -3.3 -2.7 -6 -6 -6 z"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                  <circle cx="12" cy="8" r="2.4" fill="currentColor"/>
                </svg>
                <span>${lib.city || '—'}</span>
              </span>
              <span class="nearby-card__place-dist">${distLabel}</span>
            </div>
            <div class="nearby-card__avail-block${blockClass}">
              <span class="nearby-card__avail-num${availClass}">${lib.available_count}</span>
              <span class="nearby-card__avail-lbl">${availLbl}</span>
            </div>
          </div>
        </div>
      </a>`;
  },

  /* -------------------------------------------------------------
     Render dei volumi di una libreria in una delle quattro modalità
     scelte dal curatore: grid | list | shelf | timeline.
     Logica condivisa fra library.html e l'anteprima di
     profile-setup.html.
     ------------------------------------------------------------- */
  renderBooksInMode(container, books, mode, gradientFallback) {
    if (!books.length) {
      container.innerHTML = `<p style="color: var(--color-ink-soft); font-style: italic; padding: var(--sp-6) 0;">
        Questa libreria non ha ancora volumi pubblicati.</p>`;
      return;
    }
    const grad = gradientFallback || 'linear-gradient(135deg, #7a1e2b, #b08840)';

    switch (mode) {
      case 'list':
        container.innerHTML = `<div class="books-list">
          ${books
            .map(
              (b) => `
            <a href="book-detail.html?id=${b.id}" class="books-list__item">
              <div class="books-list__cover" style="background: ${b.cover_gradient || grad};">
                ${b.title.split(' ').slice(0, 2).join(' ')}
              </div>
              <div class="books-list__main">
                <h4>${b.title}</h4>
                <span>${b.author} · ${b.year} · ${b.category}</span>
              </div>
              <div class="books-list__meta">
                ${b.available ? 'disponibile' : 'in prestito'}<br/>
                <small>${b.condition}</small>
              </div>
            </a>`
            )
            .join('')}
        </div>`;
        break;

      case 'shelf':
        container.innerHTML = `<div class="books-shelf">
          ${books
            .map(
              (b) => `
            <a href="book-detail.html?id=${b.id}" class="books-shelf__book"
               style="background: ${b.cover_gradient || grad};"
               title="${b.title} — ${b.author}">${b.title}</a>`
            )
            .join('')}
        </div>`;
        break;

      case 'timeline':
        container.innerHTML = `<div class="books-timeline">
          ${[...books]
            .sort((a, b) => a.year - b.year)
            .map(
              (b) => `
            <a href="book-detail.html?id=${b.id}" class="books-timeline__item" style="text-decoration:none;display:block;">
              <div class="books-timeline__year">${b.year}</div>
              <div class="books-timeline__title">${b.title}</div>
              <div class="books-timeline__author">${b.author} — ${b.category}</div>
            </a>`
            )
            .join('')}
        </div>`;
        break;

      case 'grid':
      default:
        /* renderBookCard restituisce già un <a class="book-card">.
           Lo si avvolge nel contenitore .books-grid perché in
           library.html #books-container è un div neutro e senza
           la classe di griglia le card si impilerebbero a tutta
           larghezza. */
        container.innerHTML = `<div class="books-grid">
          ${books.map((b) => this.renderBookCard(b)).join('')}
        </div>`;
        break;
    }
  },

  /* -------------------------------------------------------------
     Validazione live: collega ascoltatori 'input'/'blur' a un form
     per applicare le classi visive .touched / .is-valid / .is-invalid
     mostrando feedback testuale immediato sotto ogni campo.
     ------------------------------------------------------------- */
  attachLiveValidation(form, customRules = {}) {
    const fields = form.querySelectorAll('input, select, textarea');

    fields.forEach((field) => {
      // Salta i checkbox/radio: la loro UX è diversa
      if (['checkbox', 'radio', 'file', 'hidden'].includes(field.type)) return;

      const group = field.closest('.form__group');
      if (group) group.classList.add('form__group--validated');

      // Crea contenitore feedback se assente
      let feedback = group?.querySelector('.form__feedback');
      if (group && !feedback) {
        feedback = document.createElement('span');
        feedback.className = 'form__feedback';
        feedback.setAttribute('aria-live', 'polite');
        group.appendChild(feedback);
      }

      const validate = () => {
        if (!field.value && !field.required) {
          // Campo facoltativo lasciato vuoto: stato neutro
          group?.classList.remove('is-valid', 'is-invalid');
          if (feedback) {
            feedback.textContent = '';
            feedback.className = 'form__feedback';
          }
          return;
        }

        let ok = field.checkValidity();
        let msg = '';

        // Regola personalizzata aggiuntiva (es. minLen descrizione)
        if (ok && customRules[field.name]) {
          const result = customRules[field.name](field.value, field);
          if (result !== true) {
            ok = false;
            msg = result;
          }
        }

        // Messaggi italianizzati per i validity state nativi
        if (!ok && !msg) {
          if (field.validity.valueMissing) msg = 'Campo obbligatorio.';
          else if (field.validity.typeMismatch) msg = 'Formato non valido.';
          else if (field.validity.patternMismatch) msg = 'Formato non valido.';
          else if (field.validity.tooShort) msg = `Minimo ${field.minLength} caratteri.`;
          else if (field.validity.tooLong) msg = `Massimo ${field.maxLength} caratteri.`;
          else if (field.validity.rangeUnderflow) msg = `Valore minimo: ${field.min}.`;
          else if (field.validity.rangeOverflow) msg = `Valore massimo: ${field.max}.`;
          else msg = 'Valore non valido.';
        }

        group?.classList.toggle('is-valid', ok);
        group?.classList.toggle('is-invalid', !ok);
        if (feedback) {
          feedback.textContent = ok ? '✓ Campo valido.' : msg;
          feedback.className =
            'form__feedback ' + (ok ? 'form__feedback--ok' : 'form__feedback--error');
        }
      };

      // Marca come "toccato" al primo blur (per evitare di mostrare
      // errori prima ancora che l'utente abbia interagito col campo)
      field.addEventListener('blur', () => {
        field.classList.add('touched');
        validate();
      });
      field.addEventListener('input', () => {
        if (field.classList.contains('touched')) validate();
      });
    });
  },

  /* -------------------------------------------------------------
     Allinea data-auth-state su <html> (selettori CSS `.auth-only` e
     `.guest-only`) alla sessione verificata dal server. Lo stato
     iniziale, prima del primo disegno, lo imposta auth-hint.js. */
  initAuthToggle() {
    if (window.LB_AUTH_ERROR) return; // sessione non verificata: resta l'indizio
    window.LB_UI.setAuthState(window.LB_UI.currentUser() ? 'user' : 'guest');
  },

  /* -------------------------------------------------------------
     ICONA-AVATAR PROFILO NELLA BARRA (v1.2)
     Inietta automaticamente, accanto alla campanella, un pallino
     circolare con il simbolo/iniziale dell'utente loggato. Il
     pallino prende il colore dal tema cromatico scelto. Click →
     profile.html. Si aggiorna se cambia lo stato di autenticazione.
     ------------------------------------------------------------- */
  initProfileAvatar() {
    const nav = document.querySelector('.site-nav');
    if (!nav || nav.querySelector('.nav-avatar-wrap')) return;

    /* Wrapper avatar + dropdown. v1.3: l'avatar non è più un semplice
       link, ma un bottone che apre un menu a tendina (logout + scorciatoia
       al profilo), pattern standard per webapp loggate. */
    const wrap = document.createElement('div');
    wrap.className = 'nav-avatar-wrap auth-only';
    wrap.innerHTML = `
      <button type="button" class="nav-avatar" aria-haspopup="true" aria-expanded="false"
              aria-label="Menu profilo">
        <span class="nav-avatar__glyph" aria-hidden="true"></span>
      </button>
      <div class="nav-avatar__menu" role="menu" hidden>
        <div class="nav-avatar__menu-head" aria-hidden="true">
          <span class="nav-avatar__menu-name"></span>
          <span class="nav-avatar__menu-user"></span>
        </div>
        <a href="profile.html" class="nav-avatar__menu-item" role="menuitem">
          <span aria-hidden="true">◆</span> Vai al profilo
        </a>
        <a href="loans.html" class="nav-avatar__menu-item" role="menuitem">
          <span aria-hidden="true">↪</span> I miei prestiti
        </a>
        <a href="profile-setup.html" class="nav-avatar__menu-item" role="menuitem">
          <span aria-hidden="true">⚙</span> Personalizza
        </a>
        <button type="button" class="nav-avatar__menu-item nav-avatar__menu-item--danger"
                role="menuitem" id="nav-logout-btn">
          <span aria-hidden="true">↦</span> Esci
        </button>
      </div>`;

    // v3.0.0-alpha.0: il vecchio .auth-toggle è stato rimosso;
    // inserisco l'avatar in coda alla nav.
    nav.appendChild(wrap);

    const button = wrap.querySelector('.nav-avatar');
    const menu = wrap.querySelector('.nav-avatar__menu');
    const glyph = wrap.querySelector('.nav-avatar__glyph');
    const nameEl = wrap.querySelector('.nav-avatar__menu-name');
    const userEl = wrap.querySelector('.nav-avatar__menu-user');
    const logoutBtn = wrap.querySelector('#nav-logout-btn');

    // Preferenze (tema, simbolo) lette dal server una volta per pagina
    let prefs = {};
    async function loadPrefs() {
      if (!window.LB_UI.currentUser()) return;
      try {
        prefs = (await window.LB_API.prefs.getMe()) || {};
        paint();
      } catch (_) {
        /* restano tema e iniziali predefiniti */
      }
    }

    function paint() {
      const me = window.LB_UI.currentUser();
      if (!me) return;
      const themeClass = `cover--${prefs.theme || 'classic'}`;
      // Foto profilo se presente, altrimenti iniziale o simbolo scelto
      if (me.avatar_url) {
        button.className = `nav-avatar nav-avatar--photo ${themeClass}`;
        glyph.innerHTML = `<img class="nav-avatar__img" src="${UI._escapeHtml(me.avatar_url)}" alt="">`;
      } else {
        const symbol =
          prefs.avatarStyle === 'symbol' && prefs.avatarSymbol
            ? prefs.avatarSymbol
            : (me.display_name || me.username || '?').trim()[0].toUpperCase();
        button.className = `nav-avatar ${themeClass}`;
        glyph.textContent = symbol;
      }
      button.title = me.display_name || me.username || '';
      nameEl.textContent = me.display_name || '';
      userEl.textContent = '@' + (me.username || '');
    }

    function openMenu() {
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.hidden) openMenu();
      else closeMenu();
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !wrap.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    /* Logout: pulisce lo stato di autenticazione e torna alla homepage.
       Lasciamo intatti like/follow/notifiche/preferenze (sono attribuiti
       all'utente per ID, riappaiono al login successivo). */
    logoutBtn.addEventListener('click', async () => {
      // Beta 8: chiude la connessione SSE prima del signOut
      if (window.LB_EVENTS) window.LB_EVENTS.stop();

      // Fase 3.2: logout via Better Auth (distrugge cookie session)
      // + reset legacy Storage per pagine ancora non migrate
      if (window.LB_API && window.LB_API_AVAILABLE !== false) {
        try {
          await window.LB_API.authClient.signOut();
        } catch (err) {
          console.debug('[logout] Better Auth skip:', err.code || err.message);
        }
      }
      try {
        // Beta 2: current_user_id non piu' in localStorage — rimuovo solo auth_state
        localStorage.removeItem('auth_state');
      } catch (_) {
        /* ignora */
      }
      window.LB_UI.setAuthState('guest');
      // feedback breve e poi via
      UI.toast('Sei uscito. A presto su Lookup.', 'info');
      setTimeout(() => {
        location.href = 'index.html';
      }, 600);
    });

    paint();
    loadPrefs();
    document.addEventListener('auth:change', paint);
    // Dopo una modifica del profilo: rilegge anche tema e simbolo
    UI._refreshAvatar = () => {
      paint();
      loadPrefs();
    };
  },

  /* -------------------------------------------------------------
     CAMPANELLA DI NOTIFICHE
     Iniettata via JS nell'header di ogni pagina (così non serve
     duplicare il markup in ogni file HTML). Visibile solo agli
     utenti autenticati; apre un pannello con la lista degli eventi
     (nuovi libri da chi segui, info aggiornate, preferiti tornati
     disponibili) e un badge con il conteggio dei non letti.
     ------------------------------------------------------------- */
  initNotifications() {
    const nav = document.querySelector('.site-nav');
    if (!nav || nav.querySelector('.notif')) return;

    // Costruisce campanella + pannello
    const wrap = document.createElement('div');
    wrap.className = 'notif auth-only';
    wrap.innerHTML = `
      <button class="notif__bell" type="button" aria-haspopup="true" aria-expanded="false"
              aria-label="Notifiche">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M12 3 C8.7 3 6 5.7 6 9 v3.5 L4.4 15.2 C4 15.9 4.5 17 5.4 17 h13.2 c0.9 0 1.4 -1.1 1 -1.8 L18 12.5 V9 c0 -3.3 -2.7 -6 -6 -6 z"
                fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M9.5 19 a2.6 2.6 0 0 0 5 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <span class="notif__badge" hidden>0</span>
      </button>
      <div class="notif__panel" role="dialog" aria-label="Le tue notifiche" hidden>
        <div class="notif__head">
          <span>Notifiche</span>
          <button type="button" class="notif__readall">Segna tutte come lette</button>
        </div>
        <div class="notif__filters" role="tablist" aria-label="Filtra notifiche">
          <button type="button" class="notif__filter is-active" data-filter="all">Tutte</button>
          <button type="button" class="notif__filter" data-filter="loans">Prestiti</button>
          <button type="button" class="notif__filter" data-filter="reviews">Recensioni</button>
          <button type="button" class="notif__filter" data-filter="social">Social</button>
          <button type="button" class="notif__filter" data-filter="system">Sistema</button>
        </div>
        <div class="notif__list"></div>
      </div>`;

    // v3.0.0-alpha.0: il vecchio .auth-toggle è stato rimosso;
    // inserisco la campanella in coda alla nav (verrà naturalmente
    // alla sinistra dell'avatar, anch'esso appended in coda).
    nav.appendChild(wrap);

    const bell = wrap.querySelector('.notif__bell');
    const badge = wrap.querySelector('.notif__badge');
    const panel = wrap.querySelector('.notif__panel');
    const list = wrap.querySelector('.notif__list');
    const readAll = wrap.querySelector('.notif__readall');

    const timeAgo = (iso) => {
      const diff = Date.now() - new Date(iso).getTime();
      const m = Math.round(diff / 60000),
        h = Math.round(diff / 3600000),
        d = Math.round(diff / 86400000);
      if (m < 60) return m <= 1 ? 'ora' : `${m} min fa`;
      if (h < 24) return `${h} h fa`;
      if (d < 30) return `${d} g fa`;
      return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    };
    // Icona per tipo di notifica (tipi del server)
    const ICONS = {
      loan_requested: '📨',
      loan_accepted: '✓',
      loan_rejected: '✕',
      loan_cancelled: '⊘',
      loan_borrowed: '📖',
      loan_returning: '↦',
      loan_returned: '↦',
      loan_message: '💬',
      loan_overdue_borrower: '⏰',
      loan_overdue_lender: '⏰',
      loan_deadline_upcoming_borrower: '📅',
      loan_deadline_upcoming_lender: '📅',
      new_review: '★',
      new_follower: '👤',
      post_reaction: '👏',
    };
    const icon = (t) => ICONS[t] || 'ℹ️';

    // Filtro attivo (stato di UI), persiste tra le aperture del pannello
    let activeFilter = 'all';
    const matchesFilter = (n) => {
      const t = n.type || '';
      if (activeFilter === 'all') return true;
      if (activeFilter === 'loans') return t.startsWith('loan_');
      if (activeFilter === 'reviews') return t === 'new_review';
      if (activeFilter === 'social') return t === 'new_follower' || t === 'post_reaction';
      return !t.startsWith('loan_') && !['new_review', 'new_follower', 'post_reaction'].includes(t);
    };

    // Dove porta una notifica
    const hrefFor = (n) => {
      if (n.loanId) return `loans.html#loan-${n.loanId}`;
      if ((n.type || '').startsWith('loan_')) return 'loans.html';
      if (n.type === 'new_review') return 'profile.html#panel-reviews';
      if (n.type === 'post_reaction') return 'profile.html#panel-posts';
      if (n.type === 'new_follower' && n.actor) {
        return `library.html?id=${encodeURIComponent(n.actor.id)}`;
      }
      if (n.book) return `book-detail.html?id=${n.book.id}`;
      return '#';
    };

    // Notifiche dal server; null finche' non arrivano o se non raggiungibile
    let allItems = null;
    let loadError = false;

    const paint = (unread) => {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.hidden = !unread;
      bell.classList.toggle('has-unread', unread > 0);

      if (loadError) {
        list.innerHTML = `<p class="notif__empty">Server non raggiungibile: notifiche non disponibili.</p>`;
        return;
      }
      if (!allItems) {
        list.innerHTML = `<p class="notif__empty">Caricamento…</p>`;
        return;
      }
      const items = allItems.filter(matchesFilter);
      if (!items.length) {
        list.innerHTML =
          activeFilter === 'all'
            ? `<p class="notif__empty">Nessuna notifica. Segui una libreria o metti «mi piace» a un volume per ricevere aggiornamenti.</p>`
            : `<p class="notif__empty">Nessuna notifica in questa categoria.</p>`;
        return;
      }
      list.innerHTML = items
        .map(
          (n) => `<a class="notif__item ${n.isRead ? '' : 'is-unread'}" href="${hrefFor(n)}">
          <span class="notif__item-icon" aria-hidden="true">${icon(n.type)}</span>
          <span class="notif__item-body">
            <span class="notif__item-msg">${UI._escapeHtml(n.message)}</span>
            <span class="notif__item-time">${timeAgo(n.createdAt)}</span>
          </span>
        </a>`
        )
        .join('');
    };

    let lastUnread = 0;
    const render = async () => {
      if (!window.LB_UI.currentUser()) return;
      try {
        const res = await window.LB_API.notifications.list({ limit: 50 });
        allItems = res.data || [];
        lastUnread = res.unreadCount ?? allItems.filter((n) => !n.isRead).length;
        loadError = false;
      } catch (_err) {
        loadError = true;
      }
      paint(lastUnread);
    };

    // Segna tutte come lette sul server, poi aggiorna badge ed elenco
    const markAllRead = async () => {
      if (!lastUnread) return;
      try {
        await window.LB_API.notifications.markAllRead();
      } catch (_err) {
        return;
      }
      render();
    };

    // Chiudendo il pannello (campanella, clic fuori, Esc) le notifiche
    // viste diventano lette
    const closePanel = () => {
      if (panel.hidden) return;
      panel.hidden = true;
      bell.setAttribute('aria-expanded', 'false');
      markAllRead();
    };
    const openPanel = () => {
      render();
      panel.hidden = false;
      bell.setAttribute('aria-expanded', 'true');
    };

    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.hidden) openPanel();
      else closePanel();
    });
    readAll.addEventListener('click', markAllRead);

    // v1.7: wiring chip-filtro
    wrap.querySelectorAll('.notif__filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.notif__filter').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeFilter = btn.dataset.filter;
        paint(lastUnread);
      });
    });
    // Chiusura cliccando fuori
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !wrap.contains(e.target)) closePanel();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePanel();
    });

    render();
    // Ricalcola il badge quando cambia lo stato di autenticazione
    document.addEventListener('auth:change', render);
    // Espone un refresh globale per altri script (es. dopo un follow/like)
    UI._refreshNotifications = render;

    // Beta 8: aggiornamento realtime via SSE.
    // Quando arriva un evento 'notification', ricalcola il badge e mostra
    // un toast se la campanella non e' aperta (evita rumore visivo se
    // l'utente sta gia' consultando le notifiche).
    if (window.LB_EVENTS) {
      window.LB_EVENTS.on('notification', (payload) => {
        // Refresh badge (fetch nuovo count backend)
        render();
        // Toast solo se la lista notifiche e' chiusa
        if (panel.hidden && payload.data?.message) {
          const shortMsg =
            payload.data.message.length > 90
              ? payload.data.message.slice(0, 87) + '...'
              : payload.data.message;
          UI.toast(shortMsg, 'info');
        }
      });
      // Riconnessione: log per debug, no UI (non vogliamo rumore)
      window.LB_EVENTS.on('open', () => console.debug('[ui] SSE connected'));
      window.LB_EVENTS.on('close', () => console.debug('[ui] SSE disconnected'));
    }
  },
};
