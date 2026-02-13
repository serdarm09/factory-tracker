@echo off
echo Cache temizleniyor...

echo.
echo 1. .next klasoru siliniyor...
rmdir /s /q .next 2>nul

echo.
echo 2. node_modules/@prisma siliniyor...
rmdir /s /q node_modules\@prisma 2>nul
rmdir /s /q node_modules\.prisma 2>nul

echo.
echo 3. Prisma Client yeniden olusturuluyor...
call npx prisma generate

echo.
echo 4. Build yapiliyor...
call npm run build

echo.
echo Tamamlandi!
pause
