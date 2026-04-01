import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";
import { ProductionPlanningTable } from "@/components/production-planning-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AutoRefresh } from "@/components/auto-refresh";
import { Wrench, Package, Truck, CheckCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProductionPlanningPage() {
    noStore();
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    if (!["ADMIN", "PLANNER", "KALITE"].includes(role)) {
        redirect("/dashboard");
    }

    // Sadece üretime gönderilmiş ürünler (IN_PRODUCTION ve COMPLETED)
    // APPROVED = henüz üretime gönderilmedi, bu sayfada gözükmez
    // Manuel eklenen yarı mamül ürünleri (MANUAL-) hariç tut
    const products = await prisma.product.findMany({
        where: {
            status: { in: ["IN_PRODUCTION", "COMPLETED"] },
            NOT: {
                sku: {
                    startsWith: "MANUAL-"
                }
            }
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
    };

    // Ürünlere sevk ve stok bilgisi ekle
    // Depoya alınmış veya sevk edilmiş ise (toplam adet karşılanmışsa) listeden çıkar
    const productsWithShipment = products.map(p => {
        const totalShipped = Math.max(
            p.shippedQty || 0,
            p.shipmentItems.reduce((sum, item) => sum + item.quantity, 0)
        );
        const totalInInventory = Math.max(
            p.storedQty || 0,
            p.inventory.reduce((sum, inv) => sum + inv.quantity, 0)
        );
        return {
            ...p,
            shipped: totalShipped,
            inStock: totalInInventory,
            remaining: p.quantity - (p.produced || 0)
        };
    }).filter(p => {
        // Tüm adeti depoya alınmış + sevk edilmişse gizle
        if ((p.inStock + p.shipped) >= p.quantity) return false;
        if (p.status === 'SHIPPED') return false;
        return true;
    });

    return (
        <div className="p-6 space-y-6">
            <AutoRefresh intervalMs={10000} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Üretim</h1>
                    <p className="text-slate-500">
                        {role === "PLANNER"
                            ? "Uretim sureclerini goruntuleyebilirsiniz (salt okunur)"
                            : "Uretim sureclerini takip edin ve durum guncellemesi yapin"}
                    </p>
                </div>
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
                        userId={parseInt((session.user as any).id)}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
