"use client";

import { useState } from "react";
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
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { importCatalogItems } from "@/lib/catalog-actions";

import { useRouter } from "next/navigation";

interface CatalogImportDialogProps {
    onSuccess?: () => void;
}

export function CatalogImportDialog({ onSuccess }: CatalogImportDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const router = useRouter();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error("Lütfen bir Excel dosyası seçin");
            return;
        }

        setLoading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            // Validate and map data
            // Expected columns: "Kod" (or "Code"), "Ad" (or "Name")
            const items: { code: string; name: string }[] = [];
            let skipped = 0;

            for (const row of jsonData as any[]) {
                // Try to find code and name columns loosely
                const code = row["Kod"] || row["Code"] || row["kod"] || row["code"] || row["Ürün Kodu"];
                const name = row["Ad"] || row["Name"] || row["ad"] || row["name"] || row["Ürün Adı"];

                if (code && name) {
                    items.push({ code: String(code), name: String(name) });
                } else {
                    skipped++;
                }
            }

            if (items.length === 0) {
                toast.error("Dosyada geçerli veri bulunamadı. 'Kod' ve 'Ad' sütunları olduğundan emin olun.");
                setLoading(false);
                return;
            }

            const res = await importCatalogItems(items);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success(`${res.count} ürün başarıyla eklendi/güncellendi. (${res.failed} hata)`);
                setOpen(false);
                setFile(null);
                router.refresh();
                if (onSuccess) onSuccess();
            }

        } catch (error) {
            console.error(error);
            toast.error("Dosya işlenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const downloadExample = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([
            { "Kod": "ABC-100", "Ad": "Örnek Ürün A" },
            { "Kod": "XYZ-200", "Ad": "Örnek Ürün B" }
        ]);
        XLSX.utils.book_append_sheet(wb, ws, "Katalog");
        XLSX.writeFile(wb, "ornek-katalog.xlsx");
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel İle Yükle
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Excel ile Katalog Yükle</DialogTitle>
                    <DialogDescription>
                        Excel dosyası (.xlsx, .xls) seçin. Dosyada <strong>Kod</strong> ve <strong>Ad</strong> sütunları olmalıdır.
                        <br />
                        <Button variant="link" className="p-0 h-auto font-normal text-blue-500" onClick={downloadExample}>Örnek Şablon İndir</Button>
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="file">Excel Dosyası</Label>
                        <Input
                            id="file"
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleUpload} disabled={loading || !file}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Yükle
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
