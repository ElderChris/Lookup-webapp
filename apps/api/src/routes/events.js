// =============================================================================
// src/routes/events.js — Server-Sent Events per notifiche realtime (Beta 8)
// =============================================================================
// Endpoint di streaming: il client apre una GET persistente, il server tiene
// aperta la connessione e invia messaggi appena disponibili sul canale
// Redis pub/sub `events:user:<userId>`.
//
// PROTOCOLLO SSE (spec HTML5):
//   Response headers:
//     Content-Type: text/event-stream
//     Cache-Control: no-cache
//     Connection: keep-alive
//     X-Accel-Buffering: no   (disabilita buffering nginx per streaming)
//
//   Formato messaggi:
//     event: notification         (nome evento, opzionale)
//     data: {"foo": "bar"}        (payload JSON, obbligatorio)
//     \n                          (doppia newline chiude il messaggio)
//
//   Heartbeat: linea commento `:heartbeat\n\n` ogni 25s per prevenire
//   timeout di proxy/browser (default ~60s).
//
// PERCHE' SSE E NON WEBSOCKET:
//   - HTTP puro: passa attraverso proxy/firewall corporate senza problemi
//   - Auto-reconnect nativo del browser (EventSource) con Last-Event-ID
//   - Unidirezionale server → client: e' esattamente quello che ci serve
//     (il client parla al server via REST come sempre)
//   - Zero deps (WebSocket avrebbe richiesto @fastify/websocket)
//   - HTTP/2 multiplexing riduce l'overhead delle connessioni parallele
//
// LIMITAZIONI:
//   - HTTP/1.1: massimo 6 connessioni concorrenti per dominio nel browser.
//     Non un problema perche' apriamo UNA sola SSE per sessione utente
//   - Se il backend crasha/riavvia, il client riconnette in 3s (default
//     EventSource retry). Nessun evento perso perche' e' anche in DB
// =============================================================================

import { requireUserId } from '../lib/authHelpers.js';
import { subscribeToUser } from '../lib/eventBus.js';
import { sseConnections } from '../lib/metrics.js';

const HEARTBEAT_INTERVAL_MS = 25_000;
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * Serializza un evento in formato SSE.
 * @param {string|null} eventName - `event:` field (opzionale)
 * @param {object|string} data - `data:` field (verra' JSON.stringify se object)
 * @param {string|null} id - `id:` field (per Last-Event-ID, opzionale)
 */
function formatSSE(eventName, data, id = null) {
  const lines = [];
  if (id) lines.push(`id: ${id}`);
  if (eventName) lines.push(`event: ${eventName}`);
  const raw = typeof data === 'string' ? data : JSON.stringify(data);
  // Ogni newline nel payload richiede prefisso "data: " per la spec SSE
  for (const chunk of raw.split('\n')) {
    lines.push(`data: ${chunk}`);
  }
  return lines.join('\n') + '\n\n';
}

export default async function eventsRoutes(fastify) {
  // ===========================================================================
  // GET /api/me/events — SSE stream per notifiche realtime
  // ===========================================================================
  // NOTA: il rate limit globale @fastify/rate-limit e' bypassato per questo
  // endpoint (aggiungerlo alla allowList o mettere config: {rateLimit: false})
  // perche' una connessione SSE persistente conta come 1 "richiesta" ma dura
  // a lungo — non ha senso rate-limitarla per burst.
  fastify.get(
    '/api/me/events',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['Notifications'],
        summary: 'Stream SSE eventi realtime (notifiche + heartbeat)',
        description: `Endpoint di streaming Server-Sent Events. Il client apre una connessione persistente e riceve eventi in tempo reale:

- **event: notification** — nuova notifica personale (nuovo prestito, reaction, ecc.)
- **event: hello** — messaggio di benvenuto alla connessione
- **:heartbeat** — commento ogni 25s per keep-alive

Uso client: \`const es = new EventSource('/api/me/events')\``,
      },
    },
    async (request, reply) => {
      const userId = await requireUserId(request);

      // Setup SSE headers e flush per iniziare lo stream
      reply.raw.writeHead(200, SSE_HEADERS);
      // Alcuni proxy richiedono un primo write per confermare l'upgrade
      reply.raw.write(':ok\n\n');

      // Evento di benvenuto: conferma al client che siamo connessi + include
      // il userId (utile per debug in DevTools)
      reply.raw.write(formatSSE('hello', { userId, connectedAt: new Date().toISOString() }));

      // Beta 10: metrics — increment gauge connessioni attive
      sseConnections.inc();

      // Subscribe al canale personale — chiama unsubscribe quando la
      // connessione si chiude per liberare risorse Redis
      const unsubscribe = await subscribeToUser(userId, (payload) => {
        try {
          const eventName = payload.type || 'message';
          reply.raw.write(formatSSE(eventName, payload));
        } catch (err) {
          request.log.warn({ err: err.message }, '[events] write failed');
        }
      });

      // Heartbeat: previene timeout proxy/browser (~60s default) inviando
      // una linea commento SSE (ignorata dal client, ma tiene la connessione viva)
      const heartbeatTimer = setInterval(() => {
        try {
          reply.raw.write(':heartbeat\n\n');
        } catch {
          // Se il write fallisce, la connessione e' morta — cleanup verra'
          // fatto dal listener 'close' sotto
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Cleanup al disconnect del client (chiusura tab, network down, ecc.)
      const cleanup = async () => {
        clearInterval(heartbeatTimer);
        await unsubscribe();
        // Beta 10: metrics — decrement gauge connessioni attive
        sseConnections.dec();
        request.log.debug({ userId }, '[events] client disconnected');
      };
      request.raw.on('close', cleanup);
      request.raw.on('error', cleanup);

      request.log.debug({ userId }, '[events] client connected');

      // Ritorna una promise che non si risolve mai — Fastify manterra' la
      // connessione aperta finche' non c'e' un errore o un close
      return new Promise(() => {
        /* mai risolve, aspettiamo il close */
      });
    }
  );
}
