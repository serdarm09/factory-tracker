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
import { EditCatalogDialog } from "@/components/edit-catalog-dialog";

interface FeatureManagerProps {
    userRole: string;
}

const CATEGORIES: { key: FeatureCategory; label: string }[] = [
    { key: "FOOT_TYPE", label: "Ayak Modeli" },
    { key: "FOOT_MATERIAL", label: "Ayak Özelliği (Materyal)" },
    { key: "ARM_TYPE", label: "Kol Modeli" },
    { key: "BACK_TYPE", label: "Sırt Modeli" },
    { key: "FABRIC_TYPE", label: "Kumaş Türü" },
    { key: "MODEL", label: "Model" },
];

export function FeatureManager({ userRole }: FeatureManagerProps) {
    const [activeTab, setActiveTab] = useState<FeatureCategory | "CATALOG">("CATALOG");
    const [features, setFeatures] = useState<{ id: number; name: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [newFeature, setNewFeature] = useState("");
    const [adding, setAdding] = useState(false);

    const fetchFeatures = async (category: FeatureCategory | "CATALOG") => {
        if (category === "CATALOG") return; // Handled separately
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
        if (activeTab === "CATALOG") return;
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
        if (activeTab === "CATALOG") return;
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
    const [catalogItems, setCatalogItems] = useState<{ id: number; code: string; name: string; imageUrl?: string | null }[]>([]);
    const [newCatalogCode, setNewCatalogCode] = useState("");
    const [newCatalogName, setNewCatalogName] = useState("");
    const [newCatalogImage, setNewCatalogImage] = useState<File | null>(null);
    const [catalogLoading, setCatalogLoading] = useState(false);

    // Pagination & Search State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");

    // Debounce search
    useEffect(() => {
        if (activeTab === "CATALOG") {
            const timer = setTimeout(() => {
                loadCatalog(1, searchQuery);
            }, 500);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, activeTab]);

    const loadCatalog = async (p: number, q: string) => {
        setCatalogLoading(true);
        try {
            const { getCatalog } = require("@/lib/catalog-actions");
            const { items, totalPages: pages } = await getCatalog(p, q);
            setCatalogItems(items);
            setTotalPages(pages);
            setPage(p);
        } catch (e) {
            // toast.error("Katalog yüklenemedi");
        } finally {
            setCatalogLoading(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            loadCatalog(newPage, searchQuery);
        }
    }

    const handleAddCatalog = async () => {
        if (!newCatalogCode.trim() || !newCatalogName.trim()) {
            toast.error("Kod ve İsim gereklidir");
            return;
        }
        if (!newCatalogImage) {
            toast.error("Ürün resmi zorunludur");
            return;
        }

        setAdding(true);
        const { addToCatalog } = require("@/lib/catalog-actions");

        const formData = new FormData();
        formData.append("code", newCatalogCode);
        formData.append("name", newCatalogName);
        formData.append("image", newCatalogImage);

        const res = await addToCatalog(formData);
        setAdding(false);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success("Kataloğa eklendi");
            setNewCatalogCode("");
            setNewCatalogName("");
            setNewCatalogImage(null);
            // Reset file input via key or ref if needed, but key={} on input is easier
            loadCatalog(1, searchQuery);
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
            loadCatalog(page, searchQuery);
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
                            Sık kullanılan ürünlerin Kod, Ad ve Resim bilgilerini tanımlayın.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Search and Add */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Katalogda Ara..."
                                    className="max-w-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 items-end border-t pt-4 flex-wrap">
                                <div className="grid gap-2 flex-1 min-w-[150px]">
                                    <Label>Yeni Ürün Kodu</Label>
                                    <Input
                                        placeholder="Örn: SANDALYE-X1"
                                        value={newCatalogCode}
                                        onChange={(e) => setNewCatalogCode(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2 flex-[2] min-w-[200px]">
                                    <Label>Yeni Ürün Adı</Label>
                                    <Input
                                        placeholder="Örn: Ahşap Sandalye 2024"
                                        value={newCatalogName}
                                        onChange={(e) => setNewCatalogName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddCatalog()}
                                    />
                                </div>
                                <div className="grid gap-2 flex-1 min-w-[200px]">
                                    <Label>Ürün Resmi <span className="text-red-500">*</span></Label>
                                    <Input
                                        key={newCatalogImage ? "loaded" : "empty"} // Reset hack
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setNewCatalogImage(e.target.files?.[0] || null)}
                                    />
                                </div>
                                <Button onClick={handleAddCatalog} disabled={adding}>
                                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Ekle
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
                            {catalogLoading ? (
                                <div className="col-span-full text-center py-4 text-muted-foreground">Yükleniyor...</div>
                            ) : catalogItems.length === 0 ? (
                                <div className="col-span-full text-center py-4 text-muted-foreground">Kayıt bulunamadı.</div>
                            ) : (
                                catalogItems.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-md bg-card">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {item.imageUrl ? (
                                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-slate-100">
                                                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="h-10 w-10 shrink-0 bg-slate-100 rounded-md border" />
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-sm truncate">{item.code}</span>
                                                <span className="text-sm text-slate-600 truncate" title={item.name}>{item.name}</span>
                                            </div>
                                        </div>
                                        {userRole === "ADMIN" && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <EditCatalogDialog
                                                    product={item}
                                                    onSuccess={() => loadCatalog(page, searchQuery)}
                                                />
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteCatalog(item.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => handlePageChange(page - 1)}
                                >
                                    Önceki
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Sayfa {page} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => handlePageChange(page + 1)}
                                >
                                    Sonraki
                                </Button>
                            </div>
                        )}
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
