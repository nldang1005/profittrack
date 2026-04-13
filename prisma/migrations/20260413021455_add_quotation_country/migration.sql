-- CreateTable
CREATE TABLE "ProductQuotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "remark" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "productFee" REAL NOT NULL,
    "shippingFee" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductQuotation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "email" TEXT,
    "financialStatus" TEXT NOT NULL,
    "fulfillmentStatus" TEXT,
    "totalPrice" REAL NOT NULL,
    "subtotalPrice" REAL NOT NULL,
    "totalShipping" REAL NOT NULL DEFAULT 0,
    "totalTax" REAL NOT NULL DEFAULT 0,
    "totalDiscounts" REAL NOT NULL DEFAULT 0,
    "totalRefunds" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "shippingCountry" TEXT NOT NULL DEFAULT '',
    "cogs" REAL NOT NULL DEFAULT 0,
    "shippingCost" REAL NOT NULL DEFAULT 0,
    "transactionFees" REAL NOT NULL DEFAULT 0,
    "grossProfit" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "processedAt" DATETIME,
    CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("cogs", "createdAt", "currency", "email", "financialStatus", "fulfillmentStatus", "grossProfit", "id", "orderNumber", "processedAt", "shippingCost", "shopifyOrderId", "storeId", "subtotalPrice", "totalDiscounts", "totalPrice", "totalRefunds", "totalShipping", "totalTax", "transactionFees", "updatedAt") SELECT "cogs", "createdAt", "currency", "email", "financialStatus", "fulfillmentStatus", "grossProfit", "id", "orderNumber", "processedAt", "shippingCost", "shopifyOrderId", "storeId", "subtotalPrice", "totalDiscounts", "totalPrice", "totalRefunds", "totalShipping", "totalTax", "transactionFees", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_storeId_shopifyOrderId_key" ON "Order"("storeId", "shopifyOrderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProductQuotation_storeId_keyword_country_key" ON "ProductQuotation"("storeId", "keyword", "country");
