import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const cursorId = searchParams.get("cursorId");
        const take = searchParams.get("take") ? parseInt(searchParams.get("take") as string) : undefined;

        let whereClause: any = {};

        if (from || to) {
            whereClause.createdAt = {};
            if (from) whereClause.createdAt.gte = new Date(from);
            if (to) whereClause.createdAt.lte = new Date(to);
        }

        let queryOptions: any = {
            where: whereClause,
            include: {
                rawMaterial: true,
                user: { select: { username: true } }
            },
            orderBy: { createdAt: 'desc' }
        };

        if (take) {
            queryOptions.take = take;
        }

        if (cursorId) {
            queryOptions.cursor = { id: parseInt(cursorId) };
            queryOptions.skip = 1;
        }

        const logs = await (prisma as any).rawMaterialLog.findMany(queryOptions);

        return NextResponse.json(logs);
    } catch (error) {
        console.error("Error fetching raw material logs:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
