-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "produced" INTEGER NOT NULL DEFAULT 0,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminDate" DATETIME,
    "material" TEXT,
    "description" TEXT,
    "marketingDescription" TEXT,
    "imageUrl" TEXT,
    "footType" TEXT,
    "footMaterial" TEXT,
    "armType" TEXT,
    "backType" TEXT,
    "fabricType" TEXT,
    "masterId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdById" INTEGER,
    "systemCode" TEXT NOT NULL,
    "barcode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("armType", "backType", "barcode", "createdAt", "createdById", "description", "fabricType", "footMaterial", "footType", "id", "imageUrl", "marketingDescription", "material", "model", "name", "orderDate", "orderId", "produced", "quantity", "status", "systemCode", "terminDate") SELECT "armType", "backType", "barcode", "createdAt", "createdById", "description", "fabricType", "footMaterial", "footType", "id", "imageUrl", "marketingDescription", "material", "model", "name", "orderDate", "orderId", "produced", "quantity", "status", "systemCode", "terminDate" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_systemCode_key" ON "Product"("systemCode");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
