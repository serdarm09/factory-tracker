import prisma from './prisma'
import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { Client } from 'pg'

// SQLite'dan PostgreSQL'e otomatik gecis (sadece bir kez calisir)
export async function initDatabase() {
    try {
        const sqlitePath = path.join(process.cwd(), 'prisma', 'dev.db')
        const migratedPath = path.join(process.cwd(), 'prisma', 'dev.db.migrated')

        // Eğer SQLite dosyası varsa ve henüz ".migrated" yapılmamışsa taşıma işlemini başlat
        if (fs.existsSync(sqlitePath) && !fs.existsSync(migratedPath)) {
            console.log('\n[MIGRATION] Otomatik SQLite -> PostgreSQL veri aktarımı başlatılıyor...')

            // 1. Veritabanını Kontrol Et ve Oluştur
            const dbUrl = process.env.DATABASE_URL || ""
            const urlParts = dbUrl.split('/')
            const dbNameWithQuery = urlParts[urlParts.length - 1]
            const dbName = dbNameWithQuery.split('?')[0]
            const defaultDbUrl = dbUrl.replace(`/${dbNameWithQuery}`, '/postgres')

            console.log(`[MIGRATION] Veritabanı varlığı kontrol ediliyor: ${dbName}`)
            const adminClient = new Client({ connectionString: defaultDbUrl })
            try {
                await adminClient.connect()
                const res = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname=$1`, [dbName])
                if (res.rowCount === 0) {
                    await adminClient.query(`CREATE DATABASE "${dbName}"`)
                    console.log(`[MIGRATION] Veritabanı başarıyla oluşturuldu: ${dbName}`)
                }
            } catch (e: any) {
                console.error(`[MIGRATION] Veritabanı oluşturulurken hata (varsa görmezden gelinebilir): ${e.message}`)
            } finally {
                await adminClient.end()
            }

            // 2. Prisma ile PostgreSQL Tablolarını Oluştur
            console.log(`[MIGRATION] PostgreSQL tabloları oluşturuluyor...`)
            try {
                const { execSync } = require('child_process');
                // Schema dosyasına göre eksik tabloları sıfırdan yaratır
                execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
            } catch (err: any) {
                console.error(`[MIGRATION] Tablo oluşturma hatası: ${err.message}`)
                console.log(`[MIGRATION] Aktarım durduruldu, çünkü tablolar yaratılamadı.`)
                return; // Tablolar olmadan veriyi aktaramayız
            }

            // 3. Veri Aktarımı
            const sqliteDb = await open({
                filename: sqlitePath,
                driver: sqlite3.Database
            })

            const pgClient = new Client({
                connectionString: process.env.DATABASE_URL
            })
            await pgClient.connect()

            try {
                // Yabancı anahtar (foreign key) kısıtlamalarını geçici olarak devre dışı bırak
                console.log(`[MIGRATION] Yabancı anahtar kontrolleri devre dışı bırakılıyor...`)
                await pgClient.query("SET session_replication_role = 'replica';")

                // Tüm SQLite tablolarını bul
                const tables = await sqliteDb.all(`
                  SELECT name 
                  FROM sqlite_master 
                  WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'
                `)

                for (const table of tables) {
                    const tableName = table.name
                    console.log(`[MIGRATION] Kopyalanıyor: ${tableName}`)

                    const rows = await sqliteDb.all(`SELECT * FROM "${tableName}"`)
                    if (rows.length === 0) continue

                    const columns = Object.keys(rows[0])

                    // PostgreSQL'e aktar
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i]
                        const values = columns.map(col => {
                            let val = row[col]
                            if (col === 'createdAt' || col === 'updatedAt' || col.endsWith('Date')) {
                                if (val) {
                                    const d = new Date(val)
                                    if (!isNaN(d.getTime())) val = d.toISOString()
                                }
                            }
                            return val
                        })

                        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
                        const query = `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES (${placeholders}) ON CONFLICT DO NOTHING`

                        try {
                            await pgClient.query(query, values)
                        } catch (err: any) {
                            console.error(`[MIGRATION] Hata (${tableName} ID: ${row.id}):`, err.message)
                        }
                    }

                    // PostgreSQL Serial sequence'larını düzelt
                    if (columns.includes('id')) {
                        try {
                            const res = await pgClient.query(`SELECT MAX(id) as max_id FROM "${tableName}"`)
                            const maxId = res.rows[0].max_id
                            if (maxId) {
                                await pgClient.query(`SELECT setval('"${tableName}_id_seq"', ${maxId})`)
                            }
                        } catch (seqErr) { }
                    }
                }

                console.log('[MIGRATION] ✅ Veri taşıma başarıyla tamamlandı!')

                // Taşındıktan sonra eski dosyanın adını değiştir ki bir daha çalışmasın
                // Önce bağlantıyı kapatıyoruz ki Windows dosya kilidini (EBUSY) kaldırsın
                await sqliteDb.close()
                fs.renameSync(sqlitePath, migratedPath)
                console.log(`[MIGRATION] ${sqlitePath} -> .migrated olarak işaretlendi.`)

            } catch (error) {
                console.error('[MIGRATION] Hata:', error)
            } finally {
                try {
                    // Yabancı anahtar kontrollerini tekrar etkinleştir
                    console.log(`[MIGRATION] Yabancı anahtar kontrolleri tekrar etkinleştiriliyor...`)
                    await pgClient.query("SET session_replication_role = 'origin';")
                } catch (e) { }

                await pgClient.end()
            }
        } else {
            console.log('Database initialized successfully (PostgreSQL)');
        }
    } catch (error) {
        console.error('Database init error:', error);
    }
}

// Uygulama kapanirken baglantilari kapat
export async function closeDatabase() {
    await prisma.$disconnect()
}
