// =============================================================================
// src/routes/register.js — Iscrizione in un'unica richiesta
// =============================================================================
// POST /api/register crea in una volta account, profilo, preferenze, dati
// dell'ente e primi volumi. L'account nasce in stato 'pending' e senza
// sessione: si entra dopo aver aperto il link di conferma inviato per email
// (vedi lib/auth.js, afterEmailVerification), che attiva l'account e
// pubblica i volumi inseriti qui.
//
// Se l'email e' gia' registrata la risposta e' identica a quella di una
// nuova iscrizione e al titolare dell'indirizzo arriva un avviso: dalla
// risposta non si puo' capire chi e' iscritto.
//
// GET /api/users/check-username indica se un nome utente e' libero (i nomi
// utente sono pubblici, quindi non c'e' nulla da nascondere).
// =============================================================================

import { auth } from '../lib/auth.js';
import { trustedPageUrl } from '../lib/authLinks.js';

const ORG_CATEGORIES = [
  'biblioteca_pubblica',
  'biblioteca_comunita',
  'libreria_indipendente',
  'associazione_culturale',
  'centro_studi',
  'scuola',
  'altro',
];

const USERNAME_PATTERN = '^[a-z0-9._]{3,30}$';

/** Volumi inseribili all'iscrizione */
const MAX_BOOKS = 10;

const registerBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password', 'name', 'username', 'accountType', 'acceptTerms', 'confirmAge'],
  properties: {
    email: { type: 'string', format: 'email', maxLength: 255 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    name: { type: 'string', minLength: 1, maxLength: 100 },
    username: { type: 'string', pattern: USERNAME_PATTERN },
    // person | organization; il lettore e' una persona con libraryRole borrower
    accountType: { type: 'string', enum: ['person', 'organization'] },
    libraryRole: { type: 'string', enum: ['curator', 'borrower'], default: 'curator' },
    bio: { type: 'string', maxLength: 500 },
    city: { type: 'string', maxLength: 150 },
    motto: { type: 'string', maxLength: 120 },
    theme: { type: 'string', enum: ['classic', 'bordeaux', 'sage', 'midnight'] },
    organization: {
      type: 'object',
      additionalProperties: false,
      required: ['legalName', 'orgCategory'],
      properties: {
        legalName: { type: 'string', minLength: 1, maxLength: 200 },
        orgCategory: { type: 'string', enum: ORG_CATEGORIES },
        contactPerson: { type: 'string', maxLength: 120 },
        website: { type: 'string', maxLength: 300 },
        publicPhone: { type: 'string', maxLength: 30 },
        publicAddress: { type: 'string', maxLength: 200 },
        openingHours: { type: 'string', maxLength: 2000 },
      },
    },
    books: {
      type: 'array',
      maxItems: MAX_BOOKS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'author', 'categoryId'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 500 },
          author: { type: 'string', minLength: 1, maxLength: 300 },
          year: { type: 'integer', minimum: 1400, maximum: 2100 },
          categoryId: { type: 'integer', minimum: 1 },
        },
      },
    },
    // Consensi obbligatori: termini e privacy, maggiore eta' (o
    // rappresentanza legale dell'ente)
    acceptTerms: { type: 'boolean', const: true },
    confirmAge: { type: 'boolean', const: true },
    // Pagina verify-email.html del sito, con gli eventuali parametri per
    // proseguire dopo la conferma (es. ?next=...)
    callbackURL: { type: 'string', maxLength: 1000 },
  },
};

function fail(reply, status, code, message) {
  return reply.status(status).send({ error: { code, message } });
}

/** Stringa ripulita; null se vuota. */
function clean(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return v || null;
}

