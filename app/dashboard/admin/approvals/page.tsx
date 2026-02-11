import prisma from "@/lib/prisma";
import { approveProduct, rejectProduct } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BarcodeDisplay from "@/components/barcode-display";
import { ApproveButton } from "@/components/approve-button";
import { RejectButton } from "@/components/reject-button";
import { ApprovedTable } from "@/components/approved-table";
import { PendingApprovalsTable } from "@/components/pending-approvals-table";
import { auth } from "@/lib/auth";
import { Megaphone, AlertTriangle } from "lucide-react";

import { AutoRefresh } from "@/components/auto-refresh";

export default async function ApprovalsPage() {
    const session = await auth();
    const userRole = (session?.user as any)?.role;

    const pendingProducts = await prisma.product.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        include: {
            creator: true,
            order: true // Order bilgisini dahil et
        }
    });

    const approvedProducts = await prisma.product.findMany({
        where: { status: { in: ['APPROVED', 'COMPLETED'] } },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
            creator: true,
            order: true
        }
    });

    // Pazarlamadan gelen redler
    const marketingRejects = pendingProducts.filter(p => p.rejectionReason);
    const marketingRejectCount = marketingRejects.length;

    return (
        <div className="space-y-8">
            <AutoRefresh intervalMs={5000} />

            <Card className={marketingRejectCount > 0 ? "border-red-400 border-2" : ""}>
                <CardHeader className={marketingRejectCount > 0 ? "bg-red-50" : ""}>
                    <div className="flex items-center justify-between">
                        <div className="w-full">
                            <CardTitle className="flex items-center gap-2">
                                Onay Bekleyenler
                                {marketingRejectCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-sm rounded-full animate-pulse">
                                        <Megaphone className="h-4 w-4" />
                                        {marketingRejectCount} Pazarlamadan Red!
                                    </span>
                                )}
                            </CardTitle>
                            {marketingRejectCount > 0 && (
                                <div className="mt-3">
                                    <CardDescription className="text-red-600 font-medium flex items-center gap-1 mb-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        Pazarlama tarafindan reddedilen urunler:
                                    </CardDescription>
                                    <div className="space-y-2">
                                        {marketingRejects.map(p => (
                                            <div key={p.id} className="bg-red-100 border border-red-300 rounded-md p-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-red-800">{p.name}</span>
                                                    <span className="text-red-400">|</span>
                                                    <span className="text-red-600 text-xs">{p.order?.company || '-'}</span>
                                                </div>
                                                <div className="mt-1 text-red-700 bg-white/50 rounded px-2 py-1">
                                                    <span className="font-medium">Red Nedeni:</span> {p.rejectionReason}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <PendingApprovalsTable pendingProducts={pendingProducts} userRole={userRole} />
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle>Son Onaylananlar / Barkodlar(Uretime gecmis urunler)</CardTitle>
                </CardHeader>
                <CardContent>
                    <ApprovedTable products={approvedProducts as any} />
                </CardContent>
            </Card>
        </div>
    );
}

