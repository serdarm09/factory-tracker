'use plain';
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createUser } from "@/lib/actions";

const initialState: { error?: string; success?: boolean } = {};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Oluşturuluyor..." : "Kullanıcı Oluştur"}
        </Button>
    );
}

export function UserCreateForm() {
    const [state, formAction] = useFormState(createUser, initialState);

    return (
        <Card>
            <CardHeader><CardTitle>Kullanıcı Oluştur</CardTitle></CardHeader>
            <CardContent>
                <form action={formAction} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Kullanıcı Adı</label>
                        <Input name="username" required placeholder="planner1" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Şifre</label>
                        <Input name="password" type="password" required placeholder="***" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Rol</label>
                        <select name="role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            <optgroup label="Genel Roller">
                                <option value="VIEWER">VIEWER (İzleyici)</option>
                                <option value="PLANNER">PLANNER (Planlamacı)</option>
                                <option value="ENGINEER">ENGINEER (Üretim Mühendisi)</option>
                                <option value="MARKETER">MARKETER (Pazarlamacı)</option>
                                <option value="WAREHOUSE">WAREHOUSE (Depo Sorumlusu)</option>
                                <option value="WORKER">WORKER (Sevkiyatçı)</option>
                                <option value="ADMIN">ADMIN (Yönetici)</option>
                            </optgroup>
                            <optgroup label="Yarı Mamül Rolleri">
                                <option value="METAL">METAL (Metal Üretim)</option>
                                <option value="KONFEKSIYON">KONFEKSIYON (Konfeksiyon Üretim)</option>
                                <option value="AHSAP_BOYA">AHSAP_BOYA (Ahşap Boya Üretim)</option>
                                <option value="AHSAP_ISKELET">AHSAP_ISKELET (Ahşap İskelet Üretim)</option>
                            </optgroup>
                        </select>
                    </div>

                    {state?.error && (
                        <div className="p-3 text-sm text-red-600 bg-red-100 rounded-md">
                            {state.error}
                        </div>
                    )}
                    {state?.success && (
                        <div className="p-3 text-sm text-green-600 bg-green-100 rounded-md">
                            Kullanıcı başarıyla oluşturuldu.
                        </div>
                    )}

                    <SubmitButton />
                </form>
            </CardContent>
        </Card>
    );
}
