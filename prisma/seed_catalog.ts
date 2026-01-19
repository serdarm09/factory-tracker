import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const csvPath = path.join(process.cwd(), 'serdar-code-order.csv');
    console.log(`Reading CSV from ${csvPath}...`);

    try {
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        // Simple CSV parser: Split by newline, then by comma. 
        // Handles quotes poorly but user data looks simple "value","value"...
        // Actually the user data has quotes: "1","görseller"...
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

        console.log(`Found ${lines.length} lines. Processing...`);

        let count = 0;
        // Skip header if it exists. First line starts with "index"?
        const startIndex = lines[0].startsWith('index') || lines[0].includes('code') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            // Remove quotes and split
            // Regex to match: "([^"]*)"|([^,]+)
            // Or simpler: split by comma, then strip quotes.
            const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));

            // Map based on header: index,sheet,row,col,code
            // standard order seem to be: index(0), sheet(1), row(2), col(3), code(4)
            // Check if parts has enough length
            if (parts.length < 5) continue;

            const code = parts[4]?.trim(); // 5th column
            if (!code) continue;

            await prisma.productCatalog.upsert({
                where: { code: code },
                update: {},
                create: {
                    code: code,
                    name: code,
                    imageUrl: `/${code}.png`
                }
            });
            count++;
        }

        console.log(`Successfully synced ${count} items to ProductCatalog.`);

    } catch (e) {
        console.error("Error reading CSV:", e);
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
