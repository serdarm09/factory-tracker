// Bu dosya Next.js server baslangicinda calisir
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initDatabase } = await import('./lib/db-init')
        await initDatabase()
    }
}