export default async function registerRoutes(fastify) {
  // ===========================================================================
  // GET /api/users/check-username
  // ===========================================================================
  fastify.get(
    '/api/users/check-username',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Verifica se un nome utente è libero',
        querystring: {
          type: 'object',
          required: ['username'],
          properties: { username: { type: 'string', minLength: 1, maxLength: 60 } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              valid: { type: 'boolean' },
              available: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request) => {
      const username = request.query.username.trim().toLowerCase();
      const valid = new RegExp(USERNAME_PATTERN).test(username);
      if (!valid) return { username, valid: false, available: false };
      const taken = await fastify.prisma.user.count({ where: { username } });
      return { username, valid: true, available: taken === 0 };
    }
  );

  // ===========================================================================
  // POST /api/register
  // ===========================================================================
  fastify.post(
    '/api/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '5 minutes' } },
      schema: {
        tags: ['Auth'],
        summary: "Iscrizione: account, profilo e primi volumi in un'unica richiesta",
        description:
          "Crea l'account senza aprire una sessione e invia l'email di conferma. " +
          "I volumi restano nascosti finche' l'email non viene confermata. " +
          "Con un'email gia' registrata la risposta e' la stessa.",
        body: registerBodySchema,
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const b = request.body;
      const email = b.email.trim().toLowerCase();
      const username = b.username.trim().toLowerCase();
      const isOrg = b.accountType === 'organization';

      // --- Controlli prima di creare qualsiasi cosa -------------------------
      if (isOrg && !b.organization) {
        return fail(reply, 400, 'ORGANIZATION_REQUIRED', "Mancano i dati dell'ente");
      }
      if (!isOrg && b.organization) {
        return fail(
          reply,
          400,
          'ORGANIZATION_NOT_ALLOWED',
          'I dati di un ente valgono solo per gli enti'
        );
      }
      if (isOrg && b.libraryRole === 'borrower') {
        return fail(reply, 400, 'INVALID_LIBRARY_ROLE', 'Un ente cura sempre la propria libreria');
      }
      let callbackURL;
      if (b.callbackURL) {
        const page = trustedPageUrl(b.callbackURL, '/verify-email.html');
        if (!page) {
          return fail(reply, 400, 'INVALID_CALLBACK_URL', 'Pagina di ritorno non valida');
        }
        callbackURL = page.toString();
      }
      const books = b.books ?? [];
      if (books.length) {
        const ids = [...new Set(books.map((x) => x.categoryId))];
        const found = await fastify.prisma.category.count({
          where: { id: { in: ids }, isActive: true },
        });
        if (found !== ids.length) {
          return fail(reply, 400, 'INVALID_CATEGORY', 'Categoria inesistente');
        }
      }
      const usernameTaken = await fastify.prisma.user.count({ where: { username } });
      if (usernameTaken) {
        return fail(reply, 409, 'USERNAME_TAKEN', 'Nome utente già in uso');
      }

      // --- Account (Better Auth) --------------------------------------------
      let created;
      try {
        created = await auth.api.signUpEmail({
          body: {
            email,
            password: b.password,
            name: b.name.trim(),
            username,
            accountType: b.accountType,
            bio: clean(b.bio) ?? undefined,
            city: clean(b.city) ?? undefined,
            ...(callbackURL && { callbackURL }),
          },
        });
      } catch (err) {
        const code = err?.body?.code || err?.code;
        if (code === 'PASSWORD_TOO_SHORT' || code === 'PASSWORD_TOO_LONG') {
          return fail(
            reply,
            400,
            'INVALID_PASSWORD',
            'La password deve avere da 8 a 128 caratteri'
          );
        }
        if (code === 'INVALID_EMAIL') {
          return fail(reply, 400, 'INVALID_EMAIL', 'Email non valida');
        }
        // Nome utente preso nel frattempo da un'altra iscrizione
        const exists = await fastify.prisma.user.count({ where: { username } });
        if (exists) return fail(reply, 409, 'USERNAME_TAKEN', 'Nome utente già in uso');
        throw err;
      }

      const response = { status: 'verification_sent', email };

      // Email gia' registrata: Better Auth restituisce un utente fittizio e
      // avvisa il titolare. Non si crea nulla.
      const userId = created?.user?.id;
      const real = userId
        ? await fastify.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
        : null;
      if (!real) return reply.status(201).send(response);

      // --- Profilo, preferenze, ente e volumi --------------------------------
      try {
        const ops = [
          fastify.prisma.user.update({
            where: { id: userId },
            data: {
              status: 'pending',
              libraryRole: b.libraryRole ?? 'curator',
              termsAcceptedAt: new Date(),
            },
          }),
        ];
        if (b.theme || clean(b.motto)) {
          ops.push(
            fastify.prisma.userPreference.create({
              data: {
                userId,
                ...(b.theme && { theme: b.theme }),
                motto: clean(b.motto),
              },
            })
          );
        }
        if (isOrg) {
          const o = b.organization;
          ops.push(
            fastify.prisma.organizationProfile.create({
              data: {
                userId,
                legalName: o.legalName.trim(),
                orgCategory: o.orgCategory,
                contactPerson: clean(o.contactPerson),
                website: clean(o.website),
                publicPhone: clean(o.publicPhone),
                publicAddress: clean(o.publicAddress),
                openingHours: clean(o.openingHours),
              },
            })
          );
        }
        for (const book of books) {
          ops.push(
            fastify.prisma.book.create({
              data: {
                ownerId: userId,
                title: book.title.trim(),
                author: book.author.trim(),
                ...(book.year && { year: book.year }),
                status: 'pending_email',
                categories: { create: [{ categoryId: book.categoryId, isPrimary: true }] },
              },
            })
          );
        }
        await fastify.prisma.$transaction(ops);
      } catch (err) {
        // Senza profilo completo l'account non deve restare: lo si elimina
        // (account e token di verifica seguono per cascata o scadenza)
        await fastify.prisma.user.delete({ where: { id: userId } }).catch(() => {});
        throw err;
      }

      return reply.status(201).send(response);
    }
  );
}
