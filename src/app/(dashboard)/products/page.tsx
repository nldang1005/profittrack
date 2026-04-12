"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";

interface ProductPerf {
  id: string;
  title: string;
  vendor: string;
  orders: number;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 29), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd"),
  });

  useEffect(() => {
    async function fetch_() {
      setLoading(true);
      const res = await fetch(`/api/products/performance?from=${dateRange.from}&to=${dateRange.to}`);
      const data = await res.json();
      setProducts(data.products || []);
      setStoreName(data.storeName || "");
      setCurrency(data.currency || "USD");
      setLoading(false);
    }
    fetch_();
  }, [dateRange]);

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.vendor?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        storeName={storeName}
        onDateRangeChange={(from, to) => setDateRange({ from, to })}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Orders</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Units Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">COGS</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Gross Profit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">No products found</td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-xs line-clamp-1 max-w-40">{p.title}</p>
                            {p.vendor && <p className="text-xs text-gray-400">{p.vendor}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{p.orders}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{p.unitsSold}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(p.revenue, currency)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(p.cogs, currency)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${p.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(p.grossProfit, currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.margin >= 30 ? "bg-green-100 text-green-700" : p.margin >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                          {p.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
