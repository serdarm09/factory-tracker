import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    const items = await (prisma as any).semiFinished.findMany({
        orderBy: { name: "asc" },
        select: {
            id: true,
            name: true,
            code: true,
            quantity: true,
            unit: true,
            category: true,
            minStock: true,
        },
    });
    return NextResponse.json(items);
}
