"use client";

import { useState, useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApproveButton } from "@/components/approve-button";
import { RejectButton } from "@/components/reject-button";
import { EditProductDialog } from "@/components/edit-product-dialog";
import { approveProduct, rejectProduct, bulkApprove, bulkReject, bulkDelete } from "@/lib/actions";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { translateStatus } from "@/lib/translations";
import { Pagination } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { DeleteProductButton } from "@/components/delete-product-button";
import { ExportButton } from "@/components/export-button";
import { Filter, X, Search, AlertTriangle, Megaphone, ArrowUpDown, ChevronDown, Building2 } from "lucide-react";

interface PendingApprovalsTableProps {
    pendingProducts: any[];
    userRole?: string;
}

export function PendingApprovalsTable({ pendingProducts, userRole }: PendingApprovalsTableProps) {
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'createdAt',
        direction: 'desc'
    });

    // Filter states
    const [filterProduct, setFilterProduct] = useState("");
    const [filterCompany, setFilterCompany] = useState("");
    const [filterPlanner, setFilterPlanner] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");

    // Get unique companies and planners for dropdown
    const uniqueCompanies = useMemo(() => {
        const companies = new Set<string>();
        pendingProducts.forEach(p => {
            const company = p.order?.company || p.company;
            if (company) companies.add(company);
        });
        return Array.from(companies).sort();
    }, [pendingProducts]);

    const uniquePlanners = useMemo(() => {
        const planners = new Set<string>();
        pendingProducts.forEach(p => {
            const planner = (p.creator as any)?.username;
            if (planner) planners.add(planner);
        });
        return Array.from(planners).sort();
    }, [pendingProducts]);

    // Filter products
    const filteredProducts = useMemo(() => {
        return pendingProducts.filter(p => {
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

            // Planner filter
            if (filterPlanner) {
                const planner = (p.creator as any)?.username || "";
                if (planner !== filterPlanner) return false;
            }

            // Date from filter (createdAt)
            if (filterDateFrom) {
                const productDate = new Date(p.createdAt);
                const fromDate = new Date(filterDateFrom);
                if (productDate < fromDate) return false;
            }

            // Date to filter (createdAt)
            if (filterDateTo) {
                const productDate = new Date(p.createdAt);
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999);
                if (productDate > toDate) return false;
            }

            return true;
        });
    }, [pendingProducts, filterProduct, filterCompany, filterPlanner, filterDateFrom, filterDateTo]);

    // Check if any filter is active
    const hasActiveFilters = filterProduct || filterCompany || filterPlanner || filterDateFrom || filterDateTo;

    // Clear all filters
    const clearFilters = () => {
        setFilterProduct("");
        setFilterCompany("");
        setFilterPlanner("");
        setFilterDateFrom("");
        setFilterDateTo("");
    };

    // Filters reset - no pagination needed
    useMemo(() => {
        // kept for memoization side-effects
    }, [filterProduct, filterCompany, filterPlanner, filterDateFrom, filterDateTo]);

    const handleRowClick = (product: any) => {
        setSelectedProduct(product);
        setIsOpen(true);
    };

    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = (products: any[]) => {
        const allIds = products.map((p: any) => p.id);
        const allSelected = allIds.every(id => selectedIds.has(id));
        const newSet = new Set(selectedIds);
        if (allSelected) {
            allIds.forEach(id => newSet.delete(id));
        } else {
            allIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    const clearSelection = () => setSelectedIds(new Set());

    const handleBulkApprove = async () => {
        return await bulkApprove(Array.from(selectedIds));
    };

    const handleBulkReject = async (reason: string) => {
        return await bulkReject(Array.from(selectedIds), reason);
    };

    const handleBulkDelete = async () => {
        return await bulkDelete(Array.from(selectedIds));
    };

    const isAdmin = userRole === "ADMIN";
    const isPlanner = userRole === "PLANNER";
    const canManage = isAdmin || isPlanner;

    // Pazarlamadan gelen red kontrolu
    const isMarketingReject = (product: any) => {
        return product.rejectionReason &&
            (product.rejectionReason.toLowerCase().includes("pazarlama") ||
                product.rejectionReason.toLowerCase().includes("marketing"));
    };

    // Sorting fonksiyonu
    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Siralama uygula
    const sortedFilteredProducts = useMemo(() => {
        let sorted = [...filteredProducts];

        // Once normal siralama
        sorted.sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortConfig.key) {
                case 'name':
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
                    break;
                case 'planner':
                    aValue = a.creator?.username?.toLowerCase() || '';
                    bValue = b.creator?.username?.toLowerCase() || '';
                    break;
                case 'material':
                    aValue = a.material?.toLowerCase() || '';
                    bValue = b.material?.toLowerCase() || '';
                    break;
                case 'company':
                    aValue = (a.order?.company || a.company || '').toLowerCase();
                    bValue = (b.order?.company || b.company || '').toLowerCase();
                    break;
                case 'createdAt':
                    aValue = new Date(a.createdAt).getTime();
                    bValue = new Date(b.createdAt).getTime();
                    break;
                case 'terminDate':
                    aValue = new Date(a.terminDate).getTime();
                    bValue = new Date(b.terminDate).getTime();
                    break;
                case 'quantity':
                    aValue = a.quantity || 0;
                    bValue = b.quantity || 0;
                    break;
                default:
                    aValue = a[sortConfig.key] || '';
                    bValue = b[sortConfig.key] || '';
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        // Pazarlamadan gelen redleri en uste al
        sorted.sort((a, b) => {
            const aIsReject = isMarketingReject(a);
            const bIsReject = isMarketingReject(b);
            if (aIsReject && !bIsReject) return -1;
            if (!aIsReject && bIsReject) return 1;
            return 0;
        });

        return sorted;
    }, [filteredProducts, sortConfig]);

    // Group filtered products by company
    const groupedByCompany = useMemo(() => {
        const groups: Record<string, any[]> = {};
        sortedFilteredProducts.forEach(p => {
            const company = p.order?.company || p.company || "Firma Belirtilmemiş";
            if (!groups[company]) groups[company] = [];
            groups[company].push(p);
        });
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'tr'));
    }, [sortedFilteredProducts]);

    // SortHead komponenti
    const SortHead = ({ label, sortKey }: { label: string; sortKey: string }) => (
        <TableHead>
            <Button
                variant="ghost"
                onClick={() => requestSort(sortKey)}
                className="hover:bg-transparent px-0 font-bold flex items-center gap-1"
            >
                {label}
                <ArrowUpDown className={`h-4 w-4 ${sortConfig.key === sortKey ? 'text-blue-600' : 'text-slate-400'}`} />
            </Button>
        </TableHead>
    );

    // Pazarlamadan gelen red sayisi
    const marketingRejectCount = useMemo(() => {
        return pendingProducts.filter(p => isMarketingReject(p)).length;
    }, [pendingProducts]);

    return (
        <>
            {/* Filter Card */}
            <Card className="mb-4">
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
                        {/* Product Search */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Ürün Ara</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ad, model, kod..."
                                    value={filterProduct}
                                    onChange={(e) => setFilterProduct(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        {/* Company Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Firma</label>
                            <Select value={filterCompany} onValueChange={(v) => setFilterCompany(v === "all" ? "" : v)}>
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
                            <Select value={filterPlanner} onValueChange={(v) => setFilterPlanner(v === "all" ? "" : v)}>
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
                            <label className="text-xs font-medium text-muted-foreground">Başlangıç Tarihi</label>
                            <Input
                                type="date"
                                value={filterDateFrom}
                                onChange={(e) => setFilterDateFrom(e.target.value)}
                            />
                        </div>

                        {/* Date To */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Bitiş Tarihi</label>
                            <Input
                                type="date"
                                value={filterDateTo}
                                onChange={(e) => setFilterDateTo(e.target.value)}
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
                            {filterPlanner && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    Planlayan: {filterPlanner}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterPlanner("")} />
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
                                {filteredProducts.length} / {pendingProducts.length} kayıt
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Export Button */}
            <div className="flex justify-end mb-4">
                <ExportButton
                    data={filteredProducts.map(p => ({
                        "Ürün Adı": p.name,
                        "Model": p.model,
                        "Firma": p.order?.company || p.company || "-",
                        "Atanan Usta": p.master || "-",
                        "Renk/DST": p.dstAdi || "-",
                        "NetSim Açıklama 1": p.aciklama1 || "-",
                        "NetSim Açıklama 2": p.aciklama2 || "-",
                        "NetSim Açıklama 3": p.aciklama3 || "-",
                        "NetSim Açıklama 4": p.aciklama4 || "-",
                        "Malzeme": p.material || "-",
                        "Planlayan": (p.creator as any)?.username || "-",
                        "Giriş Tarihi": new Date(p.createdAt).toLocaleDateString('tr-TR'),
                        "Termin Tarihi": p.terminDate ? new Date(p.terminDate).toLocaleDateString('tr-TR') : "-",
                        "Adet": p.quantity,
                        "Durum": translateStatus(p.status),
                        "Açıklama": p.description || "-"
                    }))}
                    filename="onay-bekleyen-urunler"
                    label="Listeyi İndir"
                />
            </div>

            {/* Accordion grouped by company */}
            <div className="space-y-2">
                {groupedByCompany.length === 0 && (
                    <div className="text-center py-8 text-slate-500">Onay bekleyen ürün yok.</div>
                )}
                <Accordion
                    type="multiple"
                    className="space-y-2"
                >
                    {groupedByCompany.map(([company, companyProducts]) => {
                        const companySelectedCount = companyProducts.filter(p => selectedIds.has(p.id)).length;
                        const allCompanySelected = companyProducts.length > 0 && companySelectedCount === companyProducts.length;
                        const hasMarketingReject = companyProducts.some(p => isMarketingReject(p));

                        return (
                            <AccordionItem
                                key={company}
                                value={company}
                                className={`border rounded-lg overflow-hidden ${hasMarketingReject ? 'border-red-300' : 'border-slate-200'
                                    }`}
                            >
                                <AccordionTrigger className={`px-4 py-3 hover:no-underline ${hasMarketingReject ? 'bg-red-50 hover:bg-red-100' : 'bg-slate-50 hover:bg-slate-100'
                                    }`}>
                                    <div className="flex items-center gap-3 w-full mr-2">
                                        {canManage && (
                                            <div onClick={(e) => { e.stopPropagation(); toggleSelectAll(companyProducts); }}>
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                                    checked={allCompanySelected}
                                                    onChange={() => { }}
                                                    readOnly
                                                />
                                            </div>
                                        )}
                                        <Building2 className={`h-4 w-4 flex-shrink-0 ${hasMarketingReject ? 'text-red-600' : 'text-slate-500'
                                            }`} />
                                        <span className="font-semibold text-sm">{company}</span>
                                        {hasMarketingReject && (
                                            <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Megaphone className="h-3 w-3" /> Pazarlama Reddi
                                            </span>
                                        )}
                                        <span className="ml-auto text-xs text-slate-500 font-normal">
                                            {companyProducts.length} ürün
                                            {companySelectedCount > 0 && (
                                                <span className="ml-2 text-blue-600 font-medium">({companySelectedCount} seçili)</span>
                                            )}
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-white">
                                                {canManage && <TableHead className="w-[40px]"></TableHead>}
                                                <SortHead label="Ürün" sortKey="name" />
                                                <SortHead label="Planlayan" sortKey="planner" />
                                                <SortHead label="Malzeme" sortKey="material" />
                                                <TableHead>Not</TableHead>
                                                <SortHead label="Giriş" sortKey="createdAt" />
                                                <SortHead label="Termin" sortKey="terminDate" />
                                                <SortHead label="Adet" sortKey="quantity" />
                                                <TableHead>İşlem</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {companyProducts.map(p => {
                                                const fromMarketing = isMarketingReject(p);
                                                return (
                                                    <TableRow
                                                        key={p.id}
                                                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${selectedIds.has(p.id) ? 'bg-blue-50' : ''} ${fromMarketing ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' : ''}`}
                                                        onClick={() => handleRowClick(p)}
                                                    >
                                                        {canManage && (
                                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                                                    checked={selectedIds.has(p.id)}
                                                                    onChange={() => toggleSelection(p.id)}
                                                                />
                                                            </TableCell>
                                                        )}
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                {p.imageUrl && (
                                                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-slate-100">
                                                                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="font-bold flex items-center gap-2">
                                                                        {p.name}
                                                                        {fromMarketing && (
                                                                            <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                                                <Megaphone className="h-3 w-3" /> Pazarlama Red
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500">{p.model}</div>
                                                                    <div className="text-xs text-slate-400">{p.systemCode}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm font-medium text-blue-600">
                                                            {(p.creator as any)?.username || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-sm">{p.material || '-'}</TableCell>
                                                        <TableCell className="max-w-[150px] text-sm">
                                                            {fromMarketing && p.rejectionReason ? (
                                                                <div className="bg-red-100 border border-red-200 rounded p-1.5">
                                                                    <div className="flex items-center gap-1 text-red-700 font-medium text-xs mb-0.5">
                                                                        <AlertTriangle className="h-3 w-3" /> Red Nedeni:
                                                                    </div>
                                                                    <p className="text-red-800 text-xs">{p.rejectionReason}</p>
                                                                </div>
                                                            ) : (
                                                                <span className="truncate block" title={p.description || ''}>
                                                                    {p.description || '-'}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{new Date(p.createdAt).toLocaleDateString('tr-TR')}</TableCell>
                                                        <TableCell className="text-red-900 font-medium">{new Date(p.terminDate).toLocaleDateString('tr-TR')}</TableCell>
                                                        <TableCell>{p.quantity}</TableCell>
                                                        <TableCell>
                                                            <div onClick={(e) => e.stopPropagation()} className="flex">
                                                                <ApproveButton action={approveProduct.bind(null, p.id)} label="Onayla" />
                                                                <RejectButton action={rejectProduct.bind(null, p.id)} />
                                                                {canManage && (
                                                                    <DeleteProductButton productId={p.id} productName={p.name} />
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </div>

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
                            {/* NetSim Sipariş Bilgileri - EN ÜSTTE */}
                            {(selectedProduct.aciklama1 || selectedProduct.aciklama2 || selectedProduct.aciklama3 || selectedProduct.aciklama4 || selectedProduct.dstAdi) && (
                                <div className="col-span-full">
                                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                        <h4 className="font-semibold text-amber-800 mb-3">📋 NetSim Sipariş Bilgileri</h4>
                                        {/* Renk */}
                                        {selectedProduct.dstAdi && (
                                            <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm mb-3">
                                                <span className="font-medium text-blue-700">🎨 Renk/DST:</span> <span className="font-bold text-blue-900">{selectedProduct.dstAdi}</span>
                                            </div>
                                        )}
                                        {/* Açıklamalar */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {selectedProduct.aciklama1 && (
                                                <div className="bg-white p-2 rounded border border-amber-100 text-sm">
                                                    <span className="font-medium text-amber-700">Açıklama 1:</span> {selectedProduct.aciklama1}
                                                </div>
                                            )}
                                            {selectedProduct.aciklama2 && (
                                                <div className="bg-white p-2 rounded border border-amber-100 text-sm">
                                                    <span className="font-medium text-amber-700">Açıklama 2:</span> {selectedProduct.aciklama2}
                                                </div>
                                            )}
                                            {selectedProduct.aciklama3 && (
                                                <div className="bg-white p-2 rounded border border-amber-100 text-sm">
                                                    <span className="font-medium text-amber-700">Açıklama 3:</span> {selectedProduct.aciklama3}
                                                </div>
                                            )}
                                            {selectedProduct.aciklama4 && (
                                                <div className="bg-white p-2 rounded border border-amber-100 text-sm">
                                                    <span className="font-medium text-amber-700">Açıklama 4:</span> {selectedProduct.aciklama4}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="col-span-full flex justify-center">
                                {selectedProduct.imageUrl && (
                                    <div className="relative h-64 w-full md:w-96 mb-4 rounded-lg overflow-hidden border bg-slate-100">
                                        {/* Using standard img tag for simplicity with local files, or Next Image if configured */}
                                        <img
                                            src={selectedProduct.imageUrl}
                                            alt={selectedProduct.name}
                                            className="object-contain w-full h-full"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <Section title="Temel Bilgiler">
                                    <Detail label="Firma / Müşteri" value={selectedProduct.order?.company || selectedProduct.company} />
                                    <Detail label="Adet" value={selectedProduct.quantity} />
                                    <Detail label="Durum" value={translateStatus(selectedProduct.status)} />
                                    <Detail label="Barkod" value={selectedProduct.barcode || '-'} />
                                </Section>

                                <Section title="Tarihler">
                                    <Detail label="Sipariş Tarihi" value={format(new Date(selectedProduct.orderDate || selectedProduct.createdAt), "PPP", { locale: tr })} />
                                    <Detail label="Termin Tarihi" value={format(new Date(selectedProduct.terminDate), "PPP", { locale: tr })} />
                                    <Detail label="Oluşturulma" value={format(new Date(selectedProduct.createdAt), "PPP HH:mm", { locale: tr })} />
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
                                <h4 className="font-semibold mb-2">Aciklama / Notlar</h4>
                                <div className="p-3 bg-slate-50 rounded-md border text-sm min-h-[60px]">
                                    {selectedProduct.description || "Aciklama yok."}
                                </div>
                            </div>

                            {/* Pazarlamadan Gelen Red Uyarisi */}
                            {isMarketingReject(selectedProduct) && selectedProduct.rejectionReason && (
                                <div className="col-span-full">
                                    <div className="bg-red-50 border-2 border-red-300 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Megaphone className="h-5 w-5 text-red-600" />
                                            <h4 className="font-bold text-red-800">Pazarlamadan Red Geldi!</h4>
                                        </div>
                                        <div className="bg-white p-3 rounded border border-red-200">
                                            <p className="text-sm font-medium text-red-700 mb-1">Red Nedeni:</p>
                                            <p className="text-red-900">{selectedProduct.rejectionReason}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="col-span-full flex justify-end gap-2 border-t pt-4 mt-2">
                                <div>
                                    <EditProductDialog product={selectedProduct} userRole={userRole} />
                                </div>
                                <div>
                                    <RejectButton action={async (reason) => {
                                        await rejectProduct(selectedProduct.id, reason);
                                        setIsOpen(false);
                                    }} />
                                </div>
                                <div>
                                    <ApproveButton
                                        action={async () => {
                                            await approveProduct(selectedProduct.id);
                                            setIsOpen(false);
                                        }}
                                        label="Onayla"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {canManage && (
                <BulkActionBar
                    selectedCount={selectedIds.size}
                    onClearSelection={clearSelection}
                    onBulkApprove={handleBulkApprove}
                    onBulkReject={handleBulkReject}
                    onBulkDelete={handleBulkDelete}
                />
            )}
        </>
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
