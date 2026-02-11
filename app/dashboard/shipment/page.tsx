import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import prisma from "@/lib/prisma";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function ShipmentPage() {
    const shipments = await prisma.shipment.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    });

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Sevkiyat Yönetimi</h1>
                <Link href="/dashboard/shipment/new">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="mr-2 h-4 w-4" /> Yeni Sevkiyat Oluştur
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4">
                {shipments.map(shipment => (
                    <Card key={shipment.id}>
                        <CardHeader className="bg-slate-50 border-b pb-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg">{shipment.company}</CardTitle>
                                    <div className="text-sm text-slate-500">
                                        Sürücü: {shipment.driverName || '-'} | Plaka: {shipment.vehiclePlate || '-'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-slate-700">
                                        {shipment.estimatedDate ? new Date(shipment.estimatedDate).toLocaleDateString('tr-TR') : '-'}
                                    </div>
                                    <div className={`text-xs px-2 py-1 rounded inline-block mt-1 font-bold ${shipment.status === 'SHIPPED' ? 'bg-green-100 text-green-700' :
                                            shipment.status === 'DELIVERED' ? 'bg-blue-100 text-blue-700' :
                                                'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {shipment.status === 'PLANNED' ? 'PLANLANDI' :
                                            shipment.status === 'SHIPPED' ? 'SEVK EDİLDİ' : shipment.status}
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ürün Kodu</TableHead>
                                        <TableHead>Ürün Adı</TableHead>
                                        <TableHead className="text-right">Adet</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shipment.items.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.product.systemCode}</TableCell>
                                            <TableCell>{item.product.name}</TableCell>
                                            <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                ))}

                {shipments.length === 0 && (
                    <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
                        Henüz sevkiyat planı bulunmuyor.
                    </div>
                )}
            </div>
        </div>
    );
}
