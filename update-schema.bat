@echo off
echo Prisma schema guncelleniyor...

echo.
echo 1. Prisma Client olusturuluyor...
call npx prisma generate

echo.
echo 2. Migration yapiliyor...
call npx prisma migrate dev --name add_semi_finished_production

echo.
echo 3. Build yapiliyor...
call npm run build

echo.
echo Tamamlandi!
pause
