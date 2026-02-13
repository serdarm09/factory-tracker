"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Wrench, Factory, Paintbrush, Box, Loader2 } from "lucide-react";
import { sendToSemiFinishedProduction } from "@/lib/actions/semi-finished-production-actions";
import { toast } from "sonner";

interface SendToSemiFinishedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedProductIds: number[];
    products?: any[]; // Tüm ürünler listesi
    onSuccess: () => void;
}

const CATEGORIES = [
    { value: "METAL", label: "Metal", icon: Wrench, color: "text-slate-600" },
    { value: "KONFEKSIYON", label: "Konfeksiyon", icon: Factory, color: "text-blue-600" },
    { value: "AHSAP_BOYA", label: "Ahşap Boya", icon: Paintbrush, color: "text-amber-600" },
    { value: "AHSAP_ISKELET", label: "Ahşap İskelet", icon: Box, color: "text-brown-600" },
];

export function SendToSemiFinishedDialog({
    open,
    onOpenChange,
    selectedProductIds,
    products = [],
    onSuccess
}: SendToSemiFinishedDialogProps) {
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Seçili ürünleri filtrele
    const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));

    const handleCategoryToggle = (category: string) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const handleSubmit = async () => {
        if (selectedCategories.length === 0) {
            toast.error("En az bir kategori seçmelisiniz");
            return;
        }

        setLoading(true);

        // Her ürün için kendi quantity'si ve açıklaması ile gönder
        const result = await sendToSemiFinishedProduction({
            products: selectedProducts.map(p => ({
                id: p.id,
                quantity: p.quantity,
                description: p.description
            })),
            categories: selectedCategories
        });

        setLoading(false);

        if (result.success) {
            toast.success("Ürünler yarı mamül üretime gönderildi");
            setSelectedCategories([]);
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(result.error || "Hata oluştu");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Yarı Mamül Üretime Gönder</DialogTitle>
                    <DialogDescription>
                        {selectedProductIds.length} ürün seçildi. Hangi üretim kategorilerine göndermek istiyorsunuz?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Üretim Kategorileri (Çoklu Seçim)</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {CATEGORIES.map((cat) => {
                                const Icon = cat.icon;
                                const isSelected = selectedCategories.includes(cat.value);

                                return (
                                    <div
                                        key={cat.value}
                                        className={`flex items-center space-x-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                            isSelected
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-slate-200 hover:border-slate-300"
                                        }`}
                                        onClick={() => handleCategoryToggle(cat.value)}
                                    >
                                        <Checkbox
                                            id={cat.value}
                                            checked={isSelected}
                                            onCheckedChange={() => handleCategoryToggle(cat.value)}
                                        />
                                        <Label
                                            htmlFor={cat.value}
                                            className="flex items-center gap-2 cursor-pointer flex-1"
                                        >
                                            <Icon className={`h-4 w-4 ${cat.color}`} />
                                            <span>{cat.label}</span>
                                        </Label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Seçili Ürünler Listesi */}
                    <div className="space-y-2">
                        <Label>Gönderilecek Ürünler</Label>
                        <div className="max-h-40 overflow-y-auto border rounded-lg p-3 bg-slate-50 space-y-2">
                            {selectedProducts.map((product) => (
                                <div key={product.id} className="flex justify-between items-center text-sm">
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-slate-600">{product.quantity} adet</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500">
                            Her ürün kendi sipariş miktarı ile gönderilecek
                        </p>
                    </div>

                    {selectedCategories.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-blue-900">
                                {selectedProductIds.length} ürün × {selectedCategories.length} kategori = {selectedProductIds.length * selectedCategories.length} kayıt oluşturulacak
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                                Seçilen kategoriler: {selectedCategories.map(c => CATEGORIES.find(cat => cat.value === c)?.label).join(", ")}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        İptal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || selectedCategories.length === 0}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Gönder
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
