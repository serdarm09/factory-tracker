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
import { rejectProduct } from "@/lib/actions";
import { toast } from "sonner";
import { XCircle } from "lucide-react";

interface RejectionDialogProps {
    productId: number;
    productName: string;
}

export function RejectionDialog({ productId, productName }: RejectionDialogProps) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [isPending, startTransition] = useTransition();

    const handleReject = () => {
        if (!reason) {
            toast.error("Lütfen red nedeni giriniz.");
            return;
        }

        startTransition(async () => {
            const res = await rejectProduct(productId, reason);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Ürün reddedildi.");
                setOpen(false);
                setReason("");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    <XCircle className="h-4 w-4 mr-1" />
                    Reddet
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Ürünü Reddet</DialogTitle>
                    <DialogDescription>
                        <b>{productName}</b> ürününü reddetmek üzeresiniz. Lütfen nedenini belirtiniz.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Textarea
                        placeholder="Red nedeni..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                    <Button variant="destructive" onClick={handleReject} disabled={isPending}>
                        {isPending ? "İşleniyor..." : "Reddet"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
