// =============================================================================
// apps/web/js/pwa.js — Service worker registration + install prompt
// =============================================================================
// Espone `window.LB_PWA` con:
//   - install()  → mostra il prompt di installazione se disponibile
//   - canInstall → boolean, se il prompt e' disponibile ORA
//   - isInstalled → boolean, se l'app e' gia' installata (standalone mode)
//   - onChange(fn) → callback quando lo stato cambia (per aggiornare UI)
//
// COMPORTAMENTO BROWSER:
//   - Chrome/Edge Android + desktop: emette `beforeinstallprompt` quando i
//     criteri PWA sono soddisfatti (manifest + sw + engagement). Noi lo
//     catturiamo e lo triggeriamo dai NOSTRI bottoni invece del banner
//     default (che il browser mostrerebbe altrimenti in modo invasivo).
//   - Safari iOS: NON emette beforeinstallprompt. L'utente deve installare
//     manualmente via "Aggiungi a schermata Home" del menu condivisione.
//     Noi mostriamo comunque un bottone che apre una guida.
//   - Firefox: idem Safari, no prompt automatico.
// =============================================================================

class PwaManager {
  constructor() {
    /** @type {Event | null} evento beforeinstallprompt catturato */
    this._deferredPrompt = null;
    /** @type {Set<() => void>} listener per cambi di stato */
    this._listeners = new Set();
    this._register();
    this._wireInstallEvents();
  }

  /**
   * Registra il service worker + verifica update.
   */
  async _register() {
    if (!('serviceWorker' in navigator)) {
      console.debug('[pwa] service worker non supportato');
      return;
    }
    // Solo in same-origin: in iframe cross-origin salta
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.debug('[pwa] service worker registrato:', registration.scope);

      // Rileva update: quando c'e' una nuova versione, notifica utente
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // C'e' un nuovo SW pronto ma quello vecchio e' ancora attivo
            this._notifyUpdate();
          }
        });
      });

      // Nessun ricaricamento automatico al cambio di service worker: alla
      // prima visita (clients.claim) e a ogni aggiornamento ricaricava la
      // pagina, cancellando quello che l'utente stava scrivendo. Il nuovo
      // service worker serve i file aggiornati dalla navigazione successiva.
    } catch (err) {
      console.error('[pwa] registrazione fallita:', err);
    }
  }

  /**
   * Cattura l'evento beforeinstallprompt per triggerarlo dai nostri bottoni.
   */
  _wireInstallEvents() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Blocca il banner default del browser
      e.preventDefault();
      this._deferredPrompt = e;
      console.debug('[pwa] install prompt disponibile');
      this._emit();
    });

    // Detect installation avvenuta
    window.addEventListener('appinstalled', () => {
      console.debug('[pwa] app installata');
      this._deferredPrompt = null;
      this._emit();
    });
  }

  /**
   * True se l'app e' installata (running standalone).
   */
  get isInstalled() {
    // display-mode: standalone → Android/Chrome/Edge PWA installata
    // navigator.standalone → Safari iOS PWA installata
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  /**
   * True se il prompt di installazione custom e' disponibile ORA.
   * Su iOS/Firefox e' sempre false (nessun prompt programmatico disponibile).
   */
  get canInstall() {
    return this._deferredPrompt !== null;
  }

  /**
   * True se siamo su iOS Safari (per mostrare istruzioni manuali).
   */
  get isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  /**
   * Mostra il prompt di installazione se disponibile.
   * Su iOS ritorna false + suggerisce apertura istruzioni manuali.
   * @returns {Promise<{outcome: 'accepted' | 'dismissed' | 'unavailable'}>}
   */
  async install() {
    if (!this._deferredPrompt) {
      return { outcome: 'unavailable' };
    }
    const promptEvent = this._deferredPrompt;
    this._deferredPrompt = null;
    this._emit();
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    return { outcome };
  }

  /**
   * Callback su cambio di stato (canInstall / isInstalled).
   * @param {() => void} fn
   * @returns {() => void} unsubscribe
   */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    }
  }

  _notifyUpdate() {
    // Toast semplice per informare che c'e' una nuova versione.
    // Non forziamo il reload: l'utente clicca il toast per aggiornare.
    if (window.UI?.toast) {
      window.UI.toast('Nuova versione disponibile. Ricarica la pagina per aggiornare.', 'info');
    } else {
      console.info('[pwa] nuova versione disponibile');
    }
  }
}

export const pwa = new PwaManager();
window.LB_PWA = pwa;

// -----------------------------------------------------------------------------
// Auto-wiring dei bottoni install nelle pagine
// -----------------------------------------------------------------------------
// Cerca elementi con id che iniziano con "install-btn-" e li collega al
// prompt di installazione. Aggiorna testo e stato in base a canInstall/isIOS.
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('[id^="install-btn-"]');
  if (buttons.length === 0) return;

  const update = () => {
    for (const btn of buttons) {
      // Cerca l'help iOS accoppiato (stesso suffisso)
      const suffix = btn.id.replace('install-btn-', '');
      const iosHelp = document.getElementById(`install-ios-help-${suffix}`);

      if (pwa.isInstalled) {
        // App gia' installata: nascondi la sezione
        const section = btn.closest('.install-app-section');
        if (section) section.style.display = 'none';
        continue;
      }

      if (pwa.canInstall) {
        // Chrome/Edge: prompt programmatico disponibile
        btn.disabled = false;
        btn.textContent = btn.dataset.textActive || btn.textContent;
        if (iosHelp) iosHelp.classList.remove('is-visible');
      } else if (pwa.isIOS) {
        // iOS Safari: nessun prompt, mostra istruzioni
        btn.textContent = 'Come installare su iPhone/iPad';
        btn.disabled = false;
        if (iosHelp) iosHelp.classList.add('is-visible');
      } else {
        // Firefox/altri: fallback generico
        btn.textContent = 'Aggiungi ai preferiti / Home';
        btn.disabled = false;
        if (iosHelp) iosHelp.classList.remove('is-visible');
      }
    }
  };

  for (const btn of buttons) {
    // Salva testo originale per ripristinare dopo dismiss
    btn.dataset.textActive = btn.textContent.trim();

    btn.addEventListener('click', async () => {
      if (pwa.isIOS && !pwa.canInstall) {
        // Toggle helper text (le istruzioni sono gia' visibili, l'utente
        // capisce cosa fare — evitiamo azioni programmatiche impossibili su iOS)
        const suffix = btn.id.replace('install-btn-', '');
        const iosHelp = document.getElementById(`install-ios-help-${suffix}`);
        if (iosHelp) iosHelp.classList.toggle('is-visible');
        return;
      }
      const { outcome } = await pwa.install();
      if (outcome === 'accepted') {
        window.UI?.toast?.('Installazione avviata!', 'info');
      } else if (outcome === 'unavailable') {
        window.UI?.toast?.(
          "Il tuo browser non supporta l'installazione automatica. Consulta le istruzioni per aggiungere manualmente.",
          'info'
        );
      }
    });
  }

  pwa.onChange(update);
  update();
});
