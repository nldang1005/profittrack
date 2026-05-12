import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Jellyfish diffuser cost dropped from $17.21 → $13.50 (effective 2026-05-11)
// Reduction per jellyfish unit: $3.71 — update all jellyfish quotation prices
const REDUCTION = 3.71;

// Oil set gift boxes (product cost only — shipping bundled with diffuser)
const OIL_SETS = [
  { keyword: "oil set 3",  productFee: 2.5, shippingFee: 0, totalPrice: 2.5,  remark: "oil gift set 3 bottles" },
  { keyword: "oil set 5",  productFee: 4.3, shippingFee: 0, totalPrice: 4.3,  remark: "oil gift set 5 bottles" },
  { keyword: "oil set 6",  productFee: 4.8, shippingFee: 0, totalPrice: 4.8,  remark: "oil gift set 6 bottles" },
  { keyword: "oil set 10", productFee: 6.4, shippingFee: 0, totalPrice: 6.4,  remark: "oil gift set 10 bottles" },
  { keyword: "oil set 12", productFee: 7.6, shippingFee: 0, totalPrice: 7.6,  remark: "oil gift set 12 bottles" },
];

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) { console.error("No store found"); process.exit(1); }

  // ── 1. Oil sets (country=US as default, no shipping — bundled with diffuser) ─
  for (const e of OIL_SETS) {
    await prisma.productQuotation.upsert({
      where: { storeId_keyword_country: { storeId: store.id, keyword: e.keyword, country: "US" } },
      update: { productFee: e.productFee, shippingFee: e.shippingFee, totalPrice: e.totalPrice, remark: e.remark },
      create: { storeId: store.id, country: "US", ...e },
    });
    console.log(`✓ [oil set] ${e.keyword} = $${e.totalPrice}`);
  }

  // ── 2. New jellyfish prices from 2026-05-11 ────────────────────────────────
  // Fetch all current jellyfish quotations (effectiveFrom = null = original prices)
  const existing = await prisma.productQuotation.findMany({
    where: { storeId: store.id, keyword: { startsWith: "jellyfish" } },
  });

  let count = 0;
  for (const q of existing) {
    // jellyfish 3 set / jellyfish 3 = 3 jellyfish units → reduce by 3×3.71 = 11.13
    const nJellyfish = (q.keyword === "jellyfish 3 set" || q.keyword === "jellyfish 3") ? 3 : 1;
    const reduction = nJellyfish * REDUCTION;
    const newTotal   = Math.round((q.totalPrice   - reduction) * 100) / 100;
    const newProduct = Math.round((q.productFee   - reduction) * 100) / 100;

    try {
      // Upsert with updated price (overwrites existing row)
      await prisma.productQuotation.upsert({
        where: { storeId_keyword_country: { storeId: store.id, keyword: q.keyword, country: q.country } },
        update: { productFee: newProduct, totalPrice: newTotal, remark: q.remark + ` (updated 2026-05-11, diffuser $13.50)` },
        create: { storeId: store.id, keyword: q.keyword, country: q.country, productFee: newProduct, shippingFee: q.shippingFee, totalPrice: newTotal, remark: q.remark + ` (updated 2026-05-11, diffuser $13.50)` },
      });
      count++;
      console.log(`✓ [${q.country}] ${q.keyword}: $${q.totalPrice} → $${newTotal}`);
    } catch (e) {
      if (e.code === "P2002") {
        console.log(`skip (exists): [${q.country}] ${q.keyword}`);
      } else throw e;
    }
  }

  console.log(`\nDone. Oil sets: ${OIL_SETS.length}, Jellyfish price updates: ${count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
