// =============================================================================
// src/routes/categories.js
// =============================================================================
// Generi dei libri (categorie BISAC, tassonomia in prisma/taxonomy.mjs):
// lista piatta con il genitore (macro-area) e il numero di volumi attivi.
// Pubblico, non paginato (circa 80 righe).
//
// Usi: scelta dei generi in Pubblica volume ed Esplora, distribuzione per
// genere nelle statistiche, filtro della ricerca.
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
                    bisacCode: { type: ['string', 'null'] },
                    parentId: { type: ['integer', 'null'] },
                    parentName: { type: ['string', 'null'] },
                    sortOrder: { type: 'integer' },
                    booksCount: { type: 'integer' },
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
      const [rows, counts] = await Promise.all([
        fastify.prisma.category.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            bisacCode: true,
            parentId: true,
            sortOrder: true,
            parent: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
        }),
        // Volumi attivi per genere
        fastify.prisma.bookCategory.groupBy({
          by: ['categoryId'],
          where: { book: { status: 'active', owner: { status: 'active' } } },
          _count: { _all: true },
        }),
      ]);
      const byCategory = new Map(counts.map((c) => [c.categoryId, c._count._all]));
      return {
        data: rows.map(({ parent, ...c }) => ({
          ...c,
          parentName: parent ? parent.name : null,
          booksCount: byCategory.get(c.id) || 0,
        })),
      };
    }
  );
}
