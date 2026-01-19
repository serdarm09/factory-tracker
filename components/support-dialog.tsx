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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createSupportTicket } from "@/lib/support-actions";
import { LifeBuoy, Loader2 } from "lucide-react";

export function SupportTicketDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        try {
            const res = await createSupportTicket(formData);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Destek talebi oluşturuldu");
                setOpen(false);
            }
        } catch (error) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div role="button" className="flex items-center gap-3 rounded-lg px-3 py-2 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all cursor-pointer font-medium">
                    <LifeBuoy className="h-4 w-4" />
                    Destek Talebi
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Destek Talebi Oluştur</DialogTitle>
                    <DialogDescription>
                        Karşılaştığınız sorunu veya önerinizi bize iletin.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Konu Başlığı</Label>
                        <Input id="title" name="title" required placeholder="Örn: Barkod okuma hatası" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="priority">Öncelik</Label>
                        <Select name="priority" defaultValue="NORMAL">
                            <SelectTrigger>
                                <SelectValue placeholder="Öncelik Seç" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LOW">Düşük</SelectItem>
                                <SelectItem value="NORMAL">Normal</SelectItem>
                                <SelectItem value="HIGH">Yüksek</SelectItem>
                                <SelectItem value="URGENT">Acil</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Açıklama</Label>
                        <Textarea
                            id="description"
                            name="description"
                            required
                            placeholder="Detaylı açıklama..."
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Gönder
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
