import prisma from "@/lib/prisma";
import { WarehouseTable } from "@/components/warehouse-table";
import { auth } from "@/lib/auth";

import { AutoRefresh } from "@/components/auto-refresh";

export default async function WarehousePage() {
    const products = await prisma.product.findMany({
        where: {
            produced: { gt: 0 }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            inventory: true,
            creator: true
        }
    });

    const session = await auth();
    const role = (session?.user as any).role;

    return (
        <div className="space-y-8">
            <AutoRefresh />
            <h2 className="text-3xl font-bold tracking-tight">Depo / Hazır Ürünler</h2>
            <WarehouseTable products={products as any} role={role} />
        </div>
    );
}
