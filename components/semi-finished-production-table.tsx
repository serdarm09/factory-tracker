"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Save, Plus, Download, FileEdit } from "lucide-react";
import { getSemiFinishedProductionByCategory, updateSemiFinishedProductionQty, removeSemiFinishedProduction } from "@/lib/actions/semi-finished-production-actions";
import { toast } from "sonner";
import { ManualAddSemiFinishedDialog } from "./manual-add-semi-finished-dialog";
import { EditProductNotesDialog } from "./edit-product-notes-dialog";
import { SemiFinishedProductDetailDialog } from "./semi-finished-product-detail-dialog";
import * as XLSX from 'xlsx';
import { format } from "date-fns";

interface SemiFinishedProductionTableProps {
    category: string;
    userRole: string;
}

export function SemiFinishedProductionTable({ category, userRole }: SemiFinishedProductionTableProps) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [isManualAddOpen, setIsManualAddOpen] = useState(false);
    const [editNotesDialog, setEditNotesDialog] = useState<{
        open: boolean;
        productId: number;
        productName: string;
        notes: any;
    } | null>(null);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    const loadData = async () => {
        setLoading(true);
        const data = await getSemiFinishedProductionByCategory(category);
        setItems(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [category]);

    const handleEdit = (id: number, currentQty: number) => {
        setEditingId(id);
        setEditValue(currentQty.toString());
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

        const result = await updateSemiFinishedProductionQty(id, qty);
        if (result.success) {
            toast.success("Miktar güncellendi");
            setEditingId(null);
            loadData();
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
        AHSAP_ISKELET: "Ahşap İskelet"
    };

    const handleExportToExcel = () => {
        if (items.length === 0) {
            toast.error("Dışa aktarılacak veri yok");
            return;
        }

        const exportData = items.map(item => ({
            'Ürün': item.product.name,
            'Model': item.product.model,
            'Sipariş': item.product.order?.name || '-',
            'Firma': item.product.order?.company || '-',
            'Hedef': item.targetQty,
            'Üretilen': item.producedQty,
            'İlerleme %': ((item.producedQty / item.targetQty) * 100).toFixed(1),
            'Durum': getStatusText(item.status),
            'Açıklama': item.product.description || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);

        // Kolon genişlikleri
        ws['!cols'] = [
            { wch: 25 }, // Ürün
            { wch: 15 }, // Model
            { wch: 20 }, // Sipariş
            { wch: 20 }, // Firma
            { wch: 10 }, // Hedef
            { wch: 10 }, // Üretilen
            { wch: 12 }, // İlerleme
            { wch: 15 }, // Durum
            { wch: 40 }  // Açıklama
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, categoryNames[category] || category);

        const fileName = `Yari_Mamul_${categoryNames[category]}_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast.success(`${items.length} kayıt Excel'e aktarıldı`);
    };

    if (loading) {
        return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Butonlar */}
            <div className="flex justify-end gap-2">
                <Button
                    onClick={handleExportToExcel}
                    variant="outline"
                    className="gap-2"
                >
                    <Download className="h-4 w-4" />
                    Excel İndir
                </Button>
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

            {items.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <p className="text-lg">Bu kategoride henüz ürün yok</p>
                    <p className="text-sm mt-2">Üretim planlama sayfasından ürün gönderin veya manuel ekleyin</p>
                </div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Ürün</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Sipariş</TableHead>
                        <TableHead className="text-center">Hedef</TableHead>
                        <TableHead className="text-center">Üretilen</TableHead>
                        <TableHead className="text-center">İlerleme</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead>Açıklama</TableHead>
                        <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => {
                        const isEditing = editingId === item.id;
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
                                    {item.product.order?.name || "-"}
                                </TableCell>
                                <TableCell className="text-center font-semibold">
                                    {item.targetQty}
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
                                <TableCell>
                                    <div className="max-w-xs">
                                        <p className="text-sm text-slate-600 truncate" title={item.product.description || "-"}>
                                            {item.product.description || "-"}
                                        </p>
                                        {/* NetSim Açıklamaları */}
                                        {(item.product.aciklama1 || item.product.aciklama2 || item.product.aciklama3 || item.product.aciklama4) && (
                                            <div className="mt-1 text-xs text-amber-600">
                                                {[item.product.aciklama1, item.product.aciklama2, item.product.aciklama3, item.product.aciklama4]
                                                    .filter(Boolean)
                                                    .length} not
                                            </div>
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
                                                {userRole === "ADMIN" && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setEditNotesDialog({
                                                                open: true,
                                                                productId: item.product.id,
                                                                productName: item.product.name,
                                                                notes: {
                                                                    aciklama1: item.product.aciklama1,
                                                                    aciklama2: item.product.aciklama2,
                                                                    aciklama3: item.product.aciklama3,
                                                                    aciklama4: item.product.aciklama4,
                                                                }
                                                            })}
                                                            title="Sipariş notlarını düzenle"
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
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            )}

            {/* Manuel Ekleme Dialog */}
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
