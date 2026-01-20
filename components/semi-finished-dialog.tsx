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
import { createSemiFinished, updateSemiFinished } from "@/lib/actions";
import { toast } from "sonner";

interface SemiFinished {
    id: number;
    name: string;
    code: string;
    description: string | null;
    quantity: number;
    minStock: number;
    unit: string;
    category: string | null;
    location: string | null;
}

interface SemiFinishedDialogProps {
    children: React.ReactNode;
    mode: "create" | "edit";
    item?: SemiFinished;
}

export function SemiFinishedDialog({ children, mode, item }: SemiFinishedDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);

        try {
            if (mode === "create") {
                const result = await createSemiFinished(formData);
                if (result.success) {
                    toast.success("Yarı mamül oluşturuldu");
                    setOpen(false);
                } else {
                    toast.error(result.error || "Bir hata oluştu");
                }
            } else if (item) {
                const result = await updateSemiFinished(item.id, formData);
                if (result.success) {
                    toast.success("Yarı mamül güncellendi");
                    setOpen(false);
                } else {
                    toast.error(result.error || "Bir hata oluştu");
                }
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "Yeni Yarı Mamül" : "Yarı Mamül Düzenle"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Kod *</Label>
                            <Input
                                id="code"
                                name="code"
                                placeholder="YM-001"
                                defaultValue={item?.code || ""}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Ad *</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="İskelet A Tipi"
                                defaultValue={item?.name || ""}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Açıklama</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Yarı mamül hakkında açıklama..."
                            defaultValue={item?.description || ""}
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="quantity">Mevcut Stok</Label>
                            <Input
                                id="quantity"
                                name="quantity"
                                type="number"
                                min="0"
                                defaultValue={item?.quantity || 0}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="minStock">Min. Stok</Label>
                            <Input
                                id="minStock"
                                name="minStock"
                                type="number"
                                min="0"
                                defaultValue={item?.minStock || 10}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unit">Birim</Label>
                            <Input
                                id="unit"
                                name="unit"
                                placeholder="adet"
                                defaultValue={item?.unit || "adet"}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">Kategori</Label>
                            <Input
                                id="category"
                                name="category"
                                placeholder="İskelet, Sünger, Kumaş..."
                                defaultValue={item?.category || ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location">Lokasyon</Label>
                            <Input
                                id="location"
                                name="location"
                                placeholder="A-1, B-2..."
                                defaultValue={item?.location || ""}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Kaydediliyor..." : mode === "create" ? "Oluştur" : "Güncelle"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
