"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wrench, Factory, Paintbrush, Box, Loader2, Layers, AlertTriangle, Droplets } from "lucide-react";
import { sendToSemiFinishedProduction, getExistingSemiFinishedCategories } from "@/lib/actions/semi-finished-production-actions";
import { toast } from "sonner";

interface SendToSemiFinishedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedProductIds: number[];
    products?: any[];
    onSuccess: () => void;
}

const CATEGORIES = [
    { value: "METAL", label: "Metal", icon: Wrench, color: "text-slate-600" },
    { value: "KONFEKSIYON", label: "Konfeksiyon", icon: Factory, color: "text-blue-600" },
    { value: "AHSAP_BOYA", label: "Ahşap Boya", icon: Paintbrush, color: "text-amber-600" },
    { value: "AHSAP_ISKELET", label: "Ahşap İskelet", icon: Box, color: "text-brown-600" },
    { value: "PLASTIK", label: "Plastik", icon: Layers, color: "text-purple-600" },
    { value: "SUNGER_DOKUM", label: "Sünger Döküm", icon: Droplets, color: "text-cyan-600" },
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
    // Zaten gönderilmiş kategori haritası: { productId: [category, ...] }
    const [existingMap, setExistingMap] = useState<Record<number, string[]>>({});
    const [loadingExisting, setLoadingExisting] = useState(false);

    const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));

    // Dialog açılınca mevcut kayıtları çek
    useEffect(() => {
        if (!open || selectedProductIds.length === 0) return;
        setLoadingExisting(true);
        getExistingSemiFinishedCategories(selectedProductIds).then(map => {
            setExistingMap(map);
            setLoadingExisting(false);
        });
        setSelectedCategories([]);
    }, [open, selectedProductIds.join(",")]);

    // Bir kategorinin seçili ürünlerin HEPSİ için zaten gönderilmiş olup olmadığı
    const isCategoryFullySent = (category: string) =>
        selectedProductIds.length > 0 &&
        selectedProductIds.every(id => existingMap[id]?.includes(category));

    // Bir kategorinin bazı ürünler için gönderilmiş olup olmadığı
    const isCategoryPartiallySent = (category: string) =>
        selectedProductIds.some(id => existingMap[id]?.includes(category)) &&
        !isCategoryFullySent(category);

    const handleCategoryToggle = (category: string) => {
        if (isCategoryFullySent(category)) {
            toast.warning(`Seçili ürünlerin tamamı zaten "${CATEGORIES.find(c => c.value === category)?.label}" kategorisine gönderilmiş`);
            return;
        }
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
                        {loadingExisting ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Mevcut kayıtlar kontrol ediliyor...
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {CATEGORIES.map((cat) => {
                                    const Icon = cat.icon;
                                    const isSelected = selectedCategories.includes(cat.value);
                                    const fullySent = isCategoryFullySent(cat.value);
                                    const partiallySent = isCategoryPartiallySent(cat.value);

                                    return (
                                        <div
                                            key={cat.value}
                                            className={`flex items-center space-x-2 p-3 border-2 rounded-lg transition-all ${
                                                fullySent
                                                    ? "border-orange-300 bg-orange-50 opacity-70 cursor-not-allowed"
                                                    : isSelected
                                                        ? "border-blue-500 bg-blue-50 cursor-pointer"
                                                        : "border-slate-200 hover:border-slate-300 cursor-pointer"
                                            }`}
                                            onClick={() => handleCategoryToggle(cat.value)}
                                        >
                                            <Checkbox
                                                id={cat.value}
                                                checked={isSelected}
                                                disabled={fullySent}
                                                onCheckedChange={() => handleCategoryToggle(cat.value)}
                                            />
                                            <Label
                                                htmlFor={cat.value}
                                                className={`flex items-center gap-2 flex-1 ${fullySent ? "cursor-not-allowed" : "cursor-pointer"}`}
                                            >
                                                <Icon className={`h-4 w-4 ${cat.color}`} />
                                                <span>{cat.label}</span>
                                            </Label>
                                            {fullySent && (
                                                <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300 shrink-0">
                                                    Gönderildi
                                                </Badge>
                                            )}
                                            {partiallySent && !fullySent && (
                                                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300 shrink-0">
                                                    Kısmi
                                                </Badge>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Seçili Ürünler Listesi */}
                    <div className="space-y-2">
                        <Label>Gönderilecek Ürünler</Label>
                        <div className="max-h-40 overflow-y-auto border rounded-lg p-3 bg-slate-50 space-y-2">
                            {selectedProducts.map((product) => {
                                const sentCategories = existingMap[product.id] || [];
                                return (
                                    <div key={product.id} className="flex justify-between items-center text-sm">
                                        <span className="font-medium">{product.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600">{product.quantity} adet</span>
                                            {sentCategories.length > 0 && (
                                                <span className="flex items-center gap-1 text-xs text-orange-600">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    {sentCategories.length} kategoride var
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
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

