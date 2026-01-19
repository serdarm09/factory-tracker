
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = 'SongulAsci';
    const newPassword = '123456';

    const user = await prisma.user.findUnique({
        where: { username },
    });

    if (!user) {
        console.error(`User '${username}' not found.`);
        return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
    });

    console.log(`Password for '${username}' has been reset to '${newPassword}'.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
