'use server';

import prisma from "@/lib/prisma";

// Helper to create audit logs
export async function createAuditLog(action: string, entity: string, entityId: string, details: string, userId: number) {
    try {
        await (prisma as any).auditLog.create({
            data: {
                action,
                entity,
                entityId,
                details,
                userId
            }
        });
    } catch (e) {
        console.error("Audit log creation failed:", e);
    }
}
