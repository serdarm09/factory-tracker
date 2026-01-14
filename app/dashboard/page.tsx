import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
    const session = await auth();
    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Fabrika Paneli</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Ürün</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{products.length}</div>
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
                            {products.length > 0
                                ? Math.round((products.filter(p => p.produced > 0).length / products.length) * 100)
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
                        <CardTitle>Üretim Durumu</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {products.map(p => {
                                const percent = Math.min(100, Math.round((p.produced / p.quantity) * 100));
                                let colorClass = "bg-red-500";
                                if (p.produced > 0 && p.produced < p.quantity) colorClass = "bg-yellow-500";
                                if (p.produced >= p.quantity) colorClass = "bg-green-500";

                                return (
                                    <div key={p.id} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="font-medium text-sm w-32">{p.name}</div>
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
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
