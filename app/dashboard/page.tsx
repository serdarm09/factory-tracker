import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { DashboardCharts } from "@/components/dashboard-charts";
import { WeeklyTrendChart } from "@/components/weekly-trend-chart";
import {
    Package,
    CheckCircle2,
    Clock,
    AlertTriangle,
    TrendingUp,
    Boxes,
    Truck,
    Users
} from "lucide-react";

export default async function DashboardPage() {
    const session = await auth();

    // KALİTE rolü sadece üretim planlama sayfasını görebilir.
    // Ana ekrana girmeye çalışırsa yönlendir.
    if ((session?.user as any)?.role === "KALITE") {
        redirect("/dashboard/production-planning");
    }

    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            order: true,
            logs: {
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { user: true }
            }
        }
    });

    // İstatistikler
    const activeProducts = products.filter(p => p.status !== 'PENDING' && p.status !== 'REJECTED');
    const pendingProducts = products.filter(p => p.status === 'PENDING');
    const completedProducts = products.filter(p => p.status === 'COMPLETED');
    const inProductionProducts = products.filter(p => p.status === 'IN_PRODUCTION' || p.status === 'APPROVED');

    // Toplam üretim miktarları
    const totalPlanned = activeProducts.reduce((sum, p) => sum + p.quantity, 0);
    const totalProduced = activeProducts.reduce((sum, p) => sum + p.produced, 0);
    const overallProgress = totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 100) : 0;

    // Siparişler
    const orders = await prisma.order.findMany({
        include: { products: true }
    });
    const activeOrders = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

    // Envanter
    const inventory = await prisma.inventory.findMany({
        include: { product: true }
    });
    const totalInventory = inventory.reduce((sum, i) => sum + i.quantity, 0);

    // Son üretim logları
    const recentLogs = await prisma.productionLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
            product: true,
            user: true
        }
    });

    // Geciken ürünler (termin tarihi geçmiş, tamamlanmamış)
    const overdueProducts = products.filter(p => {
        if (p.status === 'COMPLETED' || p.status === 'PENDING') return false;
        if (!p.terminDate) return false;
        return new Date(p.terminDate) < new Date(new Date().setHours(0, 0, 0, 0));
    });

    // Bu hafta tamamlanan
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const completedThisWeek = products.filter(p => {
        if (p.status !== 'COMPLETED') return false;
        // Use the most recent production log's createdAt if available, otherwise use product createdAt
        const lastLog = p.logs[0]; // logs are ordered by createdAt desc
        const completedDate = lastLog ? new Date(lastLog.createdAt) : new Date(p.createdAt);
        return completedDate >= weekStart;
    });

    // Sevk edilen ürünler
    const shippedProducts = products.filter(p => (p.shippedQty || 0) > 0);

    // Haftalık üretim verileri (son 7 gün)
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyLogs = await prisma.productionLog.findMany({
        where: {
            createdAt: { gte: weekAgo }
        },
        orderBy: { createdAt: 'asc' }
    });

    // Günlük üretim grafiği için veri hazırla
    const dailyProduction: { [key: string]: number } = {};
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dayName = days[date.getDay()];
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
        dailyProduction[`${dayName} ${dateStr}`] = 0;
    }

    weeklyLogs.forEach(log => {
        const date = new Date(log.createdAt);
        const dayName = days[date.getDay()];
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
        const key = `${dayName} ${dateStr}`;
        if (dailyProduction[key] !== undefined) {
            dailyProduction[key] += log.quantity;
        }
    });

    const chartData = Object.entries(dailyProduction).map(([name, value]) => ({
        name,
        üretim: value
    }));

    // Durum dağılımı için pasta grafik verisi (Özet PieChart)
    let onaylananCount = 0;
    let uretimdeCount = 0;
    let depoCount = 0;
    let sevkCount = 0;

    activeProducts.forEach(p => {
        if (p.status !== 'CANCELLED' && p.status !== 'REJECTED') {
            const shipped = p.shippedQty || 0;
            const stored = p.storedQty || 0;
            const depoNet = stored - shipped;
            const inProdNet = (p.produced || 0) - stored;

            if (shipped > 0) sevkCount++;
            if (depoNet > 0) depoCount++;
            if (p.status === 'IN_PRODUCTION' || inProdNet > 0) uretimdeCount++;
            if (p.status === 'APPROVED' && (p.produced || 0) === 0) onaylananCount++;
        }
    });

    const statusData = [
        { name: 'Depodaki', value: depoCount, color: '#8b5cf6' },
        { name: 'Sevk Edilen', value: sevkCount, color: '#06b6d4' },
        { name: 'Üretimde', value: uretimdeCount, color: '#3b82f6' },
        { name: 'Onaylanıp Bekleyen', value: onaylananCount, color: '#f59e0b' },
    ].filter(d => d.value > 0);

    // --- DASHBOARD ANALYTICS DATA ---
    const companyTotals: Record<string, { count: number, value: number, completed: number, shipped: number }> = {};
    const productTotals: Record<string, { count: number, value: number }> = {};
    const fabricTotals: Record<string, { count: number, value: number }> = {};
    const masterTotals: Record<string, { count: number, value: number }> = {};
    const durumTotals: Record<string, { count: number, value: number }> = {};

    activeProducts.forEach(p => {
        // Durum (ÜRETİM BEKLEYEN, ÜRETİMDE, DEPODAKİ, SEVK EDİLEN, ONAYLANAN, İPTAL)
        const st = p.status;
        let isDepo = false;
        let isSevk = false;
        let isUretimBekleyen = false;
        let isOnaylanan = false;
        let isUretimde = false;

        if (st === 'CANCELLED' || st === 'REJECTED') {
            // İptaller listeye katılmasın diye atlayabiliriz ya da İPTAL diyebiliriz
        } else {
            // Sevk edilen miktar varsa ayrı bir sayaçta değerlendirelim
            const shipped = p.shippedQty || 0;
            const stored = p.storedQty || 0;
            const planned = p.quantity || 0;

            // 1. Sevk Edildi durumu
            if (shipped > 0) {
                isSevk = true;
                if (!durumTotals['SEVK EDİLDİ']) durumTotals['SEVK EDİLDİ'] = { count: 0, value: 0 };
                durumTotals['SEVK EDİLDİ'].count++; // 1 sipariş kısmı sevk
                durumTotals['SEVK EDİLDİ'].value += shipped;
            }

            // 2. Depodaki durumu (storedQty - shippedQty > 0)
            const depoNet = stored - shipped;
            if (depoNet > 0) {
                isDepo = true;
                if (!durumTotals['DEPODAKİ']) durumTotals['DEPODAKİ'] = { count: 0, value: 0 };
                durumTotals['DEPODAKİ'].count++;
                durumTotals['DEPODAKİ'].value += depoNet;
            }

            // 3. Üretimde ve Henüz Depoya Girmemiş (produced - stored)
            const inProdNet = (p.produced || 0) - stored;
            // Eğer status IN_PRODUCTION ise veya üretilmiş ama depoya düşmemişse
            if (st === 'IN_PRODUCTION' || inProdNet > 0) {
                isUretimde = true;
                if (!durumTotals['ÜRETİMDE']) durumTotals['ÜRETİMDE'] = { count: 0, value: 0 };
                durumTotals['ÜRETİMDE'].count++;
                // Eğer doğrudan inProdNet > 0 ise hesaba kat, değilse tamamını
                durumTotals['ÜRETİMDE'].value += inProdNet > 0 ? inProdNet : planned;
            }

            // 4. Onaylanıp Bekleyen (Sadece APPROVED ve üretim yoksa)
            if (st === 'APPROVED' && (p.produced || 0) === 0) {
                isOnaylanan = true;
                if (!durumTotals['ONAYLANAN']) durumTotals['ONAYLANAN'] = { count: 0, value: 0 };
                durumTotals['ONAYLANAN'].count++;
                durumTotals['ONAYLANAN'].value += planned;
            }

            // 5. Üretim Bekleyen (PENDING)
            if (st === 'PENDING') {
                isUretimBekleyen = true;
                if (!durumTotals['ÜRETİM BEKLEYEN']) durumTotals['ÜRETİM BEKLEYEN'] = { count: 0, value: 0 };
                durumTotals['ÜRETİM BEKLEYEN'].count++;
                durumTotals['ÜRETİM BEKLEYEN'].value += planned;
            }
        }

        // Ürün Adı, Kumaş, Bölüm (Tümü için geçerli, iptaller hariç)
        if (st !== 'CANCELLED' && st !== 'REJECTED') {
            if (!productTotals[p.name]) productTotals[p.name] = { count: 0, value: 0 };
            productTotals[p.name].count++;
            productTotals[p.name].value += p.quantity;

            if (p.dstAdi && p.dstAdi.trim() !== '' && p.dstAdi !== 'Belirtilmemiş') {
                const fabric = p.dstAdi;
                if (!fabricTotals[fabric]) fabricTotals[fabric] = { count: 0, value: 0 };
                fabricTotals[fabric].count++;
                fabricTotals[fabric].value += p.quantity;
            }

            if (p.master && p.master.trim() !== '' && p.master !== 'Belirtilmemiş') {
                const master = p.master;
                if (!masterTotals[master]) masterTotals[master] = { count: 0, value: 0 };
                masterTotals[master].count++;
                masterTotals[master].value += p.quantity;
            }
        }
    });

    // Company from orders (some products might not have an order, but we can iterate orders)
    orders.forEach(o => {
        const company = o.company || 'Belirtilmemiş';
        if (!companyTotals[company]) companyTotals[company] = { count: 0, value: 0, completed: 0, shipped: 0 };

        o.products.forEach(p => {
            companyTotals[company].count++;
            companyTotals[company].value += p.quantity;
            if (p.status === 'COMPLETED') companyTotals[company].completed++;
            if ((p.shippedQty || 0) > 0) companyTotals[company].shipped++;
        });
    });

    const activeProductCount = activeProducts.length;

    // Sorters
    const sortByCount = (a: any, b: any) => b.count - a.count;
    const sortByValue = (a: any, b: any) => b.value - a.value;

    const cariListesi = Object.entries(companyTotals).map(([k, v]) => ({ name: k, ...v }));
    const productListesi = Object.entries(productTotals).map(([k, v]) => ({ name: k, ...v }));
    const fabricListesi = Object.entries(fabricTotals).map(([k, v]) => ({ name: k, ...v }));
    const masterListesi = Object.entries(masterTotals).map(([k, v]) => ({ name: k, ...v }));
    const durumListesi = Object.entries(durumTotals).map(([k, v]) => ({ name: k, ...v }));

    const getTop10Count = (arr: any[], keyName: string) => arr.sort(sortByCount).slice(0, 10).map(i => ({
        [keyName]: i.name,
        'SİPARİŞ SAYISI': i.count,
        'YÜZDE': activeProductCount > 0 ? (i.count / activeProductCount) * 100 : 0
    }));

    const getTop10Value = (arr: any[], keyName: string) => arr.sort(sortByValue).slice(0, 10).map(i => ({
        [keyName]: i.name,
        'ÜRÜN ADETİ': i.value,
        'SİPARİŞ_SAYISI': i.count,
        'ORT_MİKTAR': i.count > 0 ? (i.value / i.count) : 0,
        'YÜZDE': totalPlanned > 0 ? (i.value / totalPlanned) * 100 : 0
    }));

    const durumFormatted: Record<string, number> = {};
    durumListesi.forEach(d => durumFormatted[d.name] = d.count);

    const dashboardData = {
        general: {
            toplam_siparis: orders.length,
            toplam_miktar: totalPlanned,
            ort_miktar: orders.length > 0 ? (totalPlanned / orders.length).toFixed(1) : 0,
            farkli_cariler: Object.keys(companyTotals).length,
            farkli_urunler: Object.keys(productTotals).length,
            farkli_kumaslar: Object.keys(fabricTotals).length,
            farkli_bolumler: Object.keys(masterTotals).length
        },
        durum_detayli: durumListesi.sort(sortByCount).map((d) => ({
            'DURUM': d.name,
            'SİPARİŞ SAYISI': d.count,
            'YÜZDE': activeProductCount > 0 ? (d.count / activeProductCount) * 100 : 0,
            'ÜRÜN ADETİ': d.value,
            'ORT_MİKTAR': d.count > 0 ? (d.value / d.count) : 0
        })),
        cari_tamamlanma: cariListesi.sort(sortByCount).slice(0, 10).map(c => ({
            'CARİ': c.name,
            'TOPLAM_SİPARİŞ': c.count,
            'TAMAMLANDI': c.completed,
            'SEVK_EDİLDİ': c.shipped,
            'TAMAMLANMA_ORANI': c.count > 0 ? ((c.completed + c.shipped) / c.count) * 100 : 0
        })),
        cari_sayisi: getTop10Count(cariListesi, 'CARİ'),
        cari_miktar: getTop10Value(cariListesi, 'CARİ'),
        urun_sayisi: getTop10Count(productListesi, 'ÜRÜN ADI'),
        urun_miktar: getTop10Value(productListesi, 'ÜRÜN ADI'),
        kumaş_sayisi: getTop10Count(fabricListesi, 'KUMAŞ ADI'),
        kumaş_miktar: getTop10Value(fabricListesi, 'KUMAŞ ADI'),
        bolum_sayisi: getTop10Count(masterListesi, 'BÖLÜM'),
        bolum_miktar: getTop10Value(masterListesi, 'BÖLÜM'),
        durum: durumFormatted
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Fabrika Paneli</h2>
                <div className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString('tr-TR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </div>
            </div>

            {/* Auto refresh for admins */}
            {(session?.user as any).role === 'ADMIN' && <AutoRefresh intervalMs={15000} />}

            {(session?.user as any).role === 'ADMIN' || (session?.user as any).role === 'VIEWER' ? (
                <>
                    {/* Ana İstatistik Kartları */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium opacity-90">Toplam Ürün</CardTitle>
                                <Package className="h-5 w-5 opacity-80" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{activeProducts.length}</div>
                                <p className="text-xs opacity-80 mt-1">Aktif üretilecek ürünler</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium opacity-90">Depodaki</CardTitle>
                                <CheckCircle2 className="h-5 w-5 opacity-80" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{depoCount}</div>
                                <p className="text-xs opacity-80 mt-1">Depodaki ürünler</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium opacity-90">Bekleyen Onay</CardTitle>
                                <Clock className="h-5 w-5 opacity-80" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{pendingProducts.length}</div>
                                <p className="text-xs opacity-80 mt-1">Onay bekliyor</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* İkinci Satır - Ek İstatistikler */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Aktif Siparişler</CardTitle>
                                <Truck className="h-5 w-5 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{activeOrders.length}</div>
                                <p className="text-xs text-muted-foreground">Toplam {orders.length} sipariş</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Depodaki Stok</CardTitle>
                                <Boxes className="h-5 w-5 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalInventory}</div>
                                <p className="text-xs text-muted-foreground">Toplam adet</p>
                            </CardContent>
                        </Card>

                        <Link href="/dashboard/shipment">
                            <Card className="border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Sevk Edilen</CardTitle>
                                    <Truck className="h-5 w-5 text-teal-600" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-teal-700">{shippedProducts.length}</div>
                                    <p className="text-xs text-teal-600">Toplam sevk</p>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>

                    {/* Grafikler */}
                    <DashboardCharts chartData={chartData} statusData={statusData} dashboardData={dashboardData} />

                    {/* Alt Kısım - Üretim Durumu ve Son Aktiviteler */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {/* Haftalık Üretim Trendi */}
                        <WeeklyTrendChart />

                        {/* Son Aktiviteler */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Son Üretim Aktiviteleri
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                    {recentLogs.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Henüz üretim kaydı yok.
                                        </p>
                                    ) : recentLogs.map(log => (
                                        <div
                                            key={log.id}
                                            className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50/50"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                <Package className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {log.product.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {log.user.username} • {log.quantity} adet
                                                    {log.shelf && ` • Raf: ${log.shelf}`}
                                                </p>
                                            </div>
                                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString('tr-TR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            ) : (
                <div className="text-slate-500">
                    Hoşgeldiniz, {(session?.user as any).username}. Sol menüden işlemlerinizi yapabilirsiniz.
                </div>
            )}
        </div>
    );
}
