// =============================================================================
// src/routes/categories.js
// =============================================================================
// Endpoint per le categorie BISAC. Lista flat di tutte le categorie attive
// (non gerarchica per ora — BISAC vero e' a 3 livelli, ma il prototipo ne usa
// uno solo). Pubblico, no auth, no paginazione (sono ~15 categorie).
//
// Use case principale (Fase 2c): il frontend riceve la lista al boot per
// poter mappare slug → id quando crea/modifica un libro.
// =============================================================================

export default async function categoriesRoutes(fastify) {
  // ===========================================================================
  // GET /api/categories
  // ===========================================================================
  fastify.get(
    '/api/categories',
    {
      schema: {
        summary: 'Lista categorie BISAC',
        description:
          'Restituisce tutte le categorie BISAC disponibili. Non paginato ' +
          '(poche righe). Usato dal frontend per mappare slug → id quando ' +
          'crea/modifica libri.',
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: ['string', 'null'] },
                  },
                  required: ['id', 'name', 'slug'],
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const rows = await fastify.prisma.category.findMany({
        select: { id: true, name: true, slug: true, description: true },
        orderBy: { name: 'asc' },
      });
      return { data: rows };
    }
  );
}
