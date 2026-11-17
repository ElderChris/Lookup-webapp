// =============================================================================
// apps/web/js/eventStream.js — Client SSE per notifiche realtime (Beta 8)
// =============================================================================
// Wrapper thin sopra `EventSource` per gestire:
//   - Auto-reconnect nativo (EventSource retry default 3s)
//   - Handler map per tipo evento (notification, hello, ecc.)
//   - Cleanup su navigate/logout
//   - Feedback UI di connessione (con soglia debounce per non lampeggiare)
//
// PATTERN uso (da chi vuole ricevere eventi):
//
//   import { eventStream } from './eventStream.js';
//   eventStream.on('notification', (payload) => {
//     console.log('nuova notifica:', payload.data.message);
//   });
//   eventStream.on('open', () => console.log('connesso'));
//   eventStream.on('close', () => console.log('disconnesso'));
//
// PATTERN start/stop:
//   eventStream.start()   ← al login
//   eventStream.stop()    ← al logout o page unload
//
// EXPORT globale: `window.LB_EVENTS` per uso da inline scripts.
// =============================================================================

const RECONNECT_DELAY_MS = 3000;
const CONNECTED_UI_DEBOUNCE_MS = 500;

class EventStream {
  constructor() {
    /** @type {EventSource | null} */
    this.es = null;
    /** @type {Map<string, Set<(payload: object) => void>>} */
    this.listeners = new Map();
    this.connected = false;
    this._uiDebounceTimer = null;
    this._stopped = true;
  }

  /**
   * Registra un handler per un tipo di evento.
   * Tipi standard emessi dal backend:
   *   - 'notification' — nuova notifica (loan requested, reaction, ecc.)
   *   - 'hello' — messaggio di benvenuto alla connessione
   *   - 'open' — connessione stabilita (evento client-side)
   *   - 'close' — connessione persa (evento client-side)
   *
   * @param {string} eventType
   * @param {(payload: object) => void} handler
   * @returns {() => void} funzione di rimozione handler
   */
  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);
    return () => this.listeners.get(eventType)?.delete(handler);
  }

  _emit(eventType, payload) {
    const set = this.listeners.get(eventType);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[eventStream] handler error on ${eventType}:`, err);
      }
    }
  }

  /**
   * Avvia la connessione SSE. Idempotente: chiama piu' volte non ricrea
   * connessioni multiple.
   */
  start() {
    if (this.es) return;
    this._stopped = false;
    this._connect();
  }

  _connect() {
    if (this._stopped) return;
    try {
      // Path relativo: nginx rev-proxy inoltra /api/* al backend.
      // Il cookie session viene inviato automaticamente da EventSource.
      this.es = new EventSource('/api/me/events', { withCredentials: true });
    } catch (err) {
      console.error('[eventStream] failed to create EventSource:', err);
      return;
    }

    this.es.addEventListener('open', () => {
      this.connected = true;
      // Debounce del "open" event: evita di lampeggiare toast se la
      // connessione si stabilisce/perde molte volte in poco tempo
      clearTimeout(this._uiDebounceTimer);
      this._uiDebounceTimer = setTimeout(() => {
        if (this.connected) this._emit('open', {});
      }, CONNECTED_UI_DEBOUNCE_MS);
      console.debug('[eventStream] connected');
    });

    // Handler per evento 'notification' (nuova notifica personale)
    this.es.addEventListener('notification', (e) => {
      try {
        const payload = JSON.parse(e.data);
        this._emit('notification', payload);
      } catch (err) {
        console.error('[eventStream] invalid notification payload:', err);
      }
    });

    // Handler per evento 'hello' (benvenuto alla connessione)
    this.es.addEventListener('hello', (e) => {
      try {
        const payload = JSON.parse(e.data);
        this._emit('hello', payload);
        console.debug('[eventStream] hello:', payload);
      } catch (err) {
        /* ignora */
      }
    });

    // onerror scatta anche su reconnect automatico — non spammiamo console
    this.es.addEventListener('error', () => {
      // EventSource ha 3 stati: CONNECTING (0), OPEN (1), CLOSED (2)
      if (this.es?.readyState === EventSource.CLOSED) {
        // Connessione definitivamente chiusa (auth fail o backend down troppo a lungo)
        this._handleClose();
      }
      // Se readyState === CONNECTING, il browser sta gia' riconnettendo autonomamente
    });
  }

  _handleClose() {
    if (this.connected) {
      this.connected = false;
      this._emit('close', {});
    }
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    // Se non e' stato richiesto uno stop esplicito, riconnetti dopo delay
    if (!this._stopped) {
      setTimeout(() => this._connect(), RECONNECT_DELAY_MS);
    }
  }

  /**
   * Chiude la connessione (logout, page unload).
   */
  stop() {
    this._stopped = true;
    clearTimeout(this._uiDebounceTimer);
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.connected = false;
  }
}

export const eventStream = new EventStream();

// Espone globalmente per uso da inline scripts HTML
window.LB_EVENTS = eventStream;

// Cleanup su page unload (rilascia connessione backend)
window.addEventListener('beforeunload', () => eventStream.stop());
