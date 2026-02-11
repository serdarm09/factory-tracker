const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function enableWal() {
    try {
        console.log('Enabling WAL mode for SQLite...');
        await prisma.$queryRaw`PRAGMA journal_mode = WAL;`;
        await prisma.$queryRaw`PRAGMA synchronous = NORMAL;`; // Daha performanslı ama güvenli
        console.log('WAL mode enabled successfully.');
    } catch (error) {
        console.error('Failed to enable WAL mode:', error);
    } finally {
        await prisma.$disconnect();
    }
}

enableWal();
