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

import { API } from './api.js';
import {
  LIBRARY_COVER_DESIGNS, LIBRARY_COVER_DESIGN_MAP,
  LOAN_STATUS_LABEL, LOAN_STATUS_HINT, LOAN_STATUS_ORDER
} from './data.js';

export const UI = {

  /* =============================================================
     v2.5 — Icone SVG inline minimali.
     Generate da Claude (Anthropic) per Lookup.
     Tutte 24×24 viewBox, stroke 1.8 px, currentColor, line-cap round.
     Pensate per essere coerenti come "tratto" — la stessa mano grafica.
     ============================================================= */
  ICON: {
    explore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z"/><path d="M9 4 V17.5 M15 6.5 V20"/><circle cx="17" cy="14" r="2.4"/><path d="M18.8 15.8 L21 18"/></svg>',
    stats:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 V10"/><path d="M10 20 V4"/><path d="M16 20 V13"/><path d="M22 20 V7"/><path d="M3 20 H23"/></svg>',
    loans:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5 H17 A2 2 0 0 1 19 7 V13 A2 2 0 0 1 17 15 H10 L6 19 V15 H5 A2 2 0 0 1 3 13 Z"/><path d="M7 9 H15"/><path d="M7 12 H12"/></svg>',
    publish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4 H14 L19 9 V20 A1 1 0 0 1 18 21 H5 A1 1 0 0 1 4 20 V5 A1 1 0 0 1 5 4 Z"/><path d="M14 4 V9 H19"/><path d="M11.5 12 V17.5 M8.75 14.75 H14.25"/></svg>',
    admin:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z"/><path d="M9 12 L11 14 L15 10"/></svg>'
  },

  /** Helper: ritorna l'SVG inline per la chiave richiesta. */
  icon(key) { return this.ICON[key] || ''; },

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
    const avgLbl = showAverage && r > 0
      ? `<span class="stars__avg">${r.toFixed(1)}</span>`
      : '';
    const countLbl = (count !== undefined && count !== null)
      ? `<span class="stars__count">${count === 0
          ? 'Nessuna recensione'
          : `${count} ${count === 1 ? 'recensione' : 'recensioni'}`}</span>`
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

  /** Renderizza la lista delle recensioni ricevute da un utente. */
  renderReviewsList(container, targetUserId) {
    const reviews = API.getReviewsForUser(targetUserId);
    if (!reviews.length) {
      container.innerHTML = `<p class="alert alert--info">
        Ancora nessuna recensione per questa libreria. Sii il primo a lasciarne una.
      </p>`;
      return;
    }
    container.innerHTML = reviews.map(r => {
      const reviewer = API.getUser(r.reviewer_id);
      if (!reviewer) return '';
      const prefs = API.getProfilePrefs(reviewer.id) || {};
      const themeClass = `cover--${prefs.theme || 'classic'}`;
      const symbol = prefs.avatar_style === 'symbol' && prefs.avatar_symbol
        ? prefs.avatar_symbol
        : (reviewer.display_name || reviewer.username || '?').trim()[0].toUpperCase();
      const dateLabel = new Date(r.created_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const relative = UI.timeAgo(r.created_at);
      return `
        <article class="review-card">
          <div class="review-card__head">
            <a href="library.html?id=${reviewer.id}" class="review-card__author">
              <span class="review-card__avatar ${themeClass}" aria-hidden="true">${symbol}</span>
              <span class="review-card__author-info">
                <span class="review-card__name">${reviewer.display_name}</span>
                <span class="review-card__user">@${reviewer.username}</span>
              </span>
            </a>
            <div class="review-card__meta">
              ${UI.renderStars(r.rating, { size: 'sm', showAverage: false })}
              <time class="review-card__date" datetime="${r.created_at}">
                <span class="review-card__date-rel">${relative}</span>
                <span class="review-card__date-abs">${dateLabel}</span>
              </time>
            </div>
          </div>
          <p class="review-card__text">${this._escapeHtml(r.text)}</p>
        </article>`;
    }).join('');
  },

  /** v1.6: lista delle recensioni SCRITTE da un utente. Stesso layout
      di renderReviewsList ma mostra il destinatario (a chi è rivolta)
      invece dell'autore, con un pulsante "Modifica" che porta alla
      libreria target nella sezione recensioni. */
  renderReviewsByReviewerList(container, reviewerId) {
    const reviews = API.getReviewsByReviewer(reviewerId);
    if (!reviews.length) {
      container.innerHTML = `<p class="alert alert--info">
        Non hai ancora scritto nessuna recensione. Dopo aver concluso un
        prestito potrai valutare la libreria del prestatore.
      </p>`;
      return;
    }
    container.innerHTML = reviews.map(r => {
      const target = API.getUser(r.target_user_id);
      if (!target) return '';
      const prefs = API.getProfilePrefs(target.id) || {};
      const themeClass = `cover--${prefs.theme || 'classic'}`;
      const symbol = prefs.avatar_style === 'symbol' && prefs.avatar_symbol
        ? prefs.avatar_symbol
        : (target.display_name || target.username || '?').trim()[0].toUpperCase();
      const dateLabel = new Date(r.created_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const relative = UI.timeAgo(r.created_at);
      return `
        <article class="review-card review-card--written">
          <div class="review-card__head">
            <a href="library.html?id=${target.id}#recensioni" class="review-card__author">
              <span class="review-card__avatar ${themeClass}" aria-hidden="true">${symbol}</span>
              <span class="review-card__author-info">
                <span class="review-card__lead">Hai recensito</span>
                <span class="review-card__name">${target.display_name}</span>
                <span class="review-card__user">@${target.username}</span>
              </span>
            </a>
            <div class="review-card__meta">
              ${UI.renderStars(r.rating, { size: 'sm', showAverage: false })}
              <time class="review-card__date" datetime="${r.created_at}">
                <span class="review-card__date-rel">${relative}</span>
                <span class="review-card__date-abs">${dateLabel}</span>
              </time>
            </div>
          </div>
          <p class="review-card__text">${this._escapeHtml(r.text)}</p>
          <div class="review-card__footer">
            <a href="library.html?id=${target.id}#recensioni" class="btn btn--ghost btn--small">
              ✎ Modifica
            </a>
            <button type="button" class="btn btn--ghost btn--small"
                    data-review-delete="${r.id}">
              🗑 Cancella
            </button>
          </div>
        </article>`;
    }).join('');

    // Wiring del bottone cancella
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-review-delete]');
      if (!btn) return;
      if (!confirm('Cancellare definitivamente questa recensione?')) return;
      const r = API.deleteReview(+btn.dataset.reviewDelete);
      if (r.ok) {
        UI.toast('Recensione cancellata.', 'info');
        UI.renderReviewsByReviewerList(container, reviewerId);
      } else {
        UI.toast('Errore: ' + r.reason, 'error');
      }
    });
  },

  /** Form per scrivere una recensione (5 stelle cliccabili + testo).
      Mostra il messaggio appropriato se l'utente non può recensire:
      - guest → invito al login
      - proprietario → non visibile
      - già recensito → pre-popola e permette modifica */
  renderReviewForm(container, targetUserId, onSubmit) {
    const check = API.canReview(targetUserId);
    if (!check.ok && check.reason === 'self') {
      container.innerHTML = `<p class="alert alert--info" style="margin: 0;">
        Questa è la tua libreria — qui leggi le recensioni che gli altri lasciano per te.
      </p>`;
      return;
    }
    if (!check.ok && check.reason === 'not-authenticated') {
      container.innerHTML = `<p class="alert alert--info" style="margin: 0;">
        <a href="login.html">Accedi</a> o <a href="register.html">registrati</a>
        per lasciare una recensione a questa libreria.
      </p>`;
      return;
    }
    if (!check.ok && check.reason === 'no-completed-loan') {
      container.innerHTML = `<p class="alert alert--info" style="margin: 0;">
        Per recensire questa libreria devi prima aver concluso almeno un prestito.
        Le recensioni sono ancorate a un'esperienza reale di scambio: prendi in prestito
        un volume, restituiscilo, e dopo la conferma del prestatore potrai lasciare la
        tua valutazione.
      </p>`;
      return;
    }

    const me = API.getCurrentUser();
    const existing = API.getReviewByPair(targetUserId, me.id);
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
          ${[1,2,3,4,5].map(n => `
            <button type="button" class="review-form__star" data-value="${n}"
                    role="radio" aria-checked="false" aria-label="${n} ${n===1?'stella':'stelle'}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2 L14.5 9 L22 9 L16 13.5 L18.2 21 L12 16.5 L5.8 21 L8 13.5 L2 9 L9.5 9 Z"/>
              </svg>
            </button>`).join('')}
          <span class="review-form__rating-label">Seleziona un voto</span>
        </div>
        <div class="form__group">
          <label class="form__label" for="review-text">La tua recensione</label>
          <textarea id="review-text" class="form__input" rows="4"
                    placeholder="Com'è stata l'esperienza? Cortesia, cura dei volumi, puntualità…"
                    minlength="20" required>${this._escapeHtml(initialText)}</textarea>
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
      btn.addEventListener('click', () => { currentRating = n; paintStars(currentRating); });
      btn.addEventListener('mouseenter', () => paintStars(n, true));
      btn.addEventListener('mouseleave', () => paintStars(currentRating));
      btn.addEventListener('focus', () => paintStars(n, true));
      btn.addEventListener('blur', () => paintStars(currentRating));
    });

    textArea.addEventListener('input', () => {
      charCount.textContent = textArea.value.length;
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      errBox.hidden = true;
      if (currentRating === 0) {
        errBox.hidden = false;
        errBox.textContent = 'Scegli una valutazione da 1 a 5 stelle.';
        return;
      }
      if (textArea.value.trim().length < 20) {
        errBox.hidden = false;
        errBox.textContent = 'Il testo della recensione deve essere lungo almeno 20 caratteri.';
        return;
      }
      const result = API.submitReview(targetUserId, currentRating, textArea.value);
      if (!result.ok) {
        errBox.hidden = false;
        errBox.textContent = 'Errore: ' + result.reason;
        return;
      }
      UI.toast(result.updated ? 'Recensione aggiornata.' : 'Recensione pubblicata. Grazie!', 'success');
      if (typeof onSubmit === 'function') onSubmit(result);
    });

    // pulsante elimina (solo se esiste già la recensione)
    const delBtn = form.querySelector('#review-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (!confirm('Eliminare definitivamente la tua recensione?')) return;
        const r = API.deleteReview(existing.id);
        if (r.ok) {
          UI.toast('Recensione eliminata.', 'info');
          if (typeof onSubmit === 'function') onSubmit({ ok: true, deleted: true });
        }
      });
    }
  },

  /** Escape minimo per inserire testo utente in HTML senza problemi. */
  _escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /** Formato leggibile "X tempo fa" — versione completa (settimane,
      mesi, anni). Usato nelle recensioni e nella timeline prestiti. */
  timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.round(diff / 1000);
    const min = Math.round(diff / 60000);
    const h   = Math.round(diff / 3600000);
    const d   = Math.round(diff / 86400000);
    const w   = Math.round(diff / (7 * 86400000));
    const mo  = Math.round(diff / (30 * 86400000));
    const y   = Math.round(diff / (365 * 86400000));
    if (sec < 60)  return 'pochi secondi fa';
    if (min < 60)  return min === 1 ? 'un minuto fa' : `${min} minuti fa`;
    if (h < 24)    return h === 1 ? "un'ora fa" : `${h} ore fa`;
    if (d < 7)     return d === 1 ? 'un giorno fa' : `${d} giorni fa`;
    if (w < 5)     return w === 1 ? 'una settimana fa' : `${w} settimane fa`;
    if (mo < 12)   return mo === 1 ? 'un mese fa' : `${mo} mesi fa`;
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
    const states = LOAN_STATUS_ORDER;        // ['requested', ..., 'returned']
    const currentIdx = states.indexOf(loan.status);

    // Mappa: stato → timestamp di transizione (se presente)
    const tsMap = {
      requested:  loan.requested_at,
      confirmed:  loan.confirmed_at,
      borrowed:   loan.borrowed_at,
      returning:  loan.returning_at,
      returned:   loan.returned_at
    };

    const nodes = states.map((st, i) => {
      const reached = i <= currentIdx;
      const isCurrent = i === currentIdx;
      const ts = tsMap[st];
      const cls = ['loan-timeline__node'];
      if (reached) cls.push('is-reached');
      if (isCurrent) cls.push('is-current');
      const tsLabel = ts ? `<span class="loan-timeline__date">${UI.timeAgo(ts)}</span>` : '';
      // Linea connettrice (tranne dopo l'ultimo)
      const connector = i < states.length - 1
        ? `<span class="loan-timeline__connector ${i < currentIdx ? 'is-reached' : ''}"></span>`
        : '';
      return `
        <li class="${cls.join(' ')}">
          <span class="loan-timeline__dot" aria-hidden="true">
            ${reached
              ? `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12 L10 17 L19 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
              : `<span class="loan-timeline__index">${i + 1}</span>`}
          </span>
          <span class="loan-timeline__label">${LOAN_STATUS_LABEL[st]}</span>
          ${tsLabel}
          ${connector}
        </li>`;
    }).join('');

    return `
      <div class="loan-timeline${compact ? ' loan-timeline--compact' : ''}">
        <ol class="loan-timeline__list" aria-label="Stato del prestito">
          ${nodes}
        </ol>
        ${compact ? '' : `<p class="loan-timeline__hint">${LOAN_STATUS_HINT[loan.status]}</p>`}
      </div>`;
  },

  /** v1.7: Chat inline associata a un prestito.
      Toggle "💬 Chat (N nuovi)" + pannello espandibile con bolle
      messaggio (user a destra/bordeaux per chi scrive, a sinistra per
      l'altro; system centrate, più piccole). Input + send in fondo.
      All'apertura: auto-mark-read di tutti i messaggi + scroll bottom.
      Re-render su submit per aggiornare il counter unread.
      `onUpdate` viene chiamata dopo ogni invio (utile per ridipingere
      la card contenitore se serve aggiornare contatori esterni). */
  renderLoanChat(container, loan, opts = {}) {
    const me = API.getCurrentUser();
    if (!me) { container.innerHTML = ''; return; }
    const isParticipant = +me.id === +loan.requester_id || +me.id === +loan.lender_id;
    if (!isParticipant) { container.innerHTML = ''; return; }

    const messages = API.getMessagesForLoan(loan.id);
    const unread = API.getUnreadMessageCount(loan.id, me.id);
    const otherId = +me.id === +loan.requester_id ? loan.lender_id : loan.requester_id;
    const other = API.getUser(otherId);
    const otherPrefs = API.getProfilePrefs(otherId) || {};
    const otherTheme = `cover--${otherPrefs.theme || 'classic'}`;
    const otherSymbol = otherPrefs.avatar_style === 'symbol' && otherPrefs.avatar_symbol
      ? otherPrefs.avatar_symbol
      : (other ? other.display_name : '?').trim()[0].toUpperCase();
    const mePrefs = API.getProfilePrefs(me.id) || {};
    const meTheme = `cover--${mePrefs.theme || 'classic'}`;
    const meSymbol = mePrefs.avatar_style === 'symbol' && mePrefs.avatar_symbol
      ? mePrefs.avatar_symbol
      : (me.display_name || '?').trim()[0].toUpperCase();

    // Etichette icone per i messaggi di sistema
    const sysIcon = {
      requested: '📨', confirmed: '✓', borrowed: '↦',
      returning: '↩', returned: '✓✓',
      rejected: '✕', cancelled: '⊘', overdue_reminder: '⏰'
    };

    const startOpen = opts.startOpen || unread > 0;

    container.innerHTML = `
      <div class="loan-chat ${startOpen ? 'is-open' : ''}">
        <button type="button" class="loan-chat__toggle" aria-expanded="${startOpen ? 'true' : 'false'}">
          <span aria-hidden="true">💬</span>
          <span class="loan-chat__toggle-label">Chat con ${other ? other.display_name : 'utente'}</span>
          ${unread > 0
            ? `<span class="loan-chat__unread-badge">${unread} nuov${unread === 1 ? 'o' : 'i'}</span>`
            : ''}
          <span class="loan-chat__caret" aria-hidden="true">▾</span>
        </button>
        <div class="loan-chat__panel" ${startOpen ? '' : 'hidden'}>
          <div class="loan-chat__messages" role="log" aria-live="polite">
            ${messages.map(m => this._renderChatMessage(m, me, other,
              meTheme, meSymbol, otherTheme, otherSymbol, sysIcon)).join('')}
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

    function open() {
      root.classList.add('is-open');
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      API.markLoanMessagesRead(loan.id, me.id);
      const badge = toggle.querySelector('.loan-chat__unread-badge');
      if (badge) badge.remove();
      // Scroll alla fine (mostra gli ultimi messaggi)
      messagesEl.scrollTop = messagesEl.scrollHeight;
      input.focus();
    }
    function close() {
      root.classList.remove('is-open');
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
    if (startOpen) {
      // Già aperto al primo rendering: marca letti, scroll bottom
      API.markLoanMessagesRead(loan.id, me.id);
      const badge = toggle.querySelector('.loan-chat__unread-badge');
      if (badge) badge.remove();
      setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 30);
    }

    toggle.addEventListener('click', () => {
      if (root.classList.contains('is-open')) close(); else open();
    });

    // Enter (senza Shift) invia; Shift+Enter va a capo
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value;
      const r = API.sendMessage(loan.id, text);
      if (!r.ok) {
        if (r.reason === 'empty') { input.focus(); return; }
        UI.toast('Errore: ' + r.reason, 'error');
        return;
      }
      input.value = '';
      // Append del nuovo messaggio senza re-render completo
      messagesEl.insertAdjacentHTML('beforeend',
        UI._renderChatMessage(r.message, me, other,
          meTheme, meSymbol, otherTheme, otherSymbol, sysIcon));
      messagesEl.scrollTop = messagesEl.scrollHeight;
      input.focus();
      if (typeof opts.onUpdate === 'function') opts.onUpdate();
    });
  },

  /** Helper interno: rendering di una singola bolla messaggio. */
  _renderChatMessage(m, me, other, meTheme, meSymbol, otherTheme, otherSymbol, sysIcon) {
    if (m.type === 'system') {
      const icon = sysIcon[m.event_type] || 'ℹ';
      return `
        <div class="chat-msg chat-msg--system">
          <span class="chat-msg__sys-icon" aria-hidden="true">${icon}</span>
          <span class="chat-msg__sys-text">${this._escapeHtml(m.content)}</span>
          <span class="chat-msg__sys-time">${UI.timeAgo(m.created_at)}</span>
        </div>`;
    }
    const isMine = +m.sender_id === +me.id;
    const author = isMine ? me : other;
    const theme = isMine ? meTheme : otherTheme;
    const symbol = isMine ? meSymbol : otherSymbol;
    return `
      <div class="chat-msg chat-msg--user ${isMine ? 'chat-msg--mine' : ''}">
        <span class="chat-msg__avatar ${theme}" aria-hidden="true">${symbol}</span>
        <div class="chat-msg__bubble">
          <div class="chat-msg__text">${this._escapeHtml(m.content)}</div>
          <div class="chat-msg__time">${UI.timeAgo(m.created_at)}</div>
        </div>
      </div>`;
  },

  renderBookCard(book, user, options = {}) {
    const owner = user || API.getUser(book.owner_id);
    const coverStyle = `style="background: ${book.cover_gradient};"`;
    const me = API.getCurrentUser();
    const liked = me && API.isLiked(me.id, book.id);
    const isOwn = me && +book.owner_id === +me.id;
    const likeChip = me && !isOwn
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
          <span>${owner ? owner.city : ''}</span>
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
      hiddenName = null     // se valorizzato, scrive un input nascosto con valori CSV per i form classici
    } = opts;

    const allTags = API.getAllCategoryTags();
    let selected = [...initial];
    let activeIdx = -1;        // riga evidenziata nel dropdown

    container.classList.add('tag-input');
    container.innerHTML = `
      <div class="tag-input__chips" aria-live="polite"></div>
      <input type="text" class="tag-input__field" placeholder="${placeholder}" autocomplete="off" />
      <div class="tag-input__dropdown" role="listbox" hidden></div>
      ${hiddenName ? `<input type="hidden" name="${hiddenName}" class="tag-input__hidden" />` : ''}`;
    const chipsBox = container.querySelector('.tag-input__chips');
    const input    = container.querySelector('.tag-input__field');
    const dropdown = container.querySelector('.tag-input__dropdown');
    const hidden   = container.querySelector('.tag-input__hidden');

    function commit() {
      onChange(selected.slice());
      if (hidden) hidden.value = selected.join(',');
    }
    function paintChips() {
      chipsBox.innerHTML = selected.map((t, i) =>
        `<span class="tag-chip">
           <span class="tag-chip__label">${t}</span>
           <button type="button" class="tag-chip__x" data-i="${i}" aria-label="Rimuovi ${t}">×</button>
         </span>`).join('');
      chipsBox.querySelectorAll('.tag-chip__x').forEach(btn =>
        btn.addEventListener('click', () => {
          selected.splice(+btn.dataset.i, 1);
          paintChips(); commit(); input.focus();
        }));
    }
    function addTag(tag) {
      if (!tag || selected.includes(tag) || selected.length >= maxTags) return false;
      if (!allTags.includes(tag)) return false;
      selected.push(tag);
      paintChips(); commit();
      input.value = '';
      closeDropdown();
      return true;
    }
    function openDropdown(items) {
      if (!items.length) { closeDropdown(); return; }
      dropdown.innerHTML = items.map((t, i) => {
        const parent = API.getCategoryParent(t);
        // evidenzia la parte di testo che combacia con la query
        const q = input.value.trim();
        const re = q ? new RegExp('(' + q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'i') : null;
        const labelHtml = re ? t.replace(re, '<mark>$1</mark>') : t;
        return `<div class="tag-opt ${i === activeIdx ? 'is-active' : ''}" role="option" data-tag="${t}">
                  <span>${labelHtml}</span>
                  ${parent ? `<span class="tag-opt__parent">${parent}</span>` : ''}
                </div>`;
      }).join('');
      dropdown.hidden = false;
      dropdown.querySelectorAll('.tag-opt').forEach(el =>
        el.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(el.dataset.tag); }));
    }
    function closeDropdown() { dropdown.hidden = true; activeIdx = -1; }
    function recompute() {
      const q = input.value.trim().toLowerCase();
      const items = allTags.filter(t => !selected.includes(t) && (!q || t.toLowerCase().includes(q))).slice(0, 12);
      openDropdown(items);
    }

    input.addEventListener('focus',  recompute);
    input.addEventListener('input',  () => { activeIdx = -1; recompute(); });
    input.addEventListener('keydown', (e) => {
      const opts = [...dropdown.querySelectorAll('.tag-opt')];
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(opts.length - 1, activeIdx + 1); recompute(); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); recompute(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (opts[activeIdx]) addTag(opts[activeIdx].dataset.tag);
        else if (opts.length === 1) addTag(opts[0].dataset.tag);
      }
      else if (e.key === 'Backspace' && !input.value && selected.length) {
        selected.pop(); paintChips(); commit();
      }
      else if (e.key === 'Escape') closeDropdown();
    });
    document.addEventListener('click', (e) => { if (!container.contains(e.target)) closeDropdown(); });

    paintChips();
    if (hidden) hidden.value = selected.join(',');

    // API esposta sul container per chiamanti esterni
    container.getTags = () => selected.slice();
    container.setTags = (arr) => { selected = arr.slice(); paintChips(); commit(); };
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
        canvas.width = size; canvas.height = size;
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
      di 320px e salvata come data URL JPEG nello user.avatar_data_url.
      `onChange` viene invocato dopo il salvataggio (es. per ricaricare). */
  wireAvatarMenu(avatarEl, onChange) {
    if (!avatarEl || avatarEl.dataset.wired === '1') return;
    avatarEl.dataset.wired = '1';
    const me = API.getCurrentUser();
    if (!me) return;
    const hasPhoto = !!me.avatar_data_url;

    // Crea il menu (rimosso quando si chiude)
    function buildMenu() {
      const menu = document.createElement('div');
      menu.className = 'avatar-menu';
      menu.setAttribute('role', 'menu');
      menu.innerHTML = `
        <button type="button" class="avatar-menu__item" data-action="upload" role="menuitem">
          <span aria-hidden="true">📷</span> ${hasPhoto ? 'Cambia foto…' : 'Carica foto…'}
        </button>
        ${hasPhoto ? `
        <button type="button" class="avatar-menu__item avatar-menu__item--danger"
                data-action="remove" role="menuitem">
          <span aria-hidden="true">✕</span> Rimuovi foto
        </button>` : ''}`;
      // Posiziona il menu sotto l'avatar
      const rect = avatarEl.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = (rect.bottom + 8) + 'px';
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
      if (existing) { closeMenu(); return; }
      const menu = buildMenu();
      menu.addEventListener('click', (ev) => {
        const action = ev.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        closeMenu();
        if (action === 'remove') {
          if (!confirm('Vuoi davvero rimuovere la foto profilo?')) return;
          const r = API.clearUserAvatar();
          if (r.ok) {
            UI.toast('Foto profilo rimossa.', 'info');
            if (onChange) onChange();
          }
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
                const r = API.setUserAvatar(cropped);
                if (r.ok) {
                  UI.toast('Foto profilo aggiornata.', 'success');
                  if (onChange) onChange();
                } else {
                  UI.toast('Errore: ' + r.reason, 'error');
                }
              } catch (err) {
                UI.toast('Impossibile elaborare l\'immagine.', 'error');
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  },

  /** v2.2: Inietta un link "Admin" nella nav header solo per utenti
      con is_admin=true. Inserito dopo "Profilo" se presente.
      v2.5: icona SVG inline coerente con le altre nav icons. */
  initAdminLink() {
    const me = API.getCurrentUser();
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

  renderPostComposer(container, options = {}) {
    const me = API.getCurrentUser();
    if (!me) { container.innerHTML = ''; return; }
    if (!API.canPublishPosts(me.id)) {
      container.innerHTML = `
        <div class="post-composer post-composer--locked">
          <p>📝 <strong>Pubblica almeno un volume</strong> per poter scrivere aggiornamenti
          sulla tua libreria. <a href="add-book.html">Aggiungi il primo volume</a>.</p>
        </div>`;
      return;
    }
    container.innerHTML = `
      <form class="post-composer" id="post-composer-form">
        <div class="post-composer__avatar" aria-hidden="true">
          ${me.avatar_data_url
            ? `<img class="post-composer__avatar-img" src="${me.avatar_data_url}" alt="">`
            : (me.display_name || '?').split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <div class="post-composer__body">
          <textarea name="content" class="post-composer__textarea" rows="3"
                    maxlength="${API.POST_MAX_LENGTH}"
                    placeholder="Condividi un aggiornamento sulla tua libreria…" required></textarea>
          <div class="post-composer__bar">
            <span class="post-composer__count" id="post-count">0 / ${API.POST_MAX_LENGTH}</span>
            <button type="submit" class="btn btn--primary btn--small">Pubblica</button>
          </div>
        </div>
      </form>`;
    const form = container.querySelector('#post-composer-form');
    const ta = form.querySelector('textarea');
    const counter = container.querySelector('#post-count');
    ta.addEventListener('input', () => {
      counter.textContent = `${ta.value.length} / ${API.POST_MAX_LENGTH}`;
      counter.classList.toggle('is-near-limit', ta.value.length > API.POST_MAX_LENGTH * 0.85);
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const r = API.createPost(ta.value);
      if (r.ok) {
        UI.toast('Post pubblicato.', 'success');
        ta.value = '';
        counter.textContent = `0 / ${API.POST_MAX_LENGTH}`;
        if (options.onPublished) options.onPublished();
      } else {
        const msgs = {
          'no-books': 'Per pubblicare un post devi prima aggiungere almeno un volume.',
          'empty': 'Il post non può essere vuoto.',
          'too-long': `Massimo ${API.POST_MAX_LENGTH} caratteri.`
        };
        UI.toast(msgs[r.reason] || 'Errore: ' + r.reason, 'error');
      }
    });
  },

  renderPostsFeed(container, posts, options = {}) {
    const me = API.getCurrentUser();
    if (posts.length === 0) {
      container.innerHTML = `<p class="posts-empty">${options.emptyMessage || 'Nessun post ancora.'}</p>`;
      return;
    }
    container.innerHTML = posts.map(p => UI._renderPostCard(p, me, options)).join('');
    UI._wirePostsFeed(container, options);
  },

  _renderPostCard(post, me, options) {
    const author = API.getUser(post.author_id) || { display_name: 'Sconosciuto', username: '?' };
    const myReaction = me ? API.getUserReaction(post.id, me.id) : null;
    const totalReactions = Object.values(post.reactions || {})
      .reduce((s, arr) => s + (arr || []).length, 0);
    const hasReported = me && (post.reports || []).some(r => +r.reporter_id === +me.id);
    const showAuthor = options.showAuthor !== false;
    const canDelete = me && (+post.author_id === +me.id || me.is_admin);
    // v2.5: avatar dell'autore — foto se presente, altrimenti iniziali
    const authorAvatarInner = author.avatar_data_url
      ? `<img class="post-card__avatar-img" src="${author.avatar_data_url}" alt="">`
      : (author.display_name || '?').split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase();

    const reactionsHtml = API.REACTION_EMOJI.map(em => {
      const count = (post.reactions?.[em] || []).length;
      const isMine = myReaction === em;
      return `<button type="button" class="post-reaction ${isMine ? 'is-mine' : ''} ${count > 0 ? 'has-count' : ''}"
                      data-post-react="${post.id}" data-emoji="${em}"
                      aria-pressed="${isMine}" title="Reagisci con ${em}">
        <span class="post-reaction__emoji" aria-hidden="true">${em}</span>
        ${count > 0 ? `<span class="post-reaction__count">${count}</span>` : ''}
      </button>`;
    }).join('');

    return `
      <article class="post-card" data-post-id="${post.id}">
        ${showAuthor ? `
        <header class="post-card__head">
          <a href="library.html?id=${author.id}" class="post-card__avatar" aria-hidden="true">
            ${authorAvatarInner}
          </a>
          <div class="post-card__author">
            <a href="library.html?id=${author.id}" class="post-card__name">${author.display_name}</a>
            <span class="post-card__time">${UI.timeAgo(post.created_at)}</span>
          </div>
          ${canDelete ? `
            <button type="button" class="post-card__delete" data-post-delete="${post.id}"
                    title="Elimina post" aria-label="Elimina post">🗑</button>
          ` : ''}
        </header>
        ` : `
        <header class="post-card__head post-card__head--anon">
          <span class="post-card__time">${UI.timeAgo(post.created_at)}</span>
          ${canDelete ? `
            <button type="button" class="post-card__delete" data-post-delete="${post.id}"
                    title="Elimina post" aria-label="Elimina post">🗑</button>
          ` : ''}
        </header>`}
        <p class="post-card__content">${UI._escapePostContent(post.content)}</p>
        <footer class="post-card__foot">
          <div class="post-card__reactions" role="group" aria-label="Reazioni">
            ${reactionsHtml}
          </div>
          ${me && +post.author_id !== +me.id ? `
            <button type="button" class="post-card__report ${hasReported ? 'is-reported' : ''}"
                    data-post-report="${post.id}"
                    title="${hasReported ? 'Già segnalato' : 'Segnala come inappropriato'}"
                    ${hasReported ? 'disabled' : ''}>
              ${hasReported ? '⚐ Segnalato' : '⚐ Segnala'}
            </button>
          ` : ''}
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
    // Reactions
    container.addEventListener('click', e => {
      const reactBtn = e.target.closest('[data-post-react]');
      const reportBtn = e.target.closest('[data-post-report]');
      const deleteBtn = e.target.closest('[data-post-delete]');

      if (reactBtn) {
        const me = API.getCurrentUser();
        if (!me) { UI.toast('Accedi per reagire ai post.', 'info'); return; }
        const r = API.togglePostReaction(reactBtn.dataset.postReact, reactBtn.dataset.emoji);
        if (r.ok && options.onChange) options.onChange();
      }
      if (reportBtn) {
        const me = API.getCurrentUser();
        if (!me) { UI.toast('Accedi per segnalare un post.', 'info'); return; }
        UI._openReportModal(reportBtn.dataset.postReport, options.onChange);
      }
      if (deleteBtn) {
        if (!confirm('Eliminare definitivamente questo post?')) return;
        const r = API.deletePost(deleteBtn.dataset.postDelete);
        if (r.ok) {
          UI.toast('Post eliminato.', 'info');
          if (options.onChange) options.onChange();
        } else UI.toast('Errore: ' + r.reason, 'error');
      }
    });
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
      <div class="admin-modal__card" role="dialog" aria-modal="true">
        <h3 class="admin-modal__title">Segnala questo post</h3>
        <form id="report-post-form" class="form">
          <div class="form__group">
            <label class="form__label" for="report-reason">Motivo</label>
            <select id="report-reason" name="reason" class="form__input" required>
              <option value="offensivo">Contenuto offensivo</option>
              <option value="spam">Spam o pubblicità</option>
              <option value="off-topic">Off-topic / non pertinente</option>
              <option value="violenza">Incitamento alla violenza o odio</option>
              <option value="altro">Altro</option>
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
    modal.querySelectorAll('[data-modal-close]').forEach(el =>
      el.addEventListener('click', () => modal.remove()));
    modal.querySelector('#report-post-form').addEventListener('submit', e => {
      e.preventDefault();
      const reason = modal.querySelector('#report-reason').value;
      const note = modal.querySelector('#report-note').value;
      const r = API.reportPost(postId, reason, note);
      if (r.ok) {
        UI.toast('Segnalazione inviata. Un moderatore la esaminerà.', 'success');
        modal.remove();
        if (onDone) onDone();
      } else if (r.reason === 'already-reported') {
        UI.toast('Hai già segnalato questo post.', 'info');
        modal.remove();
      } else UI.toast('Errore: ' + r.reason, 'error');
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
      const me = API.getCurrentUser();
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
    container.innerHTML = books.map(b => this.renderBookCard(b, null, options)).join('');
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
    container.innerHTML = books.map((b, i) => {
      const owner = API.getUser(b.owner_id);
      const isOrg = owner && API.isOrganization(owner);
      const ownerLabel = owner ? owner.display_name : 'Sconosciuto';
      const place = owner ? (owner.city || '—') : '—';
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
    }).join('');
  },

  /** Gestione navigazione mobile */
  initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen);
      });
    }
  },

  /** Evidenzia voce di menu attiva */
  highlightActiveNav() {
    const current = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.site-nav a').forEach(link => {
      if (link.getAttribute('href') === current) link.classList.add('active');
    });
  },

  /** Notifiche toast */
  toast(message, type = 'info') {
    const t = document.createElement('div');
    t.className = `alert alert--${type}`;
    t.setAttribute('role', 'status');
    t.textContent = message;
    t.style.cssText = 'position:fixed;top:5rem;right:1.5rem;z-index:1000;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.15);';
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '0', 3000);
    setTimeout(() => t.remove(), 3500);
  },

  /* -------------------------------------------------------------
     Card "Libreria utente" — mini-profilo con bio e conteggio libri.
     Distingue visivamente le librerie-ente dalle librerie-persona.
     ------------------------------------------------------------- */
  renderLibraryCard(user) {
    const initial = (user.display_name || user.username || '?')
      .trim()[0].toUpperCase();
    const bookLabel = user.book_count === 1 ? 'volume' : 'volumi';
    const isOrg = API.isOrganization(user);
    const typeBadge = isOrg
      ? `<span class="library-card__type library-card__type--org">${API.orgCategoryLabel((API.getOrgProfile(user.id) || {}).org_category)}</span>`
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
    const { themeClass, design, letter } = API.libraryCoverData(lib, lib.prefs);
    const isOrg = API.isOrganization(lib);

    /* Distanza in linguaggio naturale */
    const dist = lib.distance_km;
    const distLabel = dist < 1
      ? `a ${Math.round(dist * 1000)} m da te`
      : `a ${dist.toFixed(1).replace('.', ',')} km da te`;

    /* Descrizione breve: il motto personalizzato se presente,
       altrimenti la biografia, altrimenti un testo neutro. */
    const shortDesc = lib.prefs && lib.prefs.motto
      ? `«${lib.prefs.motto}»`
      : (lib.bio || (isOrg ? 'Libreria di comunità aperta al prestito.' : 'Collezione privata condivisa con la comunità.'));

    /* Tipo: badge in alto a sinistra con icona dedicata. */
    const typeLabel = isOrg
      ? API.orgCategoryLabel((API.getOrgProfile(lib.id) || {}).org_category)
      : 'Libreria personale';
    const typeIcon  = isOrg ? '🏛' : '📖';
    const typeClass = isOrg ? 'nearby-card--org' : 'nearby-card--person';

    /* Avviso visivo "pochi volumi disponibili": quando la libreria ha
       <= 2 libri disponibili, il blocco numero+etichetta pulsa con un
       bordo arancione che attira l'attenzione (caso 0 = grigio). */
    const lowStock = lib.available_count > 0 && lib.available_count <= 2;
    const emptyStock = lib.available_count === 0;
    const availClass = (emptyStock ? ' nearby-card__avail-num--zero' : '')
                     + (lowStock   ? ' nearby-card__avail-num--low'  : '');
    const blockClass = lowStock ? ' nearby-card__avail-block--low' : '';
    const availLbl   = lib.available_count === 1 ? 'libro disponibile' : 'libri disponibili';

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
          ${API.isLibraryFresh(lib) ? `
            <span class="nearby-card__fresh" title="Libreria aperta da poco">
              <span aria-hidden="true">✦</span> Appena aperta
            </span>` : ''}
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
          ${books.map(b => `
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
            </a>`).join('')}
        </div>`;
        break;

      case 'shelf':
        container.innerHTML = `<div class="books-shelf">
          ${books.map(b => `
            <a href="book-detail.html?id=${b.id}" class="books-shelf__book"
               style="background: ${b.cover_gradient || grad};"
               title="${b.title} — ${b.author}">${b.title}</a>`).join('')}
        </div>`;
        break;

      case 'timeline':
        container.innerHTML = `<div class="books-timeline">
          ${[...books].sort((a, b) => a.year - b.year).map(b => `
            <a href="book-detail.html?id=${b.id}" class="books-timeline__item" style="text-decoration:none;display:block;">
              <div class="books-timeline__year">${b.year}</div>
              <div class="books-timeline__title">${b.title}</div>
              <div class="books-timeline__author">${b.author} — ${b.category}</div>
            </a>`).join('')}
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
          ${books.map(b => this.renderBookCard(b)).join('')}
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

    fields.forEach(field => {
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
          if (feedback) { feedback.textContent = ''; feedback.className = 'form__feedback'; }
          return;
        }

        let ok = field.checkValidity();
        let msg = '';

        // Regola personalizzata aggiuntiva (es. minLen descrizione)
        if (ok && customRules[field.name]) {
          const result = customRules[field.name](field.value, field);
          if (result !== true) { ok = false; msg = result; }
        }

        // Messaggi italianizzati per i validity state nativi
        if (!ok && !msg) {
          if (field.validity.valueMissing)        msg = 'Campo obbligatorio.';
          else if (field.validity.typeMismatch)   msg = 'Formato non valido.';
          else if (field.validity.patternMismatch)msg = 'Formato non valido.';
          else if (field.validity.tooShort)       msg = `Minimo ${field.minLength} caratteri.`;
          else if (field.validity.tooLong)        msg = `Massimo ${field.maxLength} caratteri.`;
          else if (field.validity.rangeUnderflow) msg = `Valore minimo: ${field.min}.`;
          else if (field.validity.rangeOverflow)  msg = `Valore massimo: ${field.max}.`;
          else                                    msg = 'Valore non valido.';
        }

        group?.classList.toggle('is-valid', ok);
        group?.classList.toggle('is-invalid', !ok);
        if (feedback) {
          feedback.textContent = ok ? '✓ Campo valido.' : msg;
          feedback.className = 'form__feedback ' +
            (ok ? 'form__feedback--ok' : 'form__feedback--error');
        }
      };

      // Marca come "toccato" al primo blur (per evitare di mostrare
      // errori prima ancora che l'utente abbia interagito col campo)
      field.addEventListener('blur',  () => { field.classList.add('touched'); validate(); });
      field.addEventListener('input', () => {
        if (field.classList.contains('touched')) validate();
      });
    });
  },

  /* -------------------------------------------------------------
     Setta sul <body> il data-attr `authState` con lo stato corrente,
     così i selettori CSS `.auth-only` e `.guest-only` mostrano/nascondono
     i bit di UI appropriati.

     v3.0.0-alpha.0: il bottone "auth-toggle" del prototipo è stato
     rimosso; in Alpha lo stato di autenticazione viene dalla session
     reale (cookie httpOnly del backend, non da localStorage). Qui
     teniamo solo l'aggiornamento del data-attr per supporto CSS. */
  initAuthToggle() {
    const state = API.getAuthState();
    document.body.dataset.authState = state;
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
    const menu   = wrap.querySelector('.nav-avatar__menu');
    const glyph  = wrap.querySelector('.nav-avatar__glyph');
    const nameEl = wrap.querySelector('.nav-avatar__menu-name');
    const userEl = wrap.querySelector('.nav-avatar__menu-user');
    const logoutBtn = wrap.querySelector('#nav-logout-btn');

    function paint() {
      const me = API.getCurrentUser();
      if (!me) return;
      const prefs = API.getProfilePrefs(me.id) || {};
      const themeClass = `cover--${prefs.theme || 'classic'}`;
      // v2.5: se l'utente ha una foto profilo, mostrarla come <img>
      // dentro lo span glyph; altrimenti fallback alle iniziali/simbolo.
      if (me.avatar_data_url) {
        button.className = `nav-avatar nav-avatar--photo ${themeClass}`;
        glyph.innerHTML = `<img class="nav-avatar__img" src="${me.avatar_data_url}" alt="">`;
      } else {
        const symbol = prefs.avatar_style === 'symbol' && prefs.avatar_symbol
          ? prefs.avatar_symbol
          : (me.display_name || me.username || '?').trim()[0].toUpperCase();
        button.className = `nav-avatar ${themeClass}`;
        glyph.textContent = symbol;
      }
      button.title = me.display_name || me.username || '';
      nameEl.textContent = me.display_name || '';
      userEl.textContent = '@' + (me.username || '');
    }

    function openMenu()  { menu.hidden = false; button.setAttribute('aria-expanded', 'true');  }
    function closeMenu() { menu.hidden = true;  button.setAttribute('aria-expanded', 'false'); }

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.hidden) openMenu(); else closeMenu();
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !wrap.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

    /* Logout: pulisce lo stato di autenticazione e torna alla homepage.
       Lasciamo intatti like/follow/notifiche/preferenze (sono attribuiti
       all'utente per ID, riappaiono al login successivo). */
    logoutBtn.addEventListener('click', () => {
      API.setAuthState('guest');
      // feedback breve e poi via
      UI.toast('Sei uscito. A presto su Lookup.', 'info');
      setTimeout(() => { location.href = 'index.html'; }, 600);
    });

    paint();
    document.addEventListener('auth:change', paint);
    UI._refreshAvatar = paint;
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

    const bell   = wrap.querySelector('.notif__bell');
    const badge  = wrap.querySelector('.notif__badge');
    const panel  = wrap.querySelector('.notif__panel');
    const list   = wrap.querySelector('.notif__list');
    const readAll = wrap.querySelector('.notif__readall');

    const timeAgo = (iso) => {
      const diff = Date.now() - new Date(iso).getTime();
      const m = Math.round(diff / 60000), h = Math.round(diff / 3600000), d = Math.round(diff / 86400000);
      if (m < 60) return m <= 1 ? 'ora' : `${m} min fa`;
      if (h < 24) return `${h} h fa`;
      if (d < 30) return `${d} g fa`;
      return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    };
    const icon = (t) => t === 'new_book' ? '📚' : t === 'book_available' ? '✅'
                       : t === 'onboarding' ? '👋'
                       : t === 'loan_request' ? '📨'
                       : t === 'loan_confirmed' ? '✓'
                       : t === 'loan_rejected' ? '✕'
                       : t === 'loan_cancelled' ? '⊘'
                       : t === 'loan_overdue' ? '⏰'
                       : t === 'loan_message' ? '💬'
                       : t === 'loan_returning' || t === 'loan_returned' ? '↦'
                       : t === 'new_post' ? '📝'
                       : 'ℹ️';

    // v1.7: filtro attivo (stato di UI), persiste tra le aperture del panel
    let activeFilter = 'all';
    const matchesFilter = (n) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'loans') return n.type && n.type.startsWith('loan_');
      if (activeFilter === 'reviews') return n.type === 'new_review' || n.type === 'loan_returned';
      if (activeFilter === 'social') return n.type === 'new_book' || n.type === 'book_available' || n.type === 'new_follower' || n.type === 'new_post';
      if (activeFilter === 'system') return n.type === 'onboarding';
      return true;
    };

    const render = () => {
      const me = API.getCurrentUser();
      if (!me) return;
      const allItems = API.getNotifications(me.id);
      // Il counter sulla campanella conta SEMPRE tutto (non filtrato)
      const unread = allItems.filter(n => !n.read).length;
      badge.textContent = unread;
      badge.hidden = unread === 0;
      bell.classList.toggle('has-unread', unread > 0);

      // La lista mostra solo quelle che passano il filtro corrente
      const items = allItems.filter(matchesFilter);

      if (!items.length) {
        list.innerHTML = activeFilter === 'all'
          ? `<p class="notif__empty">Nessuna notifica. Segui una libreria o metti «mi piace» a un volume per ricevere aggiornamenti.</p>`
          : `<p class="notif__empty">Nessuna notifica in questa categoria.</p>`;
        return;
      }
      list.innerHTML = items.map(n => {
        // Le notifiche di onboarding (👋) puntano alle azioni d'avvio
        let href;
        if (n.type === 'onboarding') {
          href = n.onboarding_action === 'personalize'
            ? 'profile-setup.html'
            : 'add-book.html';
        } else if (n.type === 'loan_confirmed' || n.type === 'loan_overdue'
                || n.type === 'loan_rejected' || n.type === 'loan_returned'
                || n.type === 'loan_message') {
          // Lato richiedente / partecipante chat: porta alla pagina dei
          // propri prestiti, evidenziando quello specifico.
          href = n.loan_id ? `loans.html?id=${n.loan_id}` : 'loans.html';
        } else if (n.type === 'loan_request' || n.type === 'loan_cancelled'
                || n.type === 'loan_returning' || n.type === 'loan_picked_up') {
          // Lato prestatore: porta alla tab "Richieste ricevute".
          href = 'profile.html#panel-requests';
        } else if (n.type === 'new_post') {
          href = n.actor_id ? `library.html?id=${n.actor_id}#posts` : 'index.html';
        } else {
          href = n.book_id   ? `book-detail.html?id=${n.book_id}`
               : n.actor_id  ? `library.html?id=${n.actor_id}` : '#';
        }
        return `<a class="notif__item ${n.read ? '' : 'is-unread'}" href="${href}">
          <span class="notif__item-icon" aria-hidden="true">${icon(n.type)}</span>
          <span class="notif__item-body">
            <span class="notif__item-msg">${n.message}</span>
            <span class="notif__item-time">${timeAgo(n.created_at)}</span>
          </span>
        </a>`;
      }).join('');
    };

    const closePanel = () => {
      panel.hidden = true;
      bell.setAttribute('aria-expanded', 'false');
    };
    const openPanel = () => {
      render();
      panel.hidden = false;
      bell.setAttribute('aria-expanded', 'true');
    };

    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.hidden) openPanel(); else closePanel();
    });
    readAll.addEventListener('click', () => {
      const me = API.getCurrentUser();
      if (me) { API.markAllNotificationsRead(me.id); render(); }
    });

    // v1.7: wiring chip-filtro
    wrap.querySelectorAll('.notif__filter').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.notif__filter').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeFilter = btn.dataset.filter;
        render();
      });
    });
    // Chiusura cliccando fuori
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !wrap.contains(e.target)) closePanel();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

    // Marca come lette quando il pannello viene chiuso dopo essere stato aperto
    bell.addEventListener('click', () => {
      if (panel.hidden) {     // appena chiuso
        const me = API.getCurrentUser();
        if (me) { API.markAllNotificationsRead(me.id); setTimeout(render, 50); }
      }
    });

    render();
    // Ricalcola il badge quando cambia lo stato di autenticazione
    document.addEventListener('auth:change', render);
    // Espone un refresh globale per altri script (es. dopo un follow/like)
    UI._refreshNotifications = render;
  }
};

