import prisma from "@/lib/prisma";
import { WarehouseTable } from "@/components/warehouse-table";

export default async function WarehousePage() {
    const products = await prisma.product.findMany({
        where: {
            produced: { gt: 0 }
        },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Depo / Hazır Ürünler</h2>
            <WarehouseTable products={products} />
        </div>
    );
}
