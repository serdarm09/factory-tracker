import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
    // Şablon başlıkları (raw-material-actions.ts'deki importRawMaterialsFromExcel fonksiyonuna uygun)
    // Beklenen başlıklar: STOK ADI, MİKTAR, MİNİMUM, MAKSİMUM, BİRİM
    const headers = [
        "STOK ADI",
        "MİKTAR",
        "MİNİMUM",
        "MAKSİMUM",
        "BİRİM"
    ];

    // Örnek veriler
    const sampleData = [
        ["HMDER001-0001 PEGASUS DERI", 50, 10, 100, "Mt"],
        ["HMKUM001-0001 KETEN KUMAŞ", 120, 20, 200, "Mt"],
        ["Örnek Malzeme 3", 0, 5, 50, "Adet"]
    ];

    // Çalışma kitabı ve sayfası oluştur
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

    // Kolon genişliklerini ayarla
    ws["!cols"] = [
        { wch: 40 }, // STOK ADI
        { wch: 15 }, // MİKTAR
        { wch: 15 }, // MİNİMUM
        { wch: 15 }, // MAKSİMUM
        { wch: 15 }  // BİRİM
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Hammadde Şablonu");

    // Excel buffer'ını oluştur
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Dosyayı indirilebilir olarak dön
    return new NextResponse(buf, {
        status: 200,
        headers: {
            "Content-Disposition": 'attachment; filename="hammadde_yukleme_sablonu.xlsx"',
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    });
}
