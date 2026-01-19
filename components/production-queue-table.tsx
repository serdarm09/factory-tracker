'use client';

import { useState } from "react";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import BarcodeDisplay from "@/components/barcode-display";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangeFilter } from "./date-range-filter";
import { DateRange } from "react-day-picker";
import { translateStatus } from "@/lib/translations";
import { ProductImage } from "@/components/product-image";

type Product = {
    id: number;
    name: string;
    model: string;
    company: string | null;
    quantity: number;
    produced: number;
    status: string;
    systemCode: string;
    barcode: string;
    createdAt: string;
    terminDate: string;
    orderDate: string;
    material?: string | null;
    description?: string | null;
    // shelf?: string | null;
    inventory?: { shelf: string; quantity: number }[];
    imageUrl?: string | null;
    // Configuration
    footType?: string | null;
    footMaterial?: string | null;
    armType?: string | null;
    backType?: string | null;
    fabricType?: string | null;
};

export function ProductionQueueTable({ products }: { products: Product[] }) {
    const [search, setSearch] = useState("");
    const [scannedBarcode, setScannedBarcode] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const itemsPerPage = 50;

    const filtered = products.filter(p => {
        const searchLower = search.toLowerCase();
        const matchesSearch =
            p.name.toLowerCase().includes(searchLower) ||
            p.model.toLowerCase().includes(searchLower) ||
            (p.company && p.company.toLowerCase().includes(searchLower)) ||
            p.barcode.toLowerCase().includes(searchLower) ||
            p.systemCode.toLowerCase().includes(searchLower);

        let matchesDateRequest = true;
        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);

            const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
            to.setHours(23, 59, 59, 999);

            const current = new Date(p.terminDate);
            matchesDateRequest = current >= from && current <= to;
        }

        return matchesSearch && matchesDateRequest;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedProducts = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handlePrint = (p: Product) => {
        const printContent = `
            <html>
                <head>
                    <title>İş Emri - ${p.name}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; text-align: center; border: 2px solid black; margin: 20px; }
                        h1 { font-size: 24px; margin-bottom: 5px; }
                        h2 { font-size: 18px; color: #555; margin-bottom: 20px; }
                        .info { text-align: left; margin: 20px auto; width: 80%; border-top: 1px solid #ddd; padding-top: 20px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 18px; }
                        .label { font-weight: bold; }
                        .barcode-box { margin: 30px 0; border: 1px dashed #ccc; padding: 20px; display: inline-block; }
                        .footer { margin-top: 50px; font-size: 12px; color: #999; }
                    </style>
                </head>
                <body>
                    <h1>${p.company || 'Firma Yok'}</h1>
                    <h2>${p.model} - ${p.name}</h2>
                    
                    <div class="info">
                        <div class="row">
                            <span class="label">Ürün Kodu</span>
                            <span>${p.systemCode}</span>
                        </div>
                         <div class="row">
                            <span class="label">Termin Tarihi:</span>
                            <span>${new Date(p.terminDate).toLocaleDateString('tr-TR')}</span>
                        </div>
                        <div class="row">
                            <span class="label">Planlanan Adet:</span>
                            <span>${p.quantity} Adet</span>
                        </div>
                        <div class="row">
                            <span class="label">Ayak Rengi:</span>
                            <span>${p.footMaterial || '-'}</span>
                        </div>
                         <div class="row">
                            <span class="label">Kumaş:</span>
                            <span>${p.fabricType || '-'}</span>
                        </div>
                    </div>

                    <div class="barcode-box">
                        <div style="font-family: 'Courier New', monospace; font-size: 40px; letter-spacing: 5px; font-weight: bold;">
                            *${p.barcode}*
                        </div>
                        <div style="font-size: 14px; margin-top: 5px;">${p.barcode}</div>
                    </div>

                    <div class="footer">
                        Oluşturulma: ${new Date().toLocaleString('tr-TR')}
                    </div>
                </body>
            </html>
        `;
        const printWindow = window.open('', '', 'width=600,height=800');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            // Wait for resources to load? Text is fast. But close() needs to wait for print dialog.
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Ara: Ürün, Model, Firma, Barkod..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="max-w-sm"
                />
                <Input
                    placeholder="Barkod Okut..."
                    value={scannedBarcode}
                    onChange={(e) => { setScannedBarcode(e.target.value); setCurrentPage(1); }}
                    className="max-w-sm ml-2"
                />
                <div className="relative ml-2">
                    <DateRangeFilter date={dateRange} setDate={setDateRange} />
                    {dateRange?.from && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -right-2 -top-2 h-5 w-5 bg-slate-100 rounded-full border shadow-sm hover:bg-red-100 hover:text-red-600"
                            onClick={() => setDateRange(undefined)}
                        >
                            <span className="sr-only">Temizle</span>
                            <span className="text-xs">✕</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Ürün</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Firma</TableHead>
                            <TableHead>Termin</TableHead>
                            <TableHead>Barkod</TableHead>
                            <TableHead className="text-right">İşlem</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedProducts.map(p => (
                            <Dialog key={p.id}>
                                <DialogTrigger asChild>
                                    <TableRow className={`cursor-pointer hover:bg-slate-50 ${scannedBarcode && p.barcode === scannedBarcode ? "bg-yellow-100" :
                                        new Date(p.terminDate) < new Date(new Date().setHours(0, 0, 0, 0)) && p.status !== 'COMPLETED' ? 'bg-red-50 hover:bg-red-100' :
                                            new Date(p.terminDate) <= new Date(new Date().setDate(new Date().getDate() + 3)) && p.status !== 'COMPLETED' ? 'bg-amber-50 hover:bg-amber-100' :
                                                ''
                                        }`}>
                                        <TableCell>
                                            <div className="w-8 h-8 rounded-md overflow-hidden bg-slate-100 relative border">
                                                <ProductImage src={`/${p.systemCode}.png`} alt={p.name} className="object-contain w-full h-full" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {p.name}
                                            <div className="text-xs text-slate-400">{p.systemCode}</div>
                                        </TableCell>
                                        <TableCell>{p.model}</TableCell>
                                        <TableCell>{p.company || '-'}</TableCell>
                                        <TableCell className={`${new Date(p.terminDate) < new Date(new Date().setHours(0, 0, 0, 0)) ? 'text-red-700 font-bold' :
                                            new Date(p.terminDate) <= new Date(new Date().setDate(new Date().getDate() + 3)) ? 'text-amber-700 font-bold' :
                                                'text-slate-700 font-mono'
                                            }`}>
                                            {new Date(p.terminDate).toLocaleDateString('tr-TR')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="w-full">
                                                <BarcodeDisplay value={p.barcode} />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handlePrint(p); }}>
                                                <Printer className="w-4 h-4 mr-2" />
                                                Yazdır
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                                    <DialogHeader className="p-6 pb-2">
                                        <DialogTitle className="text-2xl font-bold flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-16 w-16 rounded border overflow-hidden relative bg-slate-50 flex items-center justify-center">
                                                    <ProductImage
                                                        src={`/${p.systemCode}.png`}
                                                        alt={p.name}
                                                        className="object-contain w-full h-full"
                                                    />
                                                </div>
                                                <div>
                                                    {p.name}
                                                    <span className="block text-base font-normal text-slate-500">{p.model}</span>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded text-sm font-bold ${p.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                                p.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-green-100 text-green-600'
                                                }`}>
                                                {translateStatus(p.status).toUpperCase()}
                                            </span>
                                        </DialogTitle>
                                    </DialogHeader>
                                    <ScrollArea className="flex-1 p-6 pt-0">
                                        {/* Production Status Overview */}
                                        <div className="mb-6 bg-white p-4 rounded-lg border shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-semibold text-slate-900">Üretim Durumu</h4>
                                                <span className="text-sm font-medium text-slate-500">
                                                    %{Math.round((p.produced / p.quantity) * 100)} Tamamlandı
                                                </span>
                                            </div>

                                            {/* Custom Progress Bar */}
                                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
                                                <div
                                                    className="h-full bg-green-500 transition-all duration-500 ease-out"
                                                    style={{ width: `${Math.min((p.produced / p.quantity) * 100, 100)}%` }}
                                                />
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-slate-50 p-3 rounded border text-center">
                                                    <span className="text-xs text-slate-500 block uppercase tracking-wider">Planlanan</span>
                                                    <span className="text-xl font-bold text-slate-900">{p.quantity}</span>
                                                </div>
                                                <div className="bg-green-50 p-3 rounded border border-green-100 text-center">
                                                    <span className="text-xs text-green-600 block uppercase tracking-wider">Üretilen</span>
                                                    <span className="text-xl font-bold text-green-700">{p.produced}</span>
                                                </div>
                                                <div className="bg-amber-50 p-3 rounded border border-amber-100 text-center">
                                                    <span className="text-xs text-amber-600 block uppercase tracking-wider">Kalan</span>
                                                    <span className="text-xl font-bold text-amber-700">{Math.max(p.quantity - p.produced, 0)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Column 1: Main Info */}
                                            <div className="space-y-6">
                                                <div className="bg-slate-50 p-4 rounded-lg border">
                                                    <h4 className="font-semibold text-slate-900 mb-4 border-b pb-2">Temel Bilgiler</h4>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Firma / Müşteri</span>
                                                            <span className="font-medium">{p.company || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Sistem Kodu</span>
                                                            <span className="font-mono bg-white px-1 border rounded">{p.systemCode}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Barkod</span>
                                                            <span className="font-mono text-xs text-slate-600">{p.barcode}</span>
                                                        </div>
                                                        <div className="pt-2">
                                                            <div className="bg-white p-2 rounded border inline-block">
                                                                <BarcodeDisplay value={p.barcode} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column 2: Configuration */}
                                            <div className="space-y-6">
                                                <div className="bg-slate-50 p-4 rounded-lg border">
                                                    <h4 className="font-semibold text-slate-900 mb-4 border-b pb-2">Konfigürasyon</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Ayak Tipi</span>
                                                            <span className="font-medium">{p.footType || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Ayak Rengi</span>
                                                            <span className="font-medium">{p.footMaterial || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Kol Tipi</span>
                                                            <span className="font-medium">{p.armType || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Sırt Tipi</span>
                                                            <span className="font-medium">{p.backType || '-'}</span>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <span className="text-xs text-slate-500 block">Kumaş Türü</span>
                                                            <span className="font-medium">{p.fabricType || '-'}</span>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <span className="text-xs text-slate-500 block">Malzeme Notu</span>
                                                            <span className="font-medium">{p.material || '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column 3: Dates & Logistics */}
                                            <div className="space-y-6">
                                                <div className="bg-slate-50 p-4 rounded-lg border">
                                                    <h4 className="font-semibold text-slate-900 mb-4 border-b pb-2">Planlama & Lojistik</h4>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Sipariş Tarihi</span>
                                                            <span className="font-medium">{p.orderDate ? new Date(p.orderDate).toLocaleDateString('tr-TR') : '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Termin Tarihi</span>
                                                            <span className={`font-bold text-lg ${new Date(p.terminDate) < new Date() ? 'text-red-600' : 'text-slate-900'}`}>
                                                                {new Date(p.terminDate).toLocaleDateString('tr-TR')}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                                            <div className="bg-blue-50 p-2 rounded text-center">
                                                                <span className="text-xs text-blue-600 block">Planlanan</span>
                                                                <span className="font-bold text-lg text-blue-900">{p.quantity}</span>
                                                            </div>
                                                            <div className={`p-2 rounded text-center ${p.produced >= p.quantity ? 'bg-green-100' : 'bg-orange-50'}`}>
                                                                <span className="text-xs text-slate-500 block">Üretilen</span>
                                                                <span className="font-bold text-lg">{p.produced}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-slate-500 block">Raf Kodu</span>
                                                            <div className="mt-1">
                                                                {p.inventory && p.inventory.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {p.inventory.map((inv, idx) => (
                                                                            <span key={idx} className="font-bold bg-yellow-300 px-2 py-1 rounded text-black text-xs">
                                                                                {inv.shelf} ({inv.quantity})
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-sm font-medium text-slate-400">Belirtilmedi</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-500 mb-2">Açıklama</h4>
                                                    <div className="bg-slate-50 p-3 rounded-md min-h-[80px] border text-sm text-slate-700">
                                                        {p.description || 'Açıklama yok.'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </DialogContent>
                            </Dialog>
                        ))}
                        {paginatedProducts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                                    Üretim kuyruğunda uygun kayıt bulunamadı.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Önceki
                    </Button>
                    <div className="text-sm text-slate-500">
                        Sayfa {currentPage} / {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Sonraki
                    </Button>
                </div>
            )}
        </div>
    );
}
