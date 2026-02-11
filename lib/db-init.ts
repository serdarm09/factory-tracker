import prisma from './prisma'

// SQLite WAL modunu etkinlestir (daha iyi esitlilik icin)
export async function initDatabase() {
    try {
        // WAL modu - birden fazla okuma, tek yazma
        await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;')
        // Busy timeout - kilitli oldugunda bekle
        await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;')
        // Senkronizasyon - normal mod (daha hizli)
        await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;')
        // Cache boyutu
        await prisma.$queryRawUnsafe('PRAGMA cache_size = 10000;')

        console.log('Database initialized with WAL mode')
    } catch (error) {
        console.error('Database init error:', error)
    }
}

// Uygulama kapanirken baglantilari kapat
export async function closeDatabase() {
    await prisma.$disconnect()
}
