'use client';

import React, { useState, useMemo, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Loader2, Info, Copy, Send, ChevronDown, ChevronRight, Filter, X, ArrowUp, ArrowDown, ArrowUpDown, Calendar, Pencil, SendHorizontal, DollarSign, CheckSquare } from "lucide-react";
import { translateStatus } from "@/lib/translations";
import * as XLSX from "xlsx";
import { EditProductDialog } from "@/components/edit-product-dialog";
import { ApprovalButton } from "@/components/approval-button";
import { RejectionDialog } from "@/components/rejection-dialog";
import { CancelProductDialog } from "@/components/cancel-product-dialog";
import { ProductTimelineDialog } from "@/components/product-timeline-dialog";
import { DeleteProductButton } from "@/components/delete-product-button";
import { useRouter } from "next/navigation";
import { getOrderForClone, sendToApproval, marketingApproveProduct, deleteProduct } from "@/lib/actions";
import { bulkUpdateSelectedProducts } from "@/lib/actions/order-actions";
import { toast } from "sonner";
import { ProductDetailDialog } from "@/components/product-detail-dialog";
import { BulkAssignDialog } from "@/components/bulk-assign-dialog";
import { BulkAssignSelectedDialog } from "@/components/bulk-assign-selected-dialog";

type SortField = 'name' | 'company' | 'date' | 'termin' | 'quantity' | 'status' | 'price';
type SortDirection = 'asc' | 'desc';

interface SectionProps {
    title: string;
    children: React.ReactNode;
}

interface PlanningProductListProps {
    orders: any[];
    legacyProducts: any[];
    userRole: string;
}

