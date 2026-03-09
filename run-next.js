const { execSync } = require('child_process');
const path = require('path');

// 1. PM2'nin saçmalamaması için çalışma dizinini zorla bu dosyanın olduğu klasör yapıyoruz
process.chdir(__dirname);

console.log(`Zorunlu Çalışma Dizini (CWD): ${process.cwd()}`);

// 2. Next.js start komutunu tam buradaki NPM ile senkron şekilde tetikliyoruz
try {
    execSync('npm run start', {
        stdio: 'inherit',
        cwd: process.cwd()
    });
} catch (error) {
    console.error('Next.js başlatılırken hata oluştu:', error);
    process.exit(1);
}


//Depo