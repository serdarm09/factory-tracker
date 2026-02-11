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
    transferToWarehouse
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
    updateShipmentStatus
} from './actions/shipment-actions';

// Semi-finished actions
export {
    createSemiFinished,
    updateSemiFinished,
    deleteSemiFinished,
    updateSemiFinishedStock
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
