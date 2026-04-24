import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const entries = [
  // Mixed jellyfish+rhythm + cannon + 4 bottles + lamp + brush (US) — $107.87
  { keyword: "jellyfish rhythm 4 bottle cannon lamp brush", country: "US",  productFee: 59.27, shippingFee: 48.60, totalPrice: 107.87, remark: "jellyfish+rhythm+cannon+4b+lamp+brush" },
  // Jellyfish 1 bottle (Belgium) — $36.24
  { keyword: "jellyfish 1 bottle",                         country: "BE",  productFee: 16.38, shippingFee: 19.86, totalPrice: 36.24,  remark: "jellyfish 1 bottle" },
  // Jellyfish 1 bottle + brush (US) — $35.04
  { keyword: "jellyfish 1 bottle brush",                   country: "US",  productFee: 18.62, shippingFee: 16.42, totalPrice: 35.04,  remark: "jellyfish 1 bottle brush" },
  // Jellyfish 2 bottles + brush (US) — $37.02
  { keyword: "jellyfish 2 bottle brush",                   country: "US",  productFee: 19.82, shippingFee: 17.20, totalPrice: 37.02,  remark: "jellyfish 2 bottle brush" },
];

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) { console.error("No store found"); process.exit(1); }

  for (const e of entries) {
    await prisma.productQuotation.upsert({
      where: { storeId_keyword_country: { storeId: store.id, keyword: e.keyword, country: e.country } },
      update: { productFee: e.productFee, shippingFee: e.shippingFee, totalPrice: e.totalPrice, remark: e.remark },
      create: { storeId: store.id, ...e },
    });
    console.log(`✓ [${e.country}] ${e.keyword} = $${e.totalPrice}`);
  }
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
