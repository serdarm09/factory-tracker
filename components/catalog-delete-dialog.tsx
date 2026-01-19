"use client";

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
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAllCatalogItems } from "@/lib/catalog-actions";
import { useRouter } from "next/navigation";

export function CatalogDeleteDialog() {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"initial" | "confirm">("initial");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            // Reset state when closed
            setTimeout(() => setStep("initial"), 300);
        }
    };

    const handleFirstConfirm = () => {
        setStep("confirm");
    };

    const handleFinalDelete = async () => {
        setLoading(true);
        try {
            const res = await deleteAllCatalogItems();
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Tüm katalog başarıyla silindi");
                setOpen(false);
                router.refresh();
            }
        } catch (error) {
            toast.error("Silme işlemi sırasında hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Tümünü Sil
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        {step === "initial" ? "Tüm Kataloğu Sil?" : "KESİN KARARINIZ MI?"}
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                        {step === "initial" ? (
                            <span>
                                Bu işlem veritabanındaki <strong>TÜM ÜRÜNLERİ</strong> kalıcı olarak silecektir.
                                <br /><br />
                                Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
                            </span>
                        ) : (
                            <span className="font-bold text-red-600 block bg-red-50 p-3 rounded-md border border-red-200">
                                DİKKAT: Bu son uyarıdır. Onaylarsanız tüm ürün verileri silinecektir.
                                Bu işlemi gerçekten yapmak istiyor musunuz?
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                    >
                        İptal
                    </Button>

                    {step === "initial" ? (
                        <Button
                            variant="destructive"
                            onClick={handleFirstConfirm}
                        >
                            Devam Et
                        </Button>
                    ) : (
                        <Button
                            variant="destructive"
                            onClick={handleFinalDelete}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Evet, Hepsini Sil
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
