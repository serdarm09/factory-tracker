'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function searchCatalog(query: string) {
    const session = await auth();
    if (!session) return [];

    if (!query || query.length < 2) return [];
    return await prisma.productCatalog.findMany({
        where: {
            OR: [
                { code: { contains: query } },
                { name: { contains: query } }
            ]
        },
        take: 20
    });
}

export async function getAttributes(category: string) {
    return await prisma.productFeature.findMany({
        where: { category },
        orderBy: { name: 'asc' }
    });
}

export async function getMasters() {
    return await getAttributes('MASTER');
}

export async function ensureAttributes() {
    // Seed basic attributes if empty
    const count = await prisma.productFeature.count();
    if (count === 0) {
        const defaults = [
            // Foot Model (Ayak Modeli)
            { category: 'FOOT_TYPE', name: 'Lukens' },
            { category: 'FOOT_TYPE', name: 'Piramit' },
            { category: 'FOOT_TYPE', name: 'Koni' },

            // Foot Material (Ayak Materyali)
            { category: 'FOOT_MATERIAL', name: 'Ahşap - Ceviz' },
            { category: 'FOOT_MATERIAL', name: 'Ahşap - Meşe' },
            { category: 'FOOT_MATERIAL', name: 'Metal - Krom' },
            { category: 'FOOT_MATERIAL', name: 'Metal - Siyah' },
            { category: 'FOOT_MATERIAL', name: 'Plastik' },

            // Arm
            { category: 'ARM_TYPE', name: 'P-Kol' },
            { category: 'ARM_TYPE', name: 'T-Kol' },
            { category: 'ARM_TYPE', name: 'Ahşap Kol' },

            // Back
            { category: 'BACK_TYPE', name: 'Sabit' },
            { category: 'BACK_TYPE', name: 'Mekanizmalı' },
            { category: 'BACK_TYPE', name: 'Kapitone' },

            // Fabric
            { category: 'FABRIC_TYPE', name: 'Kadife - Gri' },
            { category: 'FABRIC_TYPE', name: 'Kadife - Bej' },
            { category: 'FABRIC_TYPE', name: 'Keten - Antrasit' },
            { category: 'FABRIC_TYPE', name: 'Deri - Siyah' },
        ];
        for (const d of defaults) {
            await prisma.productFeature.create({ data: d });
        }
    }
}
