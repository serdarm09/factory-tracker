'use client';

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { XCircle, Loader2 } from "lucide-react";

type RejectButtonProps = {
    action: (reason: string) => Promise<any>;
    disabled?: boolean;
};

export function RejectButton({ action, disabled }: RejectButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        const reason = prompt("Red nedeni giriniz:", "Uygunsuz ürün");
        if (!reason) return; // Cancelled

        startTransition(async () => {
            const res = await action(reason);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Ürün reddedildi");
            }
        });
    };

    return (
        <Button
            onClick={handleClick}
            disabled={disabled || isPending}
            variant="destructive"
            size="sm"
            className="ml-2"
        >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Reddet
        </Button>
    );
}
