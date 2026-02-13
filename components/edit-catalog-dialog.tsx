'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateCatalogItem, getProductComponents, updateProductComponents } from "@/lib/catalog-actions";
import { toast } from "sonner";
import { Pencil, Loader2, Plus, Trash2 } from "lucide-react";

interface EditCatalogDialogProps {
    product: {
        id: number;
        code: string;
        name: string;
        imageUrl?: string | null;
    };
    onSuccess?: () => void;
}

// Bileşen kategorileri (Excel'den alınan)
const COMPONENT_CATEGORIES = [
    'DÖKME SÜNGER',
    'METAL AYAK',
    'METAL KOL',
    'METAL İSKELET',
    'METAL MEKANİZMA',
    'AKŞAP İSKELET',
    'KONTRA',
    'AHŞAP CNC',
    'AHŞAP KOL+KLAPA BOYA ',
    'AHŞAP AYAK BOYA ',
    'TELESKOP KÖRÜK PLS',
    'AYAK PLS',
    'KOL PLS',
    'OTURAK+SIRT PLS',
    'KONFEKSİYON',
    'DIŞ TEDARİK(KLAPA)',
    'DIŞ TEDARİK(İSKELET)',
    'DIŞ TEDARİK1',
    'DIŞ TEDARİK2',
    'DIŞ TEDARİK3'
];

export function EditCatalogDialog({ product, onSuccess }: EditCatalogDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(product.name);
    const [code, setCode] = useState(product.code);
    const [image, setImage] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [componentsLoading, setComponentsLoading] = useState(false);
    const [components, setComponents] = useState<{ [key: string]: string }>({});

    // Bileşenleri yükle
    useEffect(() => {
        if (open) {
            setComponentsLoading(true);
            getProductComponents(product.name)
                .then((data) => {
                    const componentsMap: { [key: string]: string } = {};
                    data.forEach((comp: any) => {
                        componentsMap[comp.category] = comp.value;
                    });
                    setComponents(componentsMap);
                })
                .finally(() => {
                    setComponentsLoading(false);
                });
        }
    }, [open, product.name]);

    async function handleSave() {
        if (!name.trim() || !code.trim()) {
            toast.error("Kod ve isim gereklidir");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("code", code);
            formData.append("name", name);
            if (image) {
                formData.append("image", image);
            }

            const res = await updateCatalogItem(product.id, formData);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Katalog ürünü güncellendi");
                setOpen(false);
                if (onSuccess) onSuccess();
            }
        } catch (e) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveComponents() {
        setLoading(true);
        try {
            const res = await updateProductComponents(product.name, components);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Bileşenler güncellendi");
            }
        } catch (e) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    }

    const updateComponent = (category: string, value: string) => {
        setComponents(prev => ({
            ...prev,
            [category]: value
        }));
    };

    const removeComponent = (category: string) => {
        setComponents(prev => {
            const newComponents = { ...prev };
            delete newComponents[category];
            return newComponents;
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Katalog Ürününü Düzenle</DialogTitle>
                    <DialogDescription>
                        Ürün bilgilerini, resmini ve yarı mamüllerini buradan güncelleyebilirsiniz.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="components">Yarı Mamüller</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4 mt-4">
                        <div className="grid gap-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="code" className="text-right">
                                    Kod
                                </Label>
                                <Input
                                    id="code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    İsim
                                </Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="image" className="text-right">
                                    Resim
                                </Label>
                                <div className="col-span-3">
                                    <Input
                                        id="image"
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setImage(e.target.files?.[0] || null)}
                                    />
                                    {product.imageUrl && !image && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Mevcut resim korunacak. Değiştirmek için yeni dosya seçin.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" onClick={handleSave} disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Kaydet
                            </Button>
                        </DialogFooter>
                    </TabsContent>

                    <TabsContent value="components" className="space-y-4 mt-4">
                        {componentsLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                    {COMPONENT_CATEGORIES.map(category => (
                                        <div key={category} className="flex items-center gap-2">
                                            <Label className="w-[200px] text-xs">{category}</Label>
                                            <Input
                                                placeholder="Değer girin (boş bırakılabilir)"
                                                value={components[category] || ''}
                                                onChange={(e) => updateComponent(category, e.target.value)}
                                                className="flex-1"
                                            />
                                            {components[category] && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => removeComponent(category)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <DialogFooter>
                                    <Button type="button" onClick={handleSaveComponents} disabled={loading}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Bileşenleri Kaydet
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
