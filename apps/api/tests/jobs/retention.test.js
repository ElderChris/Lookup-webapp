// =============================================================================
// tests/jobs/retention.test.js — pulizia notturna dei dati scaduti
// =============================================================================

import { describe, it, expect, afterAll } from 'vitest';
import { createTestPrisma } from '../helpers.mjs';
import { processRetentionPurge } from '../../src/jobs/retention.js';

const prisma = createTestPrisma();
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const DAY = 24 * 60 * 60 * 1000;

function pendingUser(username, createdAt) {
  return prisma.user.create({
    data: {
      username,
      email: `${username}@example.com`,
      displayName: 'In attesa',
      status: 'pending',
      emailVerified: false,
      createdAt,
    },
  });
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: 'rettest' } } });
  await prisma.$disconnect();
});

describe('processRetentionPurge', () => {
  it('cancella le iscrizioni mai confermate dopo 30 giorni, non quelle recenti', async () => {
    const old = await pendingUser('rettest.vecchio', new Date(Date.now() - 31 * DAY));
    const recent = await pendingUser('rettest.recente', new Date(Date.now() - 2 * DAY));

    const res = await processRetentionPurge({}, logger);
    expect(res.pendingAccounts).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.count({ where: { id: old.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: recent.id } })).toBe(1);
  });
});
