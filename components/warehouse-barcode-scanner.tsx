"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScanBarcode, Focus, CheckCircle2, AlertCircle, Package, Search, Truck, X } from "lucide-react";
import { shipProduct } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Product = {
    id: number;
    name: string;
    model: string;
    systemCode: string;
    barcode: string | null;
    quantity: number;
    storedQty?: number;
    shippedQty?: number;
    company: string | null;
};

interface WarehouseBarcodeScannerProps {
    products: Product[];
}

export function WarehouseBarcodeScanner({ products }: WarehouseBarcodeScannerProps) {
    const router = useRouter();
    const [barcode, setBarcode] = useState("");
    const [searchResult, setSearchResult] = useState<Product | null>(null);
    const [msg, setMsg] = useState("");
    const [msgType, setMsgType] = useState<"success" | "error">("error");
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Sevk formu state
    const [shipQty, setShipQty] = useState("1");
    const [shipCompany, setShipCompany] = useState("");
    const [driverName, setDriverName] = useState("");
    const [vehiclePlate, setVehiclePlate] = useState("");
    const [shipping, setShipping] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcode.trim()) return;

        const normalizedBarcode = barcode.trim().replace(/\*/g, "-");

        const found = products.find(
            p =>
                p.barcode === normalizedBarcode ||
                p.systemCode === normalizedBarcode ||
                p.barcode === barcode.trim() ||
                p.systemCode === barcode.trim()
        );

        if (found) {
            setSearchResult(found);
            setMsgType("success");
            setMsg(`Ürün bulundu! Depoda ${found.storedQty || 0} adet mevcut.`);
            setShipCompany(found.company || "");
            setShipQty("1");
            setDriverName("");
            setVehiclePlate("");
        } else {
            setSearchResult(null);
            setMsgType("error");
            setMsg("Ürün bulunamadı veya depoda stok yok.");
        }
    };

    const handleShip = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchResult) return;

        const qty = parseInt(shipQty);
        const available = searchResult.storedQty || 0;

        if (!qty || qty <= 0) {
            toast.error("Geçerli bir adet girin");
            return;
        }
        if (qty > available) {
            toast.error(`Depoda sadece ${available} adet var`);
            return;
        }
        if (!shipCompany.trim()) {
            toast.error("Firma adı zorunludur");
            return;
        }

        setShipping(true);
        const result = await shipProduct({
            productId: searchResult.id,
            quantity: qty,
            company: shipCompany,
            driverName: driverName || undefined,
            vehiclePlate: vehiclePlate || undefined,
        });
        setShipping(false);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success(`${qty} adet sevk edildi!`);
            handleReset();
            router.refresh();
        }
    };

    const handleReset = () => {
        setBarcode("");
        setSearchResult(null);
        setMsg("");
        setShipQty("1");
        setShipCompany("");
        setDriverName("");
        setVehiclePlate("");
        barcodeInputRef.current?.focus();
    };

    const focusBarcodeInput = () => {
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
    };

    const available = searchResult?.storedQty || 0;

    return (
        <Card className="border-2 border-slate-200">
            <CardHeader className="bg-slate-50">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ScanBarcode className="h-5 w-5 text-slate-600" />
                            Barkod ile Sevk
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Barkodu okutun, ardından sevk işlemini yapın
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Barkod arama formu */}
                <form onSubmit={handleSearch} className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Input
                                ref={barcodeInputRef}
                                autoFocus
                                autoComplete="off"
                                placeholder="Barkodu okutun veya yazın..."
                                value={barcode}
                                onChange={e => setBarcode(e.target.value)}
                                className="text-xl h-16 pr-12 font-mono tracking-wider border-slate-400 focus:border-blue-500 focus:ring-blue-500"
                            />
                            <ScanBarcode className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                disabled={!barcode.trim()}
                                className="h-16 px-8 text-lg bg-blue-600 hover:bg-blue-700"
                            >
                                <Search className="mr-2 h-5 w-5" />
                                Ara
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={focusBarcodeInput}
                                className="h-16 px-4"
                                title="Barkod alanına odaklan"
                            >
                                <Focus className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={handleReset} type="button">
                            <X className="h-3 w-3 mr-1" />
                            Temizle
                        </Button>
                        <Badge variant="secondary" className="text-xs">
                            * karakteri - olarak aranır (NS*2025*123 → NS-2025-123)
                        </Badge>
                    </div>

                    {msg && (
                        <div className={`flex items-center gap-2 p-3 rounded-lg ${msgType === "success"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                            }`}>
                            {msgType === "success"
                                ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                                : <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            }
                            <span className="font-medium">{msg}</span>
                        </div>
                    )}
                </form>

                {/* Ürün bulundu: bilgi + sevk formu */}
                {searchResult && (
                    <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50 space-y-4">
                        {/* Ürün bilgileri */}
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    {searchResult.name}
                                </h3>
                                <p className="text-sm text-green-700">Model: {searchResult.model}</p>
                                {searchResult.company && (
                                    <p className="text-sm text-green-700">Firma: {searchResult.company}</p>
                                )}
                            </div>
                            {searchResult.barcode && (
                                <Badge variant="outline" className="font-mono">{searchResult.barcode}</Badge>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                                <span className="text-green-600 text-xs font-medium">Toplam</span>
                                <div className="text-2xl font-bold text-slate-700">{searchResult.quantity}</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                                <span className="text-green-600 text-xs font-medium">Depoda</span>
                                <div className="text-2xl font-bold text-green-600">{available}</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                                <span className="text-green-600 text-xs font-medium">Sevk Edilen</span>
                                <div className="text-2xl font-bold text-blue-600">{searchResult.shippedQty || 0}</div>
                            </div>
                        </div>

                        {/* Sevk Formu */}
                        {available > 0 ? (
                            <form onSubmit={handleShip} className="space-y-3 border-t border-green-300 pt-4">
                                <h4 className="font-semibold text-green-900 flex items-center gap-2">
                                    <Truck className="h-4 w-4" />
                                    Sevk İşlemi
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Sevk Adedi * (maks. {available})</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={available}
                                            value={shipQty}
                                            onChange={e => setShipQty(e.target.value)}
                                            className="h-10 text-lg font-bold text-center"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Firma *</Label>
                                        <Input
                                            value={shipCompany}
                                            onChange={e => setShipCompany(e.target.value)}
                                            placeholder="Firma adı"
                                            className="h-10"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Sürücü (opsiyonel)</Label>
                                        <Input
                                            value={driverName}
                                            onChange={e => setDriverName(e.target.value)}
                                            placeholder="Sürücü adı"
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Plaka (opsiyonel)</Label>
                                        <Input
                                            value={vehiclePlate}
                                            onChange={e => setVehiclePlate(e.target.value)}
                                            placeholder="34 ABC 123"
                                            className="h-10 uppercase"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={shipping}
                                    className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
                                >
                                    <Truck className="mr-2 h-5 w-5" />
                                    {shipping ? "Sevk ediliyor..." : `${shipQty} Adet Sevk Et`}
                                </Button>
                            </form>
                        ) : (
                            <div className="border-t border-green-300 pt-4 text-center text-orange-600 font-medium">
                                Depoda sevk edilebilir ürün yok
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

