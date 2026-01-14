const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
        console.log('WAL mode enabled successfully.');
    } catch (e) {
        console.error('Failed to enable WAL mode:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
