'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createShipment, getReadyToShipProducts } from "@/lib/actions";
import { Loader2, Plus, Check, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function NewShipmentPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form Data
    const [company, setCompany] = useState("");
    const [driverName, setDriverName] = useState("");
    const [vehiclePlate, setVehiclePlate] = useState("");
    const [estimatedDate, setEstimatedDate] = useState("");

    // Product Selection
    const [readyProducts, setReadyProducts] = useState<any[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<{ [key: number]: number }>({}); // productId -> quantity to ship
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        getReadyToShipProducts().then(setReadyProducts);
    }, []);

    const handleToggleProduct = (product: any, checked: boolean) => {
        const newSelected = { ...selectedProducts };
        if (checked) {
            newSelected[product.id] = product.available; // Default to max
        } else {
            delete newSelected[product.id];
        }
        setSelectedProducts(newSelected);
    }

    const updateQuantity = (productId: number, qty: number, max: number) => {
        if (qty < 0) qty = 0;
        if (qty > max) qty = max;
        setSelectedProducts({
            ...selectedProducts,
            [productId]: qty
        });
    }

    const handleSubmit = async () => {
        const items = Object.entries(selectedProducts).map(([pid, qty]) => ({
            productId: parseInt(pid),
            quantity: qty
        })).filter(i => i.quantity > 0);

        if (!company || !estimatedDate || items.length === 0) {
            toast.error("Lütfen tüm zorunlu alanları doldurun ve en az bir ürün seçin.");
            return;
        }

        setLoading(true);
        const res = await createShipment({
            company,
            driverName,
            vehiclePlate,
            estimatedDate: new Date(estimatedDate),
            items
        });

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success("Sevkiyat başarıyla oluşturuldu.");
            router.push("/dashboard/shipment");
        }
        setLoading(false);
    }

    const filteredProducts = readyProducts.filter(p =>
        p.systemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.order?.company || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Yeni Sevkiyat Oluştur</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: Form */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Sevkiyat Bilgileri</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Alıcı Firma</Label>
                            <Input placeholder="Firma Adı" value={company} onChange={e => setCompany(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Planlanan Çıkış Tarihi</Label>
                            <Input type="date" value={estimatedDate} onChange={e => setEstimatedDate(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Sürücü Adı (Opsiyonel)</Label>
                            <Input placeholder="Ad Soyad" value={driverName} onChange={e => setDriverName(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Araç Plaka (Opsiyonel)</Label>
                            <Input placeholder="34 XX 123" value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} />
                        </div>

                        <div className="pt-4">
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700"
                                onClick={handleSubmit}
                                disabled={loading || Object.keys(selectedProducts).length === 0}
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                                Sevkiyatı Oluştur
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Products */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Sevkiyat İçeriği</CardTitle>
                        <CardDescription>Depoda hazır (üretilmiş) ürünlerden seçim yapınız.</CardDescription>
                        <div className="pt-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Ürün Ara (Kod, Ad, Sipariş Firması)..."
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[600px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Ürün</TableHead>
                                    <TableHead>Sipariş</TableHead>
                                    <TableHead>Stok</TableHead>
                                    <TableHead className="w-[100px]">Miktar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.map(p => {
                                    const isSelected = !!selectedProducts[p.id];
                                    return (
                                        <TableRow key={p.id} className={isSelected ? "bg-blue-50" : ""}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleToggleProduct(p, e.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold">{p.systemCode}</div>
                                                <div className="text-sm text-slate-500">{p.name}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{p.order?.company || '-'}</div>
                                                <div className="text-xs text-slate-400">{p.order?.name}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    Hazır: <span className="font-bold text-green-600">{p.produced}</span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    (Daha önce sevk: {p.shipped})
                                                    <br />
                                                    Kalan: <b>{p.available}</b>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {isSelected && (
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={p.available}
                                                        value={selectedProducts[p.id]}
                                                        onChange={e => updateQuantity(p.id, parseInt(e.target.value), p.available)}
                                                        className="h-8 w-20"
                                                    />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {filteredProducts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                            Sevkiyata hazır ürün bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
