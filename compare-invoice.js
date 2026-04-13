const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Actual amounts from Dropsure invoice U036814736428 (2026-04-13)
// Key = orderNumber (DH prefix stripped), Value = actual COGS charged
const INVOICE = {
  1092: 26.52, 1091: 26.52, 1090: 26.52, 1089: 36.18, 1088: 29.53,
  1087: 33.40, 1086: 29.76, 1085: 30.56, 1084: 29.76, 1083: 33.40,
  1082: 26.70, 1081: 28.75, 1080: 29.83, 1079: 33.40, 1078: 34.22,
  1077: 33.40, 1076: 29.76, 1075: 53.44, 1074: 29.76, 1073: 29.76,
  1072: 29.76, 1071: 32.25, 1070: 28.63, 1069: 28.63, 1068: 34.39,
  1067: 29.76, 1066: 36.63, 1065: 29.76, 1064: 29.76, 1063: 29.76,
  1062: 29.76, 1061: 46.80, 1060: 33.40, 1059: 33.40, 1058: 29.76,
  1057: 29.76, 1056: 29.76, 1055: 44.81, 1054: 158.54, 1053: 29.76,
  1052: 29.76, 1051: 51.60, 1050: 34.22, 1049: 29.76, 1048: 29.76,
  1047: 38.36, 1046: 29.76, 1045: 31.83, 1044: 29.76, 1043: 38.70,
  1042: 33.13, 1041: 44.80, 1040: 29.76, 1039: 29.76, 1038: 29.76,
  1037: 44.80, 1036: 28.05, 1035: 49.53, 1034: 33.13, 1033: 39.88,
  1032: 29.76, 1031: 29.76, 1030: 38.95, 1029: 29.63, 1028: 31.57,
  1027: 30.87, 1026: 32.87, 1025: 29.76, 1024: 29.76, 1023: 28.24,
  1022:  9.02, 1021: 26.32, 1020: 29.76, 1019: 31.85, 1018: 29.76,
  1017: 34.91, 1016: 39.80, 1015: 29.76, 1014: 29.76, 1013: 28.24,
  1012: 29.76, 1011: 34.68, 1010: 29.76, 1009: 95.37, 1008: 35.14,
  1007: 29.76, 1006: 34.39, 1005: 35.65, 1004: 29.76, 1003: 29.76,
}
const INVOICE_TOTAL = 3096.74

async function main() {
  const store = await prisma.store.findFirst()
  if (!store) { console.log('No store'); return }

  const orders = await prisma.order.findMany({
    where: { storeId: store.id, orderNumber: { in: Object.keys(INVOICE).map(Number) } },
    select: { id: true, orderNumber: true, cogs: true, totalPrice: true, totalRefunds: true, transactionFees: true },
    orderBy: { orderNumber: 'desc' },
  })

  console.log(`${'Order'.padEnd(8)} ${'Invoice'.padStart(10)} ${'DB COGS'.padStart(10)} ${'Diff'.padStart(8)} Status`)
  console.log('─'.repeat(50))

  let matched = 0, discrepancies = []
  let totalInvoice = 0, totalDB = 0

  for (const order of orders) {
    const invoiceAmt = INVOICE[order.orderNumber]
    if (invoiceAmt === undefined) continue

    const diff = Math.round((order.cogs - invoiceAmt) * 100) / 100
    const ok = Math.abs(diff) < 0.02   // allow $0.02 rounding tolerance

    totalInvoice += invoiceAmt
    totalDB      += order.cogs

    const status = ok ? '✓' : `⚠ ${diff > 0 ? '+' : ''}${diff.toFixed(2)}`
    console.log(`#${String(order.orderNumber).padEnd(7)} $${String(invoiceAmt.toFixed(2)).padStart(9)} $${String(order.cogs.toFixed(2)).padStart(9)} ${status}`)

    if (!ok) discrepancies.push({ order, invoiceAmt, diff })
    else matched++
  }

  console.log('─'.repeat(50))
  console.log(`TOTAL     $${totalInvoice.toFixed(2).padStart(9)} $${totalDB.toFixed(2).padStart(9)}   Δ $${(totalDB - totalInvoice).toFixed(2)}`)
  console.log(`\n✓ Khớp: ${matched}  ⚠ Lệch: ${discrepancies.length}  (trên ${orders.length} orders)`)
  console.log(`Invoice total: $${INVOICE_TOTAL}  |  DB total: $${totalDB.toFixed(2)}`)

  if (discrepancies.length === 0) {
    console.log('\n🎉 COGS hoàn toàn khớp với invoice!')
    return
  }

  // Update COGS to exact invoice amounts
  console.log('\n=== UPDATING DB TO EXACT INVOICE AMOUNTS ===')
  let updated = 0
  for (const { order, invoiceAmt } of discrepancies) {
    const grossProfit = order.totalPrice - order.totalRefunds - invoiceAmt - order.transactionFees
    await prisma.order.update({
      where: { id: order.id },
      data: { cogs: invoiceAmt, grossProfit },
    })
    console.log(`  #${order.orderNumber}: $${order.cogs.toFixed(2)} → $${invoiceAmt.toFixed(2)}`)
    updated++
  }
  console.log(`\n✅ Updated ${updated} orders to exact invoice values.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
