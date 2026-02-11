const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting image URL migration...");

    // Fetch all products
    const products = await prisma.product.findMany(); // Adjust batching if thousands.
    console.log(`Found ${products.length} products.`);

    let updatedCount = 0;

    for (const p of products) {
        // Find matching catalog item by model (assuming model == catalog code)
        // or systemCode parsing? Model seems safest as it stores the code (e.g. SU010-MKM).
        if (!p.model) continue;

        const catalog = await prisma.productCatalog.findUnique({
            where: { code: p.model }
        });

        if (catalog && catalog.imageUrl && catalog.imageUrl !== p.imageUrl) {
            await prisma.product.update({
                where: { id: p.id },
                data: { imageUrl: catalog.imageUrl }
            });
            updatedCount++;
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} products.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
