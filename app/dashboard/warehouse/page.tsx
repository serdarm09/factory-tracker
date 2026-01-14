import prisma from "@/lib/prisma";
import { WarehouseTable } from "@/components/warehouse-table";
import { auth } from "@/lib/auth";

export default async function WarehousePage() {
    const products = await prisma.product.findMany({
        where: {
            produced: { gt: 0 }
        },
        orderBy: { createdAt: 'desc' }
    });

    const session = await auth();
    const role = (session?.user as any).role;

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Depo / Hazır Ürünler</h2>
            <WarehouseTable products={products} role={role} />
        </div>
    );
}
