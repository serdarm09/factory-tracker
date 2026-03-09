'use client';

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck, Filter, X, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Package, User, Car, Info } from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ProductImage } from "@/components/product-image";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface ShippedProductsTableProps {
    shippedProducts: any[];
    userRole: string;
}

const PARTS_SHIPPED_MAP: Record<string, { label: string; cls: string }> = {
    EVET:       { label: "Ayak veya Aksesuar sevk edildi",    cls: "bg-green-100 text-green-800 border border-green-200"  },
    HAYIR:      { label: "Ayak veya Aksesuar sevk edilmedi",  cls: "bg-red-100 text-red-800 border border-red-200"        },
    DAHA_SONRA: { label: "Ayak veya Aksesuar sevk edilecek",  cls: "bg-amber-100 text-amber-800 border border-amber-200"  },
};

function PartsShippedBadge({ value }: { value: string | null | undefined }) {
    if (!value) return <span className="text-xs text-slate-400">—</span>;
    const info = PARTS_SHIPPED_MAP[value] ?? { label: value, cls: "bg-slate-100 text-slate-700" };
    return <span className={`text-xs px-2 py-0.5 rounded font-medium ${info.cls}`}>{info.label}</span>;
}

export function ShippedProductsTable({ shippedProducts, userRole }: ShippedProductsTableProps) {
    const [viewProduct, setViewProduct] = useState<any | null>(null);
    const [viewOpen, setViewOpen] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // Filter states
    const [filterProduct, setFilterProduct] = useState("");
    const [filterCompany, setFilterCompany] = useState("");
    const [filterHasShipment, setFilterHasShipment] = useState("all"); // all, with, without
    const [filterDateStart, setFilterDateStart] = useState(""); // Sevk tarihi başlangıç
    const [filterDateEnd, setFilterDateEnd] = useState("");   // Sevk tarihi bitiş

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Get unique values for dropdowns
    const uniqueCompanies = useMemo(() => {
        const companies = new Set<string>();
        shippedProducts.forEach(product => {
            if (product.order?.company) companies.add(product.order.company);
        });
        return Array.from(companies).sort();
    }, [shippedProducts]);

    // Filter products
    const filteredProducts = useMemo(() => {
        return shippedProducts.filter(product => {
            // Product search
            if (filterProduct) {
                const searchLower = filterProduct.toLowerCase();
                const matchName = product.name?.toLowerCase().includes(searchLower);
                const matchModel = product.model?.toLowerCase().includes(searchLower);
                const matchCode = product.systemCode?.toLowerCase().includes(searchLower);
                const matchBarcode = product.barcode?.toLowerCase().includes(searchLower);
                if (!matchName && !matchModel && !matchCode && !matchBarcode) return false;
            }

            // Company filter
            if (filterCompany && product.order?.company !== filterCompany) return false;

            // Shipment record filter
            if (filterHasShipment === "with" && product.shipmentItems.length === 0) return false;
            if (filterHasShipment === "without" && product.shipmentItems.length > 0) return false;

            // Sevk tarihi filtresi - en son shipmentItem.shipment.exitDate'e göre
            if (filterDateStart || filterDateEnd) {
                const shipDates = product.shipmentItems
                    ?.map((item: any) => item.shipment?.exitDate)
                    .filter(Boolean)
                    .map((d: string) => new Date(d).getTime());
                const latestShipDate = shipDates?.length > 0 ? Math.max(...shipDates) : null;

                if (!latestShipDate) return false; // Tarihi olan sevkiyat yoksa gösterme
                if (filterDateStart && latestShipDate < new Date(filterDateStart).getTime()) return false;
                if (filterDateEnd) {
                    const endDate = new Date(filterDateEnd);
                    endDate.setHours(23, 59, 59, 999);
                    if (latestShipDate > endDate.getTime()) return false;
                }
            }

            return true;
        });
    }, [shippedProducts, filterProduct, filterCompany, filterHasShipment, filterDateStart, filterDateEnd]);

    // Pagination
    const totalPages = Math.ceil(filteredProducts.length / pageSize);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    // Check if any filter is active
    const hasActiveFilters = filterProduct || filterCompany || filterHasShipment !== "all" || filterDateStart || filterDateEnd;

    // Clear all filters
    const clearFilters = () => {
        setFilterProduct("");
        setFilterCompany("");
        setFilterHasShipment("all");
        setFilterDateStart("");
        setFilterDateEnd("");
        setCurrentPage(1);
    };

    const handleRowClick = (product: any) => {
        setViewProduct(product);
        setViewOpen(true);
    };

    const handleExport = () => {
        setExportLoading(true);
        try {
            const exportData = filteredProducts.map(product => ({
                "Ürün Kodu": product.systemCode || '',
                "Ürün Adı": product.name || '',
                "Model": product.model || '',
                "Firma": product.order?.company || '',
                "Sipariş": product.order?.name || '',
                "Sevk Edilen Adet": product.shippedQty || 0,
                "Sevkiyat Bilgisi": product.shipmentItems && product.shipmentItems.length > 0 ?
                    product.shipmentItems.map((item: any) => `${item.shipment.company || 'Belirtilmedi'}`).join(', ') :
                    'Kayıt yok',
                "Barkod": product.barcode || '',
                "Planlayan": product.creator?.username || '',
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, "Sevk Edilenler");
            XLSX.writeFile(wb, `Sevk_Edilenler_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success(`${exportData.length} kayıt Excel'e aktarıldı`);
        } catch (error) {
            toast.error("Excel oluşturulurken hata oluştu");
        } finally {
            setExportLoading(false);
        }
    };

    // Calculate totals
    const totalShipped = filteredProducts.reduce((sum, product) => sum + (product.shippedQty || 0), 0);
    const productsWithShipmentRecord = shippedProducts.filter(p => p.shipmentItems.length > 0).length;
    const productsWithoutShipmentRecord = shippedProducts.filter(p => p.shipmentItems.length === 0).length;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 font-medium">Toplam Sevk Edilen</p>
                                <p className="text-3xl font-bold text-blue-700">{shippedProducts.length}</p>
                            </div>
                            <Package className="h-10 w-10 text-blue-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-orange-600 font-medium">Sevk Edilen Adet</p>
                                <p className="text-3xl font-bold text-orange-700">{totalShipped}</p>
                            </div>
                            <Truck className="h-10 w-10 text-orange-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 font-medium">Kayıtlı Sevkiyat</p>
                                <p className="text-3xl font-bold text-green-700">{productsWithShipmentRecord}</p>
                            </div>
                            <User className="h-10 w-10 text-green-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-amber-600 font-medium">Kayıtsız Sevkiyat</p>
                                <p className="text-3xl font-bold text-amber-700">{productsWithoutShipmentRecord}</p>
                            </div>
                            <Car className="h-10 w-10 text-amber-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Card */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filtreler
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="h-4 w-4 mr-1" />
                                    Temizle
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                                disabled={exportLoading || filteredProducts.length === 0}
                                className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                                <Download className="h-4 w-4" />
                                Excel İndir
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Product Search */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Ürün Ara</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ad, kod, barkod..."
                                    value={filterProduct}
                                    onChange={(e) => { setFilterProduct(e.target.value); setCurrentPage(1); }}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        {/* Company Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Firma</label>
                            <Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v === "all" ? "" : v); setCurrentPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tüm firmalar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm firmalar</SelectItem>
                                    {uniqueCompanies.map(company => (
                                        <SelectItem key={company} value={company}>{company}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Shipment Record Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Sevkiyat Kaydı</label>
                            <Select value={filterHasShipment} onValueChange={(v) => { setFilterHasShipment(v); setCurrentPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tümü" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    <SelectItem value="with">Kayıtlı Olanlar</SelectItem>
                                    <SelectItem value="without">Kayıtsız Olanlar</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Range Filter - Sevk Tarihi */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Sevk Tarihi (Başlangıç)</label>
                            <Input
                                type="date"
                                value={filterDateStart}
                                onChange={(e) => { setFilterDateStart(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Sevk Tarihi (Bitiş)</label>
                            <Input
                                type="date"
                                value={filterDateEnd}
                                onChange={(e) => { setFilterDateEnd(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                    </div>

                    {/* Active Filters Summary */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
                            <span className="text-sm text-muted-foreground">Aktif filtreler:</span>
                            {filterProduct && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Ürün: {filterProduct}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterProduct("")} />
                                </Badge>
                            )}
                            {filterCompany && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Firma: {filterCompany}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterCompany("")} />
                                </Badge>
                            )}
                            {filterDateStart && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Sevk: {filterDateStart} {filterDateEnd && `→ ${filterDateEnd}`}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => { setFilterDateStart(""); setFilterDateEnd(""); }} />
                                </Badge>
                            )}
                            {filterHasShipment !== "all" && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Kayıt: {filterHasShipment === "with" ? "Var" : "Yok"}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterHasShipment("all")} />
                                </Badge>
                            )}
                            <span className="text-sm font-medium ml-auto">
                                {filteredProducts.length} / {shippedProducts.length} kayıt
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardHeader className="bg-blue-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                        <Truck className="h-5 w-5" />
                        Sevk Edilen Ürünler
                        <Badge variant="outline" className="ml-2">{filteredProducts.length} ürün</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ürün</TableHead>
                                <TableHead>Firma</TableHead>
                                <TableHead>Sipariş</TableHead>
                                <TableHead>Sevk Tarihi</TableHead>
                                <TableHead className="text-center">Sevk Edilen</TableHead>
                                <TableHead>Ayak veya Aksesuar Durumu</TableHead>
                                <TableHead>Sevkiyat Bilgileri</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        {hasActiveFilters ? "Filtrelere uygun ürün bulunamadı" : "Henüz sevk edilen ürün bulunmuyor"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedProducts.map((product) => (
                                    <TableRow
                                        key={product.id}
                                        className="cursor-pointer hover:bg-blue-50 transition-colors"
                                        onClick={() => handleRowClick(product)}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {product.imageUrl && (
                                                    <img src={product.imageUrl} alt="" className="w-8 h-8 object-contain rounded border bg-white" />
                                                )}
                                                <div>
                                                    <div className="font-semibold">{product.name}</div>
                                                    <div className="text-xs text-slate-500">{product.systemCode}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-medium">{product.order?.company || '-'}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">{product.order?.name || '-'}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {product.shipmentItems && product.shipmentItems.length > 0 ? (() => {
                                                    const shipDates = product.shipmentItems
                                                        .map((item: any) => item.shipment?.exitDate)
                                                        .filter(Boolean)
                                                        .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
                                                    return shipDates.length > 0
                                                        ? <span className="text-teal-700 font-medium">{format(new Date(shipDates[0]), "dd MMM yyyy", { locale: tr })}</span>
                                                        : <span className="text-slate-400 text-xs">Tarih girilmemiş</span>;
                                                })() : <span className="text-amber-500 text-xs">—</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="font-bold text-blue-600 text-lg">{product.shippedQty || 0}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {product.shipmentItems && product.shipmentItems.length > 0
                                                    ? product.shipmentItems.map((item: any, idx: number) => (
                                                        <PartsShippedBadge key={idx} value={item.partsShipped} />
                                                    ))
                                                    : <span className="text-xs text-slate-400">—</span>
                                                }
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {product.shipmentItems && product.shipmentItems.length > 0 ? (
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
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="flex items-center justify-between px-4 py-4 border-t">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Sayfa başına:</span>
                                <Select
                                    value={pageSize.toString()}
                                    onValueChange={(value) => {
                                        setPageSize(parseInt(value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[70px] h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span>Toplam {filteredProducts.length} kayıt</span>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>

                                <div className="flex items-center gap-1 mx-2">
                                    <span className="text-sm">
                                        Sayfa {currentPage} / {totalPages || 1}
                                    </span>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage >= totalPages}
                                >
                                    <ChevronsRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* View Details Dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-blue-600" />
                            Ürün Detayları
                        </DialogTitle>
                        <DialogDescription>
                            {viewProduct?.name} - {viewProduct?.shippedQty || 0} adet sevk edildi
                        </DialogDescription>
                    </DialogHeader>

                    {viewProduct && (
                        <div className="space-y-4 mt-4">
                            <div className="border rounded-lg p-4">
                                <h4 className="font-semibold text-sm text-slate-900 border-b pb-2 mb-3">Ürün Bilgileri</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Ürün Kodu:</span>
                                        <span className="font-mono font-medium">{viewProduct.systemCode}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Ürün Adı:</span>
                                        <span className="font-medium">{viewProduct.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Model:</span>
                                        <span>{viewProduct.model}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Firma:</span>
                                        <span>{viewProduct.order?.company || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Sipariş:</span>
                                        <span>{viewProduct.order?.name || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border rounded-lg p-4">
                                <h4 className="font-semibold text-sm text-slate-900 border-b pb-2 mb-3">Sevkiyat Bilgileri</h4>
                                {viewProduct.shipmentItems && viewProduct.shipmentItems.length > 0 ? (
                                    <div className="space-y-2">
                                                        {viewProduct.shipmentItems.map((item: any, idx: number) => (
                                                            <div key={idx} className="bg-green-50 p-3 rounded text-sm space-y-1.5">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">Firma:</span>
                                                                    <span className="font-medium">{item.shipment.company || 'Belirtilmedi'}</span>
                                                                </div>
                                                                {item.shipment.driverName && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-500">Sürücü:</span>
                                                                        <span>{item.shipment.driverName}</span>
                                                                    </div>
                                                                )}
                                                                {item.shipment.vehiclePlate && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-500">Plaka:</span>
                                                                        <span className="font-mono">{item.shipment.vehiclePlate}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">Adet:</span>
                                                                    <span className="font-bold">{item.quantity}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center pt-1 border-t border-green-200">
                                                                    <span className="text-slate-500 flex items-center gap-1">
                                                                        <Info className="h-3 w-3" /> Parça Durumu:
                                                                    </span>
                                                                    <PartsShippedBadge value={item.partsShipped} />
                                                                </div>
                                                            </div>
                                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 p-3 rounded text-sm text-amber-700">
                                        ⚠ Henüz sevkiyat kaydı oluşturulmamış
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
