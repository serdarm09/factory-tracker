import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function DashboardPage() {
    const session = await auth();
    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' }
    });

    const activeProducts = products.filter(p => p.status !== 'PENDING');

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Fabrika Paneli</h2>

            {/* Auto refresh for admins to see new pending approvals instantly */}
            {(session?.user as any).role === 'ADMIN' && <AutoRefresh interval={15000} />}

            {(session?.user as any).role === 'ADMIN' || (session?.user as any).role === 'VIEWER' ? (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Toplam Ürün (Aktif)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{activeProducts.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {products.filter(p => p.status === 'COMPLETED').length}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Depo Oranı</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {activeProducts.length > 0
                                        ? Math.round((activeProducts.filter(p => p.produced > 0).length / activeProducts.length) * 100)
                                        : 0}%
                                </div>
                                <p className="text-xs text-muted-foreground">Üretime giren ürünler</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Bekleyen Onay</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    {products.filter(p => p.status === 'PENDING').length}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Üretim Durumu (Sadece Onaylı)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {activeProducts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">Henüz onaylı/üretimde ürün yok.</p>
                                    ) : activeProducts.map(p => {
                                        const percent = Math.min(100, Math.round((p.produced / p.quantity) * 100));
                                        let colorClass = "bg-red-500";
                                        if (p.produced > 0 && p.produced < p.quantity) colorClass = "bg-yellow-500";
                                        if (p.produced >= p.quantity) colorClass = "bg-green-500";

                                        return (
                                            <Link href={`/dashboard/production/${p.barcode || p.systemCode}`} key={p.id} className="block hover:bg-slate-50 p-2 rounded-md transition-colors cursor-pointer group">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-medium text-sm w-32 group-hover:text-blue-600 transition-colors">{p.name}</div>
                                                    <div className="text-xs text-slate-500 w-24">{p.systemCode}</div>
                                                    <div className="flex-1 mx-4">
                                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${colorClass} transition-all duration-500`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-bold w-16 text-right">{p.produced} / {p.quantity}</div>
                                                </div>
                                            </Link>
                                        )
                                    })}
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
