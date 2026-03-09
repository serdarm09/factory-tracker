import prisma from "@/lib/prisma";
import { WarehouseTable } from "@/components/warehouse-table";
import { auth } from "@/lib/auth";
import { WarehouseBarcodeScanner } from "@/components/warehouse-barcode-scanner";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function WarehousePage() {
    const products = await prisma.product.findMany({
        where: {
            storedQty: { gt: 0 },          // Fiziksel olarak depoda stok var
            status: { not: 'SHIPPED' },    // Sevk edilmişleri gösterme
            NOT: {
                sku: {
                    startsWith: "MANUAL-"  // Manuel yarı mamül ürünleri hariç tut
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            inventory: true,
            creator: true,
            shipmentItems: true,
            order: true
        }
    });

    // Calculate shipped quantity for each product
    // storedQty = Depodaki miktar (sevk edilebilir stok)
    // shippedQty = Toplam sevk edilen miktar
    const productsWithShipped = products.map(p => {
        const storedQty = (p as any).storedQty || 0;
        const shippedQty = (p as any).shippedQty || 0;
        return {
            ...p,
            shipped: shippedQty,
            available: storedQty, // Depodaki miktar = sevk edilebilir miktar
            storedQty,
            company: (p.order as any)?.company || (p as any).company || ""
        };
    });

    const session = await auth();
    const role = (session?.user as any).role;

    // KALİTE rolü bu sayfayi gorememeli
    if (role === "KALITE") {
        import("next/navigation").then(m => m.redirect("/dashboard/production-planning"));
        return null;
    }

    return (
        <div className="space-y-8">
            <AutoRefresh />
            <h2 className="text-3xl font-bold tracking-tight">Depo / Hazır Ürünler</h2>

            {/* Barkod Okuyucu */}
            <WarehouseBarcodeScanner products={productsWithShipped as any} />

            <WarehouseTable products={productsWithShipped as any} role={role} />
        </div>
    );
}
