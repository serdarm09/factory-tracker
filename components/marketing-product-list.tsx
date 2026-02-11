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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Factory, CheckCircle, Filter, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Search, Warehouse, Truck, Send, CalendarIcon } from "lucide-react";
import { translateStatus } from "@/lib/translations";
import { marketingApproveProduct } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ProductImage } from "@/components/product-image";
import { CancelProductDialog } from "@/components/cancel-product-dialog";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

interface SectionProps {
    title: string;
    children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
    return (
        <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 border-b pb-1">{title}</h3>
            <div className="space-y-1">
                {children}
            </div>
        </div>
    );
}

interface DetailProps {
    label: string;
    value: React.ReactNode;
}

function Detail({ label, value }: DetailProps) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-slate-500">{label}:</span>
            <span className="font-medium text-slate-900 text-right">{value || '-'}</span>
        </div>
    );
}

interface MarketingProductListProps {
    marketingReviewProducts: any[];
    approvedProducts: any[];
    inProductionProducts: any[];
    completedProducts: any[];
    shippedItems: any[];
    userRole: string;
}

export function MarketingProductList({ marketingReviewProducts, approvedProducts, inProductionProducts, completedProducts, shippedItems, userRole }: MarketingProductListProps) {
    const router = useRouter();
    const [sendingToProduction, setSendingToProduction] = useState<number | null>(null);
    const [viewProduct, setViewProduct] = useState<any>(null);
    const [viewOpen, setViewOpen] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // Filter states
    const [filterCompany, setFilterCompany] = useState("");
    const [filterProduct, setFilterProduct] = useState("");
    const [filterPlanner, setFilterPlanner] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
    const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<"marketingReview" | "approved" | "inProduction" | "completed" | "shipped">("marketingReview");

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // All products combined
    const allProducts = useMemo(() => {
        if (activeTab === "marketingReview") return marketingReviewProducts;
        if (activeTab === "approved") return approvedProducts;
        if (activeTab === "inProduction") return inProductionProducts;
        if (activeTab === "completed") return completedProducts;
        // For shipped tab, transform shippedItems to product-like format
        return shippedItems.map(item => ({
            ...item.product,
            shippedQuantity: item.quantity,
            shipmentDate: item.shipment.createdAt,
            shipmentCompany: item.shipment.company,
            shipmentDriver: item.shipment.driverName,
            shipmentPlate: item.shipment.vehiclePlate,
            shipmentStatus: item.shipment.status,
            shipmentId: item.shipment.id
        }));
    }, [activeTab, marketingReviewProducts, approvedProducts, inProductionProducts, completedProducts, shippedItems]);

    // Get unique companies for dropdown
    const uniqueCompanies = useMemo(() => {
        const companies = new Set<string>();
        [...marketingReviewProducts, ...approvedProducts, ...inProductionProducts, ...completedProducts].forEach(p => {
            const company = p.order?.company || p.company;
            if (company) companies.add(company);
        });
        return Array.from(companies).sort();
    }, [marketingReviewProducts, approvedProducts, inProductionProducts, completedProducts]);

    // Get unique planners for dropdown
    const uniquePlanners = useMemo(() => {
        const planners = new Set<string>();
        [...marketingReviewProducts, ...approvedProducts, ...inProductionProducts, ...completedProducts].forEach(p => {
            const planner = p.creator?.username;
            if (planner) planners.add(planner);
        });
        return Array.from(planners).sort();
    }, [marketingReviewProducts, approvedProducts, inProductionProducts, completedProducts]);

    // Filter products
    const filteredProducts = useMemo(() => {
        return allProducts.filter(p => {
            // Company filter
            if (filterCompany) {
                const company = p.order?.company || p.company || "";
                if (company !== filterCompany) return false;
            }

            // Product name/code filter
            if (filterProduct) {
                const searchTerm = filterProduct.toLowerCase();
                const matches =
                    p.name?.toLowerCase().includes(searchTerm) ||
                    p.model?.toLowerCase().includes(searchTerm) ||
                    p.systemCode?.toLowerCase().includes(searchTerm);
                if (!matches) return false;
            }

            // Planner filter
            if (filterPlanner) {
                const planner = p.creator?.username || "";
                if (planner !== filterPlanner) return false;
            }

            // Date from filter (terminDate)
            if (filterDateFrom && p.terminDate) {
                const terminDate = new Date(p.terminDate);
                const fromDate = new Date(filterDateFrom);
                fromDate.setHours(0, 0, 0, 0);
                if (terminDate < fromDate) return false;
            }

            // Date to filter (terminDate)
            if (filterDateTo && p.terminDate) {
                const terminDate = new Date(p.terminDate);
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999);
                if (terminDate > toDate) return false;
            }

            return true;
        });
    }, [allProducts, filterCompany, filterProduct, filterPlanner, filterDateFrom, filterDateTo]);

    // Paginated products
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredProducts.slice(start, start + pageSize);
    }, [filteredProducts, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredProducts.length / pageSize);

    // Check if any filter is active
    const hasActiveFilters = filterCompany || filterProduct || filterPlanner || filterDateFrom || filterDateTo;

    // Clear all filters
    const clearFilters = () => {
        setFilterCompany("");
        setFilterProduct("");
        setFilterPlanner("");
        setFilterDateFrom(undefined);
        setFilterDateTo(undefined);
        setCurrentPage(1);
    };

    // Reset page when filters change
    const handleFilterChange = () => {
        setCurrentPage(1);
    };

    const handleSendToProduction = async (productId: number) => {
        setSendingToProduction(productId);
        try {
            const result = await marketingApproveProduct(productId);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("Ürün üretime gönderildi!");
                router.refresh();
            }
        } catch (error) {
            toast.error("Üretime gönderme başarısız");
        } finally {
            setSendingToProduction(null);
        }
    };

    const handleRowClick = (product: any) => {
        setViewProduct(product);
        setViewOpen(true);
    };

    const handleExport = () => {
        setExportLoading(true);
        try {
            let exportData;

            if (activeTab === "shipped") {
                exportData = filteredProducts.map(p => ({
                    "Ürün Kodu": p.systemCode || '',
                    "Ürün Adı": p.name || '',
                    "Model": p.model || '',
                    "Firma": p.shipmentCompany || p.order?.company || '',
                    "Planlanan Adet": p.quantity,
                    "Sevk Adedi": p.shippedQuantity || 0,
                    "Sevk Tarihi": p.shipmentDate ? new Date(p.shipmentDate).toLocaleDateString('tr-TR') : '',
                    "Sürücü": p.shipmentDriver || '',
                    "Plaka": p.shipmentPlate || '',
                    "Barkod": p.barcode || '',
                }));
            } else {
                exportData = filteredProducts.map(p => ({
                    "Ürün Kodu": p.systemCode || '',
                    "Ürün Adı": p.name || '',
                    "Model": p.model || '',
                    "Firma": p.order?.company || '',
                    "Adet": p.quantity,
                    "Üretilen": p.produced || 0,
                    "Sevk Edilen": p.shipped || 0,
                    "Kalan": p.available || (p.produced - (p.shipped || 0)),
                    "Termin Tarihi": p.terminDate ? new Date(p.terminDate).toLocaleDateString('tr-TR') : '',
                    "Durum": translateStatus(p.status),
                    "Malzeme": p.material || '',
                    "Barkod": p.barcode || '',
                }));
            }

            const sheetName = activeTab === "approved" ? "Onaylananlar" :
                activeTab === "inProduction" ? "Üretimde" :
                    activeTab === "completed" ? "Depoda" : "Sevk Edilenler";
            const fileName = activeTab === "approved" ? "Onaylananlar" :
                activeTab === "inProduction" ? "Uretimde" :
                    activeTab === "completed" ? "Depoda" : "SevkEdilenler";

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, `Pazarlama_${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success(`${exportData.length} kayıt Excel'e aktarıldı`);
        } catch (error) {
            toast.error("Excel oluşturulurken hata oluştu");
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Filters Card */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filtreler
                        </CardTitle>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X className="h-4 w-4 mr-1" />
                                Temizle
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Product Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Ürün Ara</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ad, model, kod..."
                                    value={filterProduct}
                                    onChange={(e) => { setFilterProduct(e.target.value); handleFilterChange(); }}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        {/* Company Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Firma</label>
                            <Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v === "all" ? "" : v); handleFilterChange(); }}>
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

                        {/* Planner Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Planlayan</label>
                            <Select value={filterPlanner} onValueChange={(v) => { setFilterPlanner(v === "all" ? "" : v); handleFilterChange(); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tüm planlayanlar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm planlayanlar</SelectItem>
                                    {uniquePlanners.map(planner => (
                                        <SelectItem key={planner} value={planner}>{planner}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date From */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Termin Başlangıç</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !filterDateFrom && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {filterDateFrom ? format(filterDateFrom, "dd.MM.yyyy", { locale: tr }) : "Tarih seçin"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={filterDateFrom}
                                        onSelect={(date) => { setFilterDateFrom(date); handleFilterChange(); }}
                                        locale={tr}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Date To */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Termin Bitiş</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !filterDateTo && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {filterDateTo ? format(filterDateTo, "dd.MM.yyyy", { locale: tr }) : "Tarih seçin"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={filterDateTo}
                                        onSelect={(date) => { setFilterDateTo(date); handleFilterChange(); }}
                                        locale={tr}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
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
                            {filterPlanner && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Planlayan: {filterPlanner}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterPlanner("")} />
                                </Badge>
                            )}
                            {filterDateFrom && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Başlangıç: {format(filterDateFrom, "dd.MM.yyyy", { locale: tr })}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDateFrom(undefined)} />
                                </Badge>
                            )}
                            {filterDateTo && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Bitiş: {format(filterDateTo, "dd.MM.yyyy", { locale: tr })}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDateTo(undefined)} />
                                </Badge>
                            )}
                            <span className="text-sm font-medium ml-auto">
                                {filteredProducts.length} / {allProducts.length} kayıt
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tab Buttons */}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant={activeTab === "marketingReview" ? "default" : "outline"}
                    onClick={() => { setActiveTab("marketingReview"); setCurrentPage(1); }}
                    className={activeTab === "marketingReview" ? "bg-amber-600 hover:bg-amber-700" : ""}
                >
                    <Send className="h-4 w-4 mr-2" />
                    Üretime Gönderilecek ({marketingReviewProducts.length})
                </Button>
                <Button
                    variant={activeTab === "approved" ? "default" : "outline"}
                    onClick={() => { setActiveTab("approved"); setCurrentPage(1); }}
                    className={activeTab === "approved" ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Onaylanan ({approvedProducts.length})
                </Button>
                <Button
                    variant={activeTab === "inProduction" ? "default" : "outline"}
                    onClick={() => { setActiveTab("inProduction"); setCurrentPage(1); }}
                    className={activeTab === "inProduction" ? "bg-purple-600 hover:bg-purple-700" : ""}
                >
                    <Factory className="h-4 w-4 mr-2" />
                    Üretimde ({inProductionProducts.length})
                </Button>
                <Button
                    variant={activeTab === "completed" ? "default" : "outline"}
                    onClick={() => { setActiveTab("completed"); setCurrentPage(1); }}
                    className={activeTab === "completed" ? "bg-green-600 hover:bg-green-700" : ""}
                >
                    <Warehouse className="h-4 w-4 mr-2" />
                    Depoda ({completedProducts.length})
                </Button>
                <Button
                    variant={activeTab === "shipped" ? "default" : "outline"}
                    onClick={() => { setActiveTab("shipped"); setCurrentPage(1); }}
                    className={activeTab === "shipped" ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                    <Truck className="h-4 w-4 mr-2" />
                    Sevk Edilenler ({shippedItems.length})
                </Button>
                <div className="flex-1" />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={exportLoading || filteredProducts.length === 0}
                    className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                >
                    {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Excel İndir
                </Button>
            </div>

            {/* Products Table */}
            <Card>
                <CardHeader className={
                    activeTab === "marketingReview" ? "bg-amber-50 border-b" :
                        activeTab === "approved" ? "bg-blue-50 border-b" :
                            activeTab === "inProduction" ? "bg-purple-50 border-b" :
                                activeTab === "completed" ? "bg-green-50 border-b" :
                                    "bg-orange-50 border-b"
                }>
                    <CardTitle className={`flex items-center gap-2 ${activeTab === "marketingReview" ? "text-amber-900" :
                        activeTab === "approved" ? "text-blue-900" :
                            activeTab === "inProduction" ? "text-purple-900" :
                                activeTab === "completed" ? "text-green-900" :
                                    "text-orange-900"
                        }`}>
                        {activeTab === "marketingReview" ? (
                            <>
                                <Send className="h-5 w-5" />
                                Üretime Gönderilecek Ürünler
                            </>
                        ) : activeTab === "approved" ? (
                            <>
                                <CheckCircle className="h-5 w-5" />
                                Onaylanmış Ürünler
                            </>
                        ) : activeTab === "inProduction" ? (
                            <>
                                <Factory className="h-5 w-5" />
                                Üretimdeki Ürünler
                            </>
                        ) : activeTab === "completed" ? (
                            <>
                                <Warehouse className="h-5 w-5" />
                                Depodaki Ürünler
                            </>
                        ) : (
                            <>
                                <Truck className="h-5 w-5" />
                                Sevk Edilen Ürünler
                            </>
                        )}
                        <Badge variant="outline" className="ml-2">{filteredProducts.length} kayıt</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">Kod / Görsel</TableHead>
                                <TableHead>Ürün</TableHead>
                                <TableHead>Firma</TableHead>
                                <TableHead>Adet</TableHead>
                                {activeTab === "shipped" && <TableHead>Sevk Adedi</TableHead>}
                                {activeTab === "shipped" && <TableHead>Sevk Tarihi</TableHead>}
                                {activeTab !== "shipped" && <TableHead>Termin</TableHead>}
                                <TableHead>Durum</TableHead>
                                {activeTab === "marketingReview" && <TableHead>İşlem</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={activeTab === "shipped" ? 8 : activeTab === "marketingReview" ? 7 : 6} className="text-center py-8 text-slate-500">
                                        {hasActiveFilters
                                            ? "Filtrelere uygun ürün bulunamadı"
                                            : activeTab === "marketingReview"
                                                ? "Üretime gönderilecek ürün bulunmuyor"
                                                : activeTab === "approved"
                                                    ? "Üretimde ürün bulunmuyor"
                                                    : activeTab === "inProduction"
                                                        ? "Üretimde ürün bulunmuyor"
                                                        : activeTab === "completed"
                                                            ? "Depoda ürün bulunmuyor"
                                                            : "Sevk edilen ürün bulunmuyor"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedProducts.map((p, index) => (
                                    <TableRow
                                        key={activeTab === "shipped" ? `${p.shipmentId}-${p.id}-${index}` : p.id}
                                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => handleRowClick(p)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                {p.imageUrl && (
                                                    <img src={p.imageUrl} alt="" className="w-8 h-8 object-contain rounded border bg-white" />
                                                )}
                                                <span className="text-xs">{p.systemCode}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-semibold">{p.name}</div>
                                            <div className="text-xs text-slate-500">{p.model}</div>
                                        </TableCell>
                                        <TableCell>{p.order?.company || '-'}</TableCell>
                                        <TableCell className="font-bold">{p.quantity}</TableCell>
                                        {activeTab === "shipped" && (
                                            <TableCell>
                                                <span className="font-bold text-orange-600">{p.shippedQuantity}</span>
                                            </TableCell>
                                        )}
                                        {activeTab === "shipped" && (
                                            <TableCell>
                                                {p.shipmentDate ? new Date(p.shipmentDate).toLocaleDateString('tr-TR') : '-'}
                                            </TableCell>
                                        )}
                                        {activeTab !== "shipped" && (
                                            <TableCell>
                                                {p.terminDate ? new Date(p.terminDate).toLocaleDateString('tr-TR') : '-'}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${activeTab === "shipped" ? 'bg-orange-100 text-orange-600' :
                                                p.status === 'MARKETING_REVIEW' ? 'bg-amber-100 text-amber-600' :
                                                    p.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                                        p.status === 'IN_PRODUCTION' ? 'bg-purple-100 text-purple-600' :
                                                            p.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                                                                'bg-gray-100 text-gray-600'
                                                }`}>
                                                {activeTab === "shipped" ? "SEVK EDİLDİ" : translateStatus(p.status).toUpperCase()}
                                            </span>
                                        </TableCell>
                                        {activeTab === "marketingReview" && (
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="gap-1 bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleSendToProduction(p.id)}
                                                        disabled={sendingToProduction === p.id}
                                                    >
                                                        {sendingToProduction === p.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <Send className="h-3 w-3" />
                                                        )}
                                                        Üretime Gönder
                                                    </Button>
                                                    <CancelProductDialog productId={p.id} productName={p.name} />
                                                </div>
                                            </TableCell>
                                        )}
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
                                        <SelectItem value="20">20</SelectItem>
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

            {/* View Product Details Dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Ürün Detayları: {viewProduct?.name}</DialogTitle>
                        <DialogDescription>
                            Kod: {viewProduct?.systemCode} | Model: {viewProduct?.model}
                        </DialogDescription>
                    </DialogHeader>

                    {viewProduct && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="col-span-full flex justify-center">
                                <div className="relative h-64 w-full md:w-96 mb-4 rounded-lg overflow-hidden border bg-slate-100 flex items-center justify-center">
                                    <ProductImage
                                        src={viewProduct.imageUrl || `/${viewProduct.systemCode}.png`}
                                        alt={viewProduct.name}
                                        className="object-contain w-full h-full"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Section title="Temel Bilgiler">
                                    <Detail label="Firma / Müşteri" value={viewProduct.order?.company || viewProduct.company} />
                                    <Detail label="Sipariş Adı" value={viewProduct.order?.name} />
                                    <Detail label="Planlanan Adet" value={viewProduct.quantity} />
                                    <Detail label="Üretilen / Stok" value={viewProduct.produced} />
                                    <Detail label="Durum" value={translateStatus(viewProduct.status)} />
                                    <Detail label="Barkod" value={viewProduct.barcode || '-'} />
                                    <Detail label="Malzeme" value={viewProduct.material} />
                                </Section>

                                <Section title="Tarihler">
                                    {viewProduct.orderDate && (
                                        <Detail label="Sipariş Tarihi" value={format(new Date(viewProduct.orderDate), "PPP", { locale: tr })} />
                                    )}
                                    {viewProduct.terminDate && (
                                        <Detail label="Termin Tarihi" value={format(new Date(viewProduct.terminDate), "PPP", { locale: tr })} />
                                    )}
                                    <Detail label="Oluşturulma" value={format(new Date(viewProduct.createdAt), "PPP HH:mm", { locale: tr })} />
                                </Section>
                            </div>

                            <div className="space-y-4">
                                <Section title="Özellikler">
                                    <Detail label="Ayak Modeli" value={viewProduct.footType} />
                                    <Detail label="Ayak Özelliği" value={viewProduct.footMaterial} />
                                    <Detail label="Kol Modeli" value={viewProduct.armType} />
                                    <Detail label="Sünger" value={viewProduct.backType} />
                                    <Detail label="Kumaş" value={viewProduct.fabricType} />
                                    <Detail label="Usta" value={viewProduct.master} />
                                </Section>

                                {viewProduct.description && (
                                    <Section title="Açıklama / Not">
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-2 rounded border">
                                            {viewProduct.description}
                                        </p>
                                    </Section>
                                )}

                                {(viewProduct.aciklama1 || viewProduct.aciklama2 || viewProduct.aciklama3 || viewProduct.aciklama4 || viewProduct.dstAdi) && (
                                    <Section title="NetSim Özellikleri">
                                        <Detail label="DST / Varyasyon" value={viewProduct.dstAdi} />
                                        <Detail label="Açıklama 1" value={viewProduct.aciklama1} />
                                        <Detail label="Açıklama 2" value={viewProduct.aciklama2} />
                                        <Detail label="Açıklama 3" value={viewProduct.aciklama3} />
                                        <Detail label="Açıklama 4" value={viewProduct.aciklama4} />
                                    </Section>
                                )}

                                {viewProduct.components && viewProduct.components.length > 0 && (
                                    <Section title="Yarı Mamüller / Bileşenler">
                                        {viewProduct.components.map((comp: any) => (
                                            <Detail key={comp.id} label={comp.category} value={comp.value} />
                                        ))}
                                    </Section>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
