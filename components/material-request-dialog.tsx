"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PackageOpen, Search, X } from "lucide-react";
import { toast } from "sonner";
import { getRawMaterials, createMaterialRequest } from "@/app/actions/raw-material-actions";

interface MaterialRequestDialogProps {
    userId: number;
    departmentName: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    KUMAS:                      "Kumaş",
    DERI:                       "Deri",
    SUNGER:                     "Sünger",
    TAHTA:                      "Tahta",
    CIVATA:                     "Cıvata",
    AMORTISOR:                  "Amortisör",
    KOL_AYAK_PLASTIK_FILE:      "Kol / Ayak",
    TEKER_BINGO_SOKET_MEKANIZMA:"Teker / Soket",
    DIGER:                      "Diğer",
};

const CATEGORY_COLORS: Record<string, string> = {
    KUMAS:                       "bg-blue-50 border-blue-300 text-blue-800 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white data-[selected=true]:border-blue-600",
    DERI:                        "bg-amber-50 border-amber-300 text-amber-800 data-[selected=true]:bg-amber-600 data-[selected=true]:text-white data-[selected=true]:border-amber-600",
    SUNGER:                      "bg-purple-50 border-purple-300 text-purple-800 data-[selected=true]:bg-purple-600 data-[selected=true]:text-white data-[selected=true]:border-purple-600",
    TAHTA:                       "bg-orange-50 border-orange-300 text-orange-800 data-[selected=true]:bg-orange-600 data-[selected=true]:text-white data-[selected=true]:border-orange-600",
    CIVATA:                      "bg-slate-50 border-slate-300 text-slate-700 data-[selected=true]:bg-slate-600 data-[selected=true]:text-white data-[selected=true]:border-slate-600",
    AMORTISOR:                   "bg-green-50 border-green-300 text-green-800 data-[selected=true]:bg-green-600 data-[selected=true]:text-white data-[selected=true]:border-green-600",
    KOL_AYAK_PLASTIK_FILE:       "bg-pink-50 border-pink-300 text-pink-800 data-[selected=true]:bg-pink-600 data-[selected=true]:text-white data-[selected=true]:border-pink-600",
    TEKER_BINGO_SOKET_MEKANIZMA: "bg-cyan-50 border-cyan-300 text-cyan-800 data-[selected=true]:bg-cyan-600 data-[selected=true]:text-white data-[selected=true]:border-cyan-600",
    DIGER:                       "bg-gray-50 border-gray-300 text-gray-700 data-[selected=true]:bg-gray-600 data-[selected=true]:text-white data-[selected=true]:border-gray-600",
};

export function MaterialRequestDialog({ userId, departmentName }: MaterialRequestDialogProps) {
    const [open, setOpen] = useState(false);
    const [rawMaterials, setRawMaterials] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [search, setSearch] = useState("");
    const [selectedMaterialId, setSelectedMaterialId] = useState("");
    const [quantity, setQuantity] = useState("");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (open && rawMaterials.length === 0) {
            getRawMaterials().then(res => {
                if (res.success) setRawMaterials(res.data || []);
            });
        }
    }, [open]);

    // Tüm tanımlı kategorileri göster
    const availableCategories = Object.keys(CATEGORY_LABELS);

    // Kategori ve arama filtresi
    const filteredMaterials = useMemo(() => {
        return rawMaterials.filter((m: any) => {
            const matchCat = !selectedCategory || m.category === selectedCategory;
            const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [rawMaterials, selectedCategory, search]);

    const selectedMaterial = rawMaterials.find((m: any) => m.id.toString() === selectedMaterialId);

    const handleCategorySelect = (cat: string) => {
        setSelectedCategory(prev => prev === cat ? "" : cat);
        setSelectedMaterialId("");
        setSearch("");
    };

    const handleClose = () => {
        setOpen(false);
        setSelectedCategory("");
        setSearch("");
        setSelectedMaterialId("");
        setQuantity("");
        setNotes("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMaterialId || !quantity || Number(quantity) <= 0) {
            toast.error("Lütfen malzeme seçin ve geçerli bir miktar girin.");
            return;
        }
        setLoading(true);
        const res = await createMaterialRequest({
            rawMaterialId: Number(selectedMaterialId),
            quantity: Number(quantity),
            requesterId: userId,
            department: departmentName,
            notes,
        });
        setLoading(false);
        if (res.success) {
            toast.success("Talebiniz Hammadde Deposuna iletildi.");
            handleClose();
        } else {
            toast.error(res.error || "Bir hata oluştu.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800">
                    <PackageOpen className="w-4 h-4 mr-2" /> Hammadde Talep Et
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Hammadde Talep Formu</DialogTitle>
                    <DialogDescription>
                        İhtiyacınız olan malzemeyi Hammadde Deposundan talep edin.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 py-1">

                    {/* 1. Kategori Seçimi */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Hammadde Türü</Label>
                        <div className="flex flex-wrap gap-2">
                            {availableCategories.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    data-selected={selectedCategory === cat}
                                    onClick={() => handleCategorySelect(cat)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${CATEGORY_COLORS[cat] || "bg-gray-50 border-gray-300 text-gray-700"}`}
                                >
                                    {CATEGORY_LABELS[cat] || cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Ürün Arama */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Malzeme Ara</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Malzeme adı ile arayın..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setSelectedMaterialId(""); }}
                                className="pl-9 pr-8"
                            />
                            {search && (
                                <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Sonuç Listesi */}
                        {(search || selectedCategory) && (
                            <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                                {filteredMaterials.length === 0 ? (
                                    <div className="px-3 py-4 text-sm text-slate-500 text-center">Sonuç bulunamadı</div>
                                ) : (
                                    filteredMaterials.map((m: any) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setSelectedMaterialId(m.id.toString())}
                                            className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedMaterialId === m.id.toString() ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{m.name}</div>
                                                <div className="text-xs text-slate-400">{CATEGORY_LABELS[m.category] || m.category}</div>
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono ml-2 shrink-0">
                                                Stok: {m.quantity} {m.unit}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Seçili malzeme göster */}
                        {selectedMaterial && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm">
                                <span className="font-medium text-blue-800 flex-1">{selectedMaterial.name}</span>
                                <span className="text-blue-600 text-xs">{CATEGORY_LABELS[selectedMaterial.category]}</span>
                                <button type="button" onClick={() => setSelectedMaterialId("")} className="text-blue-400 hover:text-blue-700">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 3. Miktar */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Miktar</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                placeholder="0"
                                className="flex-1"
                            />
                            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-2 rounded border shrink-0">
                                {selectedMaterial?.unit || "Birim"}
                            </span>
                        </div>
                    </div>

                    {/* 4. Not */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Not <span className="font-normal text-slate-400">(opsiyonel)</span></Label>
                        <Input
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Gerekirse açıklama ekleyin..."
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>İptal</Button>
                        <Button type="submit" disabled={loading || !selectedMaterialId || !quantity}>
                            {loading ? "Gönderiliyor..." : "Talebi Gönder"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
