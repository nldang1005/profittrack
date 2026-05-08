-- CreateIndex
CREATE INDEX "AdSpend_adAccountId_date_idx" ON "AdSpend"("adAccountId", "date");

-- CreateIndex
CREATE INDEX "Order_storeId_createdAt_idx" ON "Order"("storeId", "createdAt");
