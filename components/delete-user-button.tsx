"use client";

import { deleteUser } from "@/lib/actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function DeleteUserButton({ userId }: { userId: number }) {
    const [loading, setLoading] = useState(false);

    async function handleDelete(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await deleteUser(userId);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Kullanıcı silindi");
            }
        } catch (error) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleDelete}>
            <Button variant="destructive" size="sm" disabled={loading}>
                {loading ? "..." : "Sil"}
            </Button>
        </form>
    );
}
