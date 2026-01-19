'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCatalogItem } from "@/lib/catalog-actions";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";

interface EditCatalogDialogProps {
    product: {
        id: number;
        code: string;
        name: string;
        imageUrl?: string | null;
    };
    onSuccess?: () => void;
}

export function EditCatalogDialog({ product, onSuccess }: EditCatalogDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(product.name);
    const [code, setCode] = useState(product.code);
    const [image, setImage] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSave() {
        if (!name.trim() || !code.trim()) {
            toast.error("Kod ve isim gereklidir");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("code", code);
            formData.append("name", name);
            if (image) {
                formData.append("image", image);
            }

            const res = await updateCatalogItem(product.id, formData);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Katalog ürünü güncellendi");
                setOpen(false);
                if (onSuccess) onSuccess();
            }
        } catch (e) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Katalog Ürününü Düzenle</DialogTitle>
                    <DialogDescription>
                        Ürün bilgilerini ve resmini buradan güncelleyebilirsiniz.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="code" className="text-right">
                            Kod
                        </Label>
                        <Input
                            id="code"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            İsim
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="image" className="text-right">
                            Resim
                        </Label>
                        <div className="col-span-3">
                            <Input
                                id="image"
                                type="file"
                                accept="image/*"
                                onChange={(e) => setImage(e.target.files?.[0] || null)}
                            />
                            {product.imageUrl && !image && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Mevcut resim korunacak. Değiştirmek için yeni dosya seçin.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSave} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Kaydet
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
