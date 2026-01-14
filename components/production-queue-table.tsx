'use client';

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import BarcodeDisplay from "@/components/barcode-display";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    material?: string | null;
    description?: string | null;
    shelf?: string | null;
};

export function ProductionQueueTable({ products }: { products: Product[] }) {
    const [search, setSearch] = useState("");
    const [scannedBarcode, setScannedBarcode] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const filtered = products.filter(p => {
        const searchLower = search.toLowerCase();
        return (
            p.name.toLowerCase().includes(searchLower) ||
            p.model.toLowerCase().includes(searchLower) ||
            (p.company && p.company.toLowerCase().includes(searchLower)) ||
            p.barcode.toLowerCase().includes(searchLower) ||
            p.systemCode.toLowerCase().includes(searchLower)
        );
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
                            <span class="label">Sistem Kodu:</span>
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
                    </div>

                    <div class="barcode-box">
                        <!-- SVG will not copy easily, using large text for now but in a real app better to generate image -->
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
            printWindow.print();
            printWindow.close();
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
                {/* Barcode scan input */}
                <Input
                    placeholder="Barkod Okut..."
                    value={scannedBarcode}
                    onChange={(e) => { setScannedBarcode(e.target.value); setCurrentPage(1); }}
                    className="max-w-sm ml-2"
                />
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
                                    <TableRow className={`cursor-pointer hover:bg-slate-50 ${scannedBarcode && p.barcode === scannedBarcode ? "bg-yellow-100" : ""}`}>
                                        <TableCell>
                                            <div className="w-2 h-8 bg-blue-500 rounded-lg"></div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {p.name}
                                            <div className="text-xs text-slate-400">{p.systemCode}</div>
                                        </TableCell>
                                        <TableCell>{p.model}</TableCell>
                                        <TableCell>{p.company || '-'}</TableCell>
                                        <TableCell className="text-red-700 font-bold font-mono">
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
                                <DialogContent className="max-w-3xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                            {p.name}
                                            <span className="text-base font-normal text-slate-500">({p.model})</span>
                                        </DialogTitle>
                                    </DialogHeader>
                                    <ScrollArea className="max-h-[80vh]">
                                        <div className="grid grid-cols-2 gap-6 p-4">
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-500 mb-1">Firma / Müşteri</h4>
                                                    <p className="text-lg">{p.company || '-'}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-500 mb-1">Sistem Kodu</h4>
                                                    <p className="font-mono bg-slate-100 p-2 rounded inline-block">{p.systemCode}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-500 mb-1">Termin Tarihi</h4>
                                                    <p className="text-red-600 font-bold text-lg">{new Date(p.terminDate).toLocaleDateString('tr-TR')}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-500 mb-1">Raf Kodu</h4>
                                                    <p className="text-lg font-bold bg-yellow-100 p-2 rounded inline-block">{p.shelf || '-'}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-500 mb-1">Malzeme / Kumaş</h4>
                                                    <p className="text-lg">{p.material || '-'}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-500 mb-1">Açıklama</h4>
                                                    <div className="bg-slate-50 p-3 rounded-md min-h-[100px] border">
                                                        {p.description || 'Açıklama yok.'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-500 mb-1">Durum</h4>
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                                        p.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                                            'bg-green-100 text-green-600'
                                                        }`}>
                                                        {p.status === 'PENDING' ? 'BEKLEMEDE' :
                                                            p.status === 'APPROVED' ? 'ONAYLANDI' : 'TAMAMLANDI'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="col-span-2 pt-6 border-t mt-4 text-center">
                                                <div className="inline-block p-4 border rounded-xl bg-white shadow-sm">
                                                    <BarcodeDisplay value={p.barcode} />
                                                    <p className="mt-2 text-xs text-slate-400 font-mono">{p.barcode}</p>
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
