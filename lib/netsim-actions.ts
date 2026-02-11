"use server";

import prisma from "./prisma";
import { revalidatePath } from "next/cache";
import {
  netSimClient,
  NetSimOrder,
  NetSimOrderDetail,
  NetSimProduct,
  NetSimRecipeItem,
} from "./netsim-client";

// NetSim baglanti durumu
export async function checkNetSimConnection() {
  try {
    const status = await netSimClient.getStatus();
    return status;
  } catch (error) {
    return { isConnected: false, currentDatabase: null };
  }
}

// NetSim'e baglan
export async function connectNetSim(databaseFile: string) {
  try {
    const result = await netSimClient.connect(databaseFile, "SYSDBA", "masterkey");
    return result;
  } catch (error) {
    return {
      isConnected: false,
      serverVersion: null,
      tableCount: 0,
      errorMessage: error instanceof Error ? error.message : "Baglanti hatasi",
    };
  }
}

// NetSim siparislerini getir (pagination destekli)
export async function getNetSimOrders(options?: {
  limit?: number;
  offset?: number;
  onlyOpen?: boolean;
}) {
  try {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const onlyOpen = options?.onlyOpen ?? false;

    const orders = await netSimClient.getOrders({
      limit,
      offset,
      onlyOpen,
    });

    // Toplam sayiyi ayri al (hata olursa 0 dön)
    let totalCount = 0;
    try {
      totalCount = await netSimClient.getOrderCount(onlyOpen);
    } catch {
      totalCount = orders.length;
    }

    // Aktarılmış siparişleri kontrol et
    const orderIds = orders.map(o => `NETSIM-${o.ALISSATIS_NO}`);
    const importedOrders = await prisma.order.findMany({
      where: {
        externalId: { in: orderIds }
      },
      select: { externalId: true }
    });
    const importedSet = new Set(importedOrders.map(o => o.externalId));

    return {
      success: true,
      orders,
      totalCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      importedOrderIds: Array.from(importedSet),
    };
  } catch (error) {
    console.error("NetSim getOrders error:", error);
    return {
      success: false,
      orders: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Siparisler alinamadi",
    };
  }
}

// NetSim siparis detaylarini getir
export async function getNetSimOrderDetails(alissatisNo: number) {
  try {
    const details = await netSimClient.getOrderDetails(alissatisNo);
    return { success: true, details };
  } catch (error) {
    return {
      success: false,
      details: [],
      error: error instanceof Error ? error.message : "Detaylar alinamadi",
    };
  }
}

// NetSim siparisini Factory-Tracker'a aktar
export async function importNetSimOrder(
  order: NetSimOrder,
  details: NetSimOrderDetail[],
  userId: string
) {
  try {
    // Daha once aktarilmis mi kontrol et
    const existingOrder = await prisma.order.findFirst({
      where: {
        externalId: `NETSIM-${order.ALISSATIS_NO}`,
      },
      include: {
        products: true,
      },
    });

    if (existingOrder) {
      // Eğer sipariş var ama ürünleri silinmişse, siparişi de sil ve yeniden aktarmaya izin ver
      if (existingOrder.products.length === 0) {
        await prisma.order.delete({
          where: { id: existingOrder.id },
        });
        // Devam et, yeniden aktarılacak
      } else {
        return {
          success: false,
          error: "Bu siparis daha once aktarilmis",
          orderId: existingOrder.id,
        };
      }
    }

    // Yeni siparis olustur
    const newOrder = await prisma.order.create({
      data: {
        externalId: `NETSIM-${order.ALISSATIS_NO}`,
        name: order.TAKIP_NO || `SIP-${order.ALISSATIS_NO}`,
        company: order.CARI_UNVANI || `Cari No: ${order.CARI_NO}`,
        customerName: order.CARI_UNVANI || null,
        description: order.ACIKLAMA || `NetSim Siparis #${order.ALISSATIS_NO}`,
        orderDate: new Date(order.TARIH),
        deliveryDate: order.TESLIM_TARIHI ? new Date(order.TESLIM_TARIHI) : null,
        totalAmount: order.GENEL_TOPLAM,
        currency: order.DOVIZ_BIRIMI || "TL",
        status: "PLANNED",
        createdById: parseInt(userId),
        products: {
          create: details.map((detail, index) => ({
            name: detail.STOK_ADI,
            model: detail.STOK_KODU || `STOK-${detail.STOK_NO}`,
            sku: detail.STOK_KODU || null,
            description: detail.ACIKLAMA || "",
            aciklama1: detail.ACIKLAMA1 || null,
            aciklama2: detail.ACIKLAMA2 || null,
            aciklama3: detail.ACIKLAMA3 || null,
            aciklama4: detail.ACIKLAMA4 || null,
            dstAdi: detail.DST_ADI || null,
            quantity: Math.floor(detail.MIKTAR),
            unit: detail.BIRIM || "Adet",
            unitPrice: detail.BIRIM_FIYAT,
            totalPrice: detail.SATIR_TOPLAMI,
            status: "DRAFT", // Önce taslak olarak gelsin, planlama onaya göndersin
            sortOrder: detail.SIRA_NO || index + 1,
            externalId: `NETSIM-DETAY-${detail.ALISSATIS_DETAY_NO}`,
            systemCode: `NS-${order.ALISSATIS_NO}-${detail.ALISSATIS_DETAY_NO}`,
            createdById: parseInt(userId),
          })),
        },
      },
      include: {
        products: true,
      },
    });

    revalidatePath("/dashboard/planning");
    revalidatePath("/dashboard/netsim");

    return {
      success: true,
      orderId: newOrder.id,
      productCount: newOrder.products.length,
    };
  } catch (error) {
    console.error("NetSim siparis aktarma hatasi:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Aktarma hatasi",
    };
  }
}

