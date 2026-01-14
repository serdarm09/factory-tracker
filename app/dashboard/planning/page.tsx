import prisma from "@/lib/prisma";
import { createProduct, cancelProduct } from "@/lib/actions";
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Yeni Plan Oluştur</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={createProduct} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Ürün Adı</Label>
                                    <Input id="name" name="name" required placeholder="Sandalye X1" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="model">Model</Label>
                                    <Input id="model" name="model" required placeholder="V2024" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company">Firma / Müşteri</Label>
                                <Input id="company" name="company" placeholder="ABC Mobilya" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="quantity">Adet</Label>
                                    <Input id="quantity" name="quantity" type="number" required min="1" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="systemCode">Sistem Kodu</Label>
                                    <Input id="systemCode" name="systemCode" required placeholder="SYS-001" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="shelf">Raf Kodu</Label>
                                    <Input id="shelf" name="shelf" required placeholder="A1, B3..." />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="terminDate">Termin Tarihi</Label>
                                <Input id="terminDate" name="terminDate" type="date" required />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="material">Malzeme / Kumaş / Deri</Label>
                                <Input id="material" name="material" placeholder="Örn: Nubuk Deri, Gri Kumaş..." />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Açıklama / Müşteri Notu</Label>
                                <textarea
                                    id="description"
                                    name="description"
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Ekstra istekler, dikiş detayları vb. (Max 500 karakter)"
                                    maxLength={500}
                                />
                            </div>

                            <Button type="submit" className="w-full">Plana Ekle</Button>
                        </form>
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
                                            {(p.status === 'PENDING' || (session?.user as any).role === 'ADMIN') && (
                                                <form action={cancelProduct.bind(null, p.id)}>
                                                    <Button variant="destructive" size="sm">İptal</Button>
                                                </form>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {products.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">Plan bulunamadı.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
