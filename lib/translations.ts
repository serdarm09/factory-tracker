
export const STATUS_TRANSLATIONS: Record<string, string> = {
    "PENDING": "Onay Bekliyor",
    "APPROVED": "Onaylandı",
    "COMPLETED": "Tamamlandı",
    "REJECTED": "Reddedildi",
    "CANCELLED": "İptal Edildi"
};

export function translateStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return STATUS_TRANSLATIONS[status] || status;
}
