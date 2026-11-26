// =============================================================================
// packages/shared/src/schemas/categories.js
// =============================================================================
// Schemi Zod per /api/categories.
// Lista flat di categorie BISAC, no paginazione (poche righe).
// =============================================================================

import { z } from 'zod';
import { IntId } from './common.js';

export const CategoryDto = z.object({
  id: IntId,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
});

export const ListCategoriesResponse = z.object({
  data: z.array(CategoryDto),
});
