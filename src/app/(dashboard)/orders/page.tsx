"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { Search, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: number;
  email: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalPrice: number;
  cogs: number;
  adSpendAlloc: number;
  transactionFees: number;
  grossProfit: number;
  currency: string;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    paid: "success",
    partially_refunded: "warning",
    refunded: "destructive",
    pending: "warning",
    voided: "secondary",
    fulfilled: "success",
    unfulfilled: "warning",
    partial: "warning",
  };
  return (
    <Badge variant={map[status] || "secondary"} className="capitalize text-xs">
      {status?.replace(/_/g, " ")}
    </Badge>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 29), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd"),
  });
  const [storeName, setStoreName] = useState("");
  const [currency, setCurrency] = useState("USD");

  async function fetchOrders() {
    setLoading(true);
    const res = await fetch(`/api/orders?from=${dateRange.from}&to=${dateRange.to}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setStoreName(data.storeName || "");
    setCurrency(data.currency || "USD");
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
  }, [dateRange]);

  const filtered = orders.filter(
    (o) =>
      String(o.orderNumber).includes(search) ||
      o.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.reduce((s, o) => s + o.totalPrice, 0);
  const totalProfit = filtered.reduce((s, o) => s + o.grossProfit, 0);

  return (
    <div className="flex flex-col h-full">
      <Header
        storeName={storeName}
        onDateRangeChange={(from, to) => setDateRange({ from, to })}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 font-medium">Orders</p>
              <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 font-medium">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue, currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 font-medium">Gross Profit</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(totalProfit, currency)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order # or email..."
            className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">COGS</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Fees</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Gross Profit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto mb-2" />
                      Loading orders...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => {
                    const margin = order.totalPrice > 0 ? (order.grossProfit / order.totalPrice) * 100 : 0;
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">#{order.orderNumber}</p>
                            <p className="text-xs text-gray-400 truncate max-w-32">{order.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.financialStatus} />
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(order.totalPrice, currency)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {formatCurrency(order.cogs, currency)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {formatCurrency(order.transactionFees, currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${order.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(order.grossProfit, currency)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-medium ${margin >= 20 ? "text-green-600" : margin >= 0 ? "text-yellow-600" : "text-red-600"}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
