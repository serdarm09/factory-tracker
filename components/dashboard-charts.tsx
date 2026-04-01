"use client";

/**
 * DashboardCharts — Analiz Grafikleri
 *
 * Dashboard ana sayfasının alt kısmına gelen analiz panö. 6 sekme:
 *   • Genel Özet     — KPI kartları + son 7 gün üretim bar chart + durum pie chart
 *   • Durum Analizi  — Sipariş durumlarının detaylı chart + tablo
 *   • Cariler         — Müşteri bazlı sipariş/hacim analizi
 *   • Ürünler         — En çok sipariş edilen ürün modelleri
 *   • Kumaşlar        — Renk/kumaş tipi dağılımı
 *   • Bölümler        — Usta/ateli bazında üretim dağılımı
 *
 * dashboardData: app/dashboard/page.tsx'deki hesaplamadan geliyor.
 * Yapı : { general, durum_detayli, cari_sayisi, cari_miktar, cari_tamamlanma,
 *           urun_sayisi, urun_miktar, kumaş_sayisi, kumaş_miktar,
 *           bolum_sayisi, bolum_miktar }
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    Legend
} from "recharts";
import { BarChart3, PieChart as PieChartIcon, Package, Hash, Users, Activity, Layers, Palette, Factory } from "lucide-react";

interface ChartDataItem {
    name: string;
    üretim: number;
}

interface StatusDataItem {
    name: string;
    value: number;
    color: string;
}

interface DashboardChartsProps {
    chartData: ChartDataItem[];
    statusData: StatusDataItem[];
    dashboardData?: any;
}

export function DashboardCharts({ chartData, statusData, dashboardData }: DashboardChartsProps) {

    // Alt sekmeler (View Toggle)
    const [cariView, setCariView] = useState<'sayisi' | 'miktar'>('sayisi');
    const [urunView, setUrunView] = useState<'sayisi' | 'miktar'>('sayisi');
    const [kumasView, setKumasView] = useState<'sayisi' | 'miktar'>('sayisi');
    const [bolumView, setBolumView] = useState<'sayisi' | 'miktar'>('sayisi');

    // renk paleti — bar/pie chart'lar için sıralı renk dizileri
    const weekColors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
    const donutColors = ['#10b981', '#f43f5e', '#eab308', '#06b6d4', '#8b5cf6', '#3b82f6', '#f97316', '#64748b'];

    // kısaltma — dashboardData'ya kısa referans (aşağıda d kullanılır)
    const d = dashboardData;

    if (!dashboardData) {
        return <div className="text-center p-10 text-muted-foreground">Analiz verileri yüklenemedi.</div>;
    }

    /**
     * renderGenericTable — Genel amaçlı analiz tablosu render yardımcısı.
     * @param dataArray — satır verisi (object array)
     * @param columns   — gösterilecek sütun anahtar adları (ilk 4 sütun)
     * @param valueLabel — (kullanılmıyor, ileride genişletmek için)
     * YÜZDE sütunu otomatik olarak "%X.X" formatında gösterilir.
     */
    const renderGenericTable = (dataArray: any[], columns: string[], valueLabel: string) => {
        return (
            <div className="rounded-md border mt-4 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[80px]">SIRA</TableHead>
                            <TableHead>{columns[0]}</TableHead>
                            <TableHead className="text-right">{columns[1]}</TableHead>
                            {columns[2] && <TableHead className="text-right">{columns[2]}</TableHead>}
                            {columns[3] && <TableHead className="text-right">{columns[3]}</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dataArray.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Kayıt Bulunamadı</TableCell></TableRow>
                        ) : dataArray.map((row, idx) => (
                            <TableRow key={idx}>
                                <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell className="font-semibold">{row[columns[0]]}</TableCell>
                                <TableCell className="text-right">{row[columns[1]]?.toLocaleString('tr-TR')} {columns[1] === 'SİPARİŞ SAYISI' ? 'Adet' : ''}</TableCell>
                                {columns[2] && (
                                    <TableCell className="text-right">
                                        {typeof row[columns[2]] === 'number' && columns[2] === 'YÜZDE'
                                            ? `%${row[columns[2]].toFixed(1)}`
                                            : row[columns[2]]?.toLocaleString('tr-TR')}
                                    </TableCell>
                                )}
                                {columns[3] && (
                                    <TableCell className="text-right">
                                        {typeof row[columns[3]] === 'number' && columns[3] === 'YÜZDE'
                                            ? `%${row[columns[3]].toFixed(1)}`
                                            : row[columns[3]]?.toLocaleString('tr-TR')}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <Tabs defaultValue="genel" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <TabsList className="bg-slate-100 flex-wrap h-auto">
                    <TabsTrigger value="genel" className="flex gap-2 py-2"><Activity className="w-4 h-4" /> Genel Özet</TabsTrigger>
                    <TabsTrigger value="durum" className="flex gap-2 py-2"><PieChartIcon className="w-4 h-4" /> Durum Analizi</TabsTrigger>
                    <TabsTrigger value="cariler" className="flex gap-2 py-2"><Users className="w-4 h-4" /> Cariler</TabsTrigger>
                    <TabsTrigger value="urunler" className="flex gap-2 py-2"><Package className="w-4 h-4" /> Ürünler</TabsTrigger>
                    <TabsTrigger value="kumaslar" className="flex gap-2 py-2"><Palette className="w-4 h-4" /> Kumaşlar</TabsTrigger>
                    <TabsTrigger value="bolumler" className="flex gap-2 py-2"><Factory className="w-4 h-4" /> Bölümler</TabsTrigger>
                </TabsList>
            </div>

            {/* TAB: Genel Özet */}
            <TabsContent value="genel" className="space-y-4 animate-in fade-in duration-500">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center">
                        <Hash className="w-5 h-5 text-indigo-500 mb-2" />
                        <span className="text-2xl font-bold">{d.general.toplam_siparis}</span>
                        <span className="text-xs text-muted-foreground mt-1">Sipariş Sayısı</span>
                    </div>
                    <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center">
                        <Package className="w-5 h-5 text-blue-500 mb-2" />
                        <span className="text-2xl font-bold">{d.general.toplam_miktar}</span>
                        <span className="text-xs text-muted-foreground mt-1">Toplam Ürün (Adet)</span>
                    </div>
                    <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center">
                        <Activity className="w-5 h-5 text-green-500 mb-2" />
                        <span className="text-2xl font-bold">{d.general.ort_miktar}</span>
                        <span className="text-xs text-muted-foreground mt-1">Ort. Sipariş Hacmi</span>
                    </div>
                    <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center">
                        <Users className="w-5 h-5 text-orange-500 mb-2" />
                        <span className="text-2xl font-bold">{d.general.farkli_cariler}</span>
                        <span className="text-xs text-muted-foreground mt-1">Farklı Cari</span>
                    </div>
                    <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center">
                        <Layers className="w-5 h-5 text-pink-500 mb-2" />
                        <span className="text-2xl font-bold">{d.general.farkli_urunler}</span>
                        <span className="text-xs text-muted-foreground mt-1">Ürün Çeşidi</span>
                    </div>
                    <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center">
                        <Palette className="w-5 h-5 text-purple-500 mb-2" />
                        <span className="text-2xl font-bold">{d.general.farkli_kumaslar}</span>
                        <span className="text-xs text-muted-foreground mt-1">Kumaş Rengi</span>
                    </div>
                    <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center">
                        <Factory className="w-5 h-5 text-slate-500 mb-2" />
                        <span className="text-2xl font-bold">{d.general.farkli_bolumler}</span>
                        <span className="text-xs text-muted-foreground mt-1">Dahili Bölüm</span>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2 mt-4">
                    {/* Bu Haftanın Grafiği */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Son 7 Gün Üretim Hacmi
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px' }} formatter={(value: number) => [`${value} adet`, 'Üretim']} />
                                        <Bar dataKey="üretim" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Durum Dağılımı (Pie from previous page logic) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChartIcon className="h-5 w-5" />
                                İş Emirleri Durum Dağılımı
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px]">
                                {statusData.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">Henüz veri yok</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={statusData}
                                                cx="50%" cy="50%"
                                                innerRadius={50} outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                labelLine={false}
                                            >
                                                {statusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '8px' }} formatter={(value: number) => [`${value} ürün`]} />
                                            <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-sm">{value}</span>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            {/* TAB: Durum Analizi (Yeni Template'den Gelen Detaylı Versiyon) */}
            <TabsContent value="durum" className="space-y-4 animate-in fade-in duration-500">
                <div className="grid lg:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Genel Durum Dağılımı (Detaylı)</CardTitle>
                            <CardDescription>Sipariş adetleri üzerinden durumların tam dağılımı</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={d.durum_detayli} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="DURUM" type="category" width={140} fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                                        <Bar dataKey="SİPARİŞ SAYISI" radius={[0, 4, 4, 0]}>
                                            {d.durum_detayli.map((_: any, i: number) => <Cell key={i} fill={donutColors[i % donutColors.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Durum Temelli İstatistikler</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderGenericTable(d.durum_detayli, ['DURUM', 'SİPARİŞ SAYISI', 'ÜRÜN ADETİ', 'YÜZDE'], 'Durum')}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Cari Bazlı Tamamlanma/Sevk Oranları (Top 10)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {renderGenericTable(d.cari_tamamlanma, ['CARİ', 'TOPLAM_SİPARİŞ', 'TAMAMLANDI', 'SEVK_EDİLDİ'], 'Cari')}
                    </CardContent>
                </Card>
            </TabsContent>

            {/* TAB: Cariler */}
            <TabsContent value="cariler" className="space-y-4 animate-in fade-in duration-500">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Cariler Analizi</CardTitle>
                            <CardDescription>En çok işlem yapılan cariler (Müşteriler)</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant={cariView === 'sayisi' ? 'default' : 'outline'} size="sm" onClick={() => setCariView('sayisi')}>Sayıya Göre</Button>
                            <Button variant={cariView === 'miktar' ? 'default' : 'outline'} size="sm" onClick={() => setCariView('miktar')}>Hacme Göre</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {cariView === 'sayisi'
                            ? renderGenericTable(d.cari_sayisi, ['CARİ', 'SİPARİŞ SAYISI', 'YÜZDE', ''], 'Cari')
                            : renderGenericTable(d.cari_miktar, ['CARİ', 'ÜRÜN ADETİ', 'ORT_MİKTAR', 'YÜZDE'], 'Cari')
                        }
                    </CardContent>
                </Card>
            </TabsContent>

            {/* TAB: Ürünler */}
            <TabsContent value="urunler" className="space-y-4 animate-in fade-in duration-500">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Ürün Modelleri Analizi</CardTitle>
                            <CardDescription>En çok sipariş edilen ürün çeşitleri</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant={urunView === 'sayisi' ? 'default' : 'outline'} size="sm" onClick={() => setUrunView('sayisi')}>Sayıya Göre</Button>
                            <Button variant={urunView === 'miktar' ? 'default' : 'outline'} size="sm" onClick={() => setUrunView('miktar')}>Hacme Göre</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={urunView === 'sayisi' ? d.urun_sayisi : d.urun_miktar}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="ÜRÜN ADI" fontSize={11} tickLine={false} axisLine={false} tick={{ width: 80 }} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                                    <Bar dataKey={urunView === 'sayisi' ? 'SİPARİŞ SAYISI' : 'ÜRÜN ADETİ'} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {urunView === 'sayisi'
                            ? renderGenericTable(d.urun_sayisi, ['ÜRÜN ADI', 'SİPARİŞ SAYISI', 'YÜZDE', ''], 'Ürün')
                            : renderGenericTable(d.urun_miktar, ['ÜRÜN ADI', 'ÜRÜN ADETİ', 'ORT_MİKTAR', 'YÜZDE'], 'Ürün')
                        }
                    </CardContent>
                </Card>
            </TabsContent>

            {/* TAB: Kumaşlar */}
            <TabsContent value="kumaslar" className="space-y-4 animate-in fade-in duration-500">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Kumaş ve Renk Analizi</CardTitle>
                            <CardDescription>Siparişlerde tercih edilen kumaş tipleri</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant={kumasView === 'sayisi' ? 'default' : 'outline'} size="sm" onClick={() => setKumasView('sayisi')}>Sayıya Göre</Button>
                            <Button variant={kumasView === 'miktar' ? 'default' : 'outline'} size="sm" onClick={() => setKumasView('miktar')}>Hacme Göre</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {kumasView === 'sayisi'
                            ? renderGenericTable(d.kumaş_sayisi, ['KUMAŞ ADI', 'SİPARİŞ SAYISI', 'YÜZDE', ''], 'Kumaş')
                            : renderGenericTable(d.kumaş_miktar, ['KUMAŞ ADI', 'ÜRÜN ADETİ', 'ORT_MİKTAR', 'YÜZDE'], 'Kumaş')
                        }
                    </CardContent>
                </Card>
            </TabsContent>

            {/* TAB: Bölümler */}
            <TabsContent value="bolumler" className="space-y-4 animate-in fade-in duration-500">
                <div className="grid lg:grid-cols-[1fr_300px] gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Bölüm / Usta Dağılımı</CardTitle>
                                <CardDescription>Üretim görevlerinin atölye/bölümlere dağılım oranı</CardDescription>
                            </div>
                            <div className="flex gap-2 hidden sm:flex">
                                <Button variant={bolumView === 'sayisi' ? 'default' : 'outline'} size="sm" onClick={() => setBolumView('sayisi')}>Sayı</Button>
                                <Button variant={bolumView === 'miktar' ? 'default' : 'outline'} size="sm" onClick={() => setBolumView('miktar')}>Hacim</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2 sm:hidden mb-4">
                                <Button className="flex-1" variant={bolumView === 'sayisi' ? 'default' : 'outline'} size="sm" onClick={() => setBolumView('sayisi')}>Sayı</Button>
                                <Button className="flex-1" variant={bolumView === 'miktar' ? 'default' : 'outline'} size="sm" onClick={() => setBolumView('miktar')}>Hacim</Button>
                            </div>
                            {bolumView === 'sayisi'
                                ? renderGenericTable(d.bolum_sayisi, ['BÖLÜM', 'SİPARİŞ SAYISI', 'YÜZDE', ''], 'Bölüm')
                                : renderGenericTable(d.bolum_miktar, ['BÖLÜM', 'ÜRÜN ADETİ', 'ORT_MİKTAR', 'YÜZDE'], 'Bölüm')
                            }
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Genel Bölüm Dağılımı</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={bolumView === 'sayisi' ? d.bolum_sayisi : d.bolum_miktar}
                                            cx="50%" cy="50%"
                                            innerRadius={40} outerRadius={80}
                                            paddingAngle={2}
                                            dataKey={bolumView === 'sayisi' ? 'SİPARİŞ SAYISI' : 'ÜRÜN ADETİ'}
                                            nameKey="BÖLÜM"
                                            labelLine={false}
                                        >
                                            {(bolumView === 'sayisi' ? d.bolum_sayisi : d.bolum_miktar).map((_: any, i: number) => (
                                                <Cell key={i} fill={donutColors[i % donutColors.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

        </Tabs>
    );
}