// ==================== RECETE (BOM) FONKSIYONLARI ====================

// Recetesi olan urunleri getir
export async function getNetSimProductsWithRecipe(options?: {
  limit?: number;
  offset?: number;
}) {
  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const products = await netSimClient.getProductsWithRecipe({ limit, offset });
    const totalCount = await netSimClient.getProductsWithRecipeCount();

    return {
      success: true,
      products,
      totalCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    };
  } catch (error) {
    console.error("NetSim getProductsWithRecipe error:", error);
    return {
      success: false,
      products: [] as NetSimProduct[],
      totalCount: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Urunler alinamadi",
    };
  }
}

// Urun ara
export async function searchNetSimProducts(search: string) {
  try {
    const products = await netSimClient.getProducts({ limit: 50, search });
    return {
      success: true,
      products,
    };
  } catch (error) {
    console.error("NetSim searchProducts error:", error);
    return {
      success: false,
      products: [] as NetSimProduct[],
      error: error instanceof Error ? error.message : "Arama hatasi",
    };
  }
}

// Urun recetesini getir
export async function getNetSimProductRecipe(stokNo: number) {
  try {
    const recipeItems = await netSimClient.getProductRecipe(stokNo);
    return {
      success: true,
      recipeItems,
    };
  } catch (error) {
    console.error("NetSim getProductRecipe error:", error);
    return {
      success: false,
      recipeItems: [] as NetSimRecipeItem[],
      error: error instanceof Error ? error.message : "Recete alinamadi",
    };
  }
}

// Veritabanindaki tablolari listele
export async function getNetSimTables() {
  try {
    const tables = await netSimClient.getTables();
    return {
      success: true,
      tables,
    };
  } catch (error) {
    console.error("NetSim getTables error:", error);
    return {
      success: false,
      tables: [] as { TABLE_NAME: string; RECORD_COUNT: number }[],
      error: error instanceof Error ? error.message : "Tablolar alinamadi",
    };
  }
}

// Tablo kolonlarini getir
export async function getNetSimTableColumns(tableName: string) {
  try {
    const columns = await netSimClient.getTableColumns(tableName);
    return {
      success: true,
      columns,
    };
  } catch (error) {
    console.error("NetSim getTableColumns error:", error);
    return {
      success: false,
      columns: [] as any[],
      error: error instanceof Error ? error.message : "Kolonlar alinamadi",
    };
  }
}

// Uretim recetelerini getir
export async function getNetSimRecipes(options?: {
  limit?: number;
  offset?: number;
}) {
  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const recipes = await netSimClient.getRecipes({ limit, offset });
    const totalCount = await netSimClient.getRecipeCount();

    return {
      success: true,
      recipes,
      totalCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    };
  } catch (error) {
    console.error("NetSim getRecipes error:", error);
    return {
      success: false,
      recipes: [] as any[],
      totalCount: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Receteler alinamadi",
    };
  }
}

// Recete ara
export async function searchNetSimRecipes(search: string) {
  try {
    const recipes = await netSimClient.getRecipes({ limit: 50, search });
    return {
      success: true,
      recipes,
    };
  } catch (error) {
    console.error("NetSim searchRecipes error:", error);
    return {
      success: false,
      recipes: [] as any[],
      error: error instanceof Error ? error.message : "Arama hatasi",
    };
  }
}

