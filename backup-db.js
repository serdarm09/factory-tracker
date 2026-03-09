const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'prisma', 'dev.db');
const WAL_PATH = path.join(__dirname, 'prisma', 'dev.db-wal');
const SHM_PATH = path.join(__dirname, 'prisma', 'dev.db-shm');
const BACKUP_DIR = path.join(__dirname, '..', 'data-yedek');

function backup() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        if (!fs.existsSync(DB_PATH)) {
            console.log('[Yedek] dev.db bulunamadı, atlanıyor.');
            return;
        }

        const now = new Date();
        const tarih = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const saat = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const folderName = `dev_${tarih}_${saat}`;
        const folderPath = path.join(BACKUP_DIR, folderName);

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        // dev.db
        fs.copyFileSync(DB_PATH, path.join(folderPath, 'dev.db'));
        console.log(`[Yedek] ${folderName}/dev.db oluşturuldu.`);

        // dev.db-wal
        try {
            fs.copyFileSync(WAL_PATH, path.join(folderPath, 'dev.db-wal'));
            console.log(`[Yedek] ${folderName}/dev.db-wal oluşturuldu.`);
        } catch {
            fs.writeFileSync(path.join(folderPath, 'dev.db-wal'), '');
            console.log(`[Yedek] ${folderName}/dev.db-wal bulunamadı, boş oluşturuldu.`);
        }

        // dev.db-shm
        try {
            fs.copyFileSync(SHM_PATH, path.join(folderPath, 'dev.db-shm'));
            console.log(`[Yedek] ${folderName}/dev.db-shm oluşturuldu.`);
        } catch {
            fs.writeFileSync(path.join(folderPath, 'dev.db-shm'), '');
            console.log(`[Yedek] ${folderName}/dev.db-shm bulunamadı, boş oluşturuldu.`);
        }

        // Son 24 klasörü tut, eskilerini sil
        const folders = fs.readdirSync(BACKUP_DIR)
            .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time);

        if (folders.length > 24) {
            folders.slice(24).forEach(f => {
                const p = path.join(BACKUP_DIR, f.name);
                fs.rmSync(p, { recursive: true, force: true });
                console.log(`[Yedek] Eski klasör silindi: ${f.name}`);
            });
        }
    } catch (err) {
        console.error('[Yedek] Hata:', err.message);
    }
}

// Başlangıçta bir kere al
backup();

// Her 2 saatte bir al
setInterval(backup, 2 * 60 * 60 * 1000);

console.log('[Yedek] Otomatik yedekleme başladı. Her 2 saatte bir çalışacak.');
