'use client';

import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";

interface ExportButtonProps {
    data: any[];
    filename?: string;
    label?: string;
    sheetName?: string;
}

export function ExportButton({
    data,
    filename = "export",
    label = "Excel İndir",
    sheetName = "Veriler"
}: ExportButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            // Write file
            XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error("Export error:", error);
            alert("Excel oluşturulurken bir hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || data.length === 0}
            className="gap-2"
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {label}
        </Button>
    );
}
