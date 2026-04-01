import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUp, Loader2 } from "lucide-react";
import { importKonfeksiyonStockFromExcel } from "@/app/actions/konfeksiyon-actions";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";

export function KonfeksiyonExcelImportDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [type, setType] = useState<"KUMAS" | "DERI" | "DIGER" | "">("");

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
        if (!type) {
            toast.error("Lütfen hedeflenen kumaş/deri türünü seçin.");
            return;
        }

        setLoading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            const res = await importKonfeksiyonStockFromExcel(rawData, type as any);

            if (res.success) {
                toast.success(`Başarılı: ${res.created} yeni eklendi, ${res.updated} güncellendi.`);
                setOpen(false);
                setFile(null);
                setType("");
                router.refresh();
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
                <Button variant="outline" className="flex items-center gap-2 h-9">
                    <FileUp className="w-4 h-4" />
                    Excel'den Yükle
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Excel'den Kumaş/Deri Yükle</DialogTitle>
                    <DialogDescription>
                        Kumaş veya deri sayım Excel dosyalarınızı yükleyebilirsiniz. Sistem stok adlarını ve kalan miktarı otomatik algılayıp mevcut olanları güncelleyecek, olmayanları yeni listeleyecektir.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>1. Kumaş / Deri Türü</Label>
                        <Select value={type} onValueChange={(v: any) => setType(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Yüklenen listenin ana türünü seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="KUMAS">Kumaş Topları</SelectItem>
                                <SelectItem value="DERI">Deri Rulo / Plaka</SelectItem>
                                <SelectItem value="DIGER">Diğer Malzemeler</SelectItem>
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
                    <Button onClick={handleImport} disabled={loading || !file || !type}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        İçe Aktarmayı Başlat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
