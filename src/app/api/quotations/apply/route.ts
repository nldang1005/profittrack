import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── Component classification ─────────────────────────────────────────────────
type Component = "jellyfish" | "rhythm" | "rain" | "bloom" | "salt" | "oil" | "lamp" | "jlamp" | "brush" | "cannon" | "ignore";

function classify(title: string, variantTitle: string | null): Component {
  const t = (title + " " + (variantTitle ?? "")).toLowerCase();
  if (t.includes("shipping protection") || t.includes("insurance")) return "ignore";
  if (t.includes("adapter")) return "ignore";  // bundled into salt unit cost
  // "Difhouser™ Jellyfish Lamp" — standalone $5.26 lamp, must check before generic lamp
  if (t.includes("jellyfish") && t.includes("lamp")) return "jlamp";
  if (t.includes("lamp"))      return "lamp";   // ocean lamp $6.36, goes with diffuser bundles
  if (t.includes("cannon"))    return "cannon";
  if (t.includes("brush") || t.includes("cleaning")) return "brush";
  if (t.includes("bloom") || t.includes("botanical")) return "bloom";
  if (t.includes("himalayan") || t.includes("salt stone")) return "salt";
  if (t.includes("rhythm")) return "rhythm";  // before jellyfish — "Aero-Jellyfish Rhythm" contains both
  if (t.includes("rain"))   return "rain";    // before jellyfish — "Aero-Jellyfish Rain" contains both
  if (
    t.includes("jellyfish") || t.includes("humidifier") || t.includes("vibe") ||
    t.includes("diffuser")  ||
    (t.includes("difhouser") && !t.includes("oil"))
  ) return "jellyfish";
  if (t.includes("essential oil") || t.includes("10ml")) return "oil";
  return "ignore";
}

// ─── Order composition ────────────────────────────────────────────────────────
interface Composition {
  nJellyfish: number;
  nRhythm:    number;
  nRain:      number;
  nBloom:     number;
  nSalt:      number;
  nOils:      number;
  nLamps:     number;  // ocean lamp ($6.36) — in diffuser bundles
  nJlamp:     number;  // jellyfish lamp ($5.26) — standalone product
  nBrush:     number;
  nCannon:    number;
}

function compose(lineItems: { title: string; variantTitle: string | null; quantity: number }[]): Composition {
  let nJellyfish = 0, nRhythm = 0, nRain = 0, nBloom = 0, nSalt = 0, nOils = 0, nLamps = 0, nJlamp = 0, nBrush = 0, nCannon = 0;
  for (const item of lineItems) {
    const type = classify(item.title, item.variantTitle);
    if (type === "jellyfish")   nJellyfish += item.quantity;
    else if (type === "rhythm") nRhythm    += item.quantity;
    else if (type === "rain")   nRain      += item.quantity;
    else if (type === "bloom")  nBloom     += item.quantity;
    else if (type === "salt")   nSalt      += item.quantity;
    else if (type === "oil")    nOils      += item.quantity;
    else if (type === "lamp")   nLamps     += item.quantity;
    else if (type === "jlamp")  nJlamp     += item.quantity;
    else if (type === "brush")  nBrush     += item.quantity;
    else if (type === "cannon") nCannon    += item.quantity;
  }
  return { nJellyfish, nRhythm, nRain, nBloom, nSalt, nOils, nLamps, nJlamp, nBrush, nCannon };
}

// ─── Lookup helper ────────────────────────────────────────────────────────────
type Quotation = { keyword: string; country: string; totalPrice: number };

function lookup(quotations: Quotation[], keyword: string, country: string): Quotation | undefined {
  return (
    quotations.find(q => q.keyword === keyword && q.country === country) ??
    quotations.find(q => q.keyword === keyword)  // fallback: any country
  );
}

