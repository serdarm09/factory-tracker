"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { getHistoricalShipmentData } from "@/lib/actions";

interface WeeklyComparison {
    week: string;
    label: string;
    total: number;
    dailyData: { day: string; count: number }[];
}

const periodOptions = [
    { value: 1, label: "Bu Hafta" },
    { value: 2, label: "Son 2 Hafta" },
    { value: 4, label: "Son 4 Hafta" },
    { value: 8, label: "Son 8 Hafta" },
];

export function WeeklyTrendChart() {
    const [selectedPeriod, setSelectedPeriod] = useState(4);
    const [historicalData, setHistoricalData] = useState<WeeklyComparison[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadHistoricalData();
    }, [selectedPeriod]);

    const loadHistoricalData = async () => {
        setLoading(true);
        try {
            const result = await getHistoricalShipmentData(selectedPeriod);
            if (result.data) {
                setHistoricalData(result.data);
            }
        } catch (e) {
            console.error("Failed to load historical data:", e);
        } finally {
            setLoading(false);
        }
    };

    let chartDataToRender: any[] = [];
    if (historicalData.length > 0) {
        if (selectedPeriod === 1) {
            // Sadece bu hafta seçiliyse günlük dağılımı gösterelim (Trend daha anlamlı olur)
            chartDataToRender = historicalData[0].dailyData.map(d => ({
                name: d.day,
                sevkiyat: d.count
            }));
        } else {
            // Birden fazla hafta seçiliyse haftalık toplamları gösterelim
            chartDataToRender = historicalData.map(w => ({
                name: w.label,
                sevkiyat: w.total
            })).slice().reverse();
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Haftalık Tarihsel Sevkiyat Trendi
                        </CardTitle>
                        <CardDescription>
                            {selectedPeriod === 1 ? "Bu haftanın günlük sevkiyat dağılımı" : "Haftalık toplam sevkiyat hacmi trendi"}
                        </CardDescription>
                    </div>
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
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="h-[300px] flex justify-center items-center">Yükleniyor...</div>
                ) : historicalData.length === 0 ? (
                    <div className="h-[300px] flex justify-center items-center">Geçmiş Veri Yok</div>
                ) : (
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartDataToRender}>
                                <defs>
                                    <linearGradient id="colorUretimWeekly" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [`${value} adet`, 'Sevkiyat']} />
                                <Area type="monotone" dataKey="sevkiyat" stroke="#10b981" strokeWidth={3} fill="url(#colorUretimWeekly)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
