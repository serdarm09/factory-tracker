'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { clearAllProductionData } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ClearDataButton() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const router = useRouter();

    const handleClear = async () => {
        if (confirmText !== "SİL") {
            toast.error("Onay metni yanlış");
            return;
        }

        setLoading(true);
        try {
            const result = await clearAllProductionData();
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("Tüm üretim verileri temizlendi");
                setOpen(false);
                setConfirmText("");
                router.refresh();
            }
        } catch (e) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Tüm Verileri Temizle
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Dikkat! Bu işlem geri alınamaz!
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                        <p>
                            Bu işlem aşağıdaki tüm verileri <strong className="text-red-600">kalıcı olarak silecektir</strong>:
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                            <li>Tüm siparişler</li>
                            <li>Tüm ürünler / iş emirleri</li>
                            <li>Tüm üretim logları</li>
                            <li>Tüm stok kayıtları</li>
                            <li>Tüm sevkiyatlar</li>
                        </ul>
                        <p className="font-semibold pt-2">
                            Onaylamak için aşağıya <span className="text-red-600">SİL</span> yazın:
                        </p>
                        <Input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="SİL"
                            className="mt-2"
                        />
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>İptal</AlertDialogCancel>
                    <Button
                        variant="destructive"
                        onClick={handleClear}
                        disabled={loading || confirmText !== "SİL"}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Siliniyor...
                            </>
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Evet, Tümünü Sil
                            </>
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
