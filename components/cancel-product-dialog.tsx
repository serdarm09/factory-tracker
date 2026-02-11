'use client';

import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { marketingRejectProduct } from "@/lib/actions";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";

interface CancelProductDialogProps {
    productId: number;
    productName: string;
}

export function CancelProductDialog({ productId, productName }: CancelProductDialogProps) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleCancel = () => {
        startTransition(async () => {
            const res = await marketingRejectProduct(productId, reason || "Pazarlama tarafından iptal edildi");
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Ürün Admin onayına geri gönderildi.");
                setOpen(false);
                setReason("");
                router.refresh();
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 bg-red-50 text-red-700 border-red-200 hover:bg-red-100">
                    <Ban className="h-3 w-3" />
                    İptal
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-red-600">Ürünü İptal Et</DialogTitle>
                    <DialogDescription>
                        <b>{productName}</b> ürününü iptal etmek üzeresiniz. Ürün Admin onayına geri gönderilecek.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Textarea
                        placeholder="İptal nedeni (opsiyonel)..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button>
                    <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
                        {isPending ? "İşleniyor..." : "İptal Et ve Admin'e Gönder"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
