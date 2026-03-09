'use client';

import { useState, useMemo, useTransition } from "react";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Search, X, Filter, Building2, Clock, AlertTriangle, CheckCircle, Package, Warehouse, Loader2 } from "lucide-react";
import BarcodeDisplay from "@/components/barcode-display";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangeFilter } from "./date-range-filter";
import { DateRange } from "react-day-picker";
import { translateStatus } from "@/lib/translations";
import { ProductImage } from "@/components/product-image";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { transferToWarehouse } from "@/lib/actions";
import { toast } from "sonner";

type Product = {
    id: number;
    name: string;
    model: string;
    company: string | null;
    quantity: number;
    produced: number;
    foamQty?: number;
    upholsteryQty?: number;
    assemblyQty?: number;
    packagedQty?: number;
    storedQty?: number;
    shippedQty?: number;
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
    // NetSim Açıklamaları
    aciklama1?: string | null;
    aciklama2?: string | null;
    aciklama3?: string | null;
    aciklama4?: string | null;
    dstAdi?: string | null;
    order?: { company: string } | null;
};

// Depoya Giriş Dialog
function TransferToWarehouseDialog({ product, onSuccess }: { product: Product; onSuccess?: (productId: number, qty: number) => void }) {
    const [open, setOpen] = useState(false);
    const [quantity, setQuantity] = useState("");
    const [shelf, setShelf] = useState("");
    const [isPending, startTransition] = useTransition();

    const packagedQty = product.packagedQty || 0;

    const handleTransfer = () => {
        if (!quantity || parseInt(quantity) <= 0) {
            toast.error("Geçerli bir miktar girin");
            return;
        }

        startTransition(async () => {
            const result = await transferToWarehouse({
                productId: product.id,
                quantity: parseInt(quantity),
                shelf: shelf || undefined
            });

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(`${quantity} adet depoya alındı`);
                setOpen(false);
                setQuantity("");
                setShelf("");
                onSuccess?.(product.id, parseInt(quantity));
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 gap-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Warehouse className="h-4 w-4" />
                    Depoya Al
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Warehouse className="h-5 w-5 text-green-600" />
                        Depoya Giriş
                    </DialogTitle>
                    <DialogDescription>
                        {product.name} - Paketlenen: <span className="font-bold text-blue-600">{packagedQty}</span> adet
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Depoya Alınacak Adet *</Label>
                        <Input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min={1}
                            max={packagedQty}
                            placeholder={`Max: ${packagedQty}`}
                            className="text-lg font-bold"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Raf / Konum (Opsiyonel)</Label>
                        <Input
                            value={shelf}
                            onChange={(e) => setShelf(e.target.value)}
                            placeholder="ör. A-12"
                        />
                    </div>
                </div>
                <DialogFooter className="pt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        İptal
                    </Button>
                    <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={handleTransfer}
                        disabled={isPending || !quantity || parseInt(quantity) <= 0}
                    >
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Depoya Al
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ProductionQueueTable({ products, onTransferSuccess }: { products: Product[]; onTransferSuccess?: (productId: number, qty: number) => void }) {
    const [search, setSearch] = useState("");
    const [scannedBarcode, setScannedBarcode] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [sortField, setSortField] = useState<'orderDate' | 'terminDate' | 'name' | 'company'>('orderDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Yeni filtreler
    const [filterCompany, setFilterCompany] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterTerminStatus, setFilterTerminStatus] = useState("all"); // all, late, thisWeek, thisMonth
    const [showFilters, setShowFilters] = useState(false);
    const [printDialogProduct, setPrintDialogProduct] = useState<Product | null>(null);
    const [printSevkYeri, setPrintSevkYeri] = useState("");

    const itemsPerPage = 50;

    // Unique companies - order.company veya company'den al
    const uniqueCompanies = useMemo(() => {
        const companies = new Set<string>();
        products.forEach(p => {
            const company = p.order?.company || p.company;
            if (company) companies.add(company);
        });
        return Array.from(companies).sort();
    }, [products]);

    // Unique statuses
    const uniqueStatuses = useMemo(() => {
        const statuses = new Set<string>();
        products.forEach(p => { if (p.status) statuses.add(p.status); });
        return Array.from(statuses);
    }, [products]);

    const handleSort = (field: 'orderDate' | 'terminDate' | 'name' | 'company') => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Termin durumu kontrolleri
    const isLate = (terminDate: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(terminDate) < today;
    };

    const isThisWeek = (terminDate: string) => {
        const today = new Date();
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 7);
        const termin = new Date(terminDate);
        return termin >= today && termin <= weekEnd;
    };

    const isThisMonth = (terminDate: string) => {
        const today = new Date();
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const termin = new Date(terminDate);
        return termin >= today && termin <= monthEnd;
    };

    const filtered = products.filter(p => {
        const searchLower = search.toLowerCase();
        const company = p.order?.company || p.company;
        const matchesSearch =
            p.name.toLowerCase().includes(searchLower) ||
            p.model.toLowerCase().includes(searchLower) ||
            (company && company.toLowerCase().includes(searchLower)) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchLower)) ||
            p.systemCode.toLowerCase().includes(searchLower);

        // Firma filtresi
        const matchesCompany = !filterCompany || company === filterCompany;

        // Durum filtresi
        const matchesStatus = filterStatus === "all" || p.status === filterStatus;

        // Termin durumu filtresi
        let matchesTerminStatus = true;
        if (filterTerminStatus === "late") {
            matchesTerminStatus = isLate(p.terminDate) && p.status !== 'COMPLETED';
        } else if (filterTerminStatus === "thisWeek") {
            matchesTerminStatus = isThisWeek(p.terminDate);
        } else if (filterTerminStatus === "thisMonth") {
            matchesTerminStatus = isThisMonth(p.terminDate);
        }

        let matchesDateRequest = true;
        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);

            const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
            to.setHours(23, 59, 59, 999);

            const current = new Date(p.terminDate);
            matchesDateRequest = current >= from && current <= to;
        }

        return matchesSearch && matchesCompany && matchesStatus && matchesTerminStatus && matchesDateRequest;
    }).sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
            case 'orderDate':
                aValue = new Date(a.orderDate).getTime();
                bValue = new Date(b.orderDate).getTime();
                break;
            case 'terminDate':
                aValue = new Date(a.terminDate).getTime();
                bValue = new Date(b.terminDate).getTime();
                break;
            case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
            case 'company':
                aValue = (a.company || '').toLowerCase();
                bValue = (b.company || '').toLowerCase();
                break;
            default:
                return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedProducts = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Aktif filtre sayısı
    const activeFilterCount = [
        filterCompany,
        filterStatus !== "all",
        filterTerminStatus !== "all",
        dateRange?.from
    ].filter(Boolean).length;

    const clearAllFilters = () => {
        setSearch("");
        setScannedBarcode("");
        setFilterCompany("");
        setFilterStatus("all");
        setFilterTerminStatus("all");
        setDateRange(undefined);
        setCurrentPage(1);
    };

    // Özet istatistikler - Paketlenmiş ürünler için
    const stats = useMemo(() => {
        const late = products.filter(p => isLate(p.terminDate) && p.status !== 'COMPLETED').length;
        const thisWeek = products.filter(p => isThisWeek(p.terminDate)).length;
        const totalPackaged = products.reduce((sum, p) => sum + (p.packagedQty || 0), 0);
        return { late, thisWeek, totalPackaged, total: products.length };
    }, [products]);

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) return <span className="ml-1 text-slate-300">↕</span>;
        return <span className="ml-1 text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    const handlePrint = (p: Product, variant: 'marisit-logo' | 'marisit-logo-en' | 'marisit-text' | 'no-logo' | 'no-logo-en' | 'cezzone' | 'cezzone-en', sevkYeri?: string) => {
        let barcodeDataUrl = '';
        if (p.barcode) {
            try {
                const canvas = document.createElement('canvas');
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const JsBarcode = require('jsbarcode');
                JsBarcode(canvas, p.barcode, {
                    format: 'CODE128',
                    width: 2,
                    height: 60,
                    displayValue: false,
                    margin: 10
                });
                barcodeDataUrl = canvas.toDataURL('image/png');
            } catch (error) {
                console.error('Barcode generation error:', error);
            }
        }

        const origin = window.location.origin;
        const isEnglish = variant === 'marisit-logo-en' || variant === 'cezzone-en' || variant === 'no-logo-en';

        const logoHTML = variant === 'marisit-logo' || variant === 'marisit-logo-en'
            ? `<img src="${origin}/image.png" alt="MARİSİT" style="height:100px;margin-bottom:4px;" />`
            : variant === 'marisit-text'
                ? `<div class="logo">MARİSİT</div><div style="font-size:11px;color:#555;letter-spacing:1px;">FURNITURE MANUFACTURING</div>`
                : variant === 'cezzone' || variant === 'cezzone-en'
                    ? `<img src="${origin}/cezzonelogo.png" alt="Cezzone" style="height:180px;margin-bottom:4px;" />`
                    : '';

        const labels = isEnglish ? {
            firma: 'Customer', urunKodu: 'Product Code', urunAdi: 'Product Name', barkod: 'Barcode',
            termin: 'Due Date', planlanan: 'Planned', ayakRengi: 'Leg Color',
            kumas: 'Fabric', adet: 'Pcs', barcodTitle: 'BARCODE', sevkYeri: 'Shipping Destination',
            dstAdi: 'Fabric / Destination'
        } : {
            firma: 'Firma', urunKodu: 'Ürün Kodu', urunAdi: 'Ürün Adı', barkod: 'Barkod',
            termin: 'Termin Tarihi', planlanan: 'Planlanan', ayakRengi: 'Ayak Rengi',
            kumas: 'Kumaş', adet: 'Adet', barcodTitle: 'BARKOD', sevkYeri: 'Sevk Yeri',
            dstAdi: 'DST Adı'
        };

        const printContent = `
            <html>
                <head>
                    <title>${p.name}</title>
                    <style>
                        @page { margin: 10mm; size: A4 landscape; }
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; padding: 16px; border: 3px solid black; background: white; color: black; }
                        .header { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 14px; }
                        .logo { font-size: 48px; font-weight: bold; color: black; letter-spacing: 3px; }
                        .info-rows { margin: 12px 0; }
                        .info-row { font-size: 25px; margin-bottom: 6px; line-height: 1.4; }
                        .info-row .lbl { font-weight: bold; color: #333; }
                        .info-row .val { margin-left: 8px; }
                        .barcode-image { display: block; margin: 14px 0; width: 80%; max-width: 600px; height: auto; }
                        .barcode-number { font-family: 'Courier New', monospace; font-size: 14pt; font-weight: bold; margin-top: 6px; letter-spacing: 2px; text-align: left; }
                        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${logoHTML}
                    </div>
                    <div class="info-rows">
                        <div class="info-row"><span class="lbl">${labels.firma}:</span><span class="val">${p.order?.company || p.company || '-'}</span></div>
                        ${sevkYeri ? `<div class="info-row" style="color:#1e40af;"><span class="lbl">${labels.sevkYeri}:</span><span class="val" style="font-weight:bold;">${sevkYeri}</span></div>` : ''}
                        <div class="info-row"><span class="lbl">${labels.urunAdi}:</span><span class="val">${p.name}</span></div>
                        <div class="info-row"><span class="lbl">${labels.urunKodu}:</span><span class="val">${p.model}</span></div>
                        <div class="info-row"><span class="lbl">${labels.planlanan}:</span><span class="val">${p.quantity} ${labels.adet}</span></div>
                        ${p.dstAdi ? `<div class="info-row"><span class="lbl">${labels.dstAdi}:</span><span class="val">${p.dstAdi}</span></div>` : ''}
                    </div>
                    ${barcodeDataUrl ? `
                    <div>
                        <img src="${barcodeDataUrl}" alt="Barcode" class="barcode-image" />
                        <div class="barcode-number">${p.barcode}</div>
                    </div>` : ''}
                </body>
            </html>
        `;
        const printWindow = window.open('', '', 'width=600,height=800');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                setTimeout(() => printWindow.close(), 500);
            }, 500);
        }
    };

    return (
        <div className="space-y-5">
            {/* Özet Kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                    onClick={() => { setFilterTerminStatus("all"); setFilterStatus("all"); setCurrentPage(1); }}
                    className={`p-3 rounded-lg border text-left transition-all ${filterTerminStatus === "all" && filterStatus === "all" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white hover:bg-slate-50"}`}
                >
                    <div className="text-xs text-slate-500">Toplam Ürün</div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                </button>
                <div className="p-3 rounded-lg border bg-blue-50 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Package className="h-16 w-16 text-blue-600" />
                    </div>
                    <div className="text-xs text-blue-600 flex items-center gap-1 font-semibold">
                        <Package className="h-3 w-3" /> Depoya Hazır
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{stats.totalPackaged} <span className="text-xs font-normal text-blue-500">adet</span></div>
                </div>
                <button
                    onClick={() => { setFilterTerminStatus("late"); setFilterStatus("all"); setCurrentPage(1); }}
                    className={`p-3 rounded-lg border text-left transition-all ${filterTerminStatus === "late" ? "ring-2 ring-red-500 bg-red-50" : "bg-white hover:bg-slate-50"}`}
                >
                    <div className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Geciken
                    </div>
                    <div className="text-2xl font-bold text-red-600">{stats.late}</div>
                </button>
                <button
                    onClick={() => { setFilterTerminStatus("thisWeek"); setFilterStatus("all"); setCurrentPage(1); }}
                    className={`p-3 rounded-lg border text-left transition-all ${filterTerminStatus === "thisWeek" ? "ring-2 ring-amber-500 bg-amber-50" : "bg-white hover:bg-slate-50"}`}
                >
                    <div className="text-xs text-amber-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Bu Hafta Termin
                    </div>
                    <div className="text-2xl font-bold text-amber-600">{stats.thisWeek}</div>
                </button>
            </div>

            {/* Filtreler */}
            <Card>
                <CardContent className="pt-4">
                    <div className="space-y-3">
                        {/* Üst satır - Arama ve toggle */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ara: Ürün, Model, Firma, Barkod..."
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                                    className="pl-9"
                                />
                            </div>
                            <Button
                                variant={showFilters ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className="gap-1"
                            >
                                <Filter className="h-4 w-4" />
                                Filtreler
                                {activeFilterCount > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                                        {activeFilterCount}
                                    </Badge>
                                )}
                            </Button>
                            {activeFilterCount > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                    <X className="h-4 w-4 mr-1" /> Temizle
                                </Button>
                            )}
                        </div>

                        {/* Genişletilmiş filtreler */}
                        {showFilters && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
                                {/* Firma */}
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Firma</label>
                                    <Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v === "all" ? "" : v); setCurrentPage(1); }}>
                                        <SelectTrigger>
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-slate-400" />
                                                <SelectValue placeholder="Tüm Firmalar" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tüm Firmalar</SelectItem>
                                            {uniqueCompanies.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Durum */}
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Durum</label>
                                    <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tüm Durumlar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tüm Durumlar</SelectItem>
                                            {uniqueStatuses.map(s => (
                                                <SelectItem key={s} value={s}>{translateStatus(s)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Termin Durumu */}
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Termin Durumu</label>
                                    <Select value={filterTerminStatus} onValueChange={(v) => { setFilterTerminStatus(v); setCurrentPage(1); }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tümü" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tümü</SelectItem>
                                            <SelectItem value="late">
                                                <span className="text-red-600">Gecikmiş</span>
                                            </SelectItem>
                                            <SelectItem value="thisWeek">
                                                <span className="text-amber-600">Bu Hafta</span>
                                            </SelectItem>
                                            <SelectItem value="thisMonth">
                                                <span className="text-blue-600">Bu Ay</span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Tarih Aralığı */}
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Termin Tarihi</label>
                                    <div className="relative">
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
                            </div>
                        )}

                        {/* Sonuç bilgisi */}
                        <div className="flex items-center justify-between text-sm text-slate-500 pt-2">
                            <span>
                                {filtered.length} sonuç bulundu
                                {activeFilterCount > 0 && ` (${activeFilterCount} filtre aktif)`}
                            </span>
                            <span className="text-xs">
                                Sayfa {currentPage} / {totalPages || 1}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('name')}>
                                Ürün <SortIcon field="name" />
                            </TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('company')}>
                                Firma <SortIcon field="company" />
                            </TableHead>
                            <TableHead>
                                <div className="flex items-center gap-1">
                                    <Package className="h-4 w-4 text-blue-500" />
                                    Paketlenen
                                </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('terminDate')}>
                                Termin <SortIcon field="terminDate" />
                            </TableHead>
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
                                        <TableCell>{p.order?.company || p.company || '-'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Package className="h-4 w-4 text-blue-500" />
                                                <span className="font-bold text-blue-600">{p.packagedQty || 0}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className={`${new Date(p.terminDate) < new Date(new Date().setHours(0, 0, 0, 0)) ? 'text-red-700 font-bold' :
                                            new Date(p.terminDate) <= new Date(new Date().setDate(new Date().getDate() + 3)) ? 'text-amber-700 font-bold' :
                                                'text-slate-700 font-mono'
                                            }`}>
                                            {new Date(p.terminDate).toLocaleDateString('tr-TR')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="w-full">
                                                {p.barcode ? <BarcodeDisplay value={p.barcode} /> : '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                                                <TransferToWarehouseDialog product={p} onSuccess={(id, qty) => onTransferSuccess?.(id, qty)} />
                                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setPrintDialogProduct(p); }}>
                                                    <Printer className="w-4 h-4" />
                                                </Button>
                                            </div>
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

                                            {/* Multi-Stage Progress Bar - Aşama bazlı renkli ilerleme */}
                                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-4 flex">
                                                {/* Sünger - Mor */}
                                                {(p.foamQty || 0) > 0 && (
                                                    <div
                                                        className="h-full bg-purple-500 transition-all duration-500"
                                                        style={{ width: `${((p.foamQty || 0) / p.quantity) * 100}%` }}
                                                        title={`Sünger: ${p.foamQty || 0}`}
                                                    />
                                                )}
                                                {/* Döşeme - Sarı */}
                                                {(p.upholsteryQty || 0) > 0 && (
                                                    <div
                                                        className="h-full bg-yellow-500 transition-all duration-500"
                                                        style={{ width: `${((p.upholsteryQty || 0) / p.quantity) * 100}%` }}
                                                        title={`Döşeme: ${p.upholsteryQty || 0}`}
                                                    />
                                                )}
                                                {/* Montaj - Turuncu */}
                                                {(p.assemblyQty || 0) > 0 && (
                                                    <div
                                                        className="h-full bg-orange-500 transition-all duration-500"
                                                        style={{ width: `${((p.assemblyQty || 0) / p.quantity) * 100}%` }}
                                                        title={`Montaj: ${p.assemblyQty || 0}`}
                                                    />
                                                )}
                                                {/* Paketleme - Mavi */}
                                                {(p.packagedQty || 0) > 0 && (
                                                    <div
                                                        className="h-full bg-blue-500 transition-all duration-500"
                                                        style={{ width: `${((p.packagedQty || 0) / p.quantity) * 100}%` }}
                                                        title={`Paketleme: ${p.packagedQty || 0}`}
                                                    />
                                                )}
                                                {/* Depo - Yeşil */}
                                                {(p.storedQty || 0) > 0 && (
                                                    <div
                                                        className="h-full bg-green-500 transition-all duration-500"
                                                        style={{ width: `${((p.storedQty || 0) / p.quantity) * 100}%` }}
                                                        title={`Depoda: ${p.storedQty || 0}`}
                                                    />
                                                )}
                                                {/* Sevk - Camgöbeği */}
                                                {(p.shippedQty || 0) > 0 && (
                                                    <div
                                                        className="h-full bg-teal-500 transition-all duration-500"
                                                        style={{ width: `${((p.shippedQty || 0) / p.quantity) * 100}%` }}
                                                        title={`Sevk: ${p.shippedQty || 0}`}
                                                    />
                                                )}
                                            </div>

                                            {/* Aşama Göstergeleri */}
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {(p.foamQty || 0) > 0 && <Badge className="bg-purple-500">Sünger: {p.foamQty}</Badge>}
                                                {(p.upholsteryQty || 0) > 0 && <Badge className="bg-yellow-500 text-black">Döşeme: {p.upholsteryQty}</Badge>}
                                                {(p.assemblyQty || 0) > 0 && <Badge className="bg-orange-500">Montaj: {p.assemblyQty}</Badge>}
                                                {(p.packagedQty || 0) > 0 && <Badge className="bg-blue-500">Paket: {p.packagedQty}</Badge>}
                                                {(p.storedQty || 0) > 0 && <Badge className="bg-green-500">Depo: {p.storedQty}</Badge>}
                                                {(p.shippedQty || 0) > 0 && <Badge className="bg-teal-500">Sevk: {p.shippedQty}</Badge>}
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
                                                            <span className="text-xs text-slate-500 block">Sünger</span>
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

                                                {/* NetSim Açıklamaları */}
                                                {(p.aciklama1 || p.aciklama2 || p.aciklama3 || p.aciklama4) && (
                                                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                                                        <h4 className="font-semibold text-sm text-amber-800 mb-2">Sipariş Notları (NetSim)</h4>
                                                        <div className="space-y-1 text-sm">
                                                            {p.aciklama1 && (
                                                                <div className="bg-white p-2 rounded border border-amber-100">
                                                                    <span className="font-medium text-amber-700">1:</span> {p.aciklama1}
                                                                </div>
                                                            )}
                                                            {p.aciklama2 && (
                                                                <div className="bg-white p-2 rounded border border-amber-100">
                                                                    <span className="font-medium text-amber-700">2:</span> {p.aciklama2}
                                                                </div>
                                                            )}
                                                            {p.aciklama3 && (
                                                                <div className="bg-white p-2 rounded border border-amber-100">
                                                                    <span className="font-medium text-amber-700">3:</span> {p.aciklama3}
                                                                </div>
                                                            )}
                                                            {p.aciklama4 && (
                                                                <div className="bg-white p-2 rounded border border-amber-100">
                                                                    <span className="font-medium text-amber-700">4:</span> {p.aciklama4}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
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

            {/* Yazdırma Seçenekleri Diyaloğu */}
            <Dialog open={!!printDialogProduct} onOpenChange={(open) => { if (!open) { setPrintDialogProduct(null); setPrintSevkYeri(""); } }}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Printer className="h-5 w-5" />
                            Çıktı Türü Seçin
                        </DialogTitle>
                        <DialogDescription>
                            {printDialogProduct?.name}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Sevk Yeri Girişi */}
                    <div className="space-y-1 pb-1">
                        <label className="text-xs font-medium text-slate-600">Sevk Yeri (opsiyonel)</label>
                        <input
                            type="text"
                            placeholder="ör. İstanbul / Port Said / Dubai..."
                            value={printSevkYeri}
                            onChange={(e) => setPrintSevkYeri(e.target.value)}
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {printSevkYeri && (
                            <p className="text-xs text-blue-600">✓ Çıktıda "Sevk Yeri: {printSevkYeri}" olarak görünecek</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        {/* TR Versiyonlar */}
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-1">Türkçe</p>
                        <Button
                            variant="outline"
                            className="justify-start gap-3 h-auto py-3"
                            onClick={() => { handlePrint(printDialogProduct!, 'marisit-logo', printSevkYeri); setPrintDialogProduct(null); setPrintSevkYeri(""); }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/image.png" alt="MARİSİT" className="h-6 object-contain" />
                            <span>MARİSİT Logolu (TR)</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="justify-start gap-3 h-auto py-3"
                            onClick={() => { handlePrint(printDialogProduct!, 'cezzone', printSevkYeri); setPrintDialogProduct(null); setPrintSevkYeri(""); }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/cezzonelogo.png" alt="Cezzone" className="h-8 object-contain" />
                            <span>Cezzone Logolu (TR)</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="justify-start gap-4 h-auto py-3"
                            onClick={() => { handlePrint(printDialogProduct!, 'marisit-text', printSevkYeri); setPrintDialogProduct(null); setPrintSevkYeri(""); }}
                        >
                            <span className="font-bold tracking-widest text-sm">MARİSİT</span>
                            <span className="text-slate-500">Yazı Logolu (TR)</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="justify-start gap-3 h-auto py-3"
                            onClick={() => { handlePrint(printDialogProduct!, 'no-logo', printSevkYeri); setPrintDialogProduct(null); setPrintSevkYeri(""); }}
                        >
                            <span className="text-slate-400 text-sm">— Logosuz (TR)</span>
                        </Button>

                        {/* EN Versiyonlar */}
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-2">English</p>
                        <Button
                            variant="outline"
                            className="justify-start gap-3 h-auto py-3"
                            onClick={() => { handlePrint(printDialogProduct!, 'marisit-logo-en', printSevkYeri); setPrintDialogProduct(null); setPrintSevkYeri(""); }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/image.png" alt="MARİSİT" className="h-6 object-contain" />
                            <span>MARİSİT Logolu (EN)</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="justify-start gap-3 h-auto py-3"
                            onClick={() => { handlePrint(printDialogProduct!, 'cezzone-en', printSevkYeri); setPrintDialogProduct(null); setPrintSevkYeri(""); }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/cezzonelogo.png" alt="Cezzone" className="h-8 object-contain" />
                            <span>Cezzone Logolu (EN)</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="justify-start gap-3 h-auto py-3"
                            onClick={() => { handlePrint(printDialogProduct!, 'no-logo-en', printSevkYeri); setPrintDialogProduct(null); setPrintSevkYeri(""); }}
                        >
                            <span className="text-slate-400 text-sm">— Logosuz (EN)</span>
                        </Button>   
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
