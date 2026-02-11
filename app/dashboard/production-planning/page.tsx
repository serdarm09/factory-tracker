import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ProductionPlanningTable } from "@/components/production-planning-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AutoRefresh } from "@/components/auto-refresh";
import { Wrench, Package, Truck, CheckCircle } from "lucide-react";

export default async function ProductionPlanningPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    if (!["ADMIN", "PLANNER", "ENGINEER"].includes(role)) {
        redirect("/dashboard");
    }

    // Üretimdeki ve tamamlanmış ürünler (Depo Ciro ve sevk bilgileri için COMPLETED da dahil)
    const products = await prisma.product.findMany({
        where: {
            status: { in: ["IN_PRODUCTION", "COMPLETED"] }
        },
        include: {
            order: true,
            creator: {
                select: { username: true }
            },
            inventory: true,
            shipmentItems: {
                include: {
                    shipment: true
                }
            }
        },
        orderBy: [
            { status: 'asc' },
            { terminDate: 'asc' }
        ]
    });

    // Istatistikler
    const stats = {
        total: products.length,
        inProduction: products.filter(p => p.status === "IN_PRODUCTION").length,
        completed: products.filter(p => p.status === "COMPLETED").length,
        approved: products.filter(p => p.status === "APPROVED").length,
    };

    // Urunlere sevk bilgisi ekle
    const productsWithShipment = products.map(p => {
        const totalShipped = p.shipmentItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalInInventory = p.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
        return {
            ...p,
            shipped: totalShipped,
            inStock: totalInInventory,
            remaining: p.quantity - p.produced
        };
    });

    return (
        <div className="p-6 space-y-6">
            <AutoRefresh intervalMs={10000} />

            <div>
                <h1 className="text-2xl font-bold text-slate-900">Üretim</h1>
                <p className="text-slate-500">
                    {role === "PLANNER"
                        ? "Uretim sureclerini goruntuleyebilirsiniz (salt okunur)"
                        : "Uretim sureclerini takip edin ve durum guncellemesi yapin"}
                </p>
            </div>

            {/* Istatistik Kartlari */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total}</p>
                                <p className="text-xs text-muted-foreground">Toplam Urun</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-100 rounded-lg">
                                <Wrench className="h-5 w-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.inProduction}</p>
                                <p className="text-xs text-muted-foreground">Uretimde</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.completed}</p>
                                <p className="text-xs text-muted-foreground">Tamamlandi</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Truck className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.approved}</p>
                                <p className="text-xs text-muted-foreground">Sevk Bekliyor</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Ana Tablo */}
            <Card>
                <CardHeader>
                    <CardTitle>Uretim Listesi</CardTitle>
                    <CardDescription>
                        {role === "PLANNER"
                            ? "Urun durumlarini buradan goruntuleyebilirsiniz"
                            : "Urun durumlarini ve alt durumlarini buradan guncelleyebilirsiniz"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ProductionPlanningTable
                        products={productsWithShipment}
                        userRole={role}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
