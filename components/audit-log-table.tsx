"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface AuditLog {
    id: number
    userId: number
    user: { username: string }
    action: string
    entity: string
    entityId: string
    details: string | null
    createdAt: Date
}

export function AuditLogTable({ logs }: { logs: AuditLog[] }) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Kullanıcı</TableHead>
                        <TableHead>İşlem</TableHead>
                        <TableHead>Bölüm</TableHead>
                        <TableHead>Kayıt ID</TableHead>
                        <TableHead>Detay</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => (
                        <TableRow key={log.id}>
                            <TableCell className="font-medium">
                                {new Date(log.createdAt).toLocaleString("tr-TR")}
                            </TableCell>
                            <TableCell>{log.user.username}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={
                                    log.action === "CREATE" ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                        log.action === "UPDATE" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                                            log.action === "DELETE" ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                                log.action === "APPROVE" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                                                    "bg-gray-100 text-gray-700 hover:bg-gray-100"
                                }>
                                    {log.action}
                                </Badge>
                            </TableCell>
                            <TableCell>{log.entity}</TableCell>
                            <TableCell className="font-mono text-xs">{log.entityId}</TableCell>
                            <TableCell className="max-w-[300px] truncate" title={log.details || ""}>
                                {log.details}
                            </TableCell>
                        </TableRow>
                    ))}
                    {logs.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-4 text-slate-500">
                                Henüz kayıt yok.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
