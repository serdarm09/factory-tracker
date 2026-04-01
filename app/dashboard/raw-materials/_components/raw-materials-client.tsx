"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockTab } from "./stock-tab";
import { RequestsTab } from "./requests-tab";
import { PurchasesTab } from "./purchases-tab";
import { MovementsTab } from "./movements-tab";
import { Layers, ListChecks, ShoppingCart, Activity } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";

export default function RawMaterialsClient({
    initialRawMaterials,
    initialMaterialRequests,
    initialPurchaseRequests,
    initialRawMaterialLogs,
    currentUser
}: {
    initialRawMaterials: any[];
    initialMaterialRequests: any[];
    initialPurchaseRequests: any[];
    initialRawMaterialLogs: any[];
    currentUser: { id: number; role?: string };
}) {
    const rawMaterials = initialRawMaterials;
    const materialRequests = initialMaterialRequests;
    const purchaseRequests = initialPurchaseRequests;
    const rawMaterialLogs = initialRawMaterialLogs;

    // Check if there are any pending material requests
    const pendingRequestCount = materialRequests.filter((r: any) => r.status === "PENDING").length;

    return (
        <div className="space-y-6">
            <AutoRefresh intervalMs={30000} />
            <Tabs defaultValue="stock" className="space-y-6">
            <TabsList className="bg-slate-200 p-1 flex w-fit gap-2">
                <TabsTrigger value="stock" className="flex items-center gap-2 data-[state=active]:bg-white">
                    <Layers className="w-4 h-4" />
                    <span>Stok Takibi</span>
                </TabsTrigger>
                <TabsTrigger value="requests" className="relative flex items-center gap-2 data-[state=active]:bg-white">
                    <ListChecks className="w-4 h-4" />
                    <span>Gelen Talepler</span>
                    {pendingRequestCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                    )}
                </TabsTrigger>
                <TabsTrigger value="purchases" className="flex items-center gap-2 data-[state=active]:bg-white">
                    <ShoppingCart className="w-4 h-4" />
                    <span>Satın Alma Talepleri</span>
                </TabsTrigger>
                <TabsTrigger value="movements" className="flex items-center gap-2 data-[state=active]:bg-white">
                    <Activity className="w-4 h-4" />
                    <span>Hareketler</span>
                </TabsTrigger>
            </TabsList>

            <TabsContent value="stock" className="m-0">
                <StockTab rawMaterials={rawMaterials} currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="requests" className="m-0">
                <RequestsTab materialRequests={materialRequests} rawMaterials={rawMaterials} currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="purchases" className="m-0">
                <PurchasesTab purchaseRequests={purchaseRequests} rawMaterials={rawMaterials} currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="movements" className="m-0">
                <MovementsTab logs={rawMaterialLogs} />
            </TabsContent>
        </Tabs>
        </div>
    );
}
