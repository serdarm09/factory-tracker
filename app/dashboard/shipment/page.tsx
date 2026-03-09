import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import prisma from "@/lib/prisma";
import { Plus, Package } from "lucide-react";
import Link from "next/link";

function PartsShippedBadge({ value }: { value: string | null }) {
    if (!value) return <span className="text-xs text-slate-400">—</span>;
    const map: Record<string, { label: string; cls: string }> = {
        EVET:       { label: "Ayak veya Aksesuar sevk edildi",    cls: "bg-green-100 text-green-800 border border-green-200"  },
        HAYIR:      { label: "Ayak veya Aksesuar sevk edilmedi",  cls: "bg-red-100 text-red-800 border border-red-200"        },
        DAHA_SONRA: { label: "Ayak veya Aksesuar sevk edilecek",  cls: "bg-amber-100 text-amber-800 border border-amber-200"  },
    };
    const info = map[value] ?? { label: value, cls: "bg-slate-100 text-slate-700" };
    return <span className={`text-xs px-2 py-0.5 rounded font-medium ${info.cls}`}>{info.label}</span>;
}

// Ürüne ait not ve özellik alanlarını küçük badge olarak göster (ayak, aksesuar, kumaş vs.)
function ProductDetailBadges({ product }: { product: any }) {
    const items: string[] = [];
    if (product.footType)     items.push(`Ayak: ${product.footType}`);
    if (product.footMaterial) items.push(`Ayak Malz: ${product.footMaterial}`);
    if (product.armType)      items.push(`Kol: ${product.armType}`);
    if (product.backType)     items.push(`Sırt: ${product.backType}`);
    if (product.fabricType)   items.push(`Kumaş: ${product.fabricType}`);
    if (product.dstAdi)       items.push(product.dstAdi);
    if (product.aciklama1)    items.push(product.aciklama1);
    if (product.aciklama2)    items.push(product.aciklama2);
    if (product.aciklama3)    items.push(product.aciklama3);
    if (product.aciklama4)    items.push(product.aciklama4);
    if (product.description)  items.push(product.description);

    if (items.length === 0) return <span className="text-xs text-slate-400">—</span>;
    return (
        <div className="flex flex-wrap gap-1 max-w-[220px]">
            {items.map((item, i) => (
                <span key={i} className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                    {item}
                </span>
            ))}
        </div>
    );
}