// ─── COGS calculation ─────────────────────────────────────────────────────────
function calcForDiffuserType(
  prefix: string,
  nUnits: number,
  nOils: number,
  nLamps: number,
  nBrush: number,
  nCannon: number,
  country: string,
  quotations: Quotation[],
): number | null {
  let total = 0;

  if (nCannon > 0 && nOils > 0) {
    // diffuser + bottle + cannon
    const q = lookup(quotations, `${prefix} 1 bottle cannon`, country);
    if (!q) return null;
    total += q.totalPrice * nUnits;

  } else if (nOils === 0 && nBrush > 0) {
    // diffuser + brush only
    const brushKeyword = nBrush >= 3 ? `${prefix} 3 brush` : `${prefix} brush`;
    const q = lookup(quotations, brushKeyword, country) ?? lookup(quotations, `${prefix} brush`, country);
    if (!q) return null;
    total += q.totalPrice * nUnits;

  } else if (nOils > 0) {
    // diffuser + oils (± lamp ± brush)
    const oilsPerUnit = Math.round(nOils / nUnits);
    const hasLamp = nLamps > 0;

    let keyword: string;
    if (hasLamp) {
      if (oilsPerUnit <= 1)      keyword = `${prefix} 1 bottle lamp`;
      else if (oilsPerUnit <= 2) keyword = `${prefix} 2 bottle lamp`;
      else if (oilsPerUnit <= 3) keyword = `${prefix} 3 bottle lamp`;
      else                       keyword = `${prefix} 4 bottle lamp`;
    } else {
      if (oilsPerUnit <= 1) keyword = `${prefix} 1 bottle`;
      else if (oilsPerUnit === 2) keyword = `${prefix} 2 bottle`;
      else if (oilsPerUnit === 3) keyword = `${prefix} 3 bottle`;
      else if (oilsPerUnit === 4) keyword = `${prefix} 4 bottle`;
      else keyword = `${prefix} 5 bottle`;
    }

    // Always try combined keyword with brush first (single-shipment price)
    if (nBrush > 0) {
      const combined = lookup(quotations, `${keyword} brush`, country);
      if (combined) {
        total += combined.totalPrice * nUnits;
        return total;
      }
    }

    const q = lookup(quotations, keyword, country);
    if (!q) return null;
    total += q.totalPrice * nUnits;

    // Fallback: add standalone brush cost if no combined quotation found
    const is4plus = keyword.includes("4 bottle") || keyword.includes("5 bottle");
    if (nBrush > 0 && !is4plus) {
      const bq = lookup(quotations, "brush", country);
      if (bq) total += bq.totalPrice * nBrush;
    }

  } else {
    // diffuser only → use "1 bottle" as baseline
    const q = lookup(quotations, `${prefix} 1 bottle`, country);
    if (!q) return null;
    total += q.totalPrice * nUnits;
  }

  return total;
}

