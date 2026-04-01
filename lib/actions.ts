/**
 * lib/actions.ts — Merkezi Action Barrel Export
 *
 * Tüm server action'lar bu dosyadan re-export edilir.
 * Gerçek implementasyonlar domain'e göre ayrı dosyalarda:
 *   lib/actions/product-actions.ts   — ürün işlemleri (oluştur, onayla, güncelle, sil...)
 *   lib/actions/user-actions.ts      — kullanıcı yönetimi
 *   lib/actions/order-actions.ts     — sipariş oluşturma/klonlama
 *   lib/actions/shipment-actions.ts  — sevkiyat yönetimi
 *   lib/actions/semi-finished-actions.ts — yarı mamül stok
 *   lib/actions/notification-actions.ts  — bildirim okundu/silindi
 *   lib/actions/catalog-actions.ts   — katalog arama + özellik yönetimi
 *   lib/actions/shared.ts            — AuditLog yazıma (diğer action'lar için yardımcı)
 *
 * Her action dosyası kendi başına `'use server'` direktifi taşır.
 * Bileşenler import yaparken doğrudan lib/actions'tan import eder.
 */

// This file now serves as a barrel export for all actions
// All actions have been split into domain-specific files in lib/actions/
// Each individual action file has its own 'use server' directive

// Shared utilities
export { createAuditLog } from './actions/shared';

// Product actions
export {
    createProduct,
    cancelProduct,
    updateProduct,
    approveProduct,
    marketingApproveProduct,
    sendToApproval,
    sendToProduction,
    bulkSendToApproval,
    logProduction,
    getProductByBarcode,
    revokeApproval,
    rejectProduct,
    marketingRejectProduct,
    deleteProduct,
    bulkApprove,
    bulkReject,
    bulkDelete,
    getProductTimeline,
    getHistoricalProductionData,
    updateProductStatus,
    updateProductSubStatus,
    bulkUpdateProductStatus,
    bulkUpdateProductSubStatus,
    updateEngineerNote,
    updateProductionStageQuantity,
    updateProductStages,
    clearAllProductionData,
    transferToWarehouse,
    updateProductShelf
} from './actions/product-actions';

// User actions
export {
    createUser,
    deleteUser,
    changeUserPassword
} from './actions/user-actions';

// Order actions
export {
    createOrder,
    getOrderForClone
} from './actions/order-actions';

// Order types
export type { CreateOrderData } from './actions/order-actions';

// Shipment actions
export {
    getReadyToShipProducts,
    createShipment,
    shipProduct,
    getShipments,
    getShippedProducts,
    updateShipmentStatus,
    getHistoricalShipmentData
} from './actions/shipment-actions';

// Semi-finished actions
export {
    createSemiFinished,
    updateSemiFinished,
    deleteSemiFinished,
    updateSemiFinishedStock,
    recordFireAmount
} from './actions/semi-finished-actions';

// Notification actions
export {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
} from './actions/notification-actions';

// Catalog actions
export {
    searchCatalog,
    getAttributes,
    getMasters,
    ensureAttributes
} from './actions/catalog-actions';
