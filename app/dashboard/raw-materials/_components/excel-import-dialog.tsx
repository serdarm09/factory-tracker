import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RawMaterialCategory } from "@prisma/client";
import { FileUp, Loader2, Download } from "lucide-react";
import { importRawMaterialsFromExcel } from "@/app/actions/raw-material-actions";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export function ExcelImportDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [category, setCategory] = useState<RawMaterialCategory | "">("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        if (!file) {
            toast.error("Lütfen bir Excel dosyası seçin.");
            return;
        }
        if (!category) {
            toast.error("Lütfen hedeflenen hammadde kategorisini seçin.");
            return;
        }

        setLoading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Excel to raw Array of Arrays
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            // Send payload to the server action
            const res = await importRawMaterialsFromExcel(rawData, category as RawMaterialCategory);

            if (res.success) {
                toast.success(`Başarılı: ${res.created} yeni madde eklendi, ${res.updated} madde güncellendi.`);
                setOpen(false);
                setFile(null);
                setCategory("");
            } else {
                toast.error(res.error || "İçe aktarım sırasında bir hata oluştu.");
            }
        } catch (error: any) {
            toast.error("Dosya okunamadı: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                    <FileUp className="w-4 h-4" />
                    Excel'den Yükle
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Excel'den Hammadde Yükle/Güncelle</DialogTitle>
                    <DialogDescription>
                        Farklı formattaki ambar sayım Excel dosyalarınızı yükleyebilirsiniz. Sistem stok adlarını, kalan miktarı ve min/max değerlerini otomatik algılayıp mevcut olanları güncelleyecek, olmayanları yeni listeleyecektir.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-end mt-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 flex items-center gap-2"
                        onClick={() => window.open('/api/download-raw-material-template', '_blank')}
                    >
                        <Download className="w-4 h-4" />
                        Örnek Şablonu İndir
                    </Button>
                </div>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>1. Kategori Seçimi</Label>
                        <Select value={category} onValueChange={(v: RawMaterialCategory) => setCategory(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Yüklenen listenin kategorisini seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.values(RawMaterialCategory) as string[]).map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat.replace(/_/g, " ")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>2. Excel Dosyası Seç</Label>
                        <div className="border border-dashed border-slate-300 rounded-md p-4 bg-slate-50 text-center">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                    <Button onClick={handleImport} disabled={loading || !file || !category}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        İçe Aktarmayı Başlat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
