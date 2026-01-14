import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCreateForm } from "./create-user-form";
import { deleteUser } from "@/lib/actions";

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
                                            {u.username !== 'admin' && (
                                                <form action={deleteUser.bind(null, u.id)}>
                                                    <Button variant="destructive" size="sm">Sil</Button>
                                                </form>
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
