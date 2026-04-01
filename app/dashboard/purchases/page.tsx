import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getPurchaseRequests } from "@/app/actions/purchase-actions";
import PurchasesClient from "./_components/purchases-client";

export default async function PurchasesPage() {
    const session = await auth();
    const user = session?.user as any;
    
    if (!user || (user.role !== "ADMIN" && user.role !== "PURCHASING" && user.role !== "VIEWER")) {
        redirect("/dashboard");
    }

    const [purchaseRequests, rawMaterials] = await Promise.all([
        getPurchaseRequests(),
        prisma.rawMaterial.findMany({ orderBy: { name: "asc" } })
    ]);

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Satın Alma Yönetimi</h1>
                    <p className="text-slate-500 mt-1">
                        Tedarik edilecek malzemeleri ve sipariş durumlarını takip edin.
                    </p>
                </div>
            </div>

            <PurchasesClient 
                initialPurchaseRequests={purchaseRequests} 
                rawMaterials={rawMaterials as any}
                currentUser={{ id: user.id, role: user.role }} 
            />
        </div>
    );
}
