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
import { updateSemiFinishedStock } from "@/lib/actions";
import { toast } from "sonner";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface SemiFinished {
    id: number;
    name: string;
    code: string;
    quantity: number;
    unit: string;
}

interface SemiFinishedStockDialogProps {
    children: React.ReactNode;
    item: SemiFinished;
    type: "IN" | "OUT";
}

export function SemiFinishedStockDialog({ children, item, type }: SemiFinishedStockDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [quantity, setQuantity] = useState(1);

    const isIn = type === "IN";
    const maxOut = item.quantity;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const qty = parseInt(formData.get("quantity") as string) || 0;

        if (qty <= 0) {
            toast.error("Miktar 0'dan büyük olmalı");
            setLoading(false);
            return;
        }

        if (!isIn && qty > item.quantity) {
            toast.error(`Stokta yeterli miktar yok. Mevcut: ${item.quantity} ${item.unit}`);
            setLoading(false);
            return;
        }

        try {
            const result = await updateSemiFinishedStock(
                item.id,
                type,
                qty,
                formData.get("note") as string || undefined
            );

            if (result.success) {
                toast.success(isIn ? "Stok girişi yapıldı" : "Stok çıkışı yapıldı");
                setOpen(false);
                setQuantity(1);
            } else {
                toast.error(result.error || "Bir hata oluştu");
            }
        } catch (error) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${isIn ? "text-green-600" : "text-red-600"}`}>
                        {isIn ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                        {isIn ? "Stok Girişi" : "Stok Çıkışı"}
                    </DialogTitle>
                </DialogHeader>

                <div className="bg-slate-50 p-3 rounded-lg mb-4">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                        Kod: {item.code} • Mevcut: {item.quantity} {item.unit}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="quantity">Miktar *</Label>
                        <Input
                            id="quantity"
                            name="quantity"
                            type="number"
                            min="1"
                            max={isIn ? undefined : maxOut}
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                            required
                        />
                        {!isIn && (
                            <p className="text-xs text-muted-foreground">
                                Maksimum çıkış: {maxOut} {item.unit}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note">Not (Opsiyonel)</Label>
                        <Textarea
                            id="note"
                            name="note"
                            placeholder={isIn ? "Tedarikçi bilgisi, fatura no..." : "Kullanım amacı, iş emri no..."}
                            rows={2}
                        />
                    </div>

                    <div className={`p-3 rounded-lg ${isIn ? "bg-green-50" : "bg-red-50"}`}>
                        <div className="text-sm font-medium">
                            {isIn ? "Giriş Sonrası Stok:" : "Çıkış Sonrası Stok:"}
                        </div>
                        <div className={`text-2xl font-bold ${isIn ? "text-green-600" : "text-red-600"}`}>
                            {isIn ? item.quantity + quantity : Math.max(0, item.quantity - quantity)} {item.unit}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className={isIn ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                        >
                            {loading ? "İşleniyor..." : isIn ? "Giriş Yap" : "Çıkış Yap"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
