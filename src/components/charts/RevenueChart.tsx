"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface DataPoint {
  date: string;
  revenue: number;
  cogs: number;
  adSpend: number;
  netProfit: number;
}

interface RevenueChartProps {
  data: DataPoint[];
  currency?: string;
}

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
      <p className="mb-2 text-xs font-semibold text-gray-500">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(entry.value, currency)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function RevenueChart({ data, currency = "USD" }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[3, 3, 0, 0]} opacity={0.9} />
        <Bar dataKey="cogs" name="COGS" fill="#f59e0b" radius={[3, 3, 0, 0]} opacity={0.9} stackId="costs" />
        <Bar dataKey="adSpend" name="Ad Spend" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.9} stackId="costs" />
        <Line
          type="monotone"
          dataKey="netProfit"
          name="Net Profit"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#10b981" }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
