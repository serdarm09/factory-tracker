'use client';

import { useState, useMemo, useTransition } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { updateProductStages } from "@/lib/actions";
import { X, Search, ArrowUpDown, Truck, Package, Wrench, CheckCircle, Clock, AlertTriangle, MessageSquare, Sofa, Hammer, BoxIcon, TrendingUp, Warehouse, Info, Edit2, Save, Users, List, Download, FileSpreadsheet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { DataTablePagination, usePagination } from "@/components/data-table-pagination";
import { DateRangeFilter } from "./date-range-filter";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';

interface ProductionPlanningTableProps {
    products: any[];
    userRole: string;
}

// Üretim aşamaları - Kademeli akış
// Mühendis: Sünger -> Döşeme -> Montaj -> Paketleme (4 aşama - burada düzenlenir)
// Depo Girişi: Paketlendi -> Depoda (production sayfasından yapılır)
// Sevkiyat: Depoda -> Sevk (warehouse sayfasından yapılır)
const STAGES = [
    { key: 'foam', label: 'Süngerde', field: 'foamQty', icon: Sofa, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-300', editable: true },
    { key: 'upholstery', label: 'Döşemede', field: 'upholsteryQty', icon: Sofa, color: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-300', editable: true },
    { key: 'assembly', label: 'Montajda', field: 'assemblyQty', icon: Hammer, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-300', editable: true },
    { key: 'packaged', label: 'Paketlendi', field: 'packagedQty', icon: BoxIcon, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300', editable: true },
    { key: 'stored', label: 'Depoda', field: 'storedQty', icon: Warehouse, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-300', editable: false }, // Production sayfasından
    { key: 'shipped', label: 'Sevk', field: 'shippedQty', icon: Truck, color: 'text-teal-600', bg: 'bg-teal-100', border: 'border-teal-300', editable: false }, // Warehouse sayfasından
] as const;

type StageKey = typeof STAGES[number]['key'];

// Ana durumlar
const STATUS_CONFIG = {
    "APPROVED": { label: "Bekliyor", color: "bg-blue-500", textColor: "text-blue-600", icon: Clock },
    "IN_PRODUCTION": { label: "Üretimde", color: "bg-yellow-500", textColor: "text-yellow-600", icon: Wrench },
    "COMPLETED": { label: "Üretim Bitti", color: "bg-green-500", textColor: "text-green-600", icon: CheckCircle },
    "SHIPPED": { label: "Sevk Edildi", color: "bg-teal-500", textColor: "text-teal-600", icon: Truck },
};

export function ProductionPlanningTable({ products, userRole }: ProductionPlanningTableProps) {
    // Filtreler
    const [activeTab, setActiveTab] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCompany, setFilterCompany] = useState("");
    const [filterMaster, setFilterMaster] = useState(""); // Usta filtresi
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'terminDate', direction: 'asc' });
    const [viewMode, setViewMode] = useState<'master' | 'list'>('master'); // Default: Usta Bazlı
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]); // Çoklu seçim

    // Dialog
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Inline edit - aşamalar için
    const [editingProduct, setEditingProduct] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Record<StageKey, number>>({
        foam: 0,
        upholstery: 0,
        assembly: 0,
        packaged: 0,
        stored: 0,
        shipped: 0
    });
    const [editNote, setEditNote] = useState("");

    const canEdit = ["ADMIN", "ENGINEER", "PLANNER", "WORKER", "MARKETER"].includes(userRole);

    // Benzersiz firmalar ve ustalar
    const uniqueCompanies = useMemo(() => {
        const companies = new Set<string>();
        products.forEach(p => { if (p.order?.company) companies.add(p.order.company); });
        return Array.from(companies).sort();
    }, [products]);

    const uniqueMasters = useMemo(() => {
        const masters = new Set<string>();
        products.forEach(p => { if (p.master) masters.add(p.master); });
        return Array.from(masters).sort();
    }, [products]);

    // Ürünün kalan miktarını hesapla
    const getRemainingQty = (p: any): number => {
        const total = p.quantity || 0;
        const shipped = p.shippedQty || 0;
        return total - shipped;
    };

    // Ürünün üretim aşamalarındaki toplam
    const getInProductionTotal = (p: any): number => {
        return (p.upholsteryQty || 0) + (p.assemblyQty || 0) + (p.packagedQty || 0);
    };

    // Depoda bekleyen (storedQty)
    const getInWarehouse = (p: any): number => {
        return p.storedQty || 0;
    };

    // İlerleme yüzdesi - depo + sevk bazlı
    const getProgress = (p: any): number => {
        if (p.quantity === 0) return 0;
        const completed = (p.storedQty || 0) + (p.shippedQty || 0);
        return Math.round((completed / p.quantity) * 100);
    };

    // Filtreleme
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Tab filtresi
            if (activeTab !== "all") {
                if (activeTab === "IN_WAREHOUSE") {
                    // Depoda bekleyenler - storedQty > 0
                    if ((p.storedQty || 0) === 0) return false;
                } else if (activeTab === "HAS_SHIPMENT") {
                    // Sevk edilenler - shippedQty > 0 (kısmi dahil)
                    if ((p.shippedQty || 0) === 0) return false;
                } else if (p.status !== activeTab) {
                    return false;
                }
            }

            // Arama filtresi
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                const matchesSearch =
                    p.name?.toLowerCase().includes(s) ||
                    p.model?.toLowerCase().includes(s) ||
                    p.systemCode?.toLowerCase().includes(s) ||
                    p.order?.company?.toLowerCase().includes(s);
                if (!matchesSearch) return false;
            }

            // Firma filtresi
            if (filterCompany && p.order?.company !== filterCompany) return false;

            // Usta filtresi
            if (filterMaster) {
                if (filterMaster === "none") {
                    if (p.master) return false; // Usta atanmamış olanları göster
                } else if (p.master !== filterMaster) {
                    return false;
                }
            }

            // Tarih aralığı filtresi
            if (dateRange?.from) {
                const from = new Date(dateRange.from);
                from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
                to.setHours(23, 59, 59, 999);
                const terminDate = new Date(p.terminDate);
                if (terminDate < from || terminDate > to) return false;
            }

            return true;
        });
    }, [products, activeTab, searchTerm, filterCompany, filterMaster, dateRange]);

    // Usta bazlı gruplama
    const groupedByMaster = useMemo(() => {
        const groups: Record<string, any[]> = {};
        filteredProducts.forEach(p => {
            const master = p.master || "Usta Atanmamış";
            if (!groups[master]) groups[master] = [];
            groups[master].push(p);
        });
        return groups;
    }, [filteredProducts]);

    // İstatistikler - Kısmi sevkleri de dahil et (tüm ürünler üzerinden)
    const stats = useMemo(() => {
        // Kısmi veya tam sevk edilen ürünler (shippedQty > 0)
        const productsWithShipments = products.filter(p => (p.shippedQty || 0) > 0);
        // Depoda bekleyen ürünler (storedQty > 0)
        const inWarehouseProducts = products.filter(p => (p.storedQty || 0) > 0);

        // Sevk edilen ciro = birim fiyat * sevk edilen miktar (kısmi dahil)
        const shippedRevenue = products.reduce((sum, p) => {
            const shippedQty = p.shippedQty || 0;
            const unitPrice = p.unitPrice || 0;
            return sum + (unitPrice * shippedQty);
        }, 0);

        // Toplam sevk edilen adet
        const shippedCount = products.reduce((sum, p) => sum + (p.shippedQty || 0), 0);

        // Depodaki ciro = birim fiyat * depodaki miktar
        const warehouseRevenue = products.reduce((sum, p) => {
            const storedQty = p.storedQty || 0;
            const unitPrice = p.unitPrice || 0;
            return sum + (unitPrice * storedQty);
        }, 0);

        // Depodaki toplam adet
        const inWarehouseCount = products.reduce((sum, p) => sum + (p.storedQty || 0), 0);

        // Üretimdeki ciro = birim fiyat * üretimdeki miktar (foam + upholstery + assembly + packaged)
        const inProductionRevenue = products.reduce((sum, p) => {
            const inProductionQty = (p.foamQty || 0) + (p.upholsteryQty || 0) + (p.assemblyQty || 0) + (p.packagedQty || 0);
            const unitPrice = p.unitPrice || 0;
            return sum + (unitPrice * inProductionQty);
        }, 0);

        // Üretimdeki toplam adet
        const inProductionCount = products.reduce((sum, p) => {
            return sum + (p.foamQty || 0) + (p.upholsteryQty || 0) + (p.assemblyQty || 0) + (p.packagedQty || 0);
        }, 0);

        return {
            shippedRevenue,
            shippedCount,
            shippedProductCount: productsWithShipments.length,
            warehouseRevenue,
            inWarehouseCount,
            inWarehouseProductCount: inWarehouseProducts.length,
            inProductionRevenue,
            inProductionCount,
        };
    }, [products]);

    // Sıralama
    const sortedProducts = useMemo(() => {
        return [...filteredProducts].sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortConfig.key) {
                case 'name': aVal = a.name; bVal = b.name; break;
                case 'company': aVal = a.order?.company || ''; bVal = b.order?.company || ''; break;
                case 'terminDate': aVal = new Date(a.terminDate).getTime(); bVal = new Date(b.terminDate).getTime(); break;
                case 'progress': aVal = getProgress(a); bVal = getProgress(b); break;
                default: aVal = a[sortConfig.key]; bVal = b[sortConfig.key];
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredProducts, sortConfig]);

    const pagination = usePagination(sortedProducts, 20);

    // Edit başlat
    const startEdit = (p: any) => {
        if (!canEdit) return;
        setEditingProduct(p.id);
        setEditValues({
            foam: p.foamQty || 0,
            upholstery: p.upholsteryQty || 0,
            assembly: p.assemblyQty || 0,
            packaged: p.packagedQty || 0,
            stored: p.storedQty || 0,
            shipped: p.shippedQty || 0
        });
        setEditNote(p.engineerNote || "");
    };

    // Kademeli mantık: Bir aşamadaki değer değiştiğinde, sonraki aşamalar otomatik ayarlanır
    // Mühendis: foam, upholstery, assembly, packaged düzenleyebilir
    // Depo girişi (stored) production sayfasından yapılır
    // Sevk işlemi (shipped) warehouse sayfasından yapılır
    // Toplam: foam + upholstery + assembly + packaged + stored + shipped <= quantity
    const handleStageChange = (stage: StageKey, value: number, product: any) => {
        const maxTotal = product.quantity;
        const newValues = { ...editValues };

        // Sevk bu sayfadan düzenlenemez
        if (stage === 'shipped') {
            toast.error("Sevk işlemi Depo sayfasından yapılır.");
            return;
        }

        // Depo girişi production sayfasından yapılır
        if (stage === 'stored') {
            toast.error("Depo girişi Üretim (Depo Girişi) sayfasından yapılır.");
            return;
        }

        // Mühendis aşamaları için normal mantık (foam, upholstery, assembly, packaged)
        newValues[stage] = Math.max(0, Math.min(value, maxTotal));

        // Toplam kontrolü - eğer toplam quantity'i geçerse, önceki aşamalardan düş
        const stageOrder: StageKey[] = ['foam', 'upholstery', 'assembly', 'packaged', 'stored', 'shipped'];
        const currentIndex = stageOrder.indexOf(stage);

        // Toplamı hesapla (stored ve shipped hariç - onlar değiştirilemez)
        let total = newValues.foam + newValues.upholstery + newValues.assembly + newValues.packaged + newValues.stored + newValues.shipped;

        // Eğer toplam fazlaysa, mevcut aşamadan önceki aşamalardan düş
        if (total > maxTotal) {
            const excess = total - maxTotal;
            let remaining = excess;

            // Önceki aşamalardan düşür (tersten, stored ve shipped hariç)
            for (let i = currentIndex - 1; i >= 0 && remaining > 0; i--) {
                const stageKey = stageOrder[i];
                if (stageKey === 'shipped' || stageKey === 'stored') continue;
                const reduction = Math.min(newValues[stageKey], remaining);
                newValues[stageKey] -= reduction;
                remaining -= reduction;
            }

            // Hala fazlaysa, mevcut değeri düşür
            if (remaining > 0) {
                newValues[stage] -= remaining;
            }
        }

        setEditValues(newValues);
    };

    // Kaydet
    const saveEdit = async (p: any) => {
        const total = editValues.foam + editValues.upholstery + editValues.assembly + editValues.packaged + editValues.stored + editValues.shipped;

        if (total > p.quantity) {
            toast.error(`Toplam aşama adedi (${total}) ürün adedini (${p.quantity}) geçemez`);
            return;
        }

        startTransition(async () => {
            const res = await updateProductStages(p.id, {
                foam: editValues.foam,
                upholstery: editValues.upholstery,
                assembly: editValues.assembly,
                packaged: editValues.packaged,
                stored: editValues.stored,
                shipped: editValues.shipped,
                engineerNote: editNote
            });

            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Güncellendi");
                setEditingProduct(null);
            }
        });
    };

    // Dialog içerisinde kaydet
    const saveDialogEdit = async () => {
        if (!selectedProduct) return;

        const total = editValues.foam + editValues.upholstery + editValues.assembly + editValues.packaged + editValues.stored + editValues.shipped;

        if (total > selectedProduct.quantity) {
            toast.error(`Toplam asama adedi (${total}) urun adedini (${selectedProduct.quantity}) gecemez`);
            return;
        }

        startTransition(async () => {
            const res = await updateProductStages(selectedProduct.id, {
                foam: editValues.foam,
                upholstery: editValues.upholstery,
                assembly: editValues.assembly,
                packaged: editValues.packaged,
                stored: editValues.stored,
                shipped: editValues.shipped,
                engineerNote: editNote
            });

            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Güncellendi");
                // Seçili ürünü güncelle
                setSelectedProduct({
                    ...selectedProduct,
                    foamQty: editValues.foam,
                    upholsteryQty: editValues.upholstery,
                    assemblyQty: editValues.assembly,
                    packagedQty: editValues.packaged,
                    storedQty: editValues.stored,
                    shippedQty: editValues.shipped,
                    engineerNote: editNote
                });
            }
        });
    };

    // Ürün detay dialogunu aç
    const openProductDetail = (p: any) => {
        setSelectedProduct(p);
        setEditValues({
            foam: p.foamQty || 0,
            upholstery: p.upholsteryQty || 0,
            assembly: p.assemblyQty || 0,
            packaged: p.packagedQty || 0,
            stored: p.storedQty || 0,
            shipped: p.shippedQty || 0
        });
        setEditNote(p.engineerNote || "");
        setIsDetailOpen(true);
    };

    const requestSort = (key: string) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const SortHead = ({ label, sortKey }: { label: string; sortKey: string }) => (
        <TableHead>
            <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-0 font-bold flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${sortConfig.key === sortKey ? 'text-blue-600' : 'text-slate-400'}`} />
            </Button>
        </TableHead>
    );

    const clearFilters = () => {
        setSearchTerm("");
        setFilterCompany("");
        setFilterMaster("");
        setDateRange(undefined);
    };

    const hasActiveFilters = searchTerm || filterCompany || filterMaster || dateRange?.from;

    // Excel indirme fonksiyonu
    const downloadExcel = (productsToExport: any[], masterName?: string) => {
        const data = productsToExport.map(p => ({
            'Firma': p.order?.company || '-',
            'Sipariş Adı': p.order?.name || '-',
            'Ürün Adı': p.name,
            'Model': p.model,
            'Stok Kodu': p.sku || '-',
            'Usta': p.master || 'Atanmamış',
            'Adet': p.quantity,
            'Sünger': p.foamQty || 0,
            'Döşeme': p.upholsteryQty || 0,
            'Montaj': p.assemblyQty || 0,
            'Paket': p.packagedQty || 0,
            'Depo': p.storedQty || 0,
            'Sevk': p.shippedQty || 0,
            'Birim Fiyat': p.unitPrice || 0,
            'Toplam Fiyat': p.totalPrice || 0,
            'Sipariş Tarihi': p.orderDate ? format(new Date(p.orderDate), 'dd.MM.yyyy') : '-',
            'Termin Tarihi': p.terminDate ? format(new Date(p.terminDate), 'dd.MM.yyyy') : '-',
            'Üretim Tarihi': p.productionDate ? format(new Date(p.productionDate), 'dd.MM.yyyy') : '-',
            'Malzeme': p.material || '-',
            'Kumaş': p.fabricType || '-',
            'Ayak': p.footType || '-',
            'Kol': p.armType || '-',
            'Sırt': p.backType || '-',
            'Açıklama': p.description || '-',
            'Mühendis Notu': p.engineerNote || '-',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Üretim');

        const fileName = masterName
            ? `uretim_${masterName.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`
            : `uretim_tumu_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;

        XLSX.writeFile(wb, fileName);
        toast.success(`${data.length} ürün Excel'e aktarıldı`);
    };

    // Ürün durumunu göster
    const getStatusDisplay = (p: any) => {
        // Detaylı durum belirleme - tamamı o aşamadaysa göster, değilse üretim aşamasını göster
        const shipped = p.shippedQty || 0;
        const stored = p.storedQty || 0;
        const packaged = p.packagedQty || 0;
        const assembly = p.assemblyQty || 0;
        const upholstery = p.upholsteryQty || 0;
        const foam = p.foamQty || 0;
        const total = p.quantity;

        // Öncelik: Sevk Edildi (tamamı) > Kısmi Sevk > Depoda (tamamı) > Paketlendi (tamamı) > Aktif Üretim Aşaması > Bekliyor
        if (shipped >= total) {
            return { label: "Sevk Edildi", color: "bg-teal-500", icon: Truck };
        } else if (shipped > 0) {
            return { label: "Kısmi Sevk", color: "bg-teal-400", icon: Truck };
        } else if (stored >= total) {
            return { label: "Depoda", color: "bg-green-500", icon: Warehouse };
        } else if (packaged >= total) {
            return { label: "Paketlendi", color: "bg-blue-500", icon: BoxIcon };
        }
        // Kısmi durumlar için aktif üretim aşamasını göster
        else if (assembly > 0) {
            return { label: "Montajda", color: "bg-orange-500", icon: Hammer };
        } else if (upholstery > 0) {
            return { label: "Döşemede", color: "bg-yellow-500", icon: Sofa };
        } else if (foam > 0) {
            return { label: "Süngerde", color: "bg-purple-500", icon: Sofa };
        } else if (packaged > 0) {
            // Kısmi paket - hala üretimde
            return { label: "Paketlemede", color: "bg-blue-400", icon: BoxIcon };
        } else if (stored > 0) {
            // Kısmi depo - hala üretimde
            return { label: "Kısmi Depoda", color: "bg-green-400", icon: Warehouse };
        } else if (p.status === "IN_PRODUCTION" || p.status === "APPROVED") {
            return { label: "Bekliyor", color: "bg-slate-500", icon: Clock };
        } else {
            return { label: "Tamamlandı", color: "bg-green-600", icon: CheckCircle };
        }
    };

    // Aşama progress gösterimi
    const renderStageProgress = (p: any) => {
        const stages = [
            { value: p.foamQty || 0, color: 'bg-purple-500' },
            { value: p.upholsteryQty || 0, color: 'bg-yellow-500' },
            { value: p.assemblyQty || 0, color: 'bg-orange-500' },
            { value: p.packagedQty || 0, color: 'bg-blue-500' },
            { value: p.storedQty || 0, color: 'bg-green-500' },
            { value: p.shippedQty || 0, color: 'bg-teal-500' },
        ];

        const total = p.quantity;

        return (
            <div className="flex items-center gap-1">
                {stages.map((s, i) => (
                    <div
                        key={i}
                        className={`h-6 ${s.color} rounded flex items-center justify-center text-white text-xs font-bold`}
                        style={{ width: `${Math.max((s.value / total) * 80, s.value > 0 ? 20 : 0)}px` }}
                        title={`${STAGES[i].label}: ${s.value}`}
                    >
                        {s.value > 0 && s.value}
                    </div>
                ))}
                <span className="text-xs text-slate-500 ml-1">/ {total}</span>
            </div>
        );
    };

    // Excel'e aktar - Tüm filtrelenmiş ürünler
    const handleExportToExcel = () => {
        const exportData = filteredProducts.map(product => ({
            'Ürün Adı': product.name,
            'Model': product.model,
            'Sistem Kodu': product.systemCode,
            'Firma': product.order?.company || '-',
            'Sipariş Adı': product.order?.name || '-',
            'Usta': product.master || 'Atanmamış',
            'Adet': product.quantity,
            'Sünger': product.foamQty || 0,
            'Döşeme': product.upholsteryQty || 0,
            'Montaj': product.assemblyQty || 0,
            'Paketlenen': product.packagedQty || 0,
            'Depoda': product.storedQty || 0,
            'Sevk Edilen': product.shippedQty || 0,
            'Durum': STATUS_CONFIG[product.status as keyof typeof STATUS_CONFIG]?.label || product.status,
            'Termin Tarihi': product.terminDate ? format(new Date(product.terminDate), 'dd/MM/yyyy') : '-',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Üretim Listesi");

        const colWidths = [
            { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }
        ];
        ws['!cols'] = colWidths;

        const fileName = `Uretim_Listesi_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success(`${filteredProducts.length} ürün Excel'e aktarıldı`);
    };

    // Seçili ürünleri Excel'e aktar
    const handleExportSelected = () => {
        const selectedProducts = filteredProducts.filter(p => selectedProductIds.includes(p.id));

        if (selectedProducts.length === 0) {
            toast.error("Lütfen en az bir ürün seçin");
            return;
        }

        const exportData = selectedProducts.map(product => ({
            'Ürün Adı': product.name,
            'Model': product.model,
            'Sistem Kodu': product.systemCode,
            'Firma': product.order?.company || '-',
            'Sipariş Adı': product.order?.name || '-',
            'Usta': product.master || 'Atanmamış',
            'Adet': product.quantity,
            'Sünger': product.foamQty || 0,
            'Döşeme': product.upholsteryQty || 0,
            'Montaj': product.assemblyQty || 0,
            'Paketlenen': product.packagedQty || 0,
            'Depoda': product.storedQty || 0,
            'Sevk Edilen': product.shippedQty || 0,
            'Durum': STATUS_CONFIG[product.status as keyof typeof STATUS_CONFIG]?.label || product.status,
            'Termin Tarihi': product.terminDate ? format(new Date(product.terminDate), 'dd/MM/yyyy') : '-',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Seçili Ürünler");

        const colWidths = [
            { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }
        ];
        ws['!cols'] = colWidths;

        const fileName = `Secili_Urunler_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success(`${selectedProducts.length} seçili ürün Excel'e aktarıldı`);
    };

    // Tümünü seç/kaldır
    const toggleSelectAll = () => {
        if (selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0) {
            setSelectedProductIds([]);
        } else {
            setSelectedProductIds(filteredProducts.map(p => p.id));
        }
    };

    // Usta bazlı Excel export
    const handleExportMasterBased = () => {
        const wb = XLSX.utils.book_new();

        Object.entries(groupedByMaster).forEach(([master, products]) => {
            const exportData = products.map(product => ({
                'Ürün Adı': product.name,
                'Model': product.model,
                'Sistem Kodu': product.systemCode,
                'Firma': product.order?.company || '-',
                'Sipariş Adı': product.order?.name || '-',
                'Adet': product.quantity,
                'Sünger': product.foamQty || 0,
                'Döşeme': product.upholsteryQty || 0,
                'Montaj': product.assemblyQty || 0,
                'Paketlenen': product.packagedQty || 0,
                'Depoda': product.storedQty || 0,
                'Sevk Edilen': product.shippedQty || 0,
                'Durum': STATUS_CONFIG[product.status as keyof typeof STATUS_CONFIG]?.label || product.status,
                'Termin Tarihi': product.terminDate ? format(new Date(product.terminDate), 'dd/MM/yyyy') : '-',
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const colWidths = [
                { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
                { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
                { wch: 12 }, { wch: 12 }, { wch: 12 }
            ];
            ws['!cols'] = colWidths;

            // Sheet adını temizle (Excel için geçersiz karakterleri kaldır)
            const sheetName = master.replace(/[:\\/?*\[\]]/g, '-').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        const fileName = `Usta_Bazli_Uretim_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success(`${Object.keys(groupedByMaster).length} usta için Excel dosyası oluşturuldu`);
    };

    // Aşama özet gösterimi
    const StagesSummary = ({ p }: { p: any }) => {
        const stages = [
            { value: p.foamQty || 0, color: 'bg-purple-500' },
            { value: p.upholsteryQty || 0, color: 'bg-yellow-500' },
            { value: p.assemblyQty || 0, color: 'bg-orange-500' },
            { value: p.packagedQty || 0, color: 'bg-blue-500' },
            { value: p.storedQty || 0, color: 'bg-green-500' },
            { value: p.shippedQty || 0, color: 'bg-teal-500' },
        ];

        const total = p.quantity;

        return (
            <div className="flex items-center gap-1">
                {stages.map((s, i) => (
                    <div
                        key={i}
                        className={`h-6 ${s.color} rounded flex items-center justify-center text-white text-xs font-bold`}
                        style={{ width: `${Math.max((s.value / total) * 80, s.value > 0 ? 20 : 0)}px` }}
                        title={`${STAGES[i].label}: ${s.value}`}
                    >
                        {s.value > 0 && s.value}
                    </div>
                ))}
                <span className="text-xs text-slate-500 ml-1">/ {total}</span>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Ciro ve Özet Kartları */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 font-medium">Toplam Ürün</p>
                                <p className="text-2xl font-bold text-blue-700">{products.length}</p>
                            </div>
                            <Package className="h-8 w-8 text-blue-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-600 font-medium">Üretimde</p>
                                <p className="text-2xl font-bold text-yellow-700">{stats.inProductionCount} adet</p>
                                {userRole === 'ADMIN' && (
                                    <p className="text-xs font-semibold text-yellow-600 mt-1">
                                        {stats.inProductionRevenue.toLocaleString('tr-TR')} ₺
                                    </p>
                                )}
                            </div>
                            <Wrench className="h-8 w-8 text-yellow-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 font-medium">Depoda</p>
                                <p className="text-2xl font-bold text-green-700">{stats.inWarehouseCount} adet</p>
                                {userRole === 'ADMIN' && (
                                    <p className="text-xs font-semibold text-green-600 mt-1">
                                        {stats.warehouseRevenue.toLocaleString('tr-TR')} ₺
                                    </p>
                                )}
                            </div>
                            <Warehouse className="h-8 w-8 text-green-400" />
                        </div>
                    </CardContent>
                </Card>

                {/* Sevk Edilen */}
                <Card className="bg-teal-50 border-teal-200">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-teal-600 font-medium">Sevk Edilen</p>
                                <p className="text-2xl font-bold text-teal-700">{stats.shippedCount} adet</p>
                                {userRole === 'ADMIN' && (
                                    <p className="text-xs font-semibold text-teal-600 mt-1">
                                        {stats.shippedRevenue.toLocaleString('tr-TR')} ₺
                                    </p>
                                )}
                            </div>
                            <Truck className="h-8 w-8 text-teal-400" />
                        </div>
                    </CardContent>
                </Card>

                {/* Üretimdeki Ciro - Sadece Admin */}
                {userRole === 'ADMIN' && (
                    <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-orange-600 font-medium">Üretim Ciro</p>
                                    <p className="text-xl font-bold text-orange-700">
                                        {stats.inProductionRevenue.toLocaleString('tr-TR')} ₺
                                    </p>
                                    <p className="text-xs text-orange-500">{stats.inProductionCount} adet</p>
                                </div>
                                <Wrench className="h-8 w-8 text-orange-400" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Depodaki Ciro - Sadece Admin */}
                {userRole === 'ADMIN' && (
                    <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-emerald-600 font-medium">Depo Ciro</p>
                                    <p className="text-xl font-bold text-emerald-700">
                                        {stats.warehouseRevenue.toLocaleString('tr-TR')} ₺
                                    </p>
                                    <p className="text-xs text-emerald-500">{stats.inWarehouseCount} adet</p>
                                </div>
                                <Warehouse className="h-8 w-8 text-emerald-400" />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* AI Bottleneck Analysis - Sadece Admin */}
            {userRole === 'ADMIN' && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 flex items-start gap-4 shadow-sm">
                    <div className="bg-white p-2 rounded-full shadow-sm">
                        <TrendingUp className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-orange-900 flex items-center gap-2">
                            Üretim Akış Analizi
                            <Badge variant="outline" className="bg-white text-orange-600 border-orange-200 text-[10px] h-5">
                                Yapay Zeka Destekli
                            </Badge>
                        </h4>

                        {(() => {
                            // Calculate totals for each stage
                            const stageTotals = {
                                foam: products.reduce((sum, p) => sum + (p.foamQty || 0), 0),
                                upholstery: products.reduce((sum, p) => sum + (p.upholsteryQty || 0), 0),
                                assembly: products.reduce((sum, p) => sum + (p.assemblyQty || 0), 0),
                                packaged: products.reduce((sum, p) => sum + (p.packagedQty || 0), 0),
                            };

                            // Find bottleneck
                            const entries = Object.entries(stageTotals);
                            const sorted = entries.sort(([, a], [, b]) => b - a);
                            const [maxStage, maxCount] = sorted[0];

                            const stageLabels: Record<string, string> = {
                                foam: 'Sünger',
                                upholstery: 'Döşeme',
                                assembly: 'Montaj',
                                packaged: 'Paketleme'
                            };

                            if (maxCount === 0) return <p className="text-sm text-orange-800 mt-1">Üretim hattında şu an aktif yük bulunmuyor.</p>;

                            return (
                                <div className="mt-2 text-sm text-orange-800">
                                    <p className="mb-1">
                                        <span className="font-semibold">⚠️ Darboğaz Tespiti:</span> En yüksek yoğunluk <strong>{stageLabels[maxStage]}</strong> aşamasında ({maxCount} adet).
                                    </p>
                                    <p className="text-xs opacity-80">
                                        Öneri: {stageLabels[maxStage]} bölümüne ek kaynak kaydırılması, toplam üretim hızını artırabilir.
                                    </p>

                                    <div className="mt-3 grid grid-cols-4 gap-2">
                                        {(['foam', 'upholstery', 'assembly', 'packaged'] as const).map(stage => (
                                            <div key={stage} className={`text-xs p-2 rounded border text-center ${stage === maxStage ? 'bg-orange-100 border-orange-300 font-bold' : 'bg-white border-orange-100'}`}>
                                                <div className="text-slate-500 mb-1">{stageLabels[stage]}</div>
                                                <div className="text-lg">{stageTotals[stage]}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Sekmeler */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-6 w-full max-w-3xl">
                    <TabsTrigger value="all" className="gap-1 text-xs">
                        <Package className="h-4 w-4" />
                        Tümü ({products.length})
                    </TabsTrigger>
                    <TabsTrigger value="APPROVED" className="gap-1 text-xs">
                        <Clock className="h-4 w-4" />
                        Bekliyor ({products.filter(p => p.status === "APPROVED").length})
                    </TabsTrigger>
                    <TabsTrigger value="IN_PRODUCTION" className="gap-1 text-xs">
                        <Wrench className="h-4 w-4" />
                        Üretimde ({products.filter(p => p.status === "IN_PRODUCTION").length})
                    </TabsTrigger>
                    <TabsTrigger value="IN_WAREHOUSE" className="gap-1 text-xs">
                        <Warehouse className="h-4 w-4" />
                        Depoda ({stats.inWarehouseProductCount})
                    </TabsTrigger>
                    <TabsTrigger value="COMPLETED" className="gap-1 text-xs">
                        <CheckCircle className="h-4 w-4" />
                        Bitti ({products.filter(p => p.status === "COMPLETED").length})
                    </TabsTrigger>
                    <TabsTrigger value="HAS_SHIPMENT" className="gap-1 text-xs">
                        <Truck className="h-4 w-4" />
                        Sevk ({stats.shippedProductCount})
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Sevk Edilen Ciro Özeti - Sadece Sevk sekmesinde ve Admin için */}
            {activeTab === "HAS_SHIPMENT" && userRole === "ADMIN" && (
                <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-teal-600 font-medium">Sevk Edilen Toplam Ciro</p>
                                <p className="text-3xl font-bold text-teal-700">
                                    {stats.shippedRevenue.toLocaleString('tr-TR')} ₺
                                </p>
                                <p className="text-sm text-teal-500">{stats.shippedCount} adet sevk edildi ({stats.shippedProductCount} üründen)</p>
                            </div>
                            <TrendingUp className="h-12 w-12 text-teal-400" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filtreler */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Ürün, model, kod veya firma ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Select value={filterCompany} onValueChange={(v) => setFilterCompany(v === "all" ? "" : v)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Firma Seç" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Firmalar</SelectItem>
                                {uniqueCompanies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterMaster} onValueChange={(v) => setFilterMaster(v === "all" ? "" : v)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Usta Seç" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Ustalar</SelectItem>
                                <SelectItem value="none">Usta Atanmamış</SelectItem>
                                {uniqueMasters.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <div className="relative">
                            <DateRangeFilter date={dateRange} setDate={setDateRange} />
                            {dateRange?.from && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute -right-2 -top-2 h-5 w-5 bg-slate-100 rounded-full border shadow-sm hover:bg-red-100 hover:text-red-600"
                                    onClick={() => setDateRange(undefined)}
                                >
                                    <span className="text-xs">✕</span>
                                </Button>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 border-green-300 text-green-700 hover:bg-green-50"
                            onClick={() => downloadExcel(
                                filteredProducts,
                                filterMaster && filterMaster !== 'none' ? filterMaster : undefined
                            )}
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Excel İndir
                        </Button>
                        {hasActiveFilters && (
                            <Button variant="outline" onClick={clearFilters}>
                                <X className="h-4 w-4 mr-1" /> Temizle
                            </Button>
                        )}
                    </div>
                    <div className="text-sm text-slate-500 mt-2">
                        {filteredProducts.length} sonuç bulundu
                    </div>
                </CardContent>
            </Card>

            {/* Excel İndirme Butonları */}
            <div className="flex items-center gap-3">
                <Button onClick={handleExportToExcel} variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Tümünü İndir
                </Button>
            </div>

            {/* Görünüm Modu Seçici */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="master" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Usta Bazlı
                    </TabsTrigger>
                    <TabsTrigger value="list" className="flex items-center gap-2">
                        <List className="h-4 w-4" />
                        Liste
                    </TabsTrigger>
                </TabsList>

                {/* Liste Görünümü */}
                <TabsContent value="list">
                    {/* Tablo */}
                    <div className="overflow-x-auto border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <SortHead label="Ürün" sortKey="name" />
                                    <SortHead label="Firma" sortKey="company" />
                                    <TableHead className="text-center">Durum</TableHead>
                                    <TableHead className="text-center">Toplam</TableHead>
                                    <TableHead className="text-center">Aşamalar</TableHead>
                                    <TableHead className="text-center">Depoda</TableHead>
                                    <TableHead className="text-center">Sevk</TableHead>
                                    <TableHead className="text-center">Kalan</TableHead>
                                    <SortHead label="Termin" sortKey="terminDate" />
                                    <SortHead label="İlerleme" sortKey="progress" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagination.paginatedItems.map(p => {
                                    const progress = getProgress(p);
                                    const isLate = new Date(p.terminDate) < new Date() && p.status !== "COMPLETED" && p.status !== "SHIPPED";
                                    const statusDisplay = getStatusDisplay(p);
                                    const remaining = getRemainingQty(p);
                                    const inWarehouse = getInWarehouse(p);
                                    const isEditing = editingProduct === p.id;

                                    return (
                                        <TableRow key={p.id} className={`hover:bg-slate-50 cursor-pointer ${isLate ? 'bg-red-50' : ''}`}>
                                            {/* Checkbox */}
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedProductIds.includes(p.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedProductIds([...selectedProductIds, p.id]);
                                                        } else {
                                                            setSelectedProductIds(selectedProductIds.filter(id => id !== p.id));
                                                        }
                                                    }}
                                                />
                                            </TableCell>
                                            {/* Ürün - Tıklanabilir */}
                                            <TableCell
                                                className="cursor-pointer hover:bg-blue-50"
                                                onClick={() => openProductDetail(p)}
                                            >
                                                <div>
                                                    <div className="font-semibold flex items-center gap-2 text-blue-600 hover:text-blue-800">
                                                        {p.name}
                                                        {isLate && <AlertTriangle className="h-4 w-4 text-red-500" />}
                                                    </div>
                                                    <div className="text-xs text-slate-500">{p.model}</div>
                                                    <div className="text-xs text-slate-400">{p.systemCode}</div>
                                                </div>
                                            </TableCell>

                                            {/* Firma */}
                                            <TableCell className="text-sm">{p.order?.company || '-'}</TableCell>

                                            {/* Durum */}
                                            <TableCell>
                                                <Badge className={`${statusDisplay.color} text-white gap-1`}>
                                                    <statusDisplay.icon className="h-3 w-3" />
                                                    {statusDisplay.label}
                                                </Badge>
                                            </TableCell>

                                            {/* Toplam Adet */}
                                            <TableCell className="text-center font-bold text-lg">{p.quantity}</TableCell>

                                            {/* Aşamalar */}
                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                {isEditing ? (
                                                    <div className="flex items-center gap-1 justify-center">
                                                        {STAGES.slice(0, 5).map(stage => (
                                                            <div key={stage.key} className="flex flex-col items-center">
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={p.quantity}
                                                                    value={editValues[stage.key]}
                                                                    onChange={(e) => handleStageChange(stage.key, parseInt(e.target.value) || 0, p)}
                                                                    className={`w-10 h-7 text-center text-xs ${stage.bg} ${stage.border}`}
                                                                />
                                                                <span className={`text-[9px] ${stage.color}`}>{stage.label.slice(0, 3)}</span>
                                                            </div>
                                                        ))}
                                                        <div className="flex gap-1 ml-1">
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); saveEdit(p); }} disabled={isPending}>
                                                                <Save className="h-3 w-3" />
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setEditingProduct(null); }}>
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (canEdit) startEdit(p);
                                                        }}
                                                        className={`${canEdit ? 'hover:ring-2 hover:ring-offset-1 cursor-pointer' : 'cursor-default'}`}
                                                    >
                                                        <StagesSummary p={p} />
                                                    </div>
                                                )}
                                            </TableCell>

                                            {/* Depoda */}
                                            <TableCell className="text-center">
                                                {(p.storedQty || 0) > 0 ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                        <Warehouse className="h-3 w-3 mr-1" />
                                                        {p.storedQty}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </TableCell>

                                            {/* Sevk Edilen */}
                                            <TableCell className="text-center">
                                                {(p.shippedQty || 0) > 0 ? (
                                                    <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                                                        <Truck className="h-3 w-3 mr-1" />
                                                        {p.shippedQty}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </TableCell>

                                            {/* Kalan */}
                                            <TableCell className="text-center">
                                                {remaining > 0 ? (
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                        {remaining}
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-green-500 text-white">Tamam</Badge>
                                                )}
                                            </TableCell>

                                            {/* Termin */}
                                            <TableCell>
                                                <span className={`text-sm ${isLate ? 'text-red-600 font-bold' : ''}`}>
                                                    {p.terminDate ? format(new Date(p.terminDate), "dd.MM.yyyy") : '-'}
                                                </span>
                                            </TableCell>

                                            {/* İlerleme */}
                                            <TableCell>
                                                <div className="w-20">
                                                    <div className="text-xs text-center mb-1 font-medium">{progress}%</div>
                                                    <Progress value={progress} className={`h-2 ${progress >= 100 ? '[&>div]:bg-green-500' : ''}`} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {pagination.paginatedItems.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                                            Ürün bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Sayfalama */}
                    {pagination.totalItems > 0 && (
                        <DataTablePagination
                            currentPage={pagination.currentPage}
                            totalPages={pagination.totalPages}
                            pageSize={pagination.pageSize}
                            totalItems={pagination.totalItems}
                            onPageChange={pagination.onPageChange}
                            onPageSizeChange={pagination.onPageSizeChange}
                        />
                    )}

                    {/* Detay Dialog */}
                    <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-xl flex items-center gap-2">
                                    {selectedProduct?.name}
                                    {selectedProduct && (
                                        <Badge className={`${getStatusDisplay(selectedProduct).color} text-white ml-2`}>
                                            {getStatusDisplay(selectedProduct).label}
                                        </Badge>
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {selectedProduct?.systemCode} | {selectedProduct?.model}
                                </DialogDescription>
                            </DialogHeader>

                            {selectedProduct && (
                                <div className="space-y-6">
                                    {/* Firma ve Usta Bilgisi - En Üstte */}
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-lg">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <p className="text-blue-600 text-xs font-medium">Firma</p>
                                                <p className="text-lg font-bold text-blue-900">{selectedProduct.order?.company || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-blue-600 text-xs font-medium">Sipariş</p>
                                                <p className="text-lg font-bold text-blue-900">{selectedProduct.order?.name || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-blue-600 text-xs font-medium">Usta</p>
                                                <p className="text-lg font-bold text-blue-900">{selectedProduct.master || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-blue-600 text-xs font-medium">Adet</p>
                                                <p className="text-lg font-bold text-blue-900">{selectedProduct.quantity}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ürün Özellikleri - Firma Altında */}
                                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 p-4 rounded-lg">
                                        <h4 className="font-semibold text-sm text-purple-800 mb-3">Ürün Özellikleri</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div className="bg-white p-2 rounded border">
                                                <p className="text-purple-600 text-xs font-medium">Kumaş</p>
                                                <p className="font-semibold">{selectedProduct.fabricType || '-'}</p>
                                            </div>
                                            <div className="bg-white p-2 rounded border">
                                                <p className="text-purple-600 text-xs font-medium">Malzeme</p>
                                                <p className="font-semibold">{selectedProduct.material || '-'}</p>
                                            </div>
                                            <div className="bg-white p-2 rounded border">
                                                <p className="text-purple-600 text-xs font-medium">Ayak Tipi</p>
                                                <p className="font-semibold">{selectedProduct.footType || '-'}</p>
                                            </div>
                                            <div className="bg-white p-2 rounded border">
                                                <p className="text-purple-600 text-xs font-medium">Ayak Rengi</p>
                                                <p className="font-semibold">{selectedProduct.footMaterial || '-'}</p>
                                            </div>
                                            {selectedProduct.armType && (
                                                <div className="bg-white p-2 rounded border">
                                                    <p className="text-purple-600 text-xs font-medium">Kol Tipi</p>
                                                    <p className="font-semibold">{selectedProduct.armType}</p>
                                                </div>
                                            )}
                                            {selectedProduct.backType && (
                                                <div className="bg-white p-2 rounded border">
                                                    <p className="text-purple-600 text-xs font-medium">Sırt Tipi</p>
                                                    <p className="font-semibold">{selectedProduct.backType}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Siparis Notlari - Özelliklerin Altında (Varsa) */}
                                    {(selectedProduct.aciklama1 || selectedProduct.aciklama2 || selectedProduct.aciklama3 || selectedProduct.aciklama4) && (
                                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                            <h4 className="font-semibold text-sm text-amber-800 mb-2">Sipariş Notları</h4>
                                            <div className="space-y-1 text-sm">
                                                {selectedProduct.aciklama1 && <p><span className="font-medium text-amber-700">1:</span> {selectedProduct.aciklama1}</p>}
                                                {selectedProduct.aciklama2 && <p><span className="font-medium text-amber-700">2:</span> {selectedProduct.aciklama2}</p>}
                                                {selectedProduct.aciklama3 && <p><span className="font-medium text-amber-700">3:</span> {selectedProduct.aciklama3}</p>}
                                                {selectedProduct.aciklama4 && <p><span className="font-medium text-amber-700">4:</span> {selectedProduct.aciklama4}</p>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Miktar Ozeti */}
                                    <div className="grid grid-cols-6 gap-2">
                                        <div className="bg-blue-50 p-3 rounded-lg text-center">
                                            <p className="text-blue-600 text-xs font-medium">Toplam</p>
                                            <p className="text-2xl font-bold text-blue-700">{selectedProduct.quantity}</p>
                                        </div>
                                        <div className="bg-purple-50 p-3 rounded-lg text-center">
                                            <p className="text-purple-600 text-xs font-medium">Sünger</p>
                                            <p className="text-2xl font-bold text-purple-700">{editValues.foam || 0}</p>
                                        </div>
                                        <div className="bg-yellow-50 p-3 rounded-lg text-center">
                                            <p className="text-yellow-600 text-xs font-medium">Üretimde</p>
                                            <p className="text-2xl font-bold text-yellow-700">
                                                {(editValues.upholstery || 0) + (editValues.assembly || 0)}
                                            </p>
                                        </div>
                                        <div className="bg-green-50 p-3 rounded-lg text-center">
                                            <p className="text-green-600 text-xs font-medium">Depoda</p>
                                            <p className="text-2xl font-bold text-green-700">{editValues.stored || 0}</p>
                                        </div>
                                        <div className="bg-teal-50 p-3 rounded-lg text-center">
                                            <p className="text-teal-600 text-xs font-medium">Sevk</p>
                                            <p className="text-2xl font-bold text-teal-700">{editValues.shipped || 0}</p>
                                        </div>
                                        <div className="bg-amber-50 p-3 rounded-lg text-center">
                                            <p className="text-amber-600 text-xs font-medium">Kalan</p>
                                            <p className="text-2xl font-bold text-amber-700">
                                                {selectedProduct.quantity - (editValues.shipped || 0)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Üretim Aşamaları - Düzenlenebilir */}
                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <Wrench className="h-4 w-4" />
                                                Üretim Aşamaları
                                                <span className="text-xs text-slate-500 ml-auto">
                                                    Toplam: {editValues.foam + editValues.upholstery + editValues.assembly + editValues.packaged + editValues.stored + editValues.shipped} / {selectedProduct.quantity}
                                                </span>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-6 gap-3">
                                                {STAGES.map(stage => {
                                                    const StageIcon = stage.icon;
                                                    const maxValue = selectedProduct.quantity;
                                                    const isShipped = stage.key === 'shipped';
                                                    const isStored = stage.key === 'stored';
                                                    // stored: sadece ADMIN düzenleyebilir
                                                    // shipped: kimse düzenleyemez (Depo sayfasından)
                                                    const isDisabled = !canEdit || isPending || isShipped || (isStored && userRole !== 'ADMIN');
                                                    return (
                                                        <div key={stage.key} className={`p-4 rounded-lg ${stage.bg} border ${stage.border} ${isShipped || (isStored && userRole !== 'ADMIN') ? 'opacity-75' : ''}`}>
                                                            <Label className={`text-sm flex items-center gap-2 mb-2 ${stage.color}`}>
                                                                <StageIcon className="h-5 w-5" />
                                                                {stage.label}
                                                                {isShipped && <span className="text-[10px] ml-auto">(Depo sayfasından)</span>}
                                                                {isStored && userRole !== 'ADMIN' && <span className="text-[10px] ml-auto">(Sadece Admin)</span>}
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={maxValue}
                                                                value={editValues[stage.key]}
                                                                disabled={isDisabled}
                                                                readOnly={isShipped || (isStored && userRole !== 'ADMIN')}
                                                                onChange={(e) => handleStageChange(stage.key, parseInt(e.target.value) || 0, selectedProduct)}
                                                                className={`h-12 text-2xl font-bold text-center ${isDisabled ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                                                            />
                                                            <p className="text-xs text-center mt-1 text-muted-foreground">/ {maxValue}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Görsel Progress */}
                                            <div className="space-y-2">
                                                <div className="flex gap-1 h-8 rounded-lg overflow-hidden bg-slate-100">
                                                    {STAGES.map(stage => {
                                                        const value = editValues[stage.key];
                                                        const width = (value / selectedProduct.quantity) * 100;
                                                        if (width === 0) return null;
                                                        return (
                                                            <div
                                                                key={stage.key}
                                                                className={`${stage.bg.replace('100', '500')} flex items-center justify-center text-white text-sm font-bold transition-all`}
                                                                style={{ width: `${width}%` }}
                                                            >
                                                                {value > 0 && value}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-500">
                                                    <span>Sünger</span>
                                                    <span>Döşeme</span>
                                                    <span>Montaj</span>
                                                    <span>Paket</span>
                                                    <span>Depo</span>
                                                    <span>Sevk</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Barkod Bilgisi */}
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="bg-slate-50 p-3 rounded">
                                            <p className="text-muted-foreground text-xs">Barkod</p>
                                            <p className="font-mono text-sm">{selectedProduct.barcode || '-'}</p>
                                        </div>
                                    </div>

                                    {/* Tarihler */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 p-3 rounded">
                                            <p className="text-muted-foreground text-xs">Sipariş Tarihi</p>
                                            <p className="font-semibold">
                                                {selectedProduct.orderDate ? format(new Date(selectedProduct.orderDate), "dd MMMM yyyy", { locale: tr }) : '-'}
                                            </p>
                                        </div>
                                        <div className={`p-3 rounded ${new Date(selectedProduct.terminDate) < new Date() && selectedProduct.status !== 'SHIPPED' ? 'bg-red-50' : 'bg-slate-50'}`}>
                                            <p className={`text-xs ${new Date(selectedProduct.terminDate) < new Date() && selectedProduct.status !== 'SHIPPED' ? 'text-red-600' : 'text-muted-foreground'}`}>
                                                Termin Tarihi
                                            </p>
                                            <p className={`font-semibold ${new Date(selectedProduct.terminDate) < new Date() && selectedProduct.status !== 'SHIPPED' ? 'text-red-600' : ''}`}>
                                                {selectedProduct.terminDate ? format(new Date(selectedProduct.terminDate), "dd MMMM yyyy", { locale: tr }) : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Fiyat Bilgisi */}
                                    {selectedProduct.unitPrice && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 p-3 rounded">
                                                <p className="text-muted-foreground text-xs">Birim Fiyat</p>
                                                <p className="font-semibold text-green-600">{selectedProduct.unitPrice?.toLocaleString('tr-TR')} ₺</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded">
                                                <p className="text-muted-foreground text-xs">Toplam Değer</p>
                                                <p className="font-semibold text-green-600">
                                                    {((selectedProduct.unitPrice || 0) * selectedProduct.quantity).toLocaleString('tr-TR')} ₺
                                                </p>
                                            </div>
                                        </div>
                                    )}


                                    {/* Muhendis Notu */}
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-sm flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4" /> Mühendis Notu
                                        </h4>
                                        <Textarea
                                            placeholder="Not ekle..."
                                            value={editNote}
                                            disabled={!canEdit || isPending}
                                            onChange={(e) => setEditNote(e.target.value)}
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            )}

                            <DialogFooter className="gap-2">
                                {canEdit && (
                                    <Button onClick={saveDialogEdit} disabled={isPending}>
                                        <Save className="h-4 w-4 mr-2" />
                                        Kaydet
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Kapat</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                {/* Usta Bazlı Görünüm */}
                <TabsContent value="master">
                    {Object.keys(groupedByMaster).length === 0 ? (
                        <div className="text-center py-12 text-slate-500 border rounded-lg">
                            <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                            <p className="text-lg font-medium">Ürün bulunamadı</p>
                        </div>
                    ) : (
                        <Accordion type="multiple" className="space-y-4">
                            {Object.entries(groupedByMaster).map(([master, masterProducts]) => {
                                const totalQuantity = masterProducts.reduce((sum: number, p: any) => sum + p.quantity, 0);
                                const completedQty = masterProducts.reduce((sum: number, p: any) => sum + (p.storedQty || 0) + (p.shippedQty || 0), 0);
                                const progress = totalQuantity > 0 ? Math.round((completedQty / totalQuantity) * 100) : 0;

                                return (
                                    <AccordionItem key={master} value={master} className="border-2 rounded-lg">
                                        <AccordionTrigger className="px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-t-lg hover:no-underline">
                                            <div className="flex items-center justify-between w-full pr-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 rounded-lg">
                                                        <Users className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-lg font-semibold">{master}</div>
                                                        <p className="text-sm text-slate-600">
                                                            {masterProducts.length} ürün • {totalQuantity} adet
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="text-sm font-medium text-slate-700">İlerleme</p>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={progress} className="w-24 h-2" />
                                                            <span className="text-sm font-semibold text-blue-600">%{progress}</span>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="bg-white">
                                                        {completedQty} / {totalQuantity}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4 pt-2">
                                            <div className="space-y-2">
                                                {masterProducts.map((product: any) => {
                                                    const StatusIcon = STATUS_CONFIG[product.status as keyof typeof STATUS_CONFIG]?.icon || Package;
                                                    const progress = getProgress(product);
                                                    const remaining = getRemainingQty(product);
                                                    const isOverdue = new Date(product.terminDate) < new Date() && product.status !== 'SHIPPED';

                                                    return (
                                                        <div
                                                            key={product.id}
                                                            className="grid grid-cols-12 gap-3 p-3 rounded-lg border bg-white hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedProduct(product);
                                                                setEditValues({
                                                                    foam: product.foamQty || 0,
                                                                    upholstery: product.upholsteryQty || 0,
                                                                    assembly: product.assemblyQty || 0,
                                                                    packaged: product.packagedQty || 0,
                                                                    stored: product.storedQty || 0,
                                                                    shipped: product.shippedQty || 0
                                                                });
                                                                setEditNote(product.engineerNote || '');
                                                                setIsDetailOpen(true);
                                                            }}
                                                        >
                                                            {/* Ürün Bilgileri */}
                                                            <div className="col-span-3">
                                                                <div className="font-semibold text-sm">{product.name}</div>
                                                                <div className="text-xs text-slate-500">{product.model}</div>
                                                                <div className="text-xs text-slate-400">{product.order?.company || '-'}</div>
                                                            </div>

                                                            {/* Miktar */}
                                                            <div className="col-span-1 flex items-center">
                                                                <Badge variant="secondary" className="font-semibold">
                                                                    {product.quantity} adet
                                                                </Badge>
                                                            </div>

                                                            {/* Üretim Aşamaları */}
                                                            <div className="col-span-4 flex items-center">
                                                                {renderStageProgress(product)}
                                                            </div>

                                                            {/* Durum */}
                                                            <div className="col-span-2 flex items-center gap-2">
                                                                <Badge className={STATUS_CONFIG[product.status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-500'}>
                                                                    {STATUS_CONFIG[product.status as keyof typeof STATUS_CONFIG]?.label || product.status}
                                                                </Badge>
                                                            </div>

                                                            {/* İlerleme */}
                                                            <div className="col-span-2 flex items-center gap-2">
                                                                <Progress value={progress} className="flex-1 h-2" />
                                                                <span className="text-xs font-semibold min-w-[35px]">%{progress}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    )}
                </TabsContent>
            </Tabs>

            {/* Dialog - Dışarıda kalacak */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    {selectedProduct && (
                        <div className="space-y-4">
                            <DialogHeader>
                                <DialogTitle className="text-2xl">{selectedProduct.name}</DialogTitle>
                                <DialogDescription>
                                    {selectedProduct.model} • {selectedProduct.systemCode}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Durum Kart */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    {(() => {
                                        const StatusIcon = STATUS_CONFIG[selectedProduct.status as keyof typeof STATUS_CONFIG]?.icon || Package;
                                        return <StatusIcon className="h-5 w-5" />;
                                    })()}
                                    <div>
                                        <p className="text-xs text-muted-foreground">Durum</p>
                                        <Badge className={STATUS_CONFIG[selectedProduct.status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-500'}>
                                            {STATUS_CONFIG[selectedProduct.status as keyof typeof STATUS_CONFIG]?.label || selectedProduct.status}
                                        </Badge>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">İlerleme</p>
                                    <div className="flex items-center gap-2">
                                        <Progress value={getProgress(selectedProduct)} className="w-24 h-2" />
                                        <span className="font-semibold">%{getProgress(selectedProduct)}</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Firma</p>
                                    <p className="font-semibold">{selectedProduct.order?.company || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Usta</p>
                                    <p className="font-semibold">{selectedProduct.master || '-'}</p>
                                </div>
                            </div>

                            {/* Dialog içeriği devamı - eski Dialog'dan kopyalandı */}
                            {/* Ürün Özellikleri */}
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 p-4 rounded-lg">
                                <h4 className="font-semibold text-sm text-purple-800 mb-3">Ürün Özellikleri</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-white p-2 rounded border">
                                        <p className="text-purple-600 text-xs font-medium">Kumaş</p>
                                        <p className="font-semibold">{selectedProduct.fabricType || '-'}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded border">
                                        <p className="text-purple-600 text-xs font-medium">Malzeme</p>
                                        <p className="font-semibold">{selectedProduct.material || '-'}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded border">
                                        <p className="text-purple-600 text-xs font-medium">Ayak Tipi</p>
                                        <p className="font-semibold">{selectedProduct.footType || '-'}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded border">
                                        <p className="text-purple-600 text-xs font-medium">Ayak Rengi</p>
                                        <p className="font-semibold">{selectedProduct.footMaterial || '-'}</p>
                                    </div>
                                    {selectedProduct.armType && (
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-purple-600 text-xs font-medium">Kol Tipi</p>
                                            <p className="font-semibold">{selectedProduct.armType}</p>
                                        </div>
                                    )}
                                    {selectedProduct.backType && (
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-purple-600 text-xs font-medium">Sırt Tipi</p>
                                            <p className="font-semibold">{selectedProduct.backType}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Siparis Notlari */}
                            {(selectedProduct.aciklama1 || selectedProduct.aciklama2 || selectedProduct.aciklama3 || selectedProduct.aciklama4) && (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                    <h4 className="font-semibold text-sm text-amber-800 mb-2">Sipariş Notları</h4>
                                    <div className="space-y-1 text-sm">
                                        {selectedProduct.aciklama1 && <p><span className="font-medium text-amber-700">1:</span> {selectedProduct.aciklama1}</p>}
                                        {selectedProduct.aciklama2 && <p><span className="font-medium text-amber-700">2:</span> {selectedProduct.aciklama2}</p>}
                                        {selectedProduct.aciklama3 && <p><span className="font-medium text-amber-700">3:</span> {selectedProduct.aciklama3}</p>}
                                        {selectedProduct.aciklama4 && <p><span className="font-medium text-amber-700">4:</span> {selectedProduct.aciklama4}</p>}
                                    </div>
                                </div>
                            )}

                            {/* Miktar Ozeti */}
                            <div className="grid grid-cols-6 gap-2">
                                <div className="bg-blue-50 p-3 rounded-lg text-center">
                                    <p className="text-blue-600 text-xs font-medium">Toplam</p>
                                    <p className="text-2xl font-bold text-blue-700">{selectedProduct.quantity}</p>
                                </div>
                                <div className="bg-purple-50 p-3 rounded-lg text-center">
                                    <p className="text-purple-600 text-xs font-medium">Sünger</p>
                                    <p className="text-2xl font-bold text-purple-700">{editValues.foam || 0}</p>
                                </div>
                                <div className="bg-yellow-50 p-3 rounded-lg text-center">
                                    <p className="text-yellow-600 text-xs font-medium">Üretimde</p>
                                    <p className="text-2xl font-bold text-yellow-700">
                                        {(editValues.upholstery || 0) + (editValues.assembly || 0)}
                                    </p>
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg text-center">
                                    <p className="text-green-600 text-xs font-medium">Depoda</p>
                                    <p className="text-2xl font-bold text-green-700">{editValues.stored || 0}</p>
                                </div>
                                <div className="bg-teal-50 p-3 rounded-lg text-center">
                                    <p className="text-teal-600 text-xs font-medium">Sevk</p>
                                    <p className="text-2xl font-bold text-teal-700">{editValues.shipped || 0}</p>
                                </div>
                                <div className="bg-amber-50 p-3 rounded-lg text-center">
                                    <p className="text-amber-600 text-xs font-medium">Kalan</p>
                                    <p className="text-2xl font-bold text-amber-700">
                                        {selectedProduct.quantity - (editValues.shipped || 0)}
                                    </p>
                                </div>
                            </div>

                            {/* Üretim Aşamaları - Düzenlenebilir */}
                            <Card>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Wrench className="h-4 w-4" />
                                        Üretim Aşamaları
                                        <span className="text-xs text-slate-500 ml-auto">
                                            Toplam: {editValues.foam + editValues.upholstery + editValues.assembly + editValues.packaged + editValues.stored + editValues.shipped} / {selectedProduct.quantity}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-6 gap-3">
                                        {STAGES.map(stage => {
                                            const StageIcon = stage.icon;
                                            const maxValue = selectedProduct.quantity;
                                            const isShipped = stage.key === 'shipped';
                                            const isStored = stage.key === 'stored';
                                            const isDisabled = !canEdit || isPending || isShipped || (isStored && userRole !== 'ADMIN');
                                            return (
                                                <div key={stage.key} className={`p-4 rounded-lg ${stage.bg} border ${stage.border} ${isShipped || (isStored && userRole !== 'ADMIN') ? 'opacity-75' : ''}`}>
                                                    <Label className={`text-sm flex items-center gap-2 mb-2 ${stage.color}`}>
                                                        <StageIcon className="h-5 w-5" />
                                                        {stage.label}
                                                        {isShipped && <span className="text-[10px] ml-auto">(Depo sayfasından)</span>}
                                                        {isStored && userRole !== 'ADMIN' && <span className="text-[10px] ml-auto">(Sadece Admin)</span>}
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={maxValue}
                                                        value={editValues[stage.key]}
                                                        disabled={isDisabled}
                                                        readOnly={isShipped || (isStored && userRole !== 'ADMIN')}
                                                        onChange={(e) => handleStageChange(stage.key, parseInt(e.target.value) || 0, selectedProduct)}
                                                        className={`h-12 text-2xl font-bold text-center ${isDisabled ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                                                    />
                                                    <p className="text-xs text-center mt-1 text-muted-foreground">/ {maxValue}</p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Görsel Progress */}
                                    <div className="space-y-2">
                                        <div className="flex gap-1 h-8 rounded-lg overflow-hidden bg-slate-100">
                                            {STAGES.map(stage => {
                                                const value = editValues[stage.key];
                                                const width = (value / selectedProduct.quantity) * 100;
                                                if (width === 0) return null;
                                                return (
                                                    <div
                                                        key={stage.key}
                                                        className={`${stage.bg.replace('100', '500')} flex items-center justify-center text-white text-sm font-bold transition-all`}
                                                        style={{ width: `${width}%` }}
                                                    >
                                                        {value > 0 && value}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>Sünger</span>
                                            <span>Döşeme</span>
                                            <span>Montaj</span>
                                            <span>Paket</span>
                                            <span>Depo</span>
                                            <span>Sevk</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Tarihler */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 p-3 rounded">
                                    <p className="text-muted-foreground text-xs">Sipariş Tarihi</p>
                                    <p className="font-semibold">
                                        {selectedProduct.orderDate ? format(new Date(selectedProduct.orderDate), "dd MMMM yyyy", { locale: tr }) : '-'}
                                    </p>
                                </div>
                                <div className={`p-3 rounded ${new Date(selectedProduct.terminDate) < new Date() && selectedProduct.status !== 'SHIPPED' ? 'bg-red-50' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${new Date(selectedProduct.terminDate) < new Date() && selectedProduct.status !== 'SHIPPED' ? 'text-red-600' : 'text-muted-foreground'}`}>
                                        Termin Tarihi
                                    </p>
                                    <p className={`font-semibold ${new Date(selectedProduct.terminDate) < new Date() && selectedProduct.status !== 'SHIPPED' ? 'text-red-600' : ''}`}>
                                        {selectedProduct.terminDate ? format(new Date(selectedProduct.terminDate), "dd MMMM yyyy", { locale: tr }) : '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Mühendis Notu */}
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" /> Mühendis Notu
                                </h4>
                                <Textarea
                                    placeholder="Not ekle..."
                                    value={editNote}
                                    disabled={!canEdit || isPending}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        {canEdit && (
                            <Button onClick={saveDialogEdit} disabled={isPending}>
                                <Save className="h-4 w-4 mr-2" />
                                Kaydet
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Kapat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Floating Action Bar - Seçili Ürünler */}
            {selectedProductIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 animate-in slide-in-from-bottom-4">
                    <span className="font-medium">{selectedProductIds.length} ürün seçili</span>
                    <div className="h-6 w-px bg-slate-600" />
                    <Button
                        onClick={handleExportSelected}
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Seçilenleri İndir
                    </Button>
                    <Button
                        onClick={() => setSelectedProductIds([])}
                        variant="ghost"
                        size="sm"
                        className="text-white hover:text-white hover:bg-slate-800"
                    >
                        <X className="h-4 w-4 mr-1" />
                        Seçimi Temizle
                    </Button>
                </div>
            )}
        </div>
    );
}
