import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const entries = [
  // Triple mix: jellyfish + rain + rhythm + 4b + lamp + brush (US) — $113.39
  { keyword: "jellyfish rain rhythm 4 bottle lamp brush", country: "US", productFee: 59.27, shippingFee: 54.12, totalPrice: 113.39, remark: "jellyfish+rain+rhythm+4b+lamp+brush" },
  // 2x rain + 4b + 2brush (US) — $58.30 total, stored per-unit ($29.15)
  { keyword: "rain 2 bottle brush",                      country: "US", productFee: 12.23, shippingFee: 16.92, totalPrice: 29.15,  remark: "rain 2b+brush US per-unit (2x bundle=$58.30)" },
  // Jellyfish 1 bottle (Switzerland) — $32.50
  { keyword: "jellyfish 1 bottle",                       country: "CH", productFee: 16.38, shippingFee: 16.12, totalPrice: 32.50,  remark: "jellyfish 1b CH" },
  // Jellyfish 1 bottle + lamp (Norway) — $48.80
  { keyword: "jellyfish 1 bottle lamp",                  country: "NO", productFee: 22.72, shippingFee: 26.08, totalPrice: 48.80,  remark: "jellyfish 1b+lamp NO" },
  // Mixed jellyfish + rhythm + 4b + brush (US) — $76.46
  { keyword: "jellyfish rhythm 4 bottle brush",          country: "US", productFee: 41.44, shippingFee: 35.02, totalPrice: 76.46,  remark: "jellyfish+rhythm+4b+brush US" },
  // Standalone lamp + 1 bottle (US) — $16.60
  { keyword: "lamp 1 bottle",                            country: "US", productFee: 6.46,  shippingFee: 10.14, totalPrice: 16.60,  remark: "lamp+1b US" },
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
