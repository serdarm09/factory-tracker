"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { addKonfeksiyonStock, updateKonfeksiyonStock, deleteKonfeksiyonStock } from "@/app/actions/konfeksiyon-actions";
import { KonfeksiyonExcelImportDialog } from "./konfeksiyon-excel-import-dialog";

export function KonfeksiyonStockTab({ stocks }: { stocks: any[] }) {
    const router = useRouter();
    const [searchQuery, setSearchQuery]         = useState("");
    const [filterType, setFilterType]           = useState("all");
    const [editingMaterial, setEditingMaterial] = useState<any>(null);
    const [formData, setFormData]               = useState<any>({
        name: "", type: "KUMAS", quantity: 0, unit: "Metre", colorCode: "", note: ""
    });

    // Inline edit state
    const [inlineEditId, setInlineEditId]       = useState<number | null>(null);
    const [inlineEditValue, setInlineEditValue] = useState("");
    const inlineInputRef                        = useRef<HTMLInputElement>(null);

    // Filter
    const filteredItems = stocks.filter(m => {
        if (searchQuery.trim() && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (filterType !== "all" && m.type !== filterType) return false;
        return true;
    });

    // Dialog Edit
    const handleEdit = (item: any) => {
        setEditingMaterial(item);
        setFormData({
            name: item.name,
            type: item.type,
            quantity: item.quantity,
            unit: item.unit,
            colorCode: item.colorCode || "",
            note: item.note || "",
        });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Simek istediğinize emin misiniz?")) return;
        const res = await deleteKonfeksiyonStock(id);
        if (res.success) toast.success("Silindi.");
        else toast.error(res.error);
        router.refresh();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: formData.name,
            type: formData.type as any,
            quantity: Number(formData.quantity),
            unit: formData.unit,
            colorCode: formData.colorCode || null,
            note: formData.note || null,
        };

        const res = editingMaterial?.id 
            ? await updateKonfeksiyonStock(editingMaterial.id, payload)
            : await addKonfeksiyonStock(payload);

        if (res.success) {
            toast.success(editingMaterial?.id ? "Güncellendi." : "Eklendi.");
            setEditingMaterial(null);
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    const openAdd = () => {
        setEditingMaterial({ id: null });
        setFormData({ name: "", type: "KUMAS", quantity: 0, unit: "Metre", colorCode: "", note: "" });
    };

    // Inline Edit
    const startInlineEdit = (item: any) => {
        setInlineEditId(item.id);
        setInlineEditValue(String(item.quantity));
        setTimeout(() => inlineInputRef.current?.select(), 30);
    };

    const cancelInlineEdit = () => {
        setInlineEditId(null);
        setInlineEditValue("");
    };

    const saveInlineEdit = async (item: any) => {
        const newQty = parseFloat(inlineEditValue);
        if (isNaN(newQty)) { toast.error("Geçersiz sayı"); return; }
        const res = await updateKonfeksiyonStock(item.id, { quantity: newQty });
        if (res.success) {
            toast.success(`${item.name} miktarı güncellendi.`);
            setInlineEditId(null);
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 py-2">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Search className="h-4 w-4 text-slate-400 shrink-0" />
                    <Input
                        placeholder={`Kumaş veya deri ara...`}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="h-9"
                    />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9 w-32">
                        <SelectValue placeholder="Tür" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Türler</SelectItem>
                        <SelectItem value="KUMAS">Kumaş</SelectItem>
                        <SelectItem value="DERI">Deri</SelectItem>
                        <SelectItem value="DIGER">Diğer</SelectItem>
                    </SelectContent>
                </Select>
                <div className="text-sm text-slate-500 w-16 text-center">
                    {filteredItems.length} kayıt
                </div>
                <KonfeksiyonExcelImportDialog />
                <Button onClick={openAdd} size="sm" className="h-9">
                    <Plus className="w-4 h-4 mr-1" /> Yeni Kumaş/Deri
                </Button>
            </div>

            {/* Table */}
            <div className="border rounded-md">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Adı</TableHead>
                            <TableHead className="w-24">Tür</TableHead>
                            <TableHead className="text-center w-24">Renk/Kod</TableHead>
                            <TableHead className="text-right w-32">Miktar</TableHead>
                            <TableHead className="w-16">Birim</TableHead>
                            <TableHead>Not</TableHead>
                            <TableHead className="text-right w-20">İşlem</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                                    Gösterilecek kayıt bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredItems.map(item => {
                                const isInline = inlineEditId === item.id;
                                return (
                                    <TableRow key={item.id} className="hover:bg-slate-50/60">
                                        <TableCell className="font-medium text-sm">{item.name}</TableCell>
                                        <TableCell>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                                item.type === "KUMAS" ? "bg-blue-100 text-blue-700" :
                                                item.type === "DERI" ? "bg-amber-100 text-amber-700" :
                                                "bg-slate-100 text-slate-700"
                                            }`}>
                                                {item.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-sm">{item.colorCode || "—"}</TableCell>
                                        <TableCell className="text-right">
                                            {isInline ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <Input
                                                        ref={inlineInputRef}
                                                        type="number"
                                                        step="0.01"
                                                        value={inlineEditValue}
                                                        onChange={e => setInlineEditValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === "Enter") saveInlineEdit(item);
                                                            if (e.key === "Escape") cancelInlineEdit();
                                                        }}
                                                        className="w-24 h-7 text-right text-sm"
                                                    />
                                                    <Button size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700" onClick={() => saveInlineEdit(item)}>
                                                        <Check className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button size="icon" variant="outline" className="h-7 w-7 border-red-200 hover:bg-red-50" onClick={cancelInlineEdit}>
                                                        <X className="h-3.5 w-3.5 text-red-600" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startInlineEdit(item)}
                                                    className="font-mono font-bold text-sm bg-slate-100 hover:bg-blue-100 text-slate-800 hover:text-blue-800 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                                    title="Tıkla ve düzenle"
                                                >
                                                    {Number(item.quantity).toLocaleString("tr-TR")}
                                                </button>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs">{item.unit}</TableCell>
                                        <TableCell className="text-xs text-slate-500 max-w-[150px] truncate">{item.note}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                                                    <Edit className="w-3.5 h-3.5 text-blue-600" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                                                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Editor Dialog */}
            <Dialog open={editingMaterial !== null} onOpenChange={v => { if (!v) setEditingMaterial(null); }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingMaterial?.id ? "Düzenle" : "Yeni Ekle"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <Label>Kumaş/Deri Adı *</Label>
                            <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ör: Su Yeşili Keten" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tür</Label>
                                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="KUMAS">Kumaş</SelectItem>
                                        <SelectItem value="DERI">Deri</SelectItem>
                                        <SelectItem value="DIGER">Diğer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Renk Kodu / Parti</Label>
                                <Input value={formData.colorCode} onChange={e => setFormData({ ...formData, colorCode: e.target.value })} placeholder="Opsiyonel" />
                            </div>
                            <div>
                                <Label>Miktar</Label>
                                <Input type="number" step="0.01" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                            </div>
                            <div>
                                <Label>Birim</Label>
                                <Select value={formData.unit} onValueChange={v => setFormData({ ...formData, unit: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {["Metre", "Ağırlık", "Adet", "Boy", "Rulo"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Not (Opsiyonel)</Label>
                            <Input value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingMaterial(null)}>İptal</Button>
                            <Button type="submit">{editingMaterial?.id ? "Güncelle" : "Ekle"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
