'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { PlanningForm } from "./planning-form";
import { Pencil } from "lucide-react";

interface EditProductDialogProps {
    product: any; // Using any for now to avoid complexity with Prisma types on client
}

export function EditProductDialog({ product }: EditProductDialogProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                    <Pencil className="h-3 w-3" />
                    Düzenle
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Mevcut Planı Düzenle</DialogTitle>
                    <DialogDescription>
                        Reddedilen veya hatalı girilen planı buradan güncelleyebilirsiniz.
                        Güncelleme sonrası ürün durumu tekrar değerlendirilecektir.
                    </DialogDescription>
                </DialogHeader>
                <PlanningForm product={product} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
