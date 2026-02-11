import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

// Production'da da singleton kullan (onemli!)
const prisma = globalThis.prisma ?? prismaClientSingleton()

// Her zaman global'e ata (development ve production)
if (!globalThis.prisma) {
    globalThis.prisma = prisma
}

export default prisma
