import prisma from "@/lib/prisma";
import { approveProduct, rejectProduct } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BarcodeDisplay from "@/components/barcode-display";
import { ApproveButton } from "@/components/approve-button";
import { RejectButton } from "@/components/reject-button";
import { ApprovedTable } from "@/components/approved-table";
import { PendingApprovalsTable } from "@/components/pending-approvals-table";
import { auth } from "@/lib/auth";

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

    return (
        <div className="space-y-8">
            <AutoRefresh intervalMs={5000} />

            <Card>
                <CardHeader>
                    <CardTitle>Onay Bekleyenler</CardTitle>
                </CardHeader>
                <CardContent>
                    <PendingApprovalsTable pendingProducts={pendingProducts} userRole={userRole} />
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle>Son Onaylananlar / Barkodlar(Üretime geçmiş ürünler)</CardTitle>
                </CardHeader>
                <CardContent>
                    <ApprovedTable products={approvedProducts as any} />
                </CardContent>
            </Card>
        </div>
    );
}

