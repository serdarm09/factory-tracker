// Bu dosya Next.js server baslangicinda calisir
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initDatabase } = await import('./lib/db-init')
        // Sunucuyu bloklamamak için arka planda çalıştır
        initDatabase().catch(console.error)

        const fs = await import('fs')
        const path = await import('path')
        const { exec } = await import('child_process')

        const BACKUP_DIR = path.join(process.cwd(), '..', 'data-yedek')

        async function backup() {
            try {
                try {
                    await fs.promises.access(BACKUP_DIR)
                } catch {
                    await fs.promises.mkdir(BACKUP_DIR, { recursive: true })
                }

                const now = new Date()
                const tarih = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                const saat = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
                const folderName = `pg_backup_${tarih}_${saat}`
                const folderPath = path.join(BACKUP_DIR, folderName)

                try {
                    await fs.promises.access(folderPath)
                } catch {
                    await fs.promises.mkdir(folderPath, { recursive: true })
                }

                const dbUrl = process.env.DATABASE_URL
                if (!dbUrl || !dbUrl.startsWith('postgres')) {
                    console.error('[Yedek] Geçerli bir PostgreSQL DATABASE_URL bulunamadı.')
                    return
                }

                const backupFile = path.join(folderPath, 'marisit_db.dump')

                // pg_dump yolunu bul
                let pgDumpPath = 'pg_dump'
                if (process.platform === 'win32') {
                    const possiblePaths = [
                        'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
                        'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
                        'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
                        'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
                        'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
                        'C:\\Program Files\\PostgreSQL\\13\\bin\\pg_dump.exe',
                        'C:\\Program Files\\PostgreSQL\\13\\pgAdmin 4\\runtime\\pg_dump.exe',
                    ]
                    for (const p of possiblePaths) {
                        if (fs.existsSync(p)) {
                            pgDumpPath = `"${p}"`
                            break
                        }
                    }
                }

                const cleanDbUrl = dbUrl.split('?')[0]
                const url = new URL(cleanDbUrl)
                const execEnv = { ...process.env, PGPASSWORD: url.password }
                const cmd = `${pgDumpPath} -h ${url.hostname} -p ${url.port || 5432} -U ${url.username} -F c -f "${backupFile}" "${url.pathname.substring(1)}"`

                // Async exec - sunucuyu bloklama!
                await new Promise<void>((resolve) => {
                    exec(cmd, { env: execEnv }, (err, _stdout, stderr) => {
                        if (err) {
                            console.error('[Yedek] Hata:', err.message)
                            if (stderr) console.error('[Yedek] Stderr:', stderr)
                        } else {
                            console.log(`[Yedek] ${folderName}/marisit_db.dump oluşturuldu.`)
                        }
                        resolve()
                    })
                })

                // Son 24 yedek klasörünü tut, eskilerini sil
                const entries = await fs.promises.readdir(BACKUP_DIR, { withFileTypes: true })

                const statsPromises = entries
                    .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('pg_backup_'))
                    .map(async (dirent) => {
                        const dirPath = path.join(BACKUP_DIR, dirent.name)
                        const stat = await fs.promises.stat(dirPath)
                        return { name: dirent.name, time: stat.mtimeMs, path: dirPath }
                    })

                const foldersWithStats = await Promise.all(statsPromises)
                foldersWithStats.sort((a, b) => b.time - a.time)

                if (foldersWithStats.length > 24) {
                    const toDelete = foldersWithStats.slice(24)
                    await Promise.all(toDelete.map(f =>
                        fs.promises.rm(f.path, { recursive: true, force: true })
                    ))
                }
            } catch (err: any) {
                console.error('[Yedek] Genel Hata:', err.message)
            }
        }

        // İlk yedeği arka planda al - sunucuyu bloklama
        backup().catch(console.error)
        // Her 2 saatte bir yedek al
        setInterval(() => backup().catch(console.error), 2 * 60 * 60 * 1000)
        console.log('[Yedek] Otomatik PostgreSQL yedekleme başladı.')
    }
}