// Recete detaylarini getir
export async function getNetSimRecipeDetails(uretimReceteNo: number) {
  try {
    // Revizyonlari al
    const revisions = await netSimClient.getRecipeRevisions(uretimReceteNo);

    // Varsayilan revizyonun detaylarini al
    const items = await netSimClient.getRecipeDetailsByRecipeNo(uretimReceteNo);

    return {
      success: true,
      revisions,
      items,
    };
  } catch (error) {
    console.error("NetSim getRecipeDetails error:", error);
    return {
      success: false,
      revisions: [] as any[],
      items: [] as any[],
      error: error instanceof Error ? error.message : "Recete detaylari alinamadi",
    };
  }
}

// Revizyon detaylarini getir
export async function getNetSimRevisionDetails(uretimRevizyonNo: number) {
  try {
    const items = await netSimClient.getRecipeDetails(uretimRevizyonNo);
    return {
      success: true,
      items,
    };
  } catch (error) {
    console.error("NetSim getRevisionDetails error:", error);
    return {
      success: false,
      items: [] as any[],
      error: error instanceof Error ? error.message : "Revizyon detaylari alinamadi",
    };
  }
}

// Alt detaylari getir (URETREDD)
export async function getNetSimRecipeSubDetails(revizyonDetayNo: number) {
  try {
    const subItems = await netSimClient.getRecipeSubDetails(revizyonDetayNo);
    return {
      success: true,
      subItems,
    };
  } catch (error) {
    console.error("NetSim getRecipeSubDetails error:", error);
    return {
      success: false,
      subItems: [] as any[],
      error: error instanceof Error ? error.message : "Alt detaylar alinamadi",
    };
  }
}

// Toplu siparis aktarimi
export async function importMultipleNetSimOrders(
  orderIds: number[],
  userId: string
) {
  const results: {
    alissatisNo: number;
    success: boolean;
    orderId?: number;
    error?: string;
  }[] = [];

  // Tum siparisleri bir kerede al (performans icin)
  const allOrders = await netSimClient.getOrders({ limit: 500, onlyOpen: true });

  for (const alissatisNo of orderIds) {
    try {
      // Siparis bilgilerini bul
      const order = allOrders.find((o) => o.ALISSATIS_NO === alissatisNo);

      if (!order) {
        results.push({
          alissatisNo,
          success: false,
          error: "Siparis bulunamadi",
        });
        continue;
      }

      // Detaylari al
      const details = await netSimClient.getOrderDetails(alissatisNo);

      // Aktar
      const result = await importNetSimOrder(order, details, userId);

      results.push({
        alissatisNo,
        success: result.success,
        orderId: result.orderId,
        error: result.error,
      });
    } catch (error) {
      results.push({
        alissatisNo,
        success: false,
        error: error instanceof Error ? error.message : "Hata olustu",
      });
    }
  }

  revalidatePath("/dashboard/planning");
  revalidatePath("/dashboard/netsim");

  return results;
}

// Yeni siparisleri kontrol et
export async function checkNewNetSimOrders(minutesAgo: number = 60) {
  try {
    const newOrders = await netSimClient.getNewOrders(minutesAgo);

    // Daha once aktarilmis olanlari filtrele
    const existingExternalIds = await prisma.order.findMany({
      where: {
        externalId: {
          startsWith: "NETSIM-",
        },
      },
      select: {
        externalId: true,
      },
    });

    const existingSet = new Set(existingExternalIds.map((o) => o.externalId));

    const pendingOrders = newOrders.filter(
      (order) => !existingSet.has(`NETSIM-${order.ALISSATIS_NO}`)
    );

    return {
      success: true,
      total: newOrders.length,
      pending: pendingOrders.length,
      orders: pendingOrders,
    };
  } catch (error) {
    return {
      success: false,
      total: 0,
      pending: 0,
      orders: [],
      error: error instanceof Error ? error.message : "Kontrol hatasi",
    };
  }
}

// NetSim siparis durumunu guncelle (opsiyonel - ileride)
export async function syncOrderStatus(orderId: number, newStatus: string) {
  // Bu fonksiyon ileride NetSim'e geri yazma icin kullanilabilir
  // Simdilik sadece local guncelleme
  try {
    const order = await prisma.order.findFirst({
      where: {
        externalId: `NETSIM-${orderId}`,
      },
    });

    if (!order) {
      return { success: false, error: "Siparis bulunamadi" };
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { status: newStatus },
    });

    revalidatePath("/dashboard/planning");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Guncelleme hatasi",
    };
  }
}

