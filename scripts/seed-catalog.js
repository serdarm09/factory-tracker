const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('Ürün kataloğu yükleniyor...');

    const filePath = path.join(__dirname, '..', 'MAMULLER.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Assuming columns 'Stok Kodu' (A) and 'Stok Adı' (B)
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`${data.length} kayıt bulundu.`);

    let count = 0;
    for (const row of data) {
        const code = row['Stok Kodu'];
        const name = row['Stok Adı'];

        if (code && name) {
            // Upsert to avoid duplicates
            await prisma.productCatalog.upsert({
                where: { code: String(code) },
                update: { name: String(name) },
                create: {
                    code: String(code),
                    name: String(name)
                }
            });
            count++;
        }
        if (count % 100 === 0) console.log(`${count} ürün işlendi...`);
    }

    console.log(`Tamamlandı: ${count} ürün kataloğa eklendi/güncellendi.`);
}

main()
    .catch((e) => {
        console.error('HATA:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
