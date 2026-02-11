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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key } from "lucide-react";
import { changeUserPassword } from "@/lib/actions";
import { toast } from "sonner";

interface ChangePasswordButtonProps {
    userId: number;
    username: string;
}

export function ChangePasswordButton({ userId, username }: ChangePasswordButtonProps) {
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error("Şifreler eşleşmiyor");
            return;
        }

        if (password.length < 4) {
            toast.error("Şifre en az 4 karakter olmalıdır");
            return;
        }

        setLoading(true);
        try {
            const result = await changeUserPassword(userId, password);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(`${username} kullanıcısının şifresi değiştirildi`);
                setOpen(false);
                setPassword("");
                setConfirmPassword("");
            }
        } catch (e) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                    <Key className="h-3 w-3" />
                    Şifre
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Şifre Değiştir</DialogTitle>
                    <DialogDescription>
                        {username} kullanıcısının şifresini değiştirin
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">Yeni Şifre</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Yeni şifre"
                            required
                            minLength={4}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Şifreyi tekrar girin"
                            required
                            minLength={4}
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
