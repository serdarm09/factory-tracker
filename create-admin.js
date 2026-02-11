const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();

  try {
    // Mevcut kullanıcıları listele
    const users = await prisma.user.findMany();
    console.log('Mevcut kullanicilar:', users.map(u => u.username));

    // Admin var mı kontrol et
    const admin = await prisma.user.findUnique({ where: { username: 'admin' } });

    if (admin) {
      // Şifreyi güncelle
      const hashedPassword = await bcrypt.hash('123456', 10);
      await prisma.user.update({
        where: { username: 'admin' },
        data: { password: hashedPassword }
      });
      console.log('Admin sifresi guncellendi: 123456');
    } else {
      // Yeni admin oluştur
      const hashedPassword = await bcrypt.hash('123456', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
      console.log('Admin kullanicisi olusturuldu: admin / 123456');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
