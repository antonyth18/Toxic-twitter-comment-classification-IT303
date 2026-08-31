const { PrismaClient } = require('@prisma/client');

// Global shared Prisma client instance
const prisma = new PrismaClient();

module.exports = prisma;
