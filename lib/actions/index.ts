'use server';

// Re-export all actions from domain-specific files

// Shared utilities
export { createAuditLog } from './shared';

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
    clearAllProductionData
} from './product-actions';

// User actions
export {
    createUser,
    deleteUser,
    changeUserPassword
} from './user-actions';

// Order actions
export {
    createOrder,
    getOrderForClone
} from './order-actions';

// Order types
export type { CreateOrderData } from './order-actions';

// Shipment actions
export {
    getReadyToShipProducts,
    createShipment,
    shipProduct,
    getShipments,
    getShippedProducts,
    updateShipmentStatus
} from './shipment-actions';

// Semi-finished actions
export {
    createSemiFinished,
    updateSemiFinished,
    deleteSemiFinished,
    updateSemiFinishedStock
} from './semi-finished-actions';

// Semi-finished production actions
export {
    sendToSemiFinishedProduction,
    getSemiFinishedProductionByCategory,
    updateSemiFinishedProductionQty,
    removeSemiFinishedProduction,
    getSemiFinishedProductionSummary,
    addManualSemiFinishedProduction
} from './semi-finished-production-actions';

// Notification actions
export {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
} from './notification-actions';

// Catalog actions
export {
    searchCatalog,
    getAttributes,
    getMasters,
    ensureAttributes
} from './catalog-actions';
