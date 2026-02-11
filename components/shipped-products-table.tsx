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
import { Truck, Filter, X, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Package, User, Car } from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ProductImage } from "@/components/product-image";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface ShippedItem {
    id: number;
    shipmentId: number;
    shipmentDate: Date;
    exitDate: Date | null;
    estimatedDate: Date | null;
    company: string;
    driverName: string | null;
    vehiclePlate: string | null;
    shipmentStatus: string;
    quantity: number;
    product: any;
}

interface ShippedProductsTableProps {
    shippedItems: ShippedItem[];
    userRole: string;
}

export function ShippedProductsTable({ shippedItems, userRole }: ShippedProductsTableProps) {
    const [viewItem, setViewItem] = useState<ShippedItem | null>(null);
    const [viewOpen, setViewOpen] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // Filter states
    const [filterProduct, setFilterProduct] = useState("");
    const [filterCompany, setFilterCompany] = useState("");
    const [filterDriver, setFilterDriver] = useState("");
    const [filterPlate, setFilterPlate] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Get unique values for dropdowns
    const uniqueCompanies = useMemo(() => {
        const companies = new Set<string>();
        shippedItems.forEach(item => {
            if (item.company) companies.add(item.company);
        });
        return Array.from(companies).sort();
    }, [shippedItems]);

    const uniqueDrivers = useMemo(() => {
        const drivers = new Set<string>();
        shippedItems.forEach(item => {
            if (item.driverName) drivers.add(item.driverName);
        });
        return Array.from(drivers).sort();
    }, [shippedItems]);

    // Filter items
    const filteredItems = useMemo(() => {
        return shippedItems.filter(item => {
            // Product search
            if (filterProduct) {
                const searchLower = filterProduct.toLowerCase();
                const matchName = item.product?.name?.toLowerCase().includes(searchLower);
                const matchModel = item.product?.model?.toLowerCase().includes(searchLower);
                const matchCode = item.product?.systemCode?.toLowerCase().includes(searchLower);
                const matchBarcode = item.product?.barcode?.toLowerCase().includes(searchLower);
                if (!matchName && !matchModel && !matchCode && !matchBarcode) return false;
            }

            // Company filter
            if (filterCompany && item.company !== filterCompany) return false;

            // Driver filter
            if (filterDriver) {
                if (!item.driverName?.toLowerCase().includes(filterDriver.toLowerCase())) return false;
            }

            // Plate filter
            if (filterPlate) {
                if (!item.vehiclePlate?.toLowerCase().includes(filterPlate.toLowerCase())) return false;
            }

            // Status filter
            if (filterStatus !== "all" && item.shipmentStatus !== filterStatus) return false;

            // Date from
            if (filterDateFrom) {
                const itemDate = new Date(item.shipmentDate);
                const fromDate = new Date(filterDateFrom);
                if (itemDate < fromDate) return false;
            }

            // Date to
            if (filterDateTo) {
                const itemDate = new Date(item.shipmentDate);
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999);
                if (itemDate > toDate) return false;
            }

            return true;
        });
    }, [shippedItems, filterProduct, filterCompany, filterDriver, filterPlate, filterStatus, filterDateFrom, filterDateTo]);

    // Pagination
    const totalPages = Math.ceil(filteredItems.length / pageSize);
    const paginatedItems = filteredItems.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    // Check if any filter is active
    const hasActiveFilters = filterProduct || filterCompany || filterDriver || filterPlate || filterStatus !== "all" || filterDateFrom || filterDateTo;

    // Clear all filters
    const clearFilters = () => {
        setFilterProduct("");
        setFilterCompany("");
        setFilterDriver("");
        setFilterPlate("");
        setFilterStatus("all");
        setFilterDateFrom("");
        setFilterDateTo("");
        setCurrentPage(1);
    };

    const handleRowClick = (item: ShippedItem) => {
        setViewItem(item);
        setViewOpen(true);
    };

    const handleExport = () => {
        setExportLoading(true);
        try {
            const exportData = filteredItems.map(item => ({
                "Sevkiyat No": item.shipmentId,
                "Ürün Kodu": item.product?.systemCode || '',
                "Ürün Adı": item.product?.name || '',
                "Model": item.product?.model || '',
                "Sevk Edilen Firma": item.company,
                "Sevk Adedi": item.quantity,
                "Sevk Tarihi": item.shipmentDate ? format(new Date(item.shipmentDate), "dd.MM.yyyy HH:mm") : '',
                "Sürücü Adı": item.driverName || '',
                "Araç Plakası": item.vehiclePlate || '',
                "Durum": item.shipmentStatus === "SHIPPED" ? "Sevk Edildi" : item.shipmentStatus === "DELIVERED" ? "Teslim Edildi" : "Planlandı",
                "Barkod": item.product?.barcode || '',
                "Planlayan": item.product?.creator?.username || '',
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
    const totalShipped = filteredItems.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-orange-50 border-orange-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-orange-600 font-medium">Toplam Sevkiyat</p>
                                <p className="text-3xl font-bold text-orange-700">{new Set(shippedItems.map(i => i.shipmentId)).size}</p>
                            </div>
                            <Truck className="h-10 w-10 text-orange-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 font-medium">Sevk Edilen Ürün</p>
                                <p className="text-3xl font-bold text-blue-700">{totalShipped}</p>
                            </div>
                            <Package className="h-10 w-10 text-blue-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 font-medium">Farklı Firma</p>
                                <p className="text-3xl font-bold text-green-700">{uniqueCompanies.length}</p>
                            </div>
                            <User className="h-10 w-10 text-green-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-purple-600 font-medium">Farklı Sürücü</p>
                                <p className="text-3xl font-bold text-purple-700">{uniqueDrivers.length}</p>
                            </div>
                            <Car className="h-10 w-10 text-purple-400" />
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
                                disabled={exportLoading || filteredItems.length === 0}
                                className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                                <Download className="h-4 w-4" />
                                Excel İndir
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
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
                            <label className="text-xs font-medium text-muted-foreground">Sevk Edilen Firma</label>
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

                        {/* Driver Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Sürücü</label>
                            <Input
                                placeholder="Sürücü adı..."
                                value={filterDriver}
                                onChange={(e) => { setFilterDriver(e.target.value); setCurrentPage(1); }}
                            />
                        </div>

                        {/* Plate Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Plaka</label>
                            <Input
                                placeholder="Araç plakası..."
                                value={filterPlate}
                                onChange={(e) => { setFilterPlate(e.target.value); setCurrentPage(1); }}
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Durum</label>
                            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tüm durumlar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                                    <SelectItem value="PLANNED">Planlandı</SelectItem>
                                    <SelectItem value="SHIPPED">Sevk Edildi</SelectItem>
                                    <SelectItem value="DELIVERED">Teslim Edildi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date From */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Başlangıç</label>
                            <Input
                                type="date"
                                value={filterDateFrom}
                                onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                            />
                        </div>

                        {/* Date To */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Bitiş</label>
                            <Input
                                type="date"
                                value={filterDateTo}
                                onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
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
                            {filterDriver && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Sürücü: {filterDriver}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDriver("")} />
                                </Badge>
                            )}
                            {filterPlate && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Plaka: {filterPlate}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterPlate("")} />
                                </Badge>
                            )}
                            {filterStatus !== "all" && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Durum: {filterStatus === "SHIPPED" ? "Sevk Edildi" : filterStatus === "DELIVERED" ? "Teslim Edildi" : "Planlandı"}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterStatus("all")} />
                                </Badge>
                            )}
                            {filterDateFrom && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Başlangıç: {filterDateFrom}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDateFrom("")} />
                                </Badge>
                            )}
                            {filterDateTo && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Bitiş: {filterDateTo}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDateTo("")} />
                                </Badge>
                            )}
                            <span className="text-sm font-medium ml-auto">
                                {filteredItems.length} / {shippedItems.length} kayıt
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardHeader className="bg-orange-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-orange-900">
                        <Truck className="h-5 w-5" />
                        Sevkiyat Kayıtları
                        <Badge variant="outline" className="ml-2">{filteredItems.length} kayıt</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Sevk No</TableHead>
                                <TableHead>Ürün</TableHead>
                                <TableHead>Sevk Firma</TableHead>
                                <TableHead className="text-center">Adet</TableHead>
                                <TableHead>Sevk Tarihi</TableHead>
                                <TableHead>Sürücü</TableHead>
                                <TableHead>Plaka</TableHead>
                                <TableHead>Durum</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                                        {hasActiveFilters ? "Filtrelere uygun kayıt bulunamadı" : "Henüz sevkiyat kaydı bulunmuyor"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedItems.map((item) => (
                                    <TableRow
                                        key={`${item.shipmentId}-${item.id}`}
                                        className="cursor-pointer hover:bg-orange-50 transition-colors"
                                        onClick={() => handleRowClick(item)}
                                    >
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono">#{item.shipmentId}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {item.product?.imageUrl && (
                                                    <img src={item.product.imageUrl} alt="" className="w-8 h-8 object-contain rounded border bg-white" />
                                                )}
                                                <div>
                                                    <div className="font-semibold">{item.product?.name}</div>
                                                    <div className="text-xs text-slate-500">{item.product?.systemCode}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-medium">{item.company}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="font-bold text-orange-600 text-lg">{item.quantity}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {format(new Date(item.shipmentDate), "dd.MM.yyyy", { locale: tr })}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {format(new Date(item.shipmentDate), "HH:mm", { locale: tr })}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {item.driverName ? (
                                                <div className="flex items-center gap-1">
                                                    <User className="h-3 w-3 text-slate-400" />
                                                    <span>{item.driverName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.vehiclePlate ? (
                                                <Badge variant="outline" className="font-mono">
                                                    {item.vehiclePlate}
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                item.shipmentStatus === 'SHIPPED' ? 'bg-orange-100 text-orange-600' :
                                                item.shipmentStatus === 'DELIVERED' ? 'bg-green-100 text-green-600' :
                                                'bg-yellow-100 text-yellow-600'
                                            }`}>
                                                {item.shipmentStatus === 'SHIPPED' ? 'SEVK EDİLDİ' :
                                                 item.shipmentStatus === 'DELIVERED' ? 'TESLİM EDİLDİ' : 'PLANLANDI'}
                                            </span>
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
                                <span>Toplam {filteredItems.length} kayıt</span>
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
                            <Truck className="h-5 w-5 text-orange-600" />
                            Sevkiyat Detayları #{viewItem?.shipmentId}
                        </DialogTitle>
                        <DialogDescription>
                            {viewItem?.product?.name} - {viewItem?.quantity} adet
                        </DialogDescription>
                    </DialogHeader>

                    {viewItem && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            {/* Product Info */}
                            <div className="space-y-4">
                                <div className="border rounded-lg p-4">
                                    <h4 className="font-semibold text-sm text-slate-900 border-b pb-2 mb-3">Ürün Bilgileri</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Ürün Kodu:</span>
                                            <span className="font-mono font-medium">{viewItem.product?.systemCode}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Ürün Adı:</span>
                                            <span className="font-medium">{viewItem.product?.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Model:</span>
                                            <span>{viewItem.product?.model}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Barkod:</span>
                                            <span className="font-mono">{viewItem.product?.barcode || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Planlayan:</span>
                                            <span>{viewItem.product?.creator?.username || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border rounded-lg p-4 bg-orange-50">
                                    <h4 className="font-semibold text-sm text-orange-900 border-b border-orange-200 pb-2 mb-3">Sevk Bilgileri</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-orange-700">Sevk Adedi:</span>
                                            <span className="font-bold text-orange-900 text-lg">{viewItem.quantity}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-orange-700">Sevk Tarihi:</span>
                                            <span className="font-medium">{format(new Date(viewItem.shipmentDate), "dd MMMM yyyy HH:mm", { locale: tr })}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-orange-700">Durum:</span>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                viewItem.shipmentStatus === 'SHIPPED' ? 'bg-orange-100 text-orange-600' :
                                                viewItem.shipmentStatus === 'DELIVERED' ? 'bg-green-100 text-green-600' :
                                                'bg-yellow-100 text-yellow-600'
                                            }`}>
                                                {viewItem.shipmentStatus === 'SHIPPED' ? 'SEVK EDİLDİ' :
                                                 viewItem.shipmentStatus === 'DELIVERED' ? 'TESLİM EDİLDİ' : 'PLANLANDI'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Shipment Info */}
                            <div className="space-y-4">
                                <div className="border rounded-lg p-4 bg-blue-50">
                                    <h4 className="font-semibold text-sm text-blue-900 border-b border-blue-200 pb-2 mb-3">Teslimat Bilgileri</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-blue-700">Sevk Edilen Firma:</span>
                                            <span className="font-bold text-blue-900">{viewItem.company}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-blue-700">Sürücü Adı:</span>
                                            <span className="font-medium">{viewItem.driverName || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-blue-700">Araç Plakası:</span>
                                            <span className="font-mono font-bold">{viewItem.vehiclePlate || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {viewItem.product?.imageUrl && (
                                    <div className="border rounded-lg p-4">
                                        <h4 className="font-semibold text-sm text-slate-900 border-b pb-2 mb-3">Ürün Görseli</h4>
                                        <div className="flex justify-center">
                                            <img
                                                src={viewItem.product.imageUrl}
                                                alt={viewItem.product.name}
                                                className="max-h-48 object-contain rounded border"
                                            />
                                        </div>
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
