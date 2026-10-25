import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = require('../../seed/seed.json');

export const seedData = {
  currency: source.currency,
  paintings: source.paintings.map((painting) => ({
    ...painting,
    imageUrl: painting.imageUrl.replace(/^images\//, '/images/')
  })),
  potteryItems: source.potteryItems,
  glazes: source.glazes,
  muralRate: source.mural.ratePerSqFt
};
