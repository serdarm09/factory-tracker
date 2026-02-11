'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Printer, Search, RefreshCw, CheckSquare, Square, Loader2 } from "lucide-react";
import BarcodeDisplay from "@/components/barcode-display";

interface Product {
    id: number;
    name: string;
    model: string;
    systemCode: string;
    barcode: string | null;
    quantity: number;
    status: string;
    company?: string;
    terminDate?: string;
    aciklama1?: string | null;
    aciklama2?: string | null;
    aciklama3?: string | null;
    aciklama4?: string | null;
}

export default function BarcodePage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
    const [statusFilter, setStatusFilter] = useState("all");
    const [printSize, setPrintSize] = useState<"small" | "medium" | "large">("medium");

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/products/with-barcode');
            const data = await res.json();
            setProducts(data);
        } catch (error) {
            console.error('Ürünler yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = search === "" ||
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.model.toLowerCase().includes(search.toLowerCase()) ||
            p.systemCode.toLowerCase().includes(search.toLowerCase()) ||
            (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase())) ||
            (p.company && p.company.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus = statusFilter === "all" || p.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const toggleProduct = (id: number) => {
        const newSelected = new Set(selectedProducts);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedProducts(newSelected);
    };

    const selectAll = () => {
        if (selectedProducts.size === filteredProducts.length) {
            setSelectedProducts(new Set());
        } else {
            setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const printSingle = (product: Product) => {
        printBarcodes([product]);
    };

    const printSelected = () => {
        const selectedList = filteredProducts.filter(p => selectedProducts.has(p.id));
        if (selectedList.length === 0) return;
        printBarcodes(selectedList);
    };

    const printBarcodes = (productsToPrint: Product[]) => {
        const sizes = {
            small: { width: 200, height: 120, fontSize: 10, barcodeSize: 16 },
            medium: { width: 300, height: 180, fontSize: 12, barcodeSize: 24 },
            large: { width: 400, height: 240, fontSize: 14, barcodeSize: 32 }
        };

        const size = sizes[printSize];

        const barcodeHtml = productsToPrint.map(p => `
            <div class="barcode-label" style="width: ${size.width}px; height: ${size.height}px; border: 2px solid #000; padding: 8px; margin: 5px; display: inline-block; text-align: center; page-break-inside: avoid; background: #fff;">
                <div style="font-size: ${size.fontSize + 2}px; font-weight: bold; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${p.name}
                </div>
                <div style="font-size: ${size.fontSize - 1}px; color: #333; margin-bottom: 5px;">
                    ${p.model}
                </div>
                <div style="font-size: ${size.fontSize - 2}px; color: #666; margin-bottom: 5px;">
                    ${p.company || ''} ${p.terminDate ? '| Termin: ' + new Date(p.terminDate).toLocaleDateString('tr-TR') : ''}
                </div>
                ${(p.aciklama1 || p.aciklama2 || p.aciklama3) ? `
                <div style="font-size: ${size.fontSize - 3}px; color: #92400e; margin-bottom: 5px; text-align: left; background: #fffbeb; padding: 3px; border-radius: 3px; max-height: 40px; overflow: hidden;">
                    ${p.aciklama1 ? `<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">• ${p.aciklama1}</div>` : ''}
                    ${p.aciklama2 ? `<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">• ${p.aciklama2}</div>` : ''}
                    ${p.aciklama3 ? `<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">• ${p.aciklama3}</div>` : ''}
                </div>
                ` : ''}
                <div style="font-family: 'Libre Barcode 39', 'Courier New', monospace; font-size: ${size.barcodeSize}px; letter-spacing: 2px; font-weight: bold; margin: 5px 0;">
                    *${p.barcode}*
                </div>
                <div style="font-size: ${size.fontSize - 1}px; font-weight: 500; letter-spacing: 1px;">
                    ${p.barcode}
                </div>
                <div style="font-size: ${size.fontSize - 3}px; color: #999; margin-top: 3px;">
                    Kod: ${p.systemCode} | Adet: ${p.quantity}
                </div>
            </div>
        `).join('');

        const printContent = `
            <html>
                <head>
                    <title>Koli Barkodu Yazdır</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                        @media print {
                            body { padding: 0; }
                            .barcode-label { margin: 2mm !important; }
                        }
                    </style>
                </head>
                <body>
                    ${barcodeHtml}
                </body>
            </html>
        `;

        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Koli Barkodu Yazdırma</h1>
                    <p className="text-muted-foreground">Ürün kolilerine yapıştırılacak barkodları yazdırın</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchProducts} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Yenile
                    </Button>
                    {selectedProducts.size > 0 && (
                        <Button onClick={printSelected} className="bg-green-600 hover:bg-green-700">
                            <Printer className="h-4 w-4 mr-2" />
                            Seçilenleri Yazdır ({selectedProducts.size})
                        </Button>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filtreler</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative md:col-span-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Ürün, model, barkod ara..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Durum" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Durumlar</SelectItem>
                                <SelectItem value="APPROVED">Onaylı</SelectItem>
                                <SelectItem value="IN_PRODUCTION">Üretimde</SelectItem>
                                <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={printSize} onValueChange={(v) => setPrintSize(v as any)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Etiket Boyutu" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="small">Küçük</SelectItem>
                                <SelectItem value="medium">Orta</SelectItem>
                                <SelectItem value="large">Büyük</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                            Ürünler
                            <Badge variant="outline" className="ml-2">{filteredProducts.length}</Badge>
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={selectAll}>
                            {selectedProducts.size === filteredProducts.length && filteredProducts.length > 0 ? (
                                <CheckSquare className="h-4 w-4 mr-2" />
                            ) : (
                                <Square className="h-4 w-4 mr-2" />
                            )}
                            Tümünü Seç
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Ürün</TableHead>
                                    <TableHead>Model</TableHead>
                                    <TableHead>Firma</TableHead>
                                    <TableHead>Barkod</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead className="text-right">İşlem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.map(p => (
                                    <TableRow key={p.id} className={selectedProducts.has(p.id) ? 'bg-blue-50' : ''}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedProducts.has(p.id)}
                                                onCheckedChange={() => toggleProduct(p.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{p.name}</div>
                                            <div className="text-xs text-muted-foreground">{p.systemCode}</div>
                                        </TableCell>
                                        <TableCell>{p.model}</TableCell>
                                        <TableCell>{p.company || '-'}</TableCell>
                                        <TableCell>
                                            {p.barcode ? (
                                                <div className="max-w-[150px]">
                                                    <BarcodeDisplay value={p.barcode} />
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="text-red-500">Barkod Yok</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                p.status === 'APPROVED' ? 'default' :
                                                    p.status === 'IN_PRODUCTION' ? 'secondary' :
                                                        'outline'
                                            }>
                                                {p.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => printSingle(p)}
                                                disabled={!p.barcode}
                                            >
                                                <Printer className="h-4 w-4 mr-1" />
                                                Yazdır
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            {search ? 'Aramanıza uygun ürün bulunamadı' : 'Barkodlu ürün bulunamadı'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
