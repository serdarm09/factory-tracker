-- AlterTable
ALTER TABLE "Product" ADD COLUMN "armType" TEXT;
ALTER TABLE "Product" ADD COLUMN "backType" TEXT;
ALTER TABLE "Product" ADD COLUMN "fabricType" TEXT;
ALTER TABLE "Product" ADD COLUMN "footMaterial" TEXT;
ALTER TABLE "Product" ADD COLUMN "footType" TEXT;

-- CreateTable
CREATE TABLE "ProductFeature" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
