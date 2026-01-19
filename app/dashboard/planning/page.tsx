

import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { translateStatus } from "@/lib/translations";
import { EditProductDialog } from "@/components/edit-product-dialog";
import { CancelProductButton } from "@/components/cancel-button"; // Assuming this still works for Product
import { AutoRefresh } from "@/components/auto-refresh";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function PlanningPage() {
    const session = await auth();

    // Fetch Orders that have products (or all?)
    // We want to show Active orders (not completed/cancelled maybe? or all).
    // Let's show all for now, ordered by date.
    const orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            products: true,
            marketingBy: true
        }
    });

    // Also fetch legacy products that might not have an Order? 
    // If strict migration, all products should have orderId? 
    // Old products have orderId = null.
    // We should display them too in a "Legacy / Unassigned" group.
    const legacyProducts = await prisma.product.findMany({
        where: { orderId: null },
        orderBy: { createdAt: 'desc' }
    });

    // Separating Rejected Products for Alert (Only if I want to keep that alert logic)
    // Actually, Admin approves here. Marketing views elsewhere?
    // User said: "admin onay verirse üretime geçilecek".
    // So this page is for Admin/Planner.

    const isViewer = (session?.user as any).role === 'VIEWER';
    const isAdmin = (session?.user as any).role === 'ADMIN';

    return (
        <div className="space-y-8">
            <AutoRefresh />

            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Planlama ve Onay</h1>
                {!isViewer && (
                    <Link href="/dashboard/planning/new-order">
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4" /> Yeni Sipariş Oluştur
                        </Button>
                    </Link>
                )}
            </div>

            {/* Legacy Products Section (if any) */}
            {legacyProducts.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="text-orange-900">Eski / Siparişsiz Planlar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ProductTable products={legacyProducts} session={session} />
                    </CardContent>
                </Card>
            )}

            {/* Orders List */}
            <div className="space-y-6">
                {orders.map(order => (
                    <Card key={order.id} className="overflow-hidden">
                        <CardHeader className="bg-slate-50 border-b pb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-xl">{order.company}</CardTitle>
                                        <span className="text-sm text-slate-500 bg-white px-2 py-1 rounded border">
                                            {order.name}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        Pazarlamacı: {order.marketingBy?.username || '-'} | Tarih: {order.createdAt.toLocaleDateString('tr-TR')}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.status === 'REQUESTED' ? 'bg-yellow-100 text-yellow-800' :
                                        order.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                        {translateStatus(order.status).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ProductTable products={order.products} session={session} />
                        </CardContent>
                    </Card>
                ))}

                {orders.length === 0 && legacyProducts.length === 0 && (
                    <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
                        Henüz sipariş veya plan bulunmuyor.
                    </div>
                )}
            </div>
        </div>
    );
}

function ProductTable({ products, session }: { products: any[], session: any }) {
    if (products.length === 0) return <div className="p-4 text-center text-slate-500 text-sm">Ürün bulunamadı.</div>;

    const isViewer = (session?.user as any).role === 'VIEWER';
    const isAdmin = (session?.user as any).role === 'ADMIN';

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[120px]">Kod / Görsel</TableHead>
                    <TableHead>Ürün</TableHead>
                    <TableHead>Malzeme</TableHead>
                    <TableHead>Not</TableHead>
                    <TableHead>Adet</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Durum</TableHead>
                    {!isViewer && <TableHead>İşlem</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {products.map((p) => (
                    <TableRow key={p.id}>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                {p.imageUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={p.imageUrl} alt="" className="w-8 h-8 object-contain rounded border bg-white" />
                                )}
                                <span className="text-xs">{p.systemCode}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-xs text-slate-500">{p.model}</div>
                        </TableCell>
                        <TableCell className="text-sm">{p.material || '-'}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                            {p.description || '-'}
                        </TableCell>
                        <TableCell className="font-bold">{p.quantity}</TableCell>
                        <TableCell>
                            {p.terminDate ? new Date(p.terminDate).toLocaleDateString('tr-TR') : '-'}
                        </TableCell>
                        <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                p.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                    p.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                        p.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                                            'bg-gray-100 text-gray-600'
                                }`}>
                                {translateStatus(p.status).toUpperCase()}
                            </span>
                        </TableCell>
                        {!isViewer && (
                            <TableCell>
                                {(p.status === 'PENDING' || p.status === 'REJECTED' || p.status === 'APPROVED') && (
                                    <div className="flex gap-1">
                                        {/* Admin can Edit/Reject */}
                                        {/* Assuming EditProductDialog handles approval via updateProduct status change or separate button? */}
                                        {/* Actually EditProductDialog likely just edits details. Approval is usually a button? */}
                                        {/* Existing CancelButton deletes it. */}
                                        {/* We need an Approve Button if Pending. */}

                                        <EditProductDialog product={p} />

                                        {/* If Pending, Show Approve Button (Admin) */}
                                        {isAdmin && p.status === 'PENDING' && (
                                            <form action={async () => {
                                                'use server';
                                                // We need to import approveProduct here or use client component
                                                // I can't write server action inline if not passed properly.
                                                // I should use a component for Approve Button.
                                            }}>
                                                {/* Placeholder for Approve Button */}
                                            </form>
                                        )}

                                        {/* For now, just keeping Edit/Cancel. approveProduct is called from EditDialog?? No. */}
                                        {/* I'll use a new ApproveButton component or reuse existing patterns. */}
                                        {/* Wait, previously Approve was done via... Actions. */}
                                        {/* I'll create an ApproveButton component in next step if needed. */}
                                    </div>
                                )}
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