export function PlanningProductList({ orders, legacyProducts, userRole }: PlanningProductListProps) {
    const isViewer = userRole === 'VIEWER';
    const isAdmin = userRole === 'ADMIN';
    const isPlanner = userRole === 'PLANNER';
    const isMarketing = userRole === 'MARKETING';
    const router = useRouter();

    // Auto-poll the server for new changes without reloading the page
    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 10000); // 10 seconds
        return () => clearInterval(interval);
    }, [router]);

    // Detail View State (New Dialog)
    const [detailProduct, setDetailProduct] = useState<any>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // Bulk Assign Dialog State
    const [bulkAssignOrder, setBulkAssignOrder] = useState<{ id: number; name: string; count: number } | null>(null);

    // Çoklu seçim state'leri
    const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
    const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

    const [exportLoading, setExportLoading] = useState(false);
    const [exportDateFrom, setExportDateFrom] = useState<string>("");
    const [exportDateTo, setExportDateTo] = useState<string>("");
    const [exportStatus, setExportStatus] = useState<string>("all");
    const [cloneLoading, setCloneLoading] = useState<number | null>(null);
    const [sendingToApproval, setSendingToApproval] = useState<number | null>(null);
    const [sendingToProduction, setSendingToProduction] = useState<number | null>(null);

    // Expanded orders state
    const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

    // Filter states
    const [filterCompany, setFilterCompany] = useState<string>("");
    const [filterProductName, setFilterProductName] = useState<string>("");
    const [filterDateFrom, setFilterDateFrom] = useState<string>("");
    const [filterDateTo, setFilterDateTo] = useState<string>("");
    const [filterMonth, setFilterMonth] = useState<string>("all");
    const [filterYear, setFilterYear] = useState<string>("all");
    const [filterUnscheduled, setFilterUnscheduled] = useState<boolean>(false);

    // Sorting states
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Get unique companies for filter
    const companies = useMemo(() => {
        const companySet = new Set<string>();
        orders.forEach(order => {
            if (order.company) companySet.add(order.company);
        });
        return Array.from(companySet).sort();
    }, [orders]);

    // Get available years
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        orders.forEach(order => {
            const year = new Date(order.createdAt).getFullYear();
            years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [orders]);

    const months = [
        { value: "1", label: "Ocak" }, { value: "2", label: "Şubat" }, { value: "3", label: "Mart" },
        { value: "4", label: "Nisan" }, { value: "5", label: "Mayıs" }, { value: "6", label: "Haziran" },
        { value: "7", label: "Temmuz" }, { value: "8", label: "Ağustos" }, { value: "9", label: "Eylül" },
        { value: "10", label: "Ekim" }, { value: "11", label: "Kasım" }, { value: "12", label: "Aralık" },
    ];

    // Helper to filter products
    const filterProductsByTab = (products: any[], tab: string) => {
        if (!products) return [];
        switch (tab) {
            case 'pending':
                return products.filter(p => ['DRAFT', 'PENDING', 'APPROVED', 'MARKETING_REVIEW', 'REJECTED'].includes(p.status));
            case 'in_production':
                return products.filter(p => p.status === 'IN_PRODUCTION');
            case 'completed':
                // Completed currently means "Üretim Bitti"
                return products.filter(p => p.status === 'COMPLETED');
            case 'stored':
                // Depoda: Items where storedQty > 0
                return products.filter(p => (p.storedQty || 0) > 0);
            case 'shipped':
                return products.filter(p => p.status === 'SHIPPED');
            default: // 'all'
                return products;
        }
    };

    // Filter Logic
    const getFilteredData = (currentTab: string) => {
        let filteredLegacy = legacyProducts.filter(p => {
            // Apply common filters
            if (filterCompany && !p.company?.toLowerCase().includes(filterCompany.toLowerCase())) return false;
            if (filterProductName && !p.name?.toLowerCase().includes(filterProductName.toLowerCase())) return false;
            // Date filters ...
            // Apply Tab filter
            const matchesTab = filterProductsByTab([p], currentTab).length > 0;
            return matchesTab;
        });

        let filteredOrdersList = orders.filter(order => {
            // Company filter
            if (filterCompany && !order.company?.toLowerCase().includes(filterCompany.toLowerCase())) return false;

            // Product name filter - check if any product in the order matches
            if (filterProductName) {
                const hasMatchingProduct = order.products.some((p: any) =>
                    p.name?.toLowerCase().includes(filterProductName.toLowerCase())
                );
                if (!hasMatchingProduct) return false;
            }

            // Planlanmamış filtresi - terminDate null olanları göster
            if (filterUnscheduled) {
                const hasUnscheduledProduct = order.products.some((p: any) => !p.terminDate);
                if (!hasUnscheduledProduct) return false;
            }

            // Month/Year/Date filters
            const orderDate = new Date(order.createdAt);
            if (filterYear !== "all" && orderDate.getFullYear() !== parseInt(filterYear)) return false;
            if (filterMonth !== "all" && (orderDate.getMonth() + 1) !== parseInt(filterMonth)) return false;
            if (filterDateFrom && orderDate < new Date(filterDateFrom)) return false;
            if (filterDateTo) {
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999);
                if (orderDate > toDate) return false;
            }

            // Check if order has any products matching the tab
            const matchingProducts = filterProductsByTab(order.products, currentTab);
            return matchingProducts.length > 0;
        });

        // Sort Orders
        filteredOrdersList.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'name': comparison = (a.name || '').localeCompare(b.name || ''); break;
                case 'company': comparison = (a.company || '').localeCompare(b.company || ''); break;
                case 'date': comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
                case 'quantity': comparison = a.products.length - b.products.length; break;
                // Add terminator sort logic if needed
                case 'termin':
                    const aTermin = Math.max(...a.products.map((p: any) => p.terminDate ? new Date(p.terminDate).getTime() : 0), 0);
                    const bTermin = Math.max(...b.products.map((p: any) => p.terminDate ? new Date(p.terminDate).getTime() : 0), 0);
                    comparison = aTermin - bTermin;
                    break;
                case 'price':
                    const aPrice = a.totalAmount || 0;
                    const bPrice = b.totalAmount || 0;
                    comparison = aPrice - bPrice;
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return { filteredOrdersList, filteredLegacy };
    };


    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
        return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
    };

    const clearFilters = () => {
        setFilterCompany("");
        setFilterProductName("");
        setFilterDateFrom("");
        setFilterDateTo("");
        setFilterMonth("all");
        setFilterYear("all");
        setFilterUnscheduled(false);
        setCurrentPage(1);
    };

    const hasActiveFilters = filterCompany || filterProductName || filterDateFrom || filterDateTo || filterMonth !== "all" || filterYear !== "all" || filterUnscheduled;

    // Toggle order expansion
    const toggleOrder = (orderId: number) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    const handleRowClick = (product: any) => {
        setDetailProduct(product);
        setDetailOpen(true);
    };

    const handleSendToApproval = async (productId: number) => {
        try {
            const result = await sendToApproval(productId);
            if (result?.error) {
                toast.error(result.error);
            } else {
                toast.success("Ürün onaya gönderildi");
                router.refresh();
            }
        } catch (error) {
            toast.error("Onaya gönderme başarısız");
        }
    };

    const handleDeleteProduct = async (productId: number) => {
        try {
            const result = await deleteProduct(productId);
            if (result?.error) {
                toast.error(result.error);
            } else {
                toast.success("Ürün silindi");
                router.refresh();
            }
        } catch (error) {
            toast.error("Silme işlemi başarısız");
        }
    };

    const handleExport = () => {
        setExportLoading(true);
        try {
            const allProducts: any[] = [];

            // Yerel tarihi YYYY-MM-DD string olarak döndürür (timezone bağımsız)
            const toLocalStr = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            const passesFilter = (p: any) => {
                if (exportStatus !== "all" && p.status !== exportStatus) return false;
                if (exportDateFrom || exportDateTo) {
                    const refDate = p.orderDate ? new Date(p.orderDate) : null;
                    if (!refDate) return false;
                    const refStr = toLocalStr(refDate);
                    if (exportDateFrom && refStr < exportDateFrom) return false;
                    if (exportDateTo && refStr > exportDateTo) return false;
                }
                return true;
            };

            const getShipmentDate = (p: any): string => {
                if (!p.shipmentItems || p.shipmentItems.length === 0) return '-';
                const shipped = p.shipmentItems
                    .map((si: any) => si.shipment?.exitDate)
                    .filter(Boolean)
                    .sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
                return shipped.length > 0 ? new Date(shipped[0]).toLocaleDateString('tr-TR') : '-';
            };

            const processProduct = (p: any, orderName: string) => ({
                "Sipariş No": orderName,
                "Cari Adı": p.order?.company || p.company || '-',
                "Ürün Adı": p.name,
                "Model": p.model,
                "Atanan Usta": p.master || '-',
                "Sipariş Tarihi": p.orderDate ? new Date(p.orderDate).toLocaleDateString('tr-TR') : '-',
                "Termin Tarihi": p.terminDate ? new Date(p.terminDate).toLocaleDateString('tr-TR') : '-',
                "Depoya Giriş Tarihi": p.storedDate ? new Date(p.storedDate).toLocaleDateString('tr-TR') : '-',
                "Sevk Tarihi": getShipmentDate(p),
                "Sipariş Adedi": p.quantity,
                "Depo Adedi": p.storedQty,
                "Sevk Adedi": p.shippedQty,
                "Birim Fiyat": p.unitPrice || '-',
                "İskonto Oranı (%)": '-',
                "İskontosuz Fiyat": '-',
                "Toplam Fiyat": p.totalPrice || '-',
                "Durum": translateStatus(p.status),
                "Renk/DST": p.dstAdi || '-',
                "Malzeme": p.material || '-',
                "NetSim Açıklama 1": p.aciklama1 || '-',
                "NetSim Açıklama 2": p.aciklama2 || '-',
                "NetSim Açıklama 3": p.aciklama3 || '-',
                "NetSim Açıklama 4": p.aciklama4 || '-',
                "Açıklama": p.description || '-'
            });

            // Direkt ham veriden filtrele, sayfa filtrelerine bağımlı değil
            orders.forEach(order => {
                order.products.filter(passesFilter).forEach((p: any) => {
                    allProducts.push(processProduct(p, order.name));
                });
            });
            legacyProducts.filter(passesFilter).forEach(p => {
                allProducts.push(processProduct(p, "Siparişsiz / Eski"));
            });

            console.log('[Export Debug]', {
                totalOrders: orders.length,
                totalLegacy: legacyProducts.length,
                exportStatus,
                exportDateFrom,
                exportDateTo,
                matchingProducts: allProducts.length,
                sampleStatuses: orders.flatMap(o => o.products).slice(0, 5).map((p: any) => ({ status: p.status, orderDate: p.orderDate }))
            });

            if (allProducts.length === 0) {
                toast.warning("Filtre kriterlerine uyan ürün bulunamadı");
                return;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(allProducts);
            XLSX.utils.book_append_sheet(wb, ws, "Planlama Listesi");
            XLSX.writeFile(wb, `Planlama_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success(`${allProducts.length} ürün Excel'e aktarıldı`);
        } catch (error) {
            toast.error("Excel hatası");
        } finally {
            setExportLoading(false);
        }
    };

    // Revenue Calculation
    const calculateRevenue = (products: any[]) => {
        return products.reduce((acc, p) => acc + (p.totalPrice || 0), 0);
    };

    const renderTable = (tabValue: string) => {
        const { filteredOrdersList, filteredLegacy } = getFilteredData(tabValue);

        // Ciro gösterme - Planlama sayfasında ciro gizli
        const showRevenue = false;
        const totalRevenue = showRevenue
            ? filteredOrdersList.reduce((acc, o) => acc + calculateRevenue(filterProductsByTab(o.products, tabValue)), 0) + calculateRevenue(filterProductsByTab(filteredLegacy, tabValue))
            : 0;

        // Pagination Logic (Orders based)
        const totalPages = Math.ceil(filteredOrdersList.length / pageSize);
        const paginatedOrders = filteredOrdersList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        return (
            <div className="space-y-4">
                {/* Seçim çubuğu */}
                {selectedProductIds.size > 0 && !isViewer && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-sm font-medium text-blue-800">{selectedProductIds.size} ürün seçildi</span>
                        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => setBulkAssignOpen(true)}>
                            <Calendar className="h-3.5 w-3.5" />
                            Toplu Ata
                        </Button>
                        <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => setSelectedProductIds(new Set())}>
                            <X className="h-3.5 w-3.5 mr-1" />
                            Seçimi Temizle
                        </Button>
                    </div>
                )}
                {showRevenue && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <Card className={`bg-green-50 border-green-200`}>
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-green-600">
                                        Toplam Ciro ({tabValue === 'completed' ? 'Üretim Bitti' : tabValue === 'stored' ? 'Depoda' : 'Sevk Edildi'})
                                    </p>
                                    <h3 className="text-2xl font-bold text-green-700">
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalRevenue)}
                                    </h3>
                                </div>
                                <DollarSign className="h-8 w-8 text-green-500 opacity-50" />
                            </CardContent>
                        </Card>
                    </div>
                )}

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="w-10"></TableHead>
                                    {!isViewer && <TableHead className="w-8"></TableHead>}
                                    <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-slate-100">
                                        <div className="flex items-center">Sipariş / Ürün <SortIcon field="name" /></div>
                                    </TableHead>
                                    <TableHead onClick={() => handleSort('company')} className="cursor-pointer hover:bg-slate-100">
                                        <div className="flex items-center">Firma <SortIcon field="company" /></div>
                                    </TableHead>
                                    <TableHead onClick={() => handleSort('date')} className="cursor-pointer hover:bg-slate-100">
                                        <div className="flex items-center">Tarih <SortIcon field="date" /></div>
                                    </TableHead>
                                    <TableHead onClick={() => handleSort('termin')} className="cursor-pointer hover:bg-slate-100">
                                        <div className="flex items-center">Termin <SortIcon field="termin" /></div>
                                    </TableHead>
                                    <TableHead onClick={() => handleSort('quantity')} className="cursor-pointer hover:bg-slate-100">
                                        <div className="flex items-center">Adet <SortIcon field="quantity" /></div>
                                    </TableHead>
                                    <TableHead onClick={() => handleSort('status')} className="cursor-pointer hover:bg-slate-100">
                                        <div className="flex items-center">Durum <SortIcon field="status" /></div>
                                    </TableHead>
                                    {showRevenue && <TableHead>Tutar</TableHead>}
                                    {!isViewer && <TableHead>İşlem</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLegacy.length > 0 && (
                                    <React.Fragment>
                                        <TableRow className="bg-orange-50 hover:bg-orange-100 font-medium">
                                            <TableCell>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleOrder(-1)}>
                                                    {expandedOrders.has(-1) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                            <TableCell colSpan={showRevenue ? 7 : 6} className="text-orange-900">Eski / Siparişsiz Planlar</TableCell>
                                        </TableRow>
                                        {expandedOrders.has(-1) && filterProductsByTab(filteredLegacy, tabValue).map(p => (
                                            <ProductRow key={p.id} product={p} isViewer={isViewer} isAdmin={isAdmin} isMarketing={isMarketing} isPlanner={isPlanner} showRevenue={showRevenue} onClick={() => handleRowClick(p)} onSendToApproval={handleSendToApproval} onDelete={handleDeleteProduct} isSelected={selectedProductIds.has(p.id)} onSelect={(id: number, checked: boolean) => {
                                                const next = new Set(selectedProductIds);
                                                checked ? next.add(id) : next.delete(id);
                                                setSelectedProductIds(next);
                                            }} />
                                        ))}
                                    </React.Fragment>
                                )}

                                {paginatedOrders.map(order => {
                                    const matchingProducts = filterProductsByTab(order.products, tabValue);
                                    if (matchingProducts.length === 0) return null;
                                    const isExpanded = expandedOrders.has(order.id);

                                    // Reddilen ürün var mı kontrol et
                                    const hasRejectedProduct = matchingProducts.some((p: any) => p.status === 'REJECTED');

                                    // Tüm ürünlerin termin tarihi girilmiş mi kontrol et
                                    const allProductsHaveTermin = matchingProducts.length > 0 &&
                                        matchingProducts.every((p: any) => p.terminDate);

                                    const orderRowClass = hasRejectedProduct
                                        ? "bg-red-100 hover:bg-red-200 font-bold text-red-900 cursor-pointer border-l-4 border-red-500"
                                        : allProductsHaveTermin
                                            ? "bg-green-100 hover:bg-green-200 font-medium cursor-pointer border-l-4 border-green-500"
                                            : "bg-slate-100 hover:bg-slate-200 font-medium cursor-pointer";

                                    return (
                                        <React.Fragment key={order.id}>
                                            <TableRow className={orderRowClass} onClick={() => toggleOrder(order.id)}>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleOrder(order.id)}>
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <div className="font-semibold">{order.name}</div>
                                                        <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1 rounded">#{order.id}</span>
                                                        {hasRejectedProduct ? (
                                                            <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white text-[10px] animate-pulse">
                                                                Reddedilen!
                                                            </Badge>
                                                        ) : allProductsHaveTermin ? (
                                                            <Badge variant="secondary" className="bg-green-200 text-green-800 text-[10px]">
                                                                Tamamlandı
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        {new Date(order.createdAt).toLocaleDateString('tr-TR')}
                                                        {order.marketingBy?.username && ` · ${order.marketingBy.username}`}
                                                    </div>
                                                    {order.products?.[0]?.aciklama1 && (
                                                        <div className="text-[10px] text-amber-700 truncate max-w-[220px]" title={order.products[0].aciklama1}>
                                                            📋 {order.products[0].aciklama1}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {!isViewer && (
                                                            <div
                                                                className="flex items-center justify-center p-1 rounded hover:bg-slate-200 cursor-pointer text-indigo-600"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const orderProductIds = matchingProducts.map((p: any) => p.id);
                                                                    const allSelected = orderProductIds.every((id: number) => selectedProductIds.has(id));
                                                                    const next = new Set(selectedProductIds);
                                                                    if (allSelected) {
                                                                        orderProductIds.forEach((id: number) => next.delete(id));
                                                                    } else {
                                                                        orderProductIds.forEach((id: number) => next.add(id));
                                                                    }
                                                                    setSelectedProductIds(next);
                                                                }}
                                                                title="Bu siparişteki tüm ürünleri seç"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={matchingProducts.length > 0 && matchingProducts.every((p: any) => selectedProductIds.has(p.id))}
                                                                    readOnly
                                                                    className="h-4 w-4 rounded border-slate-300 cursor-pointer pointer-events-none"
                                                                />
                                                            </div>
                                                        )}
                                                        <span>{order.company}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{new Date(order.createdAt).toLocaleDateString('tr-TR')}</TableCell>
                                                <TableCell>-</TableCell>
                                                <TableCell><Badge variant="outline">{matchingProducts.length} adet</Badge></TableCell>
                                                <TableCell><Badge variant="secondary">{translateStatus(order.status)}</Badge></TableCell>
                                                {showRevenue && <TableCell>{order.totalAmount ? `${order.totalAmount} TL` : '-'}</TableCell>}
                                                {!isViewer && <TableCell></TableCell>}
                                            </TableRow>
                                            {isExpanded && matchingProducts.map((p: any) => (
                                                <ProductRow key={p.id} product={p} isViewer={isViewer} isAdmin={isAdmin} isMarketing={isMarketing} isPlanner={isPlanner} showRevenue={showRevenue} onClick={() => handleRowClick(p)} onSendToApproval={handleSendToApproval} onDelete={handleDeleteProduct} isSelected={selectedProductIds.has(p.id)} onSelect={(id: number, checked: boolean) => {
                                                    const next = new Set(selectedProductIds);
                                                    checked ? next.add(id) : next.delete(id);
                                                    setSelectedProductIds(next);
                                                }} />
                                            ))}
                                        </React.Fragment>
                                    );
                                })}

                                {paginatedOrders.length === 0 && filteredLegacy.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={showRevenue ? 9 : 8} className="text-center py-8 text-muted-foreground">
                                            Kayıt bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Pagination Controls */}
                {filteredOrdersList.length > 0 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span>Sayfa {currentPage} / {totalPages || 1}</span>
                            <span className="text-slate-300">|</span>
                            <span>Göster:</span>
                            {[20, 50, 100, 150, 200].map(size => (
                                <button
                                    key={size}
                                    onClick={() => { setPageSize(size); setCurrentPage(1); }}
                                    className={`px-2 py-0.5 rounded text-xs border ${pageSize === size ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-300 hover:bg-slate-100'}`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Önceki</Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Sonraki</Button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2"><Filter className="h-5 w-5" /> Filtreler</CardTitle>
                        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" /> Temizle</Button>}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-muted-foreground">Firma</label>
                            <Input placeholder="Firma ara..." value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-muted-foreground">Ürün Adı</label>
                            <Input placeholder="Ürün ara..." value={filterProductName} onChange={(e) => setFilterProductName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-muted-foreground">Yıl</label>
                            <Select value={filterYear} onValueChange={setFilterYear}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    {availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-muted-foreground">Ay</label>
                            <Select value={filterMonth} onValueChange={setFilterMonth}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-muted-foreground">Tarih Aralığı</label>
                            <div className="flex gap-2">
                                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-muted-foreground">Diğer</label>
                            <div className="flex items-center h-10 px-3 border rounded-md bg-background">
                                <input
                                    type="checkbox"
                                    id="filterUnscheduled"
                                    checked={filterUnscheduled}
                                    onChange={(e) => setFilterUnscheduled(e.target.checked)}
                                    className="mr-2 h-4 w-4"
                                />
                                <label htmlFor="filterUnscheduled" className="text-sm cursor-pointer">Planlanmamış</label>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-2 flex-wrap">
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-white shadow-sm">
                    <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">İndir için filtre:</span>
                    <Input
                        type="date"
                        value={exportDateFrom}
                        onChange={(e) => setExportDateFrom(e.target.value)}
                        className="h-7 text-xs w-32 border-slate-200"
                    />
                    <span className="text-xs text-muted-foreground">-</span>
                    <Input
                        type="date"
                        value={exportDateTo}
                        onChange={(e) => setExportDateTo(e.target.value)}
                        className="h-7 text-xs w-32 border-slate-200"
                    />
                    <Select value={exportStatus} onValueChange={setExportStatus}>
                        <SelectTrigger className="h-7 text-xs w-36 border-slate-200">
                            <SelectValue placeholder="Durum" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Durumlar</SelectItem>
                            <SelectItem value="APPROVED">Onaylandı</SelectItem>
                            <SelectItem value="IN_PRODUCTION">Üretimde</SelectItem>
                            <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                        </SelectContent>
                    </Select>
                    {(exportDateFrom || exportDateTo || exportStatus !== "all") && (
                        <button
                            onClick={() => { setExportDateFrom(""); setExportDateTo(""); setExportStatus("all"); }}
                            className="text-slate-400 hover:text-slate-600"
                            title="Temizle"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={exportLoading} className="gap-2 bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                    {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel İndir
                </Button>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="all">Tümü</TabsTrigger>
                    <TabsTrigger value="pending">Bekliyor</TabsTrigger>
                    <TabsTrigger value="in_production">Üretimde</TabsTrigger>
                    <TabsTrigger value="completed">Üretim Bitti</TabsTrigger>
                    <TabsTrigger value="stored">Depoda</TabsTrigger>
                    <TabsTrigger value="shipped">Sevk Edildi</TabsTrigger>
                </TabsList>

                <TabsContent value="all">{renderTable('all')}</TabsContent>
                <TabsContent value="pending">{renderTable('pending')}</TabsContent>
                <TabsContent value="in_production">{renderTable('in_production')}</TabsContent>
                <TabsContent value="completed">{renderTable('completed')}</TabsContent>
                <TabsContent value="stored">{renderTable('stored')}</TabsContent>
                <TabsContent value="shipped">{renderTable('shipped')}</TabsContent>
            </Tabs>

            <ProductDetailDialog
                open={detailOpen}
                onOpenChange={setDetailOpen}
                product={detailProduct}
                userRole={userRole}
            />

            {bulkAssignOrder && (
                <BulkAssignDialog
                    open={!!bulkAssignOrder}
                    onOpenChange={(open) => !open && setBulkAssignOrder(null)}
                    orderId={bulkAssignOrder.id}
                    orderName={bulkAssignOrder.name}
                    productCount={bulkAssignOrder.count}
                />
            )}

            <BulkAssignSelectedDialog
                open={bulkAssignOpen}
                onOpenChange={setBulkAssignOpen}
                productIds={Array.from(selectedProductIds)}
                companies={companies}
                onSuccess={() => setSelectedProductIds(new Set())}
            />
        </div>
    );
}

function ProductRow({ product, isViewer, isAdmin, isMarketing, isPlanner, showRevenue, onClick, onSendToApproval, onDelete, isSelected, onSelect }: any) {
    const [sendingApproval, setSendingApproval] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

    // Helper to get image
    const getImage = (p: any) => p.imageUrl || `/${p.systemCode}.png`;

    // Status Badge Logic
    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            'DRAFT': 'bg-slate-100 text-slate-600',
            'PENDING': 'bg-orange-100 text-orange-600',
            'APPROVED': 'bg-blue-100 text-blue-600',
            'REJECTED': 'bg-red-100 text-red-600',
            'COMPLETED': 'bg-green-100 text-green-600',
            'IN_PRODUCTION': 'bg-purple-100 text-purple-600',
            'SHIPPED': 'bg-gray-800 text-white',
        };
        return colors[status] || 'bg-gray-100 text-gray-600';
    };

    // Onaya gönderilebilir mi?
    const canSendToApproval = !["APPROVED", "IN_PRODUCTION", "COMPLETED", "SHIPPED", "MARKETING_REVIEW"].includes(product.status) && product.terminDate;

    const handleSendToApproval = async () => {
        setSendingApproval(true);
        try {
            await onSendToApproval(product.id);
        } finally {
            setSendingApproval(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Bu ürünü silmek istediğinizden emin misiniz?")) return;
        setDeleting(true);
        try {
            await onDelete(product.id);
        } finally {
            setDeleting(false);
        }
    };

    // Row styling logic
    const isRejected = product.status === 'REJECTED';
    const hasTerminDate = !!product.terminDate;

    const cellBg = isSelected
        ? "bg-blue-50"
        : isRejected
            ? "bg-red-50 text-red-900"
            : hasTerminDate
                ? "bg-green-50"
                : "bg-white";

    const rowBgClass = isSelected
        ? "bg-blue-50 hover:bg-blue-100 cursor-pointer"
        : isRejected
            ? "bg-red-50 hover:bg-red-100 cursor-pointer border-l-2 border-red-500"
            : hasTerminDate
                ? "bg-green-50 hover:bg-green-100 cursor-pointer"
                : "bg-white hover:bg-slate-50 cursor-pointer";

    return (
        <TableRow className={rowBgClass} onClick={onClick}>
            <TableCell></TableCell>
            {!isViewer && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelect(product.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 cursor-pointer"
                    />
                </TableCell>
            )}
            <TableCell>
                <div className="flex items-center gap-2 pl-4">
                    <div className="w-8 h-8 rounded border bg-slate-50 flex items-center justify-center overflow-hidden">
                        <img src={getImage(product)} alt="" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.src = '/placeholder.png')} />
                    </div>
                    <div>
                        {product.catalogProduct ? (
                            <>
                                <div className="text-[10px] text-slate-500 uppercase font-medium">NetSim:</div>
                                <div className="text-xs text-slate-600 mb-1">{product.name}</div>
                                <div className="text-[10px] text-green-600 uppercase font-medium">Katalog:</div>
                                <div className="font-medium text-green-700">{product.catalogProduct.name}</div>
                            </>
                        ) : (
                            <div className="font-medium">{product.name}</div>
                        )}
                        <div className="text-xs text-slate-500">{product.systemCode} | {product.model}</div>
                        {product.aciklama1 && (
                            <div className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded mt-0.5 truncate max-w-[200px]" title={product.aciklama1}>
                                📋 {product.aciklama1}
                            </div>
                        )}
                    </div>
                </div>
            </TableCell>
            <TableCell className={`text-sm ${cellBg}`}>{product.material || '-'}</TableCell>
            <TableCell className={`text-sm ${cellBg}`}>{product.orderDate ? new Date(product.orderDate).toLocaleDateString('tr-TR') : '-'}</TableCell>
            <TableCell className={`text-sm ${cellBg} ${hasTerminDate ? 'text-green-700 font-semibold' : 'text-red-500'}`}>
                {product.terminDate ? new Date(product.terminDate).toLocaleDateString('tr-TR') : 'Girilmedi'}
            </TableCell>
            <TableCell className={`font-bold ${cellBg}`}>
                <div className="flex flex-col">
                    <span>{product.quantity}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                        {product.produced > 0 && `(Ü: ${product.produced})`}
                    </span>
                </div>
            </TableCell>
            <TableCell className={cellBg}>
                <span className={`px-2 py-1 rounded text-xs font-bold inline-block ${getStatusBadge(product.status)}`}>
                    {translateStatus(product.status)}
                </span>
            </TableCell>
            {showRevenue && <TableCell className={cellBg}>{product.totalPrice ? `${product.totalPrice} TL` : '-'}</TableCell>}
            {!isViewer && (
                <TableCell className={cellBg} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 bg-transparent"
                            onClick={onClick}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            Düzenle
                        </Button>
                        {canSendToApproval && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 bg-transparent"
                                onClick={handleSendToApproval}
                                disabled={sendingApproval}
                            >
                                {sendingApproval ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <SendHorizontal className="h-3.5 w-3.5" />
                                )}
                                Onaya Gönder
                            </Button>
                        )}
                        {isAdmin && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <X className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        )}
                        {product.status === 'REJECTED' && <Info className="h-4 w-4 text-red-500" />}
                    </div>
                </TableCell>
            )}
        </TableRow>
    );
}
