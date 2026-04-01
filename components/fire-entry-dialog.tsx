"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordFireAmount } from "@/lib/actions";
import { toast } from "sonner";
import { Flame } from "lucide-react";

const UNITS = [
    { value: "adet", label: "Adet" },
    { value: "metre", label: "Metre (m)" },
    { value: "kg", label: "Kilogram (kg)" },
    { value: "litre", label: "Litre (L)" },
    { value: "top", label: "Top" },
    { value: "paket", label: "Paket" },
    { value: "rulo", label: "Rulo" },
    { value: "kutu", label: "Kutu" },
];

interface FireEntryDialogProps {
    items: { id: number; name: string; unit: string; quantity: number }[];
}

export function FireEntryDialog({ items }: FireEntryDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string>("");
    const [quantity, setQuantity] = useState("");
    const [unit, setUnit] = useState("adet");
    const [note, setNote] = useState("");

    const selectedItem = items.find(i => i.id === parseInt(selectedItemId));

    // When item changes, default unit to its own unit
    const handleItemChange = (val: string) => {
        setSelectedItemId(val);
        const item = items.find(i => i.id === parseInt(val));
        if (item) setUnit(item.unit);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemId || !quantity) {
            toast.error("Lütfen ürünü ve fire miktarını seçin.");
            return;
        }

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Geçerli bir fire miktarı girin.");
            return;
        }

        setLoading(true);
        try {
            const res = await recordFireAmount(parseInt(selectedItemId), qty, unit, note || undefined);
            if (res.success) {
                toast.success(`Fire kaydedildi. Yeni stok: ${res.newQuantity} ${unit}`);
                setOpen(false);
                setSelectedItemId("");
                setQuantity("");
                setNote("");
            } else {
                toast.error(res.error || "Bir hata oluştu");
            }
        } catch {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
                    <Flame className="h-4 w-4" />
                    Günlük Fire Girişi
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-orange-700">
                        <Flame className="h-5 w-5" />
                        Günlük Fire / Zayi Kaydı
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Ürün Seçimi */}
                    <div className="space-y-2">
                        <Label>Yarı Mamül *</Label>
                        <Select value={selectedItemId} onValueChange={handleItemChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Fire olan ürünü seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {items.map(item => (
                                    <SelectItem key={item.id} value={String(item.id)}>
                                        {item.name}
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            (Mevcut: {item.quantity} {item.unit})
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Miktar + Birim */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Fire Miktarı *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Birim *</Label>
                            <Select value={unit} onValueChange={setUnit}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {UNITS.map(u => (
                                        <SelectItem key={u.value} value={u.value}>
                                            {u.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Açıklama */}
                    <div className="space-y-2">
                        <Label>Açıklama / Neden</Label>
                        <Textarea
                            placeholder="Ör: Kesim hatası, yırtılma, ıslak kaldı..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={2}
                        />
                    </div>

                    {selectedItem && (
                        <div className="rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-800">
                            <strong>{selectedItem.name}</strong> — Mevcut stok:{" "}
                            <span className="font-semibold">{selectedItem.quantity} {selectedItem.unit}</span>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            {loading ? "Kaydediliyor..." : "Fire Kaydet"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
