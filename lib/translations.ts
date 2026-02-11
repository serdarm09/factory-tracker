
export const STATUS_TRANSLATIONS: Record<string, string> = {
    "DRAFT": "Taslak",
    "PENDING": "Onay Bekliyor",
    "REQUESTED": "Talep Edildi",
    "PLANNED": "Planlandı",
    "MARKETING_REVIEW": "Pazarlama İncelemesi",
    "APPROVED": "Onaylandı",
    "IN_PRODUCTION": "Üretimde",
    "AWAITING_SHIPMENT": "Sevk Bekliyor",
    "IN_WAREHOUSE": "Depoda",
    "PARTIAL_SHIPPED": "Yarı Sevk",
    "SHIPPED": "Sevk Edildi",
    "COMPLETED": "Tamamlandı",
    "REJECTED": "Reddedildi",
    "CANCELLED": "İptal Edildi"
};

export function translateStatus(status: string | null | undefined): string {
    if (!status) return "-";
    return STATUS_TRANSLATIONS[status] || status;
}
