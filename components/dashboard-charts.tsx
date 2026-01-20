"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    LineChart,
    Line,
    AreaChart,
    Area
} from "recharts";
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { getHistoricalProductionData } from "@/lib/actions";

interface ChartDataItem {
    name: string;
    üretim: number;
}

interface StatusDataItem {
    name: string;
    value: number;
    color: string;
}

interface WeeklyComparison {
    week: string;
    label: string;
    total: number;
    dailyData: { day: string; count: number }[];
}

interface DashboardChartsProps {
    chartData: ChartDataItem[];
    statusData: StatusDataItem[];
}

const periodOptions = [
    { value: 1, label: "Bu Hafta" },
    { value: 2, label: "Son 2 Hafta" },
    { value: 4, label: "Son 4 Hafta" },
    { value: 8, label: "Son 8 Hafta" },
];

export function DashboardCharts({ chartData, statusData }: DashboardChartsProps) {
    const [selectedPeriod, setSelectedPeriod] = useState(4);
    const [historicalData, setHistoricalData] = useState<WeeklyComparison[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<"weekly" | "comparison">("weekly");

    useEffect(() => {
        loadHistoricalData();
    }, [selectedPeriod]);

    const loadHistoricalData = async () => {
        setLoading(true);
        try {
            const result = await getHistoricalProductionData(selectedPeriod);
            if (result.data) {
                setHistoricalData(result.data);
            }
        } catch (e) {
            console.error("Failed to load historical data:", e);
        } finally {
            setLoading(false);
        }
    };

    // Haftalık toplam karşılaştırma verisi
    const weeklyTotals = historicalData.map(w => ({
        name: w.label,
        üretim: w.total
    }));

    // Tüm günlük verileri birleştir (son N hafta)
    const allDailyData = historicalData.flatMap(w =>
        w.dailyData.map(d => ({
            ...d,
            week: w.label
        }))
    );

    // Renk paleti
    const weekColors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

    return (
        <div className="space-y-4">
            {/* Üst Grafikler */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Bu Haftanın Grafiği */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Bu Hafta Üretim
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis
                                        dataKey="name"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'white',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                        }}
                                        formatter={(value: number) => [`${value} adet`, 'Üretim']}
                                    />
                                    <Bar
                                        dataKey="üretim"
                                        fill="#3b82f6"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Durum Dağılımı Pasta Grafiği */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChartIcon className="h-5 w-5" />
                            Ürün Durumu Dağılımı
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            {statusData.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    Henüz veri yok
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            labelLine={false}
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'white',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                            }}
                                            formatter={(value: number) => [`${value} ürün`]}
                                        />
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            formatter={(value) => <span className="text-sm">{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Geçmişe Dönük Karşılaştırma */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Geçmişe Dönük Üretim Karşılaştırması
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                {periodOptions.map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={selectedPeriod === option.value ? "default" : "ghost"}
                                        size="sm"
                                        onClick={() => setSelectedPeriod(option.value)}
                                        className="text-xs"
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : historicalData.length === 0 ? (
                        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                            Henüz geçmiş veri yok
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Haftalık Toplam Karşılaştırma */}
                            <div>
                                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Haftalık Toplam Üretim</h4>
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={weeklyTotals} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
                                            <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                width={100}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'white',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                                }}
                                                formatter={(value: number) => [`${value} adet`, 'Toplam Üretim']}
                                            />
                                            <Bar
                                                dataKey="üretim"
                                                radius={[0, 4, 4, 0]}
                                            >
                                                {weeklyTotals.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={weekColors[index % weekColors.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Haftalık Özet Kartları */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {historicalData.slice(0, 4).map((week, index) => {
                                    const prevWeek = historicalData[index + 1];
                                    const change = prevWeek ? week.total - prevWeek.total : 0;
                                    const changePercent = prevWeek && prevWeek.total > 0
                                        ? Math.round((change / prevWeek.total) * 100)
                                        : 0;

                                    return (
                                        <div
                                            key={week.week}
                                            className="p-4 rounded-lg border bg-slate-50/50"
                                        >
                                            <div className="text-xs text-muted-foreground mb-1">{week.label}</div>
                                            <div className="text-2xl font-bold">{week.total}</div>
                                            {prevWeek && (
                                                <div className={`text-xs mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {change >= 0 ? '↑' : '↓'} {Math.abs(change)} ({changePercent > 0 ? '+' : ''}{changePercent}%)
                                                </div>
                                            )}
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {week.week}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Trend Çizgi Grafiği */}
                            <div>
                                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Üretim Trendi</h4>
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={weeklyTotals.slice().reverse()}>
                                            <defs>
                                                <linearGradient id="colorUretim" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis
                                                dataKey="name"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'white',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                                }}
                                                formatter={(value: number) => [`${value} adet`, 'Üretim']}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="üretim"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                fill="url(#colorUretim)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
