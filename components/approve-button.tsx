'use client';

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ApproveButtonProps {
    action: () => Promise<any>;
    label: string;
}

export function ApproveButton({ action, label }: ApproveButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        if (window.confirm("Bu işlemi onayladığınıza emin misiniz?")) {
            try {
                const res = await action();
                if (res?.error) {
                    toast.error(res.error);
                } else {
                    toast.success("İşlem başarılı");
                }
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <Button onClick={handleClick} size="sm" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {label}
        </Button>
    );
}
