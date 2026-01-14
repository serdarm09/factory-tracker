import prisma from "@/lib/prisma";
import { approveProduct, rejectProduct } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BarcodeDisplay from "@/components/barcode-display";
import { ApproveButton } from "@/components/approve-button";
import { RejectButton } from "@/components/reject-button";
import { ApprovedTable } from "@/components/approved-table";

export default async function ApprovalsPage() {
    const pendingProducts = await prisma.product.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        include: { creator: true }
    });

    const approvedProducts = await prisma.product.findMany({
        where: { status: { in: ['APPROVED', 'COMPLETED'] } },
        take: 50,
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Onay İşlemleri</h2>

            <Card>
                <CardHeader>
                    <CardTitle>Onay Bekleyenler</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ürün</TableHead>
                                <TableHead>Planlayan</TableHead>
                                <TableHead>Malzeme</TableHead>
                                <TableHead>Not</TableHead>
                                <TableHead>Firma</TableHead>
                                <TableHead>Giriş Tarihi</TableHead>
                                <TableHead>Termin</TableHead>
                                <TableHead>Adet</TableHead>
                                <TableHead>İşlem</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingProducts.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="font-bold">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.model}</div>
                                        <div className="text-xs text-slate-400">{p.systemCode}</div>
                                    </TableCell>
                                    <TableCell className="text-sm font-medium text-blue-600">
                                        {(p.creator as any)?.username || '-'}
                                    </TableCell>
                                    <TableCell className="text-sm">{p.material || '-'}</TableCell>
                                    <TableCell className="max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                                        {p.description || '-'}
                                    </TableCell>
                                    <TableCell>{p.company || '-'}</TableCell>
                                    <TableCell>{p.createdAt.toLocaleDateString('tr-TR')}</TableCell>
                                    <TableCell className="text-red-900 font-medium">{p.terminDate.toLocaleDateString('tr-TR')}</TableCell>
                                    <TableCell>{p.quantity}</TableCell>
                                    <TableCell>
                                        <ApproveButton
                                            action={approveProduct.bind(null, p.id)}
                                            label="Onayla & Barkod Üret"
                                        />
                                        <RejectButton action={rejectProduct.bind(null, p.id)} />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {pendingProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-4 text-slate-500">Onay bekleyen ürün yok.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle>Son Onaylananlar / Barkodlar</CardTitle>
                </CardHeader>
                <CardContent>
                    <ApprovedTable products={approvedProducts as any} />
                </CardContent>
            </Card>
        </div>
    );
}

