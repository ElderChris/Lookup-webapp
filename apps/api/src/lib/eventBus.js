// =============================================================================
// src/lib/eventBus.js — Redis pub/sub wrapper per SSE realtime (Beta 8)
// =============================================================================
// Wrapper thin sopra Redis pub/sub per broadcast di eventi realtime agli
// utenti connessi via Server-Sent Events (SSE).
//
// PATTERN CANALE:
//   events:user:<userId>  → canale per-utente (notifiche personali)
//   events:global         → canale broadcast (future: feature announcements)
//
// PATTERN PUBLISHER:
//   Ogni endpoint che genera un evento significativo chiama publishToUser().
//   Il servizio notifications.js (emit) chiama publishToUser automaticamente
//   dopo la persistenza in DB — cosi' la SSE resta consistente col DB.
//
// PATTERN SUBSCRIBER:
//   L'endpoint SSE (routes/events.js) chiama subscribeToUser(userId, handler)
//   quando un client si connette. Il handler viene chiamato per ogni
//   messaggio ricevuto sul canale.
//
// PERCHE' pub/sub Redis (non in-memory EventEmitter):
//   - Multi-istanza: se abbiamo 3 backend Node dietro load balancer, un
//     evento pubblicato dall'istanza A raggiunge un client connesso
//     all'istanza B (che non l'avrebbe mai visto con EventEmitter locale)
//   - Zero deps aggiuntive: Redis gia' presente per BullMQ + rate limit
//   - Fault-tolerant: se il Redis va giu' e riparte, i client SSE si
//     riconnettono automaticamente (grazie a EventSource browser)
//
// LIMITATION nota:
//   Redis pub/sub NON e' persistente. Se un utente non e' connesso quando
//   arriva un evento, l'evento e' perso (dal punto di vista SSE). MA la
//   notifica e' gia' persistita in DB → al prossimo login la vede
//   dall'endpoint /api/me/notifications. La SSE e' "best-effort realtime",
//   non "delivery garantita".
// =============================================================================

import { Redis } from 'ioredis';
import { config } from '../config.js';
import { ssePublishes } from './metrics.js';

// -----------------------------------------------------------------------------
// Connessioni Redis dedicate (publisher + subscriber sono separati)
// -----------------------------------------------------------------------------
// Redis richiede connessioni distinte per pub e sub perche' subscribe mette
// la connessione in modalita' "solo subscribe" (blocca gli altri comandi).
// La connessione publisher e' quella condivisa via config; la subscriber
// e' lazy (creata solo se il progetto ha un endpoint SSE attivo).

/** @type {Redis | null} */
let subscriberConnection = null;

/** @type {Map<string, Set<(payload: object) => void>>} handlers per canale */
const handlers = new Map();

/**
 * Ottieni (o crea lazy) la connessione Redis per subscribe.
 * Riusa la stessa istanza tra tutti i subscriber (multiplexing).
 */
function getSubscriber() {
  if (!subscriberConnection) {
    subscriberConnection = new Redis(config.redis.url, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
    });
    // Dispatch centralizzato: quando arriva un messaggio, chiama tutti gli
    // handler registrati per quel canale.
    subscriberConnection.on('message', (channel, raw) => {
      const set = handlers.get(channel);
      if (!set) return;
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (err) {
        console.error(`[eventBus] messaggio non-JSON su ${channel}:`, err.message);
        return;
      }
      for (const handler of set) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[eventBus] handler error su ${channel}:`, err.message);
        }
      }
    });
  }
  return subscriberConnection;
}

/**
 * Publisher: usiamo l'istanza redis condivisa (import da lib/redis.js).
 * PUBLISH non blocca la connessione (a differenza di SUBSCRIBE), quindi
 * possiamo riusare la stessa che serve tutto il resto dell'app.
 */
import { redis as publisherConnection } from './redis.js';

// -----------------------------------------------------------------------------
// API pubblica
// -----------------------------------------------------------------------------

/**
 * Pubblica un evento sul canale di un utente.
 * Non-blocking: se Redis giu', log warn ma non throw.
 *
 * @param {string} userId
 * @param {object} event - { type, data, ts? }
 * @returns {Promise<number>} numero di client connessi (0 se nessuno)
 */
export async function publishToUser(userId, event) {
  const channel = `events:user:${userId}`;
  const payload = { ...event, ts: event.ts || new Date().toISOString() };
  try {
    const receivers = await publisherConnection.publish(channel, JSON.stringify(payload));
    // Beta 10: metrics — traccia publishes per tipo evento
    ssePublishes.labels(event.type || 'unknown').inc();
    return receivers;
  } catch (err) {
    console.warn(`[eventBus] publish failed on ${channel}:`, err.message);
    return 0;
  }
}

/**
 * Subscribe a eventi per un utente specifico.
 * Il handler viene chiamato ogni volta che publishToUser(userId, ...) viene
 * invocato (anche da altre istanze backend).
 *
 * Ritorna una funzione `unsubscribe()` da chiamare quando il client SSE si
 * disconnette, per liberare risorse.
 *
 * @param {string} userId
 * @param {(payload: object) => void} handler
 * @returns {Promise<() => Promise<void>>} funzione di cleanup
 */
export async function subscribeToUser(userId, handler) {
  const channel = `events:user:${userId}`;
  const sub = getSubscriber();

  if (!handlers.has(channel)) {
    handlers.set(channel, new Set());
    // Prima subscribe fisica al canale Redis (per questo channel)
    await sub.subscribe(channel);
  }
  handlers.get(channel).add(handler);

  return async function unsubscribe() {
    const set = handlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      handlers.delete(channel);
      try {
        await sub.unsubscribe(channel);
      } catch (err) {
        // Redis potrebbe essere gia' disconnesso in shutdown, ignora
      }
    }
  };
}

/**
 * Cleanup risorse in shutdown (chiude la connessione subscriber).
 */
export async function closeEventBus() {
  handlers.clear();
  if (subscriberConnection) {
    subscriberConnection.disconnect();
    subscriberConnection = null;
  }
}
