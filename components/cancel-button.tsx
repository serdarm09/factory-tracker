'use client';

import { cancelProduct } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function CancelProductButton({ id }: { id: number }) {
    const [loading, setLoading] = useState(false);

    async function handleCancel() {
        if (!confirm("Bu planı iptal etmek (silmek) istediğinize emin misiniz?")) return;

        setLoading(true);
        try {
            const res = await cancelProduct(id);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Plan iptal edildi");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <Button variant="destructive" size="sm" onClick={handleCancel} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            İptal
        </Button>
    );
}
