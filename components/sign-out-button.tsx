'use client';
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
    return (
        <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-4 py-2 w-full text-left text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
        >
            <LogOut className="w-5 h-5" />
            <h6>Çıkış yap(Güvenli Çıkış)</h6>
        </button>
    )
}
