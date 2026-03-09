const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sfs = await prisma.semiFinishedProduction.findMany({
        select: {
            id: true,
            productId: true,
            category: true,
            targetQty: true,
            producedQty: true,
            status: true,
            completedAt: true,
            product: {
                select: {
                    name: true,
                    quantity: true,
                    storedQty: true,
                    status: true
                }
            }
        },
        orderBy: { updatedAt: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(sfs, null, 2));
}

main().finally(() => prisma.$disconnect());
