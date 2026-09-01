// Prisma client singleton. Prevents creating multiple clients during dev hot-reload.
const { PrismaClient } = require('@prisma/client');

const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

module.exports = prisma;
