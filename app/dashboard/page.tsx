import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { DashboardCharts } from "@/components/dashboard-charts";
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

    // Durum dağılımı için pasta grafik verisi
    const statusData = [
        { name: 'Bekleyen', value: pendingProducts.length, color: '#f59e0b' },
        { name: 'Üretimde', value: inProductionProducts.length, color: '#3b82f6' },
        { name: 'Tamamlanan', value: completedProducts.length, color: '#22c55e' },
    ].filter(d => d.value > 0);

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
                                <CardTitle className="text-sm font-medium opacity-90">Tamamlanan</CardTitle>
                                <CheckCircle2 className="h-5 w-5 opacity-80" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{completedProducts.length}</div>
                                <p className="text-xs opacity-80 mt-1">Bitmiş ürünler</p>
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

                        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium opacity-90">Genel İlerleme</CardTitle>
                                <TrendingUp className="h-5 w-5 opacity-80" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">%{overallProgress}</div>
                                <div className="mt-2 h-2 bg-white/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-white transition-all duration-500"
                                        style={{ width: `${overallProgress}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* İkinci Satır - Ek İstatistikler */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

                        <Card className={overdueProducts.length > 0 ? "border-red-200 bg-red-50" : ""}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Geciken</CardTitle>
                                <AlertTriangle className={`h-5 w-5 ${overdueProducts.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${overdueProducts.length > 0 ? "text-red-600" : ""}`}>
                                    {overdueProducts.length}
                                </div>
                                <p className="text-xs text-muted-foreground">Termin tarihi geçmiş</p>
                            </CardContent>
                        </Card>

                        <Card className="border-green-200 bg-green-50">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Bu Hafta</CardTitle>
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{completedThisWeek.length}</div>
                                <p className="text-xs text-muted-foreground">Tamamlanan ürün</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Grafikler */}
                    <DashboardCharts chartData={chartData} statusData={statusData} />

                    {/* Alt Kısım - Üretim Durumu ve Son Aktiviteler */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {/* Üretim Durumu */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Üretim Durumu
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                                    {activeProducts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Henüz aktif ürün yok.
                                        </p>
                                    ) : activeProducts.slice(0, 10).map(p => {
                                        const percent = Math.min(100, Math.round((p.produced / p.quantity) * 100));
                                        let colorClass = "bg-red-500";
                                        let bgClass = "bg-red-100";
                                        if (p.produced > 0 && p.produced < p.quantity) {
                                            colorClass = "bg-amber-500";
                                            bgClass = "bg-amber-100";
                                        }
                                        if (p.produced >= p.quantity) {
                                            colorClass = "bg-green-500";
                                            bgClass = "bg-green-100";
                                        }

                                        return (
                                            <Link
                                                href={`/dashboard/production/${p.barcode || p.systemCode}`}
                                                key={p.id}
                                                className="block hover:bg-slate-50 p-3 rounded-lg transition-colors cursor-pointer border"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="font-medium text-sm truncate max-w-[150px]">
                                                        {p.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500">{p.systemCode}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <div className={`h-2 w-full ${bgClass} rounded-full overflow-hidden`}>
                                                            <div
                                                                className={`h-full ${colorClass} transition-all duration-500`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-semibold min-w-[80px] text-right">
                                                        {p.produced} / {p.quantity}
                                                    </div>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>

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
