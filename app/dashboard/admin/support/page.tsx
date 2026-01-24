import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { updateTicketStatus, deleteTicket } from "@/lib/support-actions";
import { Trash2, CheckCircle, XCircle } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function SupportPage() {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
        redirect("/dashboard");
    }

    const tickets = await (prisma as any).supportTicket.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: true }
    });

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Destek Talepleri</h2>
            <AutoRefresh intervalMs={30000} />

            <div className="grid gap-4">
                {tickets.length === 0 ? (
                    <div className="text-muted-foreground">Henüz destek talebi yok.</div>
                ) : (
                    tickets.map((ticket: any) => (
                        <Card key={ticket.id} className={`border-l-4 ${ticket.priority === 'URGENT' ? 'border-l-red-500' : ticket.priority === 'HIGH' ? 'border-l-orange-500' : 'border-l-blue-500'}`}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {ticket.title}
                                            <Badge variant={ticket.status === 'OPEN' ? 'default' : 'secondary'}>
                                                {ticket.status === 'OPEN' ? 'Açık' : 'Kapalı'}
                                            </Badge>
                                            <Badge variant="outline">{ticket.priority}</Badge>
                                        </CardTitle>
                                        <CardDescription>
                                            Gönderen: {ticket.user.username} - {format(ticket.createdAt, "PPP p", { locale: tr })}
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <form action={async () => {
                                            "use server";
                                            if (ticket.status === 'OPEN') {
                                                await updateTicketStatus(ticket.id, 'CLOSED');
                                            } else {
                                                await updateTicketStatus(ticket.id, 'OPEN');
                                            }
                                        }}>
                                            <Button variant="outline" size="sm">
                                                {ticket.status === 'OPEN' ? <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> : <XCircle className="mr-2 h-4 w-4 text-yellow-600" />}
                                                {ticket.status === 'OPEN' ? 'Kapat' : 'Yeniden Aç'}
                                            </Button>
                                        </form>

                                        <form action={async () => {
                                            "use server";
                                            await deleteTicket(ticket.id);
                                        }}>
                                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 p-3 rounded-md">
                                    {ticket.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
