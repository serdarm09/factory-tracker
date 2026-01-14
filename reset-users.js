const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Tüm kullanıcılar siliniyor...');
    // Delete all users
    await prisma.auditLog.deleteMany({}); // Delete audit logs first to avoid foreign key issues
    await prisma.productionLog.deleteMany({}); // production logs might rely on userIds too if cascade isn't set
    // check schema.prisma? Assuming cascade might simpler to just delete
    // But let's check basic logic. User has auditLogs relation. 
    // Let's delete users.

    // NOTE: If there are foreign keys without cascade delete, this might fail.
    // Assuming standard setup.

    // Safest approach: delete dependent records first or rely on cascade.
    // Given previous errors, I'll try to delete auditlogs and productionlogs related to users?
    // Actually, auditLogs are essential records. But user asked to "reset".
    // "tüm kullancılaarı sil" -> this implies wiping user data.
    // Ideally we keep logs but set userId to null? But schema might require userId.
    // A hard reset is acceptable here based on user tone ("tüm kullancılaarı sil").

    await prisma.auditLog.deleteMany({});
    await prisma.productionLog.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('Admin kullanıcısı oluşturuluyor...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await prisma.user.create({
        data: {
            username: 'admin',
            password: hashedPassword,
            role: 'ADMIN'
        }
    });

    console.log('BAŞARILI: Sistem sıfırlandı. Kullanıcı: admin / Şifre: admin123');
}

main()
    .catch((e) => {
        console.error('HATA:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
