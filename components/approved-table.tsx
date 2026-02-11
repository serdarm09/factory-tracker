'use client';

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { ExportButton } from "@/components/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Loader2, XCircle, Filter, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import BarcodeDisplay from "@/components/barcode-display";
import { revokeApproval } from "@/lib/actions";
import { DateRangeFilter } from "./date-range-filter";
import { DateRange } from "react-day-picker";
import { Pagination } from "@/components/ui/pagination";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

type Product = {
    id: number;
    name: string;
    model: string;
    company: string | null;
    quantity: number;
    produced: number;
    status: string;
    systemCode: string;
    barcode: string | null;
    createdAt: Date;
    terminDate: Date;
    material?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    footType?: string | null;
    footMaterial?: string | null;
    armType?: string | null;
    backType?: string | null;
    fabricType?: string | null;
    master?: string | null;
    creator?: { username: string } | null;
    order?: { company: string } | null;
    // NetSim Açıklamaları
    aciklama1?: string | null;
    aciklama2?: string | null;
    aciklama3?: string | null;
    aciklama4?: string | null;
};

export function ApprovedTable({ products }: { products: Product[] }) {
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product | null; direction: 'asc' | 'desc' }>({
        key: 'createdAt',
        direction: 'desc',
    });
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Filter states
    const [filterProduct, setFilterProduct] = useState("");
    const [filterCompany, setFilterCompany] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterBarcode, setFilterBarcode] = useState("");
    const [filterPlanner, setFilterPlanner] = useState("");

    // Get unique values for dropdowns
    const uniqueCompanies = useMemo(() => {
        const companies = new Set<string>();
        products.forEach(p => {
            const company = p.order?.company || p.company;
            if (company) companies.add(company);
        });
        return Array.from(companies).sort();
    }, [products]);

    const uniquePlanners = useMemo(() => {
        const planners = new Set<string>();
        products.forEach(p => {
            const planner = p.creator?.username;
            if (planner) planners.add(planner);
        });
        return Array.from(planners).sort();
    }, [products]);

    const handleRowClick = (product: Product) => {
        setSelectedProduct(product);
        setIsOpen(true);
    };

    const filteredProducts = products.filter(p => {
        // Date range filter
        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);

            const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
            to.setHours(23, 59, 59, 999);

            const current = new Date(p.terminDate);
            if (!(current >= from && current <= to)) return false;
        }

        // Product name/model filter
        if (filterProduct) {
            const searchLower = filterProduct.toLowerCase();
            const matchName = p.name?.toLowerCase().includes(searchLower);
            const matchModel = p.model?.toLowerCase().includes(searchLower);
            const matchCode = p.systemCode?.toLowerCase().includes(searchLower);
            if (!matchName && !matchModel && !matchCode) return false;
        }

        // Company filter
        if (filterCompany) {
            const company = p.order?.company || p.company || "";
            if (company !== filterCompany) return false;
        }

        // Status filter
        if (filterStatus !== "all") {
            if (p.status !== filterStatus) return false;
        }

        // Barcode filter
        if (filterBarcode) {
            const barcode = p.barcode || "";
            if (!barcode.toLowerCase().includes(filterBarcode.toLowerCase())) return false;
        }

        // Planner filter
        if (filterPlanner) {
            const planner = p.creator?.username || "";
            if (planner !== filterPlanner) return false;
        }

        return true;
    });

    // Check if any filter is active
    const hasActiveFilters = filterProduct || filterCompany || filterStatus !== "all" ||
        filterBarcode || filterPlanner || dateRange?.from;

    // Clear all filters
    const clearFilters = () => {
        setFilterProduct("");
        setFilterCompany("");
        setFilterStatus("all");
        setFilterBarcode("");
        setFilterPlanner("");
        setDateRange(undefined);
        setCurrentPage(1);
    };

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (!sortConfig.key) return 0;

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Pagination
    const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
    const paginatedProducts = sortedProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page when filters change
    const handleDateRangeChange = (range: DateRange | undefined) => {
        setDateRange(range);
        setCurrentPage(1);
    };

    // Reset page when text filters change
    useMemo(() => {
        setCurrentPage(1);
    }, [filterProduct, filterCompany, filterStatus, filterBarcode, filterPlanner]);

    const requestSort = (key: keyof Product) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortHead = ({ label, sortKey }: { label: string, sortKey: keyof Product }) => (
        <TableHead>
            <Button variant="ghost" onClick={() => requestSort(sortKey)} className="hover:bg-transparent px-0 font-bold">
                {label}
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </TableHead>
    );

    return (
        <div className="space-y-4">
            {/* Filter Card */}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                        {/* Product Search */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Urun Ara</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ad, model, kod..."
                                    value={filterProduct}
                                    onChange={(e) => setFilterProduct(e.target.value)}
                                    className="pl-8 h-9"
                                />
                            </div>
                        </div>

                        {/* Company Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Firma</label>
                            <Select value={filterCompany} onValueChange={(v) => setFilterCompany(v === "all" ? "" : v)}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Tum firmalar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tum firmalar</SelectItem>
                                    {uniqueCompanies.map(company => (
                                        <SelectItem key={company} value={company}>{company}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Planner Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Planlayan</label>
                            <Select value={filterPlanner} onValueChange={(v) => setFilterPlanner(v === "all" ? "" : v)}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Tum planlayanlar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tum planlayanlar</SelectItem>
                                    {uniquePlanners.map(planner => (
                                        <SelectItem key={planner} value={planner}>{planner}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Durum</label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Tum durumlar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tum Durumlar</SelectItem>
                                    <SelectItem value="APPROVED">Onayli (Uretimde)</SelectItem>
                                    <SelectItem value="COMPLETED">Tamamlandi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Barcode Search */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Barkod</label>
                            <Input
                                placeholder="Barkod ara..."
                                value={filterBarcode}
                                onChange={(e) => setFilterBarcode(e.target.value)}
                                className="h-9"
                            />
                        </div>

                        {/* Date Range Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Termin Tarihi</label>
                            <div className="relative">
                                <DateRangeFilter date={dateRange} setDate={handleDateRangeChange} />
                                {dateRange?.from && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute -right-1 -top-1 h-4 w-4 bg-slate-200 rounded-full hover:bg-red-100 hover:text-red-600"
                                        onClick={() => setDateRange(undefined)}
                                    >
                                        <span className="sr-only">Temizle</span>
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
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
                            {filterStatus !== "all" && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Durum: {filterStatus === "APPROVED" ? "Onaylı" : "Tamamlandı"}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterStatus("all")} />
                                </Badge>
                            )}
                            {filterBarcode && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Barkod: {filterBarcode}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterBarcode("")} />
                                </Badge>
                            )}
                            {dateRange?.from && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Termin: {format(dateRange.from, "dd.MM.yyyy")} {dateRange.to ? `- ${format(dateRange.to, "dd.MM.yyyy")}` : ""}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setDateRange(undefined)} />
                                </Badge>
                            )}
                            <span className="text-sm font-medium ml-auto">
                                {filteredProducts.length} / {products.length} kayıt
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Export Button */}
            <div className="flex justify-end">
                <ExportButton
                    data={sortedProducts.map(p => ({
                        "Urun Adi": p.name,
                        "Model": p.model,
                        "Firma": p.company,
                        "Malzeme": p.material,
                        "Aciklama": p.description,
                        "Planlayan": p.creator?.username || "-",
                        "Giris Tarihi": new Date(p.createdAt).toLocaleDateString('tr-TR'),
                        "Termin Tarihi": new Date(p.terminDate).toLocaleDateString('tr-TR'),
                        "Kullanilan Barkod": p.barcode,
                        "Durum": p.status === 'COMPLETED' ? 'Tamamlandi' : 'Onayli'
                    }))}
                    filename="onaylanan-urunler"
                    label="Listeyi Indir"
                />
            </div>
            <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <SortHead label="Ürün" sortKey="name" />
                        <SortHead label="Model" sortKey="model" />
                        <TableHead>Malzeme</TableHead>
                        <TableHead>Not</TableHead>
                        <SortHead label="Firma" sortKey="company" />
                        <SortHead label="Giriş / Onay" sortKey="createdAt" />
                        <SortHead label="Termin" sortKey="terminDate" />
                        <SortHead label="Barkod" sortKey="barcode" />
                        <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedProducts.map(p => (
                        <TableRow
                            key={p.id}
                            className="h-8 cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => handleRowClick(p)}
                        >
                            <TableCell className="py-2">
                                <div className="flex justify-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${p.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="font-medium py-2">
                                <div className="flex items-center gap-3">
                                    {p.imageUrl && (
                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-slate-100">
                                            <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                        </div>
                                    )}
                                    <span className="text-blue-600 font-semibold">{p.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="py-2">{p.model}</TableCell>
                            <TableCell className="py-2 text-sm">{p.material || '-'}</TableCell>
                            <TableCell className="py-2 max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                                {p.description || '-'}
                            </TableCell>
                            <TableCell className="py-2">{p.company || '-'}</TableCell>
                            <TableCell className="py-2 text-slate-500">{new Date(p.createdAt).toLocaleDateString('tr-TR')}</TableCell>
                            <TableCell className="py-2 text-red-900 font-medium">{new Date(p.terminDate).toLocaleDateString('tr-TR')}</TableCell>
                            <TableCell className="py-2">
                                {p.barcode ? (
                                    <div className="max-w-[150px] overflow-hidden">
                                        <BarcodeDisplay value={p.barcode} />
                                    </div>
                                ) : (
                                    <span className="font-mono text-slate-400">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right py-2" onClick={(e) => e.stopPropagation()}>
                                <CancelButton id={p.id} status={p.status} />
                            </TableCell>
                        </TableRow>
                    ))}
                    {paginatedProducts.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center py-4 text-slate-500">Henuz onaylanan urun yok.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            </div>
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={sortedProducts.length}
            />

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Ürün Detayları: {selectedProduct?.name}</DialogTitle>
                        <DialogDescription>
                            Kod: {selectedProduct?.systemCode} | Model: {selectedProduct?.model}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedProduct && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="col-span-full flex justify-center">
                                {selectedProduct.imageUrl ? (
                                    <div className="relative h-64 w-full md:w-96 mb-4 rounded-lg overflow-hidden border bg-slate-100">
                                        <img
                                            src={selectedProduct.imageUrl}
                                            alt={selectedProduct.name}
                                            className="object-contain w-full h-full"
                                        />
                                    </div>
                                ) : (
                                    <div className="relative h-64 w-full md:w-96 mb-4 rounded-lg overflow-hidden border bg-slate-100 flex items-center justify-center text-slate-400">
                                        Görsel yok
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <Section title="Temel Bilgiler">
                                    <Detail label="Firma / Müşteri" value={selectedProduct.order?.company || selectedProduct.company} />
                                    <Detail label="Adet" value={selectedProduct.quantity} />
                                    <Detail label="Üretilen" value={selectedProduct.produced} />
                                    <Detail label="Durum" value={selectedProduct.status === 'COMPLETED' ? 'Tamamlandı' : 'Üretimde'} />
                                    <Detail label="Barkod" value={selectedProduct.barcode || '-'} />
                                </Section>

                                <Section title="Tarihler">
                                    <Detail label="Giriş Tarihi" value={format(new Date(selectedProduct.createdAt), "PPP", { locale: tr })} />
                                    <Detail label="Termin Tarihi" value={format(new Date(selectedProduct.terminDate), "PPP", { locale: tr })} />
                                </Section>
                            </div>

                            <div className="space-y-4">
                                <Section title="Özellikler">
                                    <Detail label="Ayak Modeli" value={selectedProduct.footType} />
                                    <Detail label="Ayak Özelliği" value={selectedProduct.footMaterial} />
                                    <Detail label="Kol Modeli" value={selectedProduct.armType} />
                                    <Detail label="Sünger" value={selectedProduct.backType} />
                                    <Detail label="Kumaş Türü" value={selectedProduct.fabricType} />
                                    <Detail label="Malzeme Detayı" value={selectedProduct.material} />
                                </Section>

                                <Section title="Personel">
                                    <Detail label="Planlayan" value={selectedProduct.creator?.username} />
                                    <Detail label="Atanan Usta" value={selectedProduct.master} />
                                </Section>
                            </div>

                            <div className="col-span-full border-t pt-4">
                                <h4 className="font-semibold mb-2">Açıklama / Notlar</h4>
                                <div className="p-3 bg-slate-50 rounded-md border text-sm min-h-[60px]">
                                    {selectedProduct.description || "Açıklama yok."}
                                </div>
                            </div>

                            {/* NetSim Açıklamaları */}
                            {(selectedProduct.aciklama1 || selectedProduct.aciklama2 || selectedProduct.aciklama3 || selectedProduct.aciklama4) && (
                                <div className="col-span-full border-t pt-4">
                                    <h4 className="font-semibold mb-2 text-amber-700">NetSim Açıklamaları</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {selectedProduct.aciklama1 && (
                                            <div className="p-2 bg-amber-50 rounded-md border border-amber-200 text-sm">
                                                <span className="font-medium text-amber-800">Açıklama 1:</span> {selectedProduct.aciklama1}
                                            </div>
                                        )}
                                        {selectedProduct.aciklama2 && (
                                            <div className="p-2 bg-amber-50 rounded-md border border-amber-200 text-sm">
                                                <span className="font-medium text-amber-800">Açıklama 2:</span> {selectedProduct.aciklama2}
                                            </div>
                                        )}
                                        {selectedProduct.aciklama3 && (
                                            <div className="p-2 bg-amber-50 rounded-md border border-amber-200 text-sm">
                                                <span className="font-medium text-amber-800">Açıklama 3:</span> {selectedProduct.aciklama3}
                                            </div>
                                        )}
                                        {selectedProduct.aciklama4 && (
                                            <div className="p-2 bg-amber-50 rounded-md border border-amber-200 text-sm">
                                                <span className="font-medium text-amber-800">Açıklama 4:</span> {selectedProduct.aciklama4}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedProduct.barcode && (
                                <div className="col-span-full border-t pt-4">
                                    <h4 className="font-semibold mb-2">Barkod</h4>
                                    <div className="flex justify-center">
                                        <BarcodeDisplay value={selectedProduct.barcode} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="border rounded-md p-3">
            <h4 className="font-semibold text-sm text-slate-900 border-b pb-1 mb-2 bg-slate-50 -mx-3 -mt-3 px-3 pt-2 rounded-t-md">{title}</h4>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
}

function Detail({ label, value }: { label: string, value: any }) {
    if (!value) return null;
    return (
        <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}

function CancelButton({ id, status }: { id: number, status: string }) {
    const [isPending, startTransition] = useTransition();

    const handleCancel = () => {
        if (!confirm("Bu onayı iptal etmek istediğinize emin misiniz? Barkod silinecek.")) return;

        startTransition(async () => {
            const res = await revokeApproval(id);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Onay iptal edildi (Barkod silindi)");
            }
        });
    };

    return (
        <Button
            variant="destructive"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={status === 'COMPLETED' || isPending}
            onClick={handleCancel}
        >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
            İptal
        </Button>
    );
}
