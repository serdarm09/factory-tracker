import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCreateForm } from "./create-user-form";
// deleteUser import removed as it is used in the client component now, OR kept if needed elsewhere, but mainly need to import the new button
import { DeleteUserButton } from "@/components/delete-user-button";

export default async function UsersPage() {
    const session = await auth();
    if ((session?.user as any).role !== "ADMIN") {
        redirect("/dashboard");
    }

    const users = await prisma.user.findMany();

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Kullanıcı Yönetimi</h2>

            <div className="grid gap-4 md:grid-cols-2">
                <UserCreateForm />

                <Card>
                    <CardHeader><CardTitle>Mevcut Kullanıcılar</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kullanıcı Adı</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>İşlem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(u => (
                                    <TableRow key={u.id}>
                                        <TableCell>{u.username}</TableCell>
                                        <TableCell>{u.role}</TableCell>
                                        <TableCell>
                                            {u.id !== parseInt((session?.user as any)?.id) && (
                                                <DeleteUserButton userId={u.id} />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
