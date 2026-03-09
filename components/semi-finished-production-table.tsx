"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Save, Plus, Download, FileEdit, Edit, ChevronDown, ChevronUp, ArrowUpDown, CheckCircle2, Clock, PackagePlus } from "lucide-react";
import { getSemiFinishedProductionByCategory, updateSemiFinishedProductionQty, updateSemiFinishedProductionTarget, removeSemiFinishedProduction, updateSemiFinishedSurplusQty } from "@/lib/actions/semi-finished-production-actions";
import { getMalFazlasiList, addMalFazlasi, deleteMalFazlasi, updateMalFazlasiQty } from "@/lib/actions/mal-fazlasi-actions";
import { toast } from "sonner";
import { ManualAddSemiFinishedDialog } from "./manual-add-semi-finished-dialog";
import { EditProductNotesDialog } from "./edit-product-notes-dialog";
import { SemiFinishedProductDetailDialog } from "./semi-finished-product-detail-dialog";
import { DateRangeFilter } from "./date-range-filter";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import { format } from "date-fns";

interface SemiFinishedProductionTableProps {
    category: string;
    userRole: string;
}

interface SemiFinishedProductionItem {
    id: number;
    productId: number;
    category: string;
    targetQty: number;
    producedQty: number;
    surplusQty: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    product: {
        id: number;
        name: string;
        model: string;
        description: string | null;
        dstAdi: string | null;
        master: string | null;
        terminDate: Date | null;
        aciklama1: string | null;
        aciklama2: string | null;
        aciklama3: string | null;
        aciklama4: string | null;
        order: {
            name: string;
            company: string;
        } | null;
    };
}