export default async function ShipmentPage() {
    // Shipment kayıtlarını getir
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

    // TÜM sevk edilmiş ürünleri getir (Shipment kaydı olsun olmasın)
    const allShippedProducts = await prisma.product.findMany({
        where: {
            shippedQty: { gt: 0 },
            NOT: { sku: { startsWith: "MANUAL-" } }
        },
        include: {
            order: {
                select: {
                    company: true,
                    name: true
                }
            },
            shipmentItems: {
                include: {
                    shipment: {
                        select: {
                            company: true,
                            driverName: true,
                            vehiclePlate: true,
                            exitDate: true,
                            status: true
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
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
                {/* TÜM sevk edilmiş ürünler */}
                {allShippedProducts.length > 0 && (
                    <Card className="border-blue-200 bg-blue-50">
                        <CardHeader className="bg-blue-100 border-b border-blue-200 pb-4">
                            <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-blue-700" />
                                <CardTitle className="text-lg text-blue-900">
                                    Sevk Edilen Tüm Ürünler
                                </CardTitle>
                            </div>
                            <p className="text-sm text-blue-700 mt-1">
                                Durumu sevk olan tüm ürünler (sevkiyat kaydı olan/olmayan)
                            </p>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ürün Kodu</TableHead>
                                        <TableHead>Ürün Adı</TableHead>
                                        <TableHead>Firma</TableHead>
                                        <TableHead>Sipariş</TableHead>
                                        <TableHead>Notlar / Detaylar</TableHead>
                                        <TableHead>Sevkiyat Bilgileri</TableHead>
                                        <TableHead>Ayak veya Aksesuar Durumu</TableHead>
                                        <TableHead className="text-right">Sevk Edilen Adet</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allShippedProducts.map(product => {
                                        const totalInShipments = product.shipmentItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
                                        const hasShipmentRecord = product.shipmentItems.length > 0;

                                        return (
                                            <TableRow key={product.id}>
                                                <TableCell className="font-medium text-xs">{product.systemCode}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{product.name}</div>
                                                    <div className="text-xs text-slate-500">{(product as any).model}</div>
                                                </TableCell>
                                                <TableCell>{product.order?.company || '-'}</TableCell>
                                                <TableCell>{product.order?.name || '-'}</TableCell>
                                                <TableCell>
                                                    <ProductDetailBadges product={product as any} />
                                                </TableCell>
                                                <TableCell>
                                                    {hasShipmentRecord ? (
                                                        <div className="text-xs space-y-1">
                                                            {product.shipmentItems.map((item: any, idx: number) => (
                                                                <div key={idx} className="text-green-700 bg-green-50 px-2 py-1 rounded">
                                                                    ✓ {item.shipment.company || 'Belirtilmedi'}
                                                                    {item.shipment.driverName && ` - ${item.shipment.driverName}`}
                                                                    {item.shipment.vehiclePlate && ` (${item.shipment.vehiclePlate})`}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                                            ⚠ Sevkiyat kaydı yok
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        {product.shipmentItems.map((item: any, idx: number) => (
                                                            <PartsShippedBadge key={idx} value={item.partsShipped} />
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="font-bold text-blue-700">{product.shippedQty}</span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Geleneksel Sevkiyat Kayıtları (İsteğe bağlı detaylı görünüm) */}
                {shipments.length > 0 && (
                    <Card className="border-slate-200">
                        <CardHeader className="bg-slate-50 border-b pb-4">
                            <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-slate-700" />
                                <CardTitle className="text-lg text-slate-900">
                                    Detaylı Sevkiyat Kayıtları
                                </CardTitle>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                                Firma, sürücü ve plaka bilgileri ile oluşturulmuş sevkiyat kayıtları
                            </p>
                        </CardHeader>
                        <CardContent className="p-0">
                            {shipments.map(shipment => (
                                <div key={shipment.id} className="border-b last:border-b-0">
                                    <div className="bg-slate-50 px-6 py-4 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-slate-900">{shipment.company}</div>
                                            <div className="text-sm text-slate-500">
                                                Sürücü: {shipment.driverName || '-'} | Plaka: {shipment.vehiclePlate || '-'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-slate-700">
                                                {shipment.estimatedDate ? new Date(shipment.estimatedDate).toLocaleDateString('tr-TR') : '-'}
                                            </div>
                                            <div className={`text-xs px-2 py-1 rounded inline-block mt-1 font-bold ${
                                                shipment.status === 'SHIPPED' ? 'bg-green-100 text-green-700' :
                                                shipment.status === 'DELIVERED' ? 'bg-blue-100 text-blue-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {shipment.status === 'PLANNED' ? 'PLANLANDI' :
                                                    shipment.status === 'SHIPPED' ? 'SEVK EDİLDİ' : shipment.status}
                                            </div>
                                        </div>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Ürün Kodu</TableHead>
                                                <TableHead>Ürün Adı</TableHead>
                                                <TableHead>Notlar / Detaylar</TableHead>
                                                <TableHead>Ayak veya Aksesuar Durumu</TableHead>
                                                <TableHead className="text-right">Adet</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {shipment.items.map((item: any) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="text-xs font-mono">{item.product.systemCode}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{item.product.name}</div>
                                                        <div className="text-xs text-slate-500">{item.product.model}</div>
                                                    </TableCell>
                                                    <TableCell><ProductDetailBadges product={item.product} /></TableCell>
                                                    <TableCell><PartsShippedBadge value={item.partsShipped} /></TableCell>
                                                    <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {shipments.length === 0 && allShippedProducts.length === 0 && (
                    <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
                        Henüz sevkiyat planı bulunmuyor.
                    </div>
                )}
            </div>
        </div>
    );
}
