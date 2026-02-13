"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus } from "lucide-react";
import { addManualSemiFinishedProduction } from "@/lib/actions/semi-finished-production-actions";
import { toast } from "sonner";

interface ManualAddSemiFinishedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: string;
    onSuccess: () => void;
}

export function ManualAddSemiFinishedDialog({
    open,
    onOpenChange,
    category,
    onSuccess
}: ManualAddSemiFinishedDialogProps) {
    const [productName, setProductName] = useState("");
    const [model, setModel] = useState("");
    const [orderName, setOrderName] = useState("");
    const [company, setCompany] = useState("");
    const [targetQty, setTargetQty] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const categoryNames: Record<string, string> = {
        METAL: "Metal",
        KONFEKSIYON: "Konfeksiyon",
        AHSAP_BOYA: "Ahşap Boya",
        AHSAP_ISKELET: "Ahşap İskelet"
    };

    const handleSubmit = async () => {
        if (!productName || !model || !targetQty) {
            toast.error("Ürün adı, model ve miktar zorunludur");
            return;
        }

        const qty = parseInt(targetQty);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Geçerli bir miktar girin");
            return;
        }

        setLoading(true);
        const result = await addManualSemiFinishedProduction({
            productName,
            model,
            orderName: orderName || undefined,
            company: company || undefined,
            description: description || undefined,
            category,
            targetQty: qty
        });

        setLoading(false);

        if (result.success) {
            toast.success("Ürün eklendi");
            // Reset form
            setProductName("");
            setModel("");
            setOrderName("");
            setCompany("");
            setTargetQty("");
            setDescription("");
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
                    <DialogTitle>Manuel Ürün Ekle - {categoryNames[category]}</DialogTitle>
                    <DialogDescription>
                        {categoryNames[category]} kategorisine manuel ürün ekleyin
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="productName">Ürün Adı *</Label>
                        <Input
                            id="productName"
                            placeholder="Ürün adı"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="model">Model *</Label>
                        <Input
                            id="model"
                            placeholder="Model kodu"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="orderName">Sipariş Adı</Label>
                            <Input
                                id="orderName"
                                placeholder="Opsiyonel"
                                value={orderName}
                                onChange={(e) => setOrderName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company">Firma</Label>
                            <Input
                                id="company"
                                placeholder="Opsiyonel"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Açıklama</Label>
                        <Textarea
                            id="description"
                            placeholder="Opsiyonel açıklama girebilirsiniz"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="targetQty">Üretim Miktarı *</Label>
                        <Input
                            id="targetQty"
                            type="number"
                            placeholder="Adet"
                            value={targetQty}
                            onChange={(e) => setTargetQty(e.target.value)}
                            min={1}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        İptal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !productName || !model || !targetQty}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Plus className="mr-2 h-4 w-4" />
                        Ekle
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
