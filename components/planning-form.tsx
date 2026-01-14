'use client';

import { createProduct } from "@/lib/actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRef } from "react";

export function PlanningForm() {
    const formRef = useRef<HTMLFormElement>(null);

    async function clientAction(formData: FormData) {
        const res = await createProduct(formData);
        if (res?.error) {
            toast.error(res.error);
        } else {
            toast.success("Ürün başarıyla plana eklendi");
            formRef.current?.reset();
        }
    }

    return (
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Ürün Adı</Label>
                    <Input id="name" name="name" required placeholder="Sandalye X1" maxLength={100} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" name="model" required placeholder="V2024" maxLength={50} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="company">Firma / Müşteri</Label>
                <Input id="company" name="company" placeholder="ABC Mobilya" maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="quantity">Adet</Label>
                    <Input id="quantity" name="quantity" type="number" required min="1" max="100000" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="systemCode">Sistem Kodu</Label>
                    <Input id="systemCode" name="systemCode" required placeholder="SYS-001" maxLength={20} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="terminDate">Termin Tarihi</Label>
                <Input id="terminDate" name="terminDate" type="date" required min={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="material">Malzeme / Kumaş / Deri</Label>
                <Input id="material" name="material" placeholder="Örn: Nubuk Deri, Gri Kumaş..." maxLength={100} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Açıklama / Müşteri Notu</Label>
                <textarea
                    id="description"
                    name="description"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Ekstra istekler, dikiş detayları vb. (Max 500 karakter)"
                    maxLength={500}
                />
            </div>

            <Button type="submit" className="w-full">Plana Ekle</Button>
        </form >
    );
}
