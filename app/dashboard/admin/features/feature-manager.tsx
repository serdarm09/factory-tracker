"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { addFeature, deleteFeature, getFeatures, FeatureCategory } from "@/lib/feature-actions";
import { X, Plus, Loader2 } from "lucide-react";

interface FeatureManagerProps {
    userRole: string;
}

const CATEGORIES: { key: FeatureCategory; label: string }[] = [
    { key: "FOOT_TYPE", label: "Ayak Modeli" },
    { key: "FOOT_MATERIAL", label: "Ayak Özelliği (Materyal)" },
    { key: "ARM_TYPE", label: "Kol Modeli" },
    { key: "BACK_TYPE", label: "Sırt Modeli" },
    { key: "FABRIC_TYPE", label: "Kumaş Türü" },
];

export function FeatureManager({ userRole }: FeatureManagerProps) {
    const [activeTab, setActiveTab] = useState<FeatureCategory>("FOOT_TYPE");
    const [features, setFeatures] = useState<{ id: number; name: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [newFeature, setNewFeature] = useState("");
    const [adding, setAdding] = useState(false);

    const fetchFeatures = async (category: FeatureCategory) => {
        setLoading(true);
        try {
            const data = await getFeatures(category);
            setFeatures(data);
        } catch (error) {
            toast.error("Veriler yüklenemedi");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeatures(activeTab);
    }, [activeTab]);

    const handleAdd = async () => {
        if (!newFeature.trim()) return;
        setAdding(true);
        const res = await addFeature(activeTab, newFeature);
        setAdding(false);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success("Eklendi");
            setNewFeature("");
            fetchFeatures(activeTab);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Bu özelliği silmek istediğinize emin misiniz?")) return;

        const res = await deleteFeature(id);
        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success("Silindi");
            fetchFeatures(activeTab);
        }
    };

    // Catalog State
    const [catalogItems, setCatalogItems] = useState<{ id: number; code: string; name: string }[]>([]);
    const [newCatalogCode, setNewCatalogCode] = useState("");
    const [newCatalogName, setNewCatalogName] = useState("");
    const [catalogLoading, setCatalogLoading] = useState(false);

    // Import these dynamically or keep them here if possible
    // Note: In Next.js App Router, using server actions directly in client components is fine if they are 'use server'.
    // Adjusting to direct imports if possible, but 'require' inside component can be tricky.
    // Let's assume catalog-actions are properly exported.
    // For now, I will keep the require but ensure it's used safely or move to top imports if I could.
    // Actually, 'require' inside body might re-require every render. Better to use standard import if possible, 
    // but since I cannot edit top of file easily with this chunk, I will stick to what was attempted but fix the structure.
    // Actually, I can use the imported actions if I add them to imports, but I'll stick to 'require' for now to match the intent 
    // OR better, I should just assume standard imports are available if I added them to top.
    // Wait, I didn't add them to top. I will use `require` inside useEffect or handlers to avoid issues, or just use `require` once.
    // However, `catalog-actions` is a server action file.

    // To fix the build error immediately, I will use require inside the functions or useEffect to ensure it's available.
    // Or simpler: I will assume the previous 'require' strategy was desired, but place it correctly.

    // BETTER STRATEGY: I will use a separate useEffect to load catalog actions to avoid "require" issues if any.
    // But simplest fix for the syntax error is just code structure.

    useEffect(() => {
        if (activeTab === "CATALOG") {
            const { getCatalog } = require("@/lib/catalog-actions");
            const load = async () => {
                setCatalogLoading(true);
                try {
                    const data = await getCatalog();
                    setCatalogItems(data);
                } catch (e) { toast.error("Katalog yüklenemedi"); }
                finally { setCatalogLoading(false); }
            };
            load();
        }
    }, [activeTab]);

    const handleAddCatalog = async () => {
        if (!newCatalogCode.trim() || !newCatalogName.trim()) {
            toast.error("Kod ve İsim gereklidir");
            return;
        }
        setAdding(true);
        const { addToCatalog } = require("@/lib/catalog-actions");
        const res = await addToCatalog(newCatalogCode, newCatalogName);
        setAdding(false);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success("Kataloğa eklendi");
            setNewCatalogCode("");
            setNewCatalogName("");
            // Reload
            const { getCatalog } = require("@/lib/catalog-actions");
            const data = await getCatalog();
            setCatalogItems(data);
        }
    };

    const handleDeleteCatalog = async (id: number) => {
        if (!confirm("Bu ürünü katalogdan silmek istediğinize emin misiniz?")) return;
        const { deleteFromCatalog } = require("@/lib/catalog-actions");
        const res = await deleteFromCatalog(id);
        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success("Silindi");
            // Reload
            const { getCatalog } = require("@/lib/catalog-actions");
            const data = await getCatalog();
            setCatalogItems(data);
        }
    };

    return (
        <Tabs defaultValue="CATALOG" onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
            <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="CATALOG" className="font-bold">Ürün Kataloğu</TabsTrigger>
                {CATEGORIES.map((cat) => (
                    <TabsTrigger key={cat.key} value={cat.key}>{cat.label}</TabsTrigger>
                ))}
            </TabsList>

            <TabsContent value="CATALOG">
                <Card>
                    <CardHeader>
                        <CardTitle>Ürün Kataloğu Yönetimi</CardTitle>
                        <CardDescription>
                            Sık kullanılan ürünlerin Kod ve Ad bilgilerini tanımlayın.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2 items-end">
                            <div className="grid gap-2 flex-1">
                                <Label>Ürün Kodu</Label>
                                <Input
                                    placeholder="Örn: SANDALYE-X1"
                                    value={newCatalogCode}
                                    onChange={(e) => setNewCatalogCode(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2 flex-[2]">
                                <Label>Ürün Adı</Label>
                                <Input
                                    placeholder="Örn: Ahşap Sandalye 2024"
                                    value={newCatalogName}
                                    onChange={(e) => setNewCatalogName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleAddCatalog()}
                                />
                            </div>
                            <Button onClick={handleAddCatalog} disabled={adding}>
                                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Ekle
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
                            {catalogLoading ? (
                                <div className="col-span-full text-center py-4 text-muted-foreground">Yükleniyor...</div>
                            ) : catalogItems.length === 0 ? (
                                <div className="col-span-full text-center py-4 text-muted-foreground">Kayıtlı ürün yok.</div>
                            ) : (
                                catalogItems.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-md bg-card">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{item.code}</span>
                                            <span className="text-sm text-slate-600 truncate" title={item.name}>{item.name}</span>
                                        </div>
                                        {userRole === "ADMIN" && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" onClick={() => handleDeleteCatalog(item.id)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {CATEGORIES.map((cat) => (
                <TabsContent key={cat.key} value={cat.key}>
                    <Card>
                        <CardHeader>
                            <CardTitle>{cat.label} Yönetimi</CardTitle>
                            <CardDescription>
                                Bu kategori için geçerli seçenekleri listeyin.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder={`Yeni ${cat.label} ekle...`}
                                    value={newFeature}
                                    onChange={(e) => setNewFeature(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                                />
                                <Button onClick={handleAdd} disabled={adding}>
                                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Ekle
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
                                {loading ? (
                                    <div className="col-span-full text-center py-4 text-muted-foreground">Yükleniyor...</div>
                                ) : features.length === 0 ? (
                                    <div className="col-span-full text-center py-4 text-muted-foreground">Kayıtlı özellik yok.</div>
                                ) : (
                                    features.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-2 border rounded-md bg-card">
                                            <span>{item.name}</span>
                                            {userRole === "ADMIN" && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            ))}
        </Tabs>
    );
}
