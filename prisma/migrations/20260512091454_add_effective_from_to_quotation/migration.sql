/*
  Warnings:

  - A unique constraint covering the columns `[storeId,keyword,country,effectiveFrom]` on the table `ProductQuotation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProductQuotation_storeId_keyword_country_key";

-- AlterTable
ALTER TABLE "ProductQuotation" ADD COLUMN "effectiveFrom" DATETIME;

-- CreateIndex
CREATE INDEX "ProductQuotation_storeId_keyword_country_idx" ON "ProductQuotation"("storeId", "keyword", "country");

-- CreateIndex
CREATE UNIQUE INDEX "ProductQuotation_storeId_keyword_country_effectiveFrom_key" ON "ProductQuotation"("storeId", "keyword", "country", "effectiveFrom");
