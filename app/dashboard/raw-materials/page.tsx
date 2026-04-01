import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import RawMaterialsClient from "./_components/raw-materials-client";

export const metadata = {
    title: "Hammadde Depo | Marisit",
    description: "Hammadde depo stok ve talep yönetimi",
};

export default async function RawMaterialsPage() {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session || (role !== "ADMIN" && role !== "RAW_MATERIAL" && role !== "VIEWER")) {
        redirect("/dashboard");
    }

    // Fetch initial data
    const rawMaterials = await prisma.rawMaterial.findMany({
        orderBy: { name: 'asc' }
    });

    const materialRequests = await prisma.materialRequest.findMany({
        include: {
            rawMaterial: true,
            requester: { select: { username: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const purchaseRequests = await prisma.purchaseRequest.findMany({
        include: {
            creator: { select: { username: true } },
            items: {
                include: { rawMaterial: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const rawMaterialLogs = await (prisma as any).rawMaterialLog.findMany({
        include: {
            rawMaterial: true,
            user: { select: { username: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 500
    });

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Hammadde Depo</h1>
                    <p className="text-slate-500">Stok takibi, üretim talepleri ve satın alma yönetimi.</p>
                </div>
            </div>

            <RawMaterialsClient
                initialRawMaterials={rawMaterials}
                initialMaterialRequests={materialRequests}
                initialPurchaseRequests={purchaseRequests}
                initialRawMaterialLogs={rawMaterialLogs}
                currentUser={{ id: parseInt((session.user as any).id), role }}
            />
        </div>
    );
}