function calcCOGS(comp: Composition, country: string, quotations: Quotation[]): number | null {
  const { nJellyfish, nRhythm, nRain, nBloom, nSalt, nOils, nLamps, nJlamp, nBrush, nCannon } = comp;

  const nDiffusers = nJellyfish + nRhythm + nRain + nBloom + nSalt;
  if (nDiffusers === 0 && nOils === 0 && nBrush === 0 && nCannon === 0 && nLamps === 0 && nJlamp === 0) return null;

  let total = 0;

  // Triple mix: jellyfish + rain + rhythm
  if (nJellyfish > 0 && nRain > 0 && nRhythm > 0) {
    const b = Math.min(nOils, 5);
    let keyword = `jellyfish rain rhythm ${b} bottle`;
    if (nCannon > 0) keyword += " cannon";
    if (nLamps  > 0) keyword += " lamp";
    if (nBrush  > 0) keyword += " brush";
    const q = lookup(quotations, keyword, country);
    if (!q) return null;
    return q.totalPrice;
  }

  // Mixed jellyfish + rhythm order → look for combined quotation first
  if (nJellyfish > 0 && nRhythm > 0) {
    const b = Math.min(nOils, 5);
    let keyword = `jellyfish rhythm ${b} bottle`;
    if (nCannon > 0) keyword += " cannon";
    if (nLamps  > 0) keyword += " lamp";
    if (nBrush  > 0) keyword += " brush";
    const q = lookup(quotations, keyword, country);
    if (!q) return null;
    return q.totalPrice;
  }

  // Mixed jellyfish + rain order → look for combined quotation first
  if (nJellyfish > 0 && nRain > 0) {
    const b = Math.min(nOils, 5);
    let keyword = `jellyfish rain ${b} bottle`;
    if (nCannon > 0) keyword += " cannon";
    if (nLamps  > 0) keyword += " lamp";
    if (nBrush  > 0) keyword += " brush";
    const q = lookup(quotations, keyword, country);
    if (!q) return null;
    return q.totalPrice;
  }

  // Pure rhythm orders
  if (nRhythm > 0) {
    const sub = calcForDiffuserType("rhythm", nRhythm, nOils, nLamps, nBrush, nCannon, country, quotations);
    if (sub === null) return null;
    total += sub;
  }

  // Pure rain orders
  if (nRain > 0) {
    const sub = calcForDiffuserType("rain", nRain, nOils, nLamps, nBrush, nCannon, country, quotations);
    if (sub === null) return null;
    total += sub;
  }

  // Jellyfish diffuser orders
  if (nJellyfish > 0) {
    const sub = calcForDiffuserType("jellyfish", nJellyfish, nOils, nLamps, nBrush, nCannon, country, quotations);
    if (sub === null) return null;
    total += sub;
  }

  // Bloom diffuser orders
  if (nBloom > 0) {
    const sub = calcForDiffuserType("bloom", nBloom, nOils, nLamps, nBrush, nCannon, country, quotations);
    if (sub === null) return null;
    total += sub;
  }

  // Salt diffuser orders
  if (nSalt > 0) {
    const sub = calcForDiffuserType("salt", nSalt, nOils, nLamps, nBrush, nCannon, country, quotations);
    if (sub === null) return null;
    total += sub;
  }

  // No diffuser at all
  if (nDiffusers === 0) {
    if (nJlamp > 0) {
      // Standalone jellyfish lamp ($5.26) — "Difhouser™ Jellyfish Lamp"
      const b = Math.min(nOils, 4);
      const key = nOils > 0 ? `lamp ${b} bottle` : "lamp";
      const q = lookup(quotations, key, country);
      if (!q) return null;
      total += q.totalPrice * nJlamp;
    } else if (nOils > 0) {
      const b = Math.min(nOils, 4);
      const q = lookup(quotations, `oil ${b}`, country);
      if (!q) return null;
      total += q.totalPrice;
    }
    if (nBrush > 0) {
      const q = lookup(quotations, "brush", country);
      if (!q) return null;
      total += q.totalPrice * nBrush;
    }
  }

  return total > 0 ? total : null;
}

// ─── API handler ──────────────────────────────────────────────────────────────
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: "No store" }, { status: 400 });

  const quotations = await prisma.productQuotation.findMany({ where: { storeId: store.id } });
  if (quotations.length === 0) {
    return NextResponse.json({ success: true, updated: 0, skipped: 0, message: "No quotations defined" });
  }

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: { lineItems: true },
  });

  let updated = 0, skipped = 0;

  for (const order of orders) {
    const country = (order.shippingCountry ?? "").toUpperCase();
    const comp    = compose(order.lineItems);
    const cogs    = calcCOGS(comp, country, quotations);

    if (cogs === null) { skipped++; continue; }

    const grossProfit = order.totalPrice - order.totalRefunds - cogs - order.transactionFees;
    await prisma.order.update({
      where: { id: order.id },
      data: { cogs, grossProfit },
    });
    updated++;
  }

  return NextResponse.json({ success: true, updated, skipped });
}
