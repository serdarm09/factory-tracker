-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "company" TEXT,
    "quantity" INTEGER NOT NULL,
    "shelf" TEXT NOT NULL,
    "produced" INTEGER NOT NULL DEFAULT 0,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminDate" DATETIME NOT NULL,
    "material" TEXT,
    "description" TEXT,
    "footType" TEXT,
    "footMaterial" TEXT,
    "armType" TEXT,
    "backType" TEXT,
    "fabricType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdById" INTEGER,
    "systemCode" TEXT NOT NULL,
    "barcode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("armType", "backType", "barcode", "company", "createdAt", "createdById", "description", "fabricType", "footMaterial", "footType", "id", "material", "model", "name", "produced", "quantity", "shelf", "status", "systemCode", "terminDate") SELECT "armType", "backType", "barcode", "company", "createdAt", "createdById", "description", "fabricType", "footMaterial", "footType", "id", "material", "model", "name", "produced", "quantity", "shelf", "status", "systemCode", "terminDate" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_systemCode_key" ON "Product"("systemCode");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
