import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AuditLogTable } from "@/components/audit-log-table";
import { redirect } from "next/navigation";

export default async function AuditLogsPage() {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
        redirect("/");
    }

    const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            user: {
                select: { username: true }
            }
        },
        take: 100 // Limit to last 100 logs
    });

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">İşlem Geçmişi (Audit Logs)</h2>
            </div>
            <div className="h-full flex-1 flex-col space-y-8 md:flex">
                <AuditLogTable logs={logs} />
            </div>
        </div>
    );
}
