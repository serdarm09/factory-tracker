'use client';

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveProduct } from "@/lib/actions";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

export function ApprovalButton({ productId }: { productId: number }) {
    const [isPending, startTransition] = useTransition();

    const handleApprove = () => {
        startTransition(async () => {
            const res = await approveProduct(productId);

            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Ürün onaylandı.");
            }
        });
    };

    return (
        <Button
            variant="outline"
            size="sm"
            className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
            onClick={handleApprove}
            disabled={isPending}
        >
            <CheckCircle className="h-4 w-4 mr-1" />
            {isPending ? "Onaylanıyor..." : "Onayla"}
        </Button>
    );
}
