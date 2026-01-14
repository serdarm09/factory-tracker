import prisma from "@/lib/prisma";
import { createProduct, cancelProduct } from "@/lib/actions";
import { PlanningForm } from "@/components/planning-form";
import { CancelProductButton } from "@/components/cancel-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auth } from "@/lib/auth";

export default async function PlanningPage() {
    const session = await auth();
    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' }
    });

    const rejectedProducts = await prisma.product.findMany({
        where: { status: 'REJECTED' },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Üretim Planlama</h2>

            {rejectedProducts.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-2">
                    <h3 className="text-red-900 font-bold flex items-center">
                        <span className="mr-2">⚠️</span>
                        Reddedilen İşler ({rejectedProducts.length})
                    </h3>
                    <div className="text-sm text-red-700">Aşağıdaki işler reddedildi. Lütfen kontrol edip tekrar giriniz veya siliniz.</div>
                    <div className="space-y-1">
                        {rejectedProducts.map(p => (
                            <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded border border-red-100">
                                <div>
                                    <span className="font-bold">{p.name}</span> <span className="text-slate-500">({p.model})</span>
                                    <span className="block text-xs text-red-500">Reddedildi</span>
                                </div>
                                <div className="text-sm">
                                    {p.company}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            </div>

            {(session?.user as any).role !== 'VIEWER' && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4 lg:col-span-3">
                        <CardHeader>
                            <CardTitle>Yeni Plan Oluştur</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PlanningForm />
                        </CardContent>
                    </Card>

                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Son Planlar</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kod</TableHead>
                                        <TableHead>Ürün</TableHead>
                                        <TableHead>Malzeme</TableHead>
                                        <TableHead>Not</TableHead>
                                        <TableHead>Adet</TableHead>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead>Durum</TableHead>
                                        <TableHead>İşlem</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">{p.systemCode}</TableCell>
                                            <TableCell>
                                                <div className="font-semibold">{p.name}</div>
                                                <div className="text-xs text-slate-500">{p.model}</div>
                                            </TableCell>
                                            <TableCell className="text-sm">{p.material || '-'}</TableCell>
                                            <TableCell className="max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                                                {p.description || '-'}
                                            </TableCell>
                                            <TableCell>{p.quantity}</TableCell>
                                            <TableCell>{p.terminDate.toLocaleDateString('tr-TR')}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                                    p.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                                        'bg-green-100 text-green-600'
                                                    }`}>
                                                    {p.status === 'PENDING' ? 'BEKLEMEDE' :
                                                        p.status === 'APPROVED' ? 'ONAYLANDI' : 'TAMAMLANDI'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {(p.status === 'PENDING' || (session?.user as any).role === 'ADMIN') && (session?.user as any).role !== 'VIEWER' && (
                                                    <CancelProductButton id={p.id} />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {products.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-slate-500">Plan bulunamadı.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}

            {(session?.user as any).role === 'VIEWER' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Planlar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kod</TableHead>
                                    <TableHead>Ürün</TableHead>
                                    <TableHead>Malzeme</TableHead>
                                    <TableHead>Not</TableHead>
                                    <TableHead>Adet</TableHead>
                                    <TableHead>Tarih</TableHead>
                                    <TableHead>Durum</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.systemCode}</TableCell>
                                        <TableCell>
                                            <div className="font-semibold">{p.name}</div>
                                            <div className="text-xs text-slate-500">{p.model}</div>
                                        </TableCell>
                                        <TableCell className="text-sm">{p.material || '-'}</TableCell>
                                        <TableCell className="max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                                            {p.description || '-'}
                                        </TableCell>
                                        <TableCell>{p.quantity}</TableCell>
                                        <TableCell>{p.terminDate.toLocaleDateString('tr-TR')}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                                p.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-green-100 text-green-600'
                                                }`}>
                                                {p.status === 'PENDING' ? 'BEKLEMEDE' :
                                                    p.status === 'APPROVED' ? 'ONAYLANDI' : 'TAMAMLANDI'}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {products.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">Plan bulunamadı.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