// NetSim teslim tarihini guncelle
export async function updateNetSimDeliveryDate(
  alissatisNo: number,
  deliveryDate: Date
) {
  try {
    const result = await netSimClient.updateDeliveryDate(alissatisNo, deliveryDate);

    if (!result) {
      return {
        success: false,
        error: "NetSim'de teslim tarihi guncellenemedi",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("NetSim teslim tarihi guncelleme hatasi:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Guncelleme hatasi",
    };
  }
}

// NetSim siparisini teslim tarihi ile birlikte aktar
export async function importNetSimOrderWithDeliveryDate(
  order: NetSimOrder,
  details: NetSimOrderDetail[],
  userId: string,
  customDeliveryDate?: Date
) {
  try {
    // Eger ozel teslim tarihi verilmisse, once NetSim'e yaz
    if (customDeliveryDate) {
      const updateResult = await netSimClient.updateDeliveryDate(
        order.ALISSATIS_NO,
        customDeliveryDate
      );

      if (!updateResult) {
        console.warn("NetSim teslim tarihi guncellenemedi, devam ediliyor...");
      }
    }

    // Daha once aktarilmis mi kontrol et
    const existingOrder = await prisma.order.findFirst({
      where: {
        externalId: `NETSIM-${order.ALISSATIS_NO}`,
      },
      include: {
        products: true,
      },
    });

    if (existingOrder) {
      // Eğer sipariş var ama ürünleri silinmişse, siparişi de sil ve yeniden aktarmaya izin ver
      if (existingOrder.products.length === 0) {
        await prisma.order.delete({
          where: { id: existingOrder.id },
        });
        // Devam et, yeniden aktarılacak
      } else {
        return {
          success: false,
          error: "Bu siparis daha once aktarilmis",
          orderId: existingOrder.id,
        };
      }
    }

    // Teslim tarihini belirle
    const finalDeliveryDate = customDeliveryDate
      ? customDeliveryDate
      : order.TESLIM_TARIHI
      ? new Date(order.TESLIM_TARIHI)
      : null;

    // Yeni siparis olustur
    const newOrder = await prisma.order.create({
      data: {
        externalId: `NETSIM-${order.ALISSATIS_NO}`,
        name: order.TAKIP_NO || `SIP-${order.ALISSATIS_NO}`,
        company: order.CARI_UNVANI || `Cari No: ${order.CARI_NO}`,
        customerName: order.CARI_UNVANI || null,
        description: order.ACIKLAMA || `NetSim Siparis #${order.ALISSATIS_NO}`,
        orderDate: new Date(order.TARIH),
        deliveryDate: finalDeliveryDate,
        totalAmount: order.GENEL_TOPLAM,
        currency: order.DOVIZ_BIRIMI || "TL",
        status: "PLANNED",
        createdById: parseInt(userId),
        products: {
          create: details.map((detail, index) => ({
            name: detail.STOK_ADI,
            model: detail.STOK_KODU || `STOK-${detail.STOK_NO}`,
            sku: detail.STOK_KODU || null,
            description: detail.ACIKLAMA || "",
            aciklama1: detail.ACIKLAMA1 || null,
            aciklama2: detail.ACIKLAMA2 || null,
            aciklama3: detail.ACIKLAMA3 || null,
            aciklama4: detail.ACIKLAMA4 || null,
            dstAdi: detail.DST_ADI || null,
            quantity: Math.floor(detail.MIKTAR),
            unit: detail.BIRIM || "Adet",
            unitPrice: detail.BIRIM_FIYAT,
            totalPrice: detail.SATIR_TOPLAMI,
            status: "DRAFT", // Önce taslak olarak gelsin, planlama onaya göndersin
            sortOrder: detail.SIRA_NO || index + 1,
            externalId: `NETSIM-DETAY-${detail.ALISSATIS_DETAY_NO}`,
            systemCode: `NS-${order.ALISSATIS_NO}-${detail.ALISSATIS_DETAY_NO}`,
            createdById: parseInt(userId),
          })),
        },
      },
      include: {
        products: true,
      },
    });

    revalidatePath("/dashboard/planning");
    revalidatePath("/dashboard/netsim");

    return {
      success: true,
      orderId: newOrder.id,
      productCount: newOrder.products.length,
    };
  } catch (error) {
    console.error("NetSim siparis aktarma hatasi:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Aktarma hatasi",
    };
  }
}