export function SemiFinishedProductionTable({ category, userRole }: SemiFinishedProductionTableProps) {
    const [items, setItems] = useState<SemiFinishedProductionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [editingTargetId, setEditingTargetId] = useState<number | null>(null);
    const [editTargetValue, setEditTargetValue] = useState("");
    const [editingSurplusId, setEditingSurplusId] = useState<number | null>(null);
    const [editSurplusValue, setEditSurplusValue] = useState("");

    // Mal Fazlası state'leri
    const [malFazlasiList, setMalFazlasiList] = useState<{
        id: number; productName: string; model: string | null; company: string | null;
        quantity: number; description: string | null; master: string | null; createdAt: Date;
    }[]>([]);
    const [malFazlasiForm, setMalFazlasiForm] = useState({
        productName: "", model: "", company: "", quantity: "", description: "", master: ""
    });
    const [malFazlasiLoading, setMalFazlasiLoading] = useState(false);
    const [editingMalFazlasiId, setEditingMalFazlasiId] = useState<number | null>(null);
    const [malFazlasiDusValue, setMalFazlasiDusValue] = useState("");
    const [isManualAddOpen, setIsManualAddOpen] = useState(false);
    const [editNotesDialog, setEditNotesDialog] = useState<{
        open: boolean;
        productId: number;
        productName: string;
        notes: {
            description: string | null;
            aciklama1: string | null;
            aciklama2: string | null;
            aciklama3: string | null;
            aciklama4: string | null;
        };
    } | null>(null);
    const [selectedItem, setSelectedItem] = useState<SemiFinishedProductionItem | null>(null);

    // Filtreleme state'leri
    const [filterProductName, setFilterProductName] = useState("");
    const [filterOrder, setFilterOrder] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("ALL");
    const [filterDst, setFilterDst] = useState("");
    const [filterMaster, setFilterMaster] = useState(""); // Usta filtresi
    const [dateRange, setDateRange] = useState<DateRange | undefined>(); // İşlem Tarihi Filtresi
    const [groupByMaster, setGroupByMaster] = useState(true);
    const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());
    const [terminSort, setTerminSort] = useState<"asc" | "desc" | null>(category === "KONFEKSIYON" ? "desc" : null);

    const loadData = async () => {
        setLoading(true);
        const data = await getSemiFinishedProductionByCategory(category);
        setItems(data as any);
        setLoading(false);
    };

    const loadMalFazlasi = async () => {
        const data = await getMalFazlasiList(category);
        setMalFazlasiList(data as any);
    };

    const toggleMasterExpand = (master: string) => {
        setExpandedMasters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(master)) {
                newSet.delete(master);
            } else {
                newSet.add(master);
            }
            return newSet;
        });
    };

    const toggleAllMasters = (expand: boolean) => {
        if (!groupedByMaster) return;
        if (expand) {
            setExpandedMasters(new Set(Object.keys(groupedByMaster)));
        } else {
            setExpandedMasters(new Set());
        }
    };

    useEffect(() => {
        loadData();
        loadMalFazlasi();
    }, [category]);

    const handleEdit = (id: number, currentQty: number) => {
        setEditingId(id);
        setEditValue(currentQty.toString());
    };

    const handleEditTarget = (id: number, currentTarget: number) => {
        setEditingTargetId(id);
        setEditTargetValue(currentTarget.toString());
    };

    const handleSave = async (id: number) => {
        const item = items.find(i => i.id === id);
        const qty = parseInt(editValue);

        if (isNaN(qty) || qty < 0) {
            toast.error("Geçersiz miktar");
            return;
        }

        if (item && qty > item.targetQty) {
            toast.error(`Hedef miktardan (${item.targetQty}) fazla girilemez`);
            return;
        }

        const result = await updateSemiFinishedProductionQty(id, qty, item ? new Date(item.updatedAt) : undefined);
        if (result.success) {
            toast.success("Miktar güncellendi");
            setEditingId(null);
            loadData();
        } else {
            if (result.error === "DATA_MODIFIED") {
                toast.error(result.message || "Veri değişmişti, tablo yenilendi.");
                setEditingId(null);
                loadData();
            } else {
                toast.error(result.error || "Hata oluştu");
            }
        }
    };

    const handleSaveTarget = async (id: number) => {
        const item = items.find(i => i.id === id);
        const targetQty = parseInt(editTargetValue);

        if (isNaN(targetQty) || targetQty < 0) {
            toast.error("Geçersiz hedef miktar");
            return;
        }

        if (item && targetQty < item.producedQty) {
            toast.error(`Hedef miktar, üretilen miktardan (${item.producedQty}) az olamaz`);
            return;
        }

        const result = await updateSemiFinishedProductionTarget(id, targetQty, item ? new Date(item.updatedAt) : undefined);
        if (result.success) {
            toast.success("Hedef miktar güncellendi");
            setEditingTargetId(null);
            loadData();
        } else {
            if (result.error === "DATA_MODIFIED") {
                toast.error(result.message || "Veri değişmişti, tablo yenilendi.");
                setEditingTargetId(null);
                loadData();
            } else {
                toast.error(result.error || "Hata oluştu");
            }
        }
    };

    const handleSaveSurplus = async (id: number) => {
        const qty = parseInt(editSurplusValue);
        if (isNaN(qty) || qty < 0) {
            toast.error("Geçersiz miktar");
            return;
        }
        const result = await updateSemiFinishedSurplusQty(id, qty);
        if (result.success) {
            toast.success("Mal fazlası güncellendi");
            setEditingSurplusId(null);
            loadData();
        } else {
            toast.error(result.error || "Hata oluştu");
        }
    };

    const handleMalFazlasiAdd = async () => {
        if (!malFazlasiForm.productName.trim()) {
            toast.error("Ürün adı zorunludur");
            return;
        }
        const qty = parseInt(malFazlasiForm.quantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Geçerli bir adet girin");
            return;
        }
        setMalFazlasiLoading(true);
        const result = await addMalFazlasi({
            productName: malFazlasiForm.productName,
            model: malFazlasiForm.model || undefined,
            company: malFazlasiForm.company || undefined,
            quantity: qty,
            description: malFazlasiForm.description || undefined,
            master: malFazlasiForm.master || undefined,
            category,
        });
        setMalFazlasiLoading(false);
        if (result.success) {
            toast.success("Mal fazlası eklendi");
            setMalFazlasiForm({ productName: "", model: "", company: "", quantity: "", description: "", master: "" });
            loadMalFazlasi();
        } else {
            toast.error(result.error || "Hata oluştu");
        }
    };

    const handleMalFazlasiDelete = async (id: number) => {
        if (!confirm("Bu kaydı silmek istediğinizden emin misiniz?")) return;
        const result = await deleteMalFazlasi(id);
        if (result.success) {
            toast.success("Kayıt silindi");
            loadMalFazlasi();
        } else {
            toast.error(result.error || "Hata oluştu");
        }
    };

    const handleMalFazlasiDus = async (id: number, currentQty: number) => {
        const dus = parseInt(malFazlasiDusValue);
        if (isNaN(dus) || dus <= 0) {
            toast.error("Geçerli bir adet girin");
            return;
        }
        if (dus > currentQty) {
            toast.error(`En fazla ${currentQty} adet düşebilirsiniz`);
            return;
        }
        const newQty = currentQty - dus;
        const result = await updateMalFazlasiQty(id, newQty);
        if (result.success) {
            toast.success(newQty === 0 ? "Kayıt silindi (stok bitti)" : `${dus} adet düşüldü, kalan: ${newQty}`);
            setEditingMalFazlasiId(null);
            setMalFazlasiDusValue("");
            loadMalFazlasi();
        } else {
            toast.error(result.error || "Hata oluştu");
        }
    };

    const handleRemove = async (id: number) => {
        if (!confirm("Bu kaydı silmek istediğinizden emin misiniz?")) return;

        const result = await removeSemiFinishedProduction(id);
        if (result.success) {
            toast.success("Kayıt silindi");
            loadData();
        } else {
            toast.error(result.error || "Hata oluştu");
        }
    };

    const getProgressColor = (produced: number, target: number) => {
        const percentage = (produced / target) * 100;
        if (percentage === 0) return "bg-slate-200";
        if (percentage < 50) return "bg-red-100 border-red-300";
        if (percentage < 100) return "bg-yellow-100 border-yellow-300";
        return "bg-green-100 border-green-300";
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "COMPLETED":
                return <Badge className="bg-green-600">Tamamlandı</Badge>;
            case "IN_PROGRESS":
                return <Badge className="bg-blue-600">Devam Ediyor</Badge>;
            default:
                return <Badge variant="secondary">Bekliyor</Badge>;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "COMPLETED":
                return "Tamamlandı";
            case "IN_PROGRESS":
                return "Devam Ediyor";
            default:
                return "Bekliyor";
        }
    };

    const categoryNames: Record<string, string> = {
        METAL: "Metal",
        KONFEKSIYON: "Konfeksiyon",
        AHSAP_BOYA: "Ahşap Boya",
        AHSAP_ISKELET: "Ahşap İskelet",
        PLASTIK: "Plastik",
        SUNGER_DOKUM: "Sünger Döküm",
    };

    const handleExportToExcel = () => {
        if (sortedItems.length === 0) {
            toast.error("Dışa aktarılacak veri yok");
            return;
        }

        const exportData = sortedItems.map(item => ({
            'Firma': item.product.order?.company || '-',
            'Ürün': item.product.name,
            'Termin': item.product.terminDate ? format(new Date(item.product.terminDate), 'dd.MM.yyyy') : '-',
            'Usta': item.product.master || '-',
            'DST': item.product.dstAdi || '-',
            'Hedef': item.targetQty,
            'Durum': getStatusText(item.status),
            'Açıklama': item.product.description || '-',
            'Açıklama1': item.product.aciklama1 || '-',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);

        ws['!cols'] = [
            { wch: 20 }, // Firma
            { wch: 25 }, // Ürün
            { wch: 14 }, // Termin
            { wch: 15 }, // Usta
            { wch: 15 }, // DST
            { wch: 10 }, // Hedef
            { wch: 15 }, // Durum
            { wch: 30 }, // Açıklama
            { wch: 30 }, // Açıklama1
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, categoryNames[category] || category);

        const fileName = `Yari_Mamul_${categoryNames[category]}_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast.success(`${sortedItems.length} kayıt Excel'e aktarıldı`);
    };

    if (loading) {
        return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
    }

    // Tablo hücrelerini render eden yardımcı fonksiyon
    const renderTableCells = (item: SemiFinishedProductionItem, isEditing: boolean, isEditingTarget: boolean, progressPercentage: number) => {
        const isEditingSurplus = editingSurplusId === item.id;
        return (
            <>
                <TableCell className="text-center font-semibold" onClick={(e) => e.stopPropagation()}>
                    {isEditingTarget && ["ADMIN", "PLANNER"].includes(userRole) ? (
                        <div className="flex items-center justify-center gap-2">
                            <Input
                                type="number"
                                value={editTargetValue}
                                onChange={(e) => setEditTargetValue(e.target.value)}
                                className="w-20 text-center"
                                min={item.producedQty}
                                autoFocus
                            />
                            <Button
                                size="sm"
                                onClick={() => handleSaveTarget(item.id)}
                                className="bg-green-600 hover:bg-green-700 h-8"
                            >
                                <Save className="h-3 w-3" />
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingTargetId(null)}
                                className="h-8"
                            >
                                ✕
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-1">
                            <span>{item.targetQty}</span>
                            {userRole === "ADMIN" && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditTarget(item.id, item.targetQty)}
                                    className="h-6 w-6 p-0"
                                    title="Hedef adeti düzenle"
                                >
                                    <Edit className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    )}
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                        <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-20 text-center"
                            min={0}
                            max={item.targetQty}
                            autoFocus
                        />
                    ) : (
                        <span
                            className="cursor-pointer hover:text-blue-600 font-semibold"
                            onClick={() => handleEdit(item.id, item.producedQty)}
                        >
                            {item.producedQty}
                        </span>
                    )}
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <span className="text-sm font-medium w-12">
                            {progressPercentage.toFixed(0)}%
                        </span>
                    </div>
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                {/* Mal Fazlası */}
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    {isEditingSurplus ? (
                        <div className="flex items-center justify-center gap-1">
                            <Input
                                type="number"
                                value={editSurplusValue}
                                onChange={(e) => setEditSurplusValue(e.target.value)}
                                className="w-20 text-center h-8"
                                min={0}
                                autoFocus
                            />
                            <Button
                                size="sm"
                                onClick={() => handleSaveSurplus(item.id)}
                                className="bg-green-600 hover:bg-green-700 h-8 w-8 p-0"
                            >
                                <Save className="h-3 w-3" />
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingSurplusId(null)}
                                className="h-8 w-8 p-0"
                            >
                                ✕
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-1">
                            <span className={`font-semibold ${item.surplusQty > 0 ? "text-orange-600" : "text-slate-400"}`}>
                                {item.surplusQty > 0 ? item.surplusQty : "-"}
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setEditingSurplusId(item.id);
                                    setEditSurplusValue(item.surplusQty.toString());
                                }}
                                className="h-6 w-6 p-0"
                                title="Mal fazlası gir"
                            >
                                <Edit className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </TableCell>
                <TableCell>
                    <div className="max-w-xs">
                        {/* Metal, Ahşap Boya ve Ahşap İskelet kategorilerinde NetSim açıklamalarını göster */}
                        {["METAL", "AHSAP_BOYA", "AHSAP_ISKELET"].includes(category) ? (
                            <div className="space-y-1">
                                {item.product.aciklama1 && (
                                    <p className="text-xs text-slate-700 truncate" title={item.product.aciklama1}>
                                        <span className="font-semibold">A1:</span> {item.product.aciklama1}
                                    </p>
                                )}
                                {item.product.aciklama2 && (
                                    <p className="text-xs text-slate-700 truncate" title={item.product.aciklama2}>
                                        <span className="font-semibold">A2:</span> {item.product.aciklama2}
                                    </p>
                                )}
                                {item.product.aciklama3 && (
                                    <p className="text-xs text-slate-700 truncate" title={item.product.aciklama3}>
                                        <span className="font-semibold">A3:</span> {item.product.aciklama3}
                                    </p>
                                )}
                                {item.product.aciklama4 && (
                                    <p className="text-xs text-slate-700 truncate" title={item.product.aciklama4}>
                                        <span className="font-semibold">A4:</span> {item.product.aciklama4}
                                    </p>
                                )}
                                {!item.product.aciklama1 && !item.product.aciklama2 && !item.product.aciklama3 && !item.product.aciklama4 && "-"}
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-slate-600 truncate" title={item.product.description || "-"}>
                                    {item.product.description || "-"}
                                </p>
                                {/* NetSim Açıklamaları - Konfeksiyon için sadece sayı */}
                                {(item.product.aciklama1 || item.product.aciklama2 || item.product.aciklama3 || item.product.aciklama4) && (
                                    <div className="mt-1 text-xs text-amber-600">
                                        {[item.product.aciklama1, item.product.aciklama2, item.product.aciklama3, item.product.aciklama4]
                                            .filter(Boolean)
                                            .length} not
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                            <>
                                <Button
                                    size="sm"
                                    onClick={() => handleSave(item.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <Save className="h-4 w-4 mr-1" />
                                    Kaydet
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingId(null)}
                                >
                                    İptal
                                </Button>
                            </>
                        ) : (
                            <>
                                {userRole !== "WORKER" && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEdit(item.id, item.producedQty)}
                                    >
                                        Düzenle
                                    </Button>
                                )}
                                {["ADMIN", "PLANNER"].includes(userRole) && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditNotesDialog({
                                                open: true,
                                                productId: item.product.id,
                                                productName: item.product.name,
                                                notes: {
                                                    description: item.product.description,
                                                    aciklama1: item.product.aciklama1,
                                                    aciklama2: item.product.aciklama2,
                                                    aciklama3: item.product.aciklama3,
                                                    aciklama4: item.product.aciklama4,
                                                }
                                            })}
                                            title="Açıklamaları düzenle"
                                        >
                                            <FileEdit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleRemove(item.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </TableCell>
            </>
        );
    };

    // Filtreleme mantığı
    const filteredItems = items.filter(item => {
        // Ürün adı filtresi
        if (filterProductName && !item.product.name.toLowerCase().includes(filterProductName.toLowerCase())) {
            return false;
        }

        // Firma filtresi
        if (filterOrder && !item.product.order?.company?.toLowerCase().includes(filterOrder.toLowerCase())) {
            return false;
        }

        // Durum filtresi
        if (filterStatus !== "ALL" && item.status !== filterStatus) {
            return false;
        }

        // DST filtresi
        if (filterDst && !item.product.dstAdi?.toLowerCase().includes(filterDst.toLowerCase())) {
            return false;
        }

        // Usta filtresi (sadece konfeksiyon için)
        if (filterMaster && !item.product.master?.toLowerCase().includes(filterMaster.toLowerCase())) {
            return false;
        }

        // Tarih filtresi (işlem tarihi: updatedAt / createdAt)
        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);
            const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
            to.setHours(23, 59, 59, 999);
            const itemDate = new Date(item.updatedAt);
            if (itemDate < from || itemDate > to) {
                return false;
            }
        }

        return true;
    });

    // Termin tarihine göre sırala
    const sortedItems = terminSort
        ? [...filteredItems].sort((a, b) => {
            const aDate = a.product.terminDate ? new Date(a.product.terminDate).getTime() : 0;
            const bDate = b.product.terminDate ? new Date(b.product.terminDate).getTime() : 0;
            return terminSort === "asc" ? aDate - bDate : bDate - aDate;
        })
        : filteredItems;

    // Aktif ve tamamlananları ayır
    const activeItems = sortedItems.filter(item => item.status !== "COMPLETED");
    const completedItems = sortedItems.filter(item => item.status === "COMPLETED");

    const toggleTerminSort = () => {
        setTerminSort(prev => prev === "asc" ? "desc" : "asc");
    };

    // Konfeksiyon ve Ahşap İskelet için usta bazlı gruplandırma (sadece aktif ürünler)
    const groupedByMaster = ["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && groupByMaster
        ? activeItems.reduce((acc, item) => {
            const master = item.product.master || "Atanmamış";
            if (!acc[master]) {
                acc[master] = [];
            }
            acc[master].push(item);
            return acc;
        }, {} as Record<string, SemiFinishedProductionItem[]>)
        : null;

    return (
        <div className="space-y-4">
            {/* Filtreleme Bölümü */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 bg-slate-50 rounded-lg border">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Ürün Adı</label>
                    <Input
                        placeholder="Ürün ara..."
                        value={filterProductName}
                        onChange={(e) => setFilterProductName(e.target.value)}
                        className="h-9"
                    />
                </div>
                {/* Firma filtresi */}
                {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && (
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Firma</label>
                        <Input
                            placeholder="Firma ara..."
                            value={filterOrder}
                            onChange={(e) => setFilterOrder(e.target.value)}
                            className="h-9"
                        />
                    </div>
                )}
                {/* Renk/Usta filtresi */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Usta</label>
                    <Input
                        placeholder="Usta ara..."
                        value={filterMaster}
                        onChange={(e) => setFilterMaster(e.target.value)}
                        className="h-9"
                    />
                </div>
                {category !== "METAL" && (
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">DST</label>
                        <Input
                            placeholder="DST ara..."
                            value={filterDst}
                            onChange={(e) => setFilterDst(e.target.value)}
                            className="h-9"
                        />
                    </div>
                )}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Durum</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                        <option value="ALL">Tümü</option>
                        <option value="PENDING">Bekliyor</option>
                        <option value="IN_PROGRESS">Devam Ediyor</option>
                        <option value="COMPLETED">Tamamlandı</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">İşlem Tarihi</label>
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

            {/* Butonlar */}
            <div className="flex justify-between items-center gap-2">
                {/* Usta bazlı gruplandırma toggle */}
                {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && (
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={groupByMaster}
                                onChange={(e) => setGroupByMaster(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300"
                            />
                            <span className="text-sm font-medium text-slate-700">Usta Bazlı Grupla</span>
                        </label>
                        {groupByMaster && groupedByMaster && (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleAllMasters(true)}
                                    className="h-8 text-xs"
                                >
                                    Tümünü Aç
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleAllMasters(false)}
                                    className="h-8 text-xs"
                                >
                                    Tümünü Kapat
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex gap-2 ml-auto">
                    {/* Excel indirme - sadece admin ve genel roller için */}
                    {!["METAL", "AHSAP_BOYA", "AHSAP_ISKELET"].includes(userRole) && (
                        <Button
                            onClick={handleExportToExcel}
                            variant="outline"
                            className="gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Excel İndir
                        </Button>
                    )}
                    {/* Sadece genel roller manuel ürün ekleyebilsin */}
                    {!["METAL", "KONFEKSIYON", "AHSAP_BOYA", "AHSAP_ISKELET"].includes(userRole) && (
                        <Button
                            onClick={() => setIsManualAddOpen(true)}
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Manuel Ürün Ekle
                        </Button>
                    )}
                </div>
            </div>

            {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    {items.length === 0 ? (
                        <>
                            <p className="text-lg">Bu kategoride henüz ürün yok</p>
                            <p className="text-sm mt-2">Üretim planlama sayfasından ürün gönderin veya manuel ekleyin</p>
                        </>
                    ) : (
                        <p className="text-lg">Filtreye uygun ürün bulunamadı</p>
                    )}
                </div>
            ) : (
                <Tabs defaultValue="active">
                    <TabsList className="mb-4">
                        <TabsTrigger value="active" className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Devam Eden
                            <span className="ml-1 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {activeItems.length}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="completed" className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Tamamlananlar
                            <span className="ml-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {completedItems.length}
                            </span>
                        </TabsTrigger>
                        {/* Mal Fazlası Tab */}
                        <TabsTrigger value="mal-fazlasi" className="flex items-center gap-2">
                            <PackagePlus className="h-4 w-4" />
                            Mal Fazlası
                            <span className="ml-1 bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {malFazlasiList.length}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Devam Eden Tab */}
                    <TabsContent value="active">
                        {activeItems.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <p className="text-lg">Devam eden ürün yok</p>
                            </div>
                        ) : groupedByMaster ? (
                            // Usta bazlı gruplandırılmış görünüm (sadece konfeksiyon için)
                            <div className="space-y-6">
                                {Object.entries(groupedByMaster).map(([master, masterItems]) => {
                                    const totalTarget = masterItems.reduce((sum, item) => sum + item.targetQty, 0);
                                    const totalProduced = masterItems.reduce((sum, item) => sum + item.producedQty, 0);
                                    const overallProgress = totalTarget > 0 ? (totalProduced / totalTarget) * 100 : 0;
                                    const isExpanded = expandedMasters.has(master);

                                    return (
                                        <div key={master} className="border rounded-lg overflow-hidden">
                                            {/* Usta Başlığı - Tıklanabilir */}
                                            <div
                                                className="bg-gradient-to-r from-blue-50 to-slate-50 p-4 border-b cursor-pointer hover:from-blue-100 hover:to-slate-100 transition-colors"
                                                onClick={() => toggleMasterExpand(master)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {/* Açılır/Kapanır İkon */}
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700">
                                                            {isExpanded ? (
                                                                <ChevronUp className="h-5 w-5" />
                                                            ) : (
                                                                <ChevronDown className="h-5 w-5" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-blue-900">{master}</h3>
                                                            <p className="text-sm text-slate-600 mt-1">
                                                                {masterItems.length} ürün • Toplam Hedef: {totalTarget} • Üretilen: {totalProduced}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-32 bg-slate-200 rounded-full h-3">
                                                            <div
                                                                className="bg-blue-600 h-3 rounded-full transition-all"
                                                                style={{ width: `${Math.min(100, overallProgress)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-lg font-bold text-blue-700 w-16 text-right">
                                                            {overallProgress.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Usta İçindeki Ürünler - Sadece açıksa göster */}
                                            {isExpanded && (
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Ürün</TableHead>
                                                            <TableHead>Model</TableHead>
                                                            <TableHead>Firma</TableHead>
                                                            <TableHead
                                                                className="cursor-pointer select-none hover:bg-slate-100"
                                                                onClick={toggleTerminSort}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    Termin
                                                                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                                                    {terminSort && (
                                                                        <span className="text-xs text-blue-600">
                                                                            {terminSort === "desc" ? "↓" : "↑"}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </TableHead>
                                                            {!["METAL", "AHSAP_ISKELET"].includes(category) && <TableHead>DST</TableHead>}
                                                            <TableHead className="text-center">Hedef</TableHead>
                                                            <TableHead className="text-center">Üretilen</TableHead>
                                                            <TableHead className="text-center">İlerleme</TableHead>
                                                            <TableHead>Durum</TableHead>
                                                            <TableHead className="text-center">Mal Fazlası</TableHead>
                                                            <TableHead>Açıklama</TableHead>
                                                            <TableHead className="text-right">İşlem</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {masterItems.map((item) => {
                                                            const isEditing = editingId === item.id;
                                                            const isEditingTarget = editingTargetId === item.id;
                                                            const progressPercentage = Math.min(100, (item.producedQty / item.targetQty) * 100);

                                                            return (
                                                                <TableRow
                                                                    key={item.id}
                                                                    className={`cursor-pointer hover:bg-slate-100 transition-colors ${getProgressColor(item.producedQty, item.targetQty)}`}
                                                                    onClick={() => setSelectedItem(item)}
                                                                >
                                                                    <TableCell className="font-medium">{item.product.name}</TableCell>
                                                                    <TableCell>{item.product.model}</TableCell>
                                                                    <TableCell>
                                                                        {item.product.order?.company || "-"}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {item.product.terminDate ? format(new Date(item.product.terminDate), 'dd.MM.yyyy') : "-"}
                                                                    </TableCell>
                                                                    {!["METAL", "AHSAP_ISKELET"].includes(category) && (
                                                                        <TableCell>
                                                                            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                                                                                {item.product.dstAdi || "-"}
                                                                            </span>
                                                                        </TableCell>
                                                                    )}
                                                                    {renderTableCells(item, isEditing, isEditingTarget, progressPercentage)}
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            // Normal tablo görünümü
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ürün</TableHead>
                                        <TableHead>Model</TableHead>
                                        {/* Firma ve Termin kolonları */}
                                        {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && <TableHead>Firma</TableHead>}
                                        {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && (
                                            <TableHead
                                                className="cursor-pointer select-none hover:bg-slate-100"
                                                onClick={toggleTerminSort}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Termin
                                                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                                    {terminSort && (
                                                        <span className="text-xs text-blue-600">
                                                            {terminSort === "desc" ? "↓" : "↑"}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableHead>
                                        )}
                                        {/* Renk/Usta kolonu */}
                                        <TableHead>Usta</TableHead>
                                        {!["METAL", "AHSAP_ISKELET"].includes(category) && <TableHead>DST</TableHead>}
                                        <TableHead className="text-center">Hedef</TableHead>
                                        <TableHead className="text-center">Üretilen</TableHead>
                                        <TableHead className="text-center">İlerleme</TableHead>
                                        <TableHead>Durum</TableHead>
                                        <TableHead className="text-center">Mal Fazlası</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead className="text-right">İşlem</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activeItems.map((item) => {
                                        const isEditing = editingId === item.id;
                                        const isEditingTarget = editingTargetId === item.id;
                                        const progressPercentage = Math.min(100, (item.producedQty / item.targetQty) * 100);

                                        return (
                                            <TableRow
                                                key={item.id}
                                                className={`cursor-pointer hover:bg-slate-100 transition-colors ${getProgressColor(item.producedQty, item.targetQty)}`}
                                                onClick={() => setSelectedItem(item)}
                                            >
                                                <TableCell className="font-medium">{item.product.name}</TableCell>
                                                <TableCell>{item.product.model}</TableCell>
                                                {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && (
                                                    <TableCell>
                                                        {item.product.order?.company || "-"}
                                                    </TableCell>
                                                )}
                                                {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && (
                                                    <TableCell>
                                                        {item.product.terminDate ? format(new Date(item.product.terminDate), 'dd.MM.yyyy') : "-"}
                                                    </TableCell>
                                                )}
                                                {/* Renk/Usta kolonu */}
                                                <TableCell>
                                                    <span className="text-sm font-medium text-blue-700">
                                                        {item.product.master || "-"}
                                                    </span>
                                                </TableCell>
                                                {!["METAL", "AHSAP_ISKELET"].includes(category) && (
                                                    <TableCell>
                                                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                                                            {item.product.dstAdi || "-"}
                                                        </span>
                                                    </TableCell>
                                                )}
                                                {renderTableCells(item, isEditing, isEditingTarget, progressPercentage)}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </TabsContent>

                    {/* Tamamlananlar Tab */}
                    <TabsContent value="completed">
                        {completedItems.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <p className="text-lg">Tamamlanan ürün yok</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ürün</TableHead>
                                        <TableHead>Model</TableHead>
                                        {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && <TableHead>Firma</TableHead>}
                                        {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && <TableHead>Termin</TableHead>}
                                        <TableHead>Usta</TableHead>
                                        {!["METAL", "AHSAP_ISKELET"].includes(category) && <TableHead>DST</TableHead>}
                                        <TableHead className="text-center">Hedef</TableHead>
                                        <TableHead className="text-center">Üretilen</TableHead>
                                        <TableHead className="text-center">İlerleme</TableHead>
                                        <TableHead>Durum</TableHead>
                                        <TableHead>Tamamlandı</TableHead>
                                        <TableHead className="text-center">Mal Fazlası</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead className="text-right">İşlem</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completedItems.map((item) => {
                                        const isEditing = editingId === item.id;
                                        const isEditingTarget = editingTargetId === item.id;
                                        const isEditingSurplus = editingSurplusId === item.id;
                                        const progressPercentage = Math.min(100, (item.producedQty / item.targetQty) * 100);

                                        return (
                                            <TableRow
                                                key={item.id}
                                                className={`cursor-pointer hover:bg-slate-100 transition-colors ${getProgressColor(item.producedQty, item.targetQty)}`}
                                                onClick={() => setSelectedItem(item)}
                                            >
                                                <TableCell className="font-medium">{item.product.name}</TableCell>
                                                <TableCell>{item.product.model}</TableCell>
                                                {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && (
                                                    <TableCell>{item.product.order?.company || "-"}</TableCell>
                                                )}
                                                {["KONFEKSIYON", "AHSAP_ISKELET"].includes(category) && (
                                                    <TableCell>
                                                        {item.product.terminDate ? format(new Date(item.product.terminDate), 'dd.MM.yyyy') : "-"}
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <span className="text-sm font-medium text-blue-700">
                                                        {item.product.master || "-"}
                                                    </span>
                                                </TableCell>
                                                {!["METAL", "AHSAP_ISKELET"].includes(category) && (
                                                    <TableCell>
                                                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                                                            {item.product.dstAdi || "-"}
                                                        </span>
                                                    </TableCell>
                                                )}
                                                {renderTableCells(item, isEditing, isEditingTarget, progressPercentage)}
                                                <TableCell>
                                                    <span className="text-sm font-medium text-slate-800">
                                                        {(item as any).completedAt ? format(new Date((item as any).completedAt), 'dd.MM.yyyy HH:mm') : "-"}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </TabsContent>

                    {/* Mal Fazlası Tab */}
                    <TabsContent value="mal-fazlasi">
                        {/* Ekleme Formu */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-4 bg-orange-50 border border-orange-200 rounded-lg mb-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Ürün Adı *</label>
                                <Input
                                    placeholder="Ürün adı"
                                    value={malFazlasiForm.productName}
                                    onChange={(e) => setMalFazlasiForm(f => ({ ...f, productName: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Model</label>
                                <Input
                                    placeholder="Model"
                                    value={malFazlasiForm.model}
                                    onChange={(e) => setMalFazlasiForm(f => ({ ...f, model: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Firma</label>
                                <Input
                                    placeholder="Firma"
                                    value={malFazlasiForm.company}
                                    onChange={(e) => setMalFazlasiForm(f => ({ ...f, company: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Usta</label>
                                <Input
                                    placeholder="Usta"
                                    value={malFazlasiForm.master}
                                    onChange={(e) => setMalFazlasiForm(f => ({ ...f, master: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Adet *</label>
                                <Input
                                    type="number"
                                    placeholder="Adet"
                                    value={malFazlasiForm.quantity}
                                    onChange={(e) => setMalFazlasiForm(f => ({ ...f, quantity: e.target.value }))}
                                    className="h-9"
                                    min={1}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Açıklama</label>
                                <div className="flex gap-1">
                                    <Input
                                        placeholder="Açıklama"
                                        value={malFazlasiForm.description}
                                        onChange={(e) => setMalFazlasiForm(f => ({ ...f, description: e.target.value }))}
                                        className="h-9"
                                    />
                                    <Button
                                        onClick={handleMalFazlasiAdd}
                                        disabled={malFazlasiLoading}
                                        className="h-9 px-3 bg-orange-600 hover:bg-orange-700 shrink-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Liste */}
                        {malFazlasiList.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <PackagePlus className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                                <p className="text-lg">Henüz mal fazlası kaydı yok</p>
                                <p className="text-sm mt-1">Yukarıdaki formu kullanarak ekleyin</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ürün Adı</TableHead>
                                        <TableHead>Model</TableHead>
                                        <TableHead>Firma</TableHead>
                                        <TableHead>Usta</TableHead>
                                        <TableHead className="text-center">Adet</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead className="text-right">İşlem</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {malFazlasiList.map((item) => (
                                        <TableRow key={item.id} className="bg-orange-50/50">
                                            <TableCell className="font-medium">{item.productName}</TableCell>
                                            <TableCell>{item.model || "-"}</TableCell>
                                            <TableCell>{item.company || "-"}</TableCell>
                                            <TableCell>
                                                <span className="text-sm font-medium text-blue-700">
                                                    {item.master || "-"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {editingMalFazlasiId === item.id ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className="text-xs text-slate-500 mr-1">Kalan: {item.quantity} — Düş:</span>
                                                        <Input
                                                            type="number"
                                                            value={malFazlasiDusValue}
                                                            onChange={(e) => setMalFazlasiDusValue(e.target.value)}
                                                            className="w-20 text-center h-8"
                                                            min={1}
                                                            max={item.quantity}
                                                            autoFocus
                                                        />
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleMalFazlasiDus(item.id, item.quantity)}
                                                            className="bg-orange-600 hover:bg-orange-700 h-8 w-8 p-0"
                                                        >
                                                            <Save className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => { setEditingMalFazlasiId(null); setMalFazlasiDusValue(""); }}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            ✕
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className="font-bold text-orange-600 text-lg">{item.quantity}</span>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => { setEditingMalFazlasiId(item.id); setMalFazlasiDusValue(""); }}
                                                            className="h-7 px-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                                                            title="Adet düş"
                                                        >
                                                            − Düş
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-slate-600 text-sm">{item.description || "-"}</TableCell>
                                            <TableCell className="text-sm text-slate-500">
                                                {format(new Date(item.createdAt), 'dd.MM.yyyy')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleMalFazlasiDelete(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </TabsContent>
                </Tabs>
            )}
            <ManualAddSemiFinishedDialog
                open={isManualAddOpen}
                onOpenChange={setIsManualAddOpen}
                category={category}
                onSuccess={loadData}
            />

            {/* Açıklama Düzenleme Dialog */}
            {editNotesDialog && (
                <EditProductNotesDialog
                    open={editNotesDialog.open}
                    onOpenChange={(open) => !open && setEditNotesDialog(null)}
                    productId={editNotesDialog.productId}
                    productName={editNotesDialog.productName}
                    currentNotes={editNotesDialog.notes}
                    onSuccess={loadData}
                />
            )}

            {/* Ürün Detay Dialog */}
            {selectedItem && (
                <SemiFinishedProductDetailDialog
                    open={!!selectedItem}
                    onOpenChange={(open) => !open && setSelectedItem(null)}
                    item={selectedItem}
                />
            )}
        </div>
    );
}
