// NetSim API Client
// Factory-Tracker'dan NetSim Bridge API'ye bağlantı

const NETSIM_API_URL = process.env.NETSIM_API_URL || 'http://localhost:5000';

export interface NetSimDatabase {
  fileName: string;
  fullPath: string;
  sizeBytes: number;
  sizeFormatted: string;
  lastModified: string;
}

export interface NetSimConnectionResult {
  isConnected: boolean;
  serverVersion: string | null;
  tableCount: number;
  errorMessage: string | null;
}

export interface NetSimOrder {
  ALISSATIS_NO: number;
  TAKIP_NO: string | null;
  ISLEM_KODU: string;
  ISLEM_ADI: string;
  TARIH: string;
  TESLIM_TARIHI: string | null;
  DURUM: string | null;
  CARI_NO: number;
  CARI_UNVANI?: string;
  GENEL_TOPLAM: number;
  DOVIZ_BIRIMI: string;
  ONAYLANDI: string;
  KAPANDI: string;
  ACIKLAMA: string | null;
  PERSONEL_NO: number;
}

export interface NetSimOrderDetail {
  ALISSATIS_DETAY_NO: number;
  ALISSATIS_NO: number;
  SIRA_NO: number;
  STOK_NO: number;
  STOK_ADI: string;
  STOK_KODU?: string;
  MIKTAR: number;
  BIRIM: string;
  BIRIM_FIYAT: number;
  SATIR_TOPLAMI: number;
  SATIR_DURUM: string | null;
  ACIKLAMA: string | null;
  ACIKLAMA1: string | null;
  ACIKLAMA2: string | null;
  ACIKLAMA3: string | null;
  ACIKLAMA4: string | null;
  TESLIM_TAAHHUT_TARIHI: string | null;
  DSTOK_NO?: number;
  DST_ADI?: string | null;
}

export interface NetSimCustomer {
  CARI_NO: number;
  CARI_KOD: string;
  CARI_UNVANI: string;
  VERGI_DAIRESI: string | null;
  VERGI_NO: string | null;
  TELEFON?: string;
  ADRES?: string;
}

export interface NetSimProduct {
  STOK_NO: number;
  STOK_KODU: string;
  STOK_ADI: string;
  BIRIM: string;
  STOK_TIP_ADI: string | null;
}

export interface NetSimRecipe {
  URETIM_RECETE_NO: number;
  RECETE_KODU: string;
  RECETE_ADI: string;
  AKTIF: string;
  STOK_NO: number;
  STOK_KODU: string | null;
  STOK_ADI: string | null;
  ACIKLAMA: string | null;
}

export interface NetSimRecipeRevision {
  URETIM_REVIZYON_NO: number;
  URETIM_RECETE_NO: number;
  REVIZYON_KODU: string;
  AKTIF: string;
  VARSAYILAN: string;
  KATSAYI: number;
  MIKTAR: number;
  ACIKLAMA: string | null;
  TARIH: string | null;
}

export interface NetSimRecipeItem {
  REVIZYON_DETAY_NO: number;
  URETIM_REVIZYON_NO: number;
  ISLEM_ADI: string;
  ISLEM_YONU: number;
  DEGISKEN_ADI: string;
  SIRA_NO: number;
  STOK_NO: number;
  STOK_KODU: string | null;
  STOK_ADI: string | null;
  BIRIM: string;
  BIRIMX: number;
  DSTOK_NO: number;
  DSTOK_KODU: string | null;
  DSTOK_ADI: string | null;
  STOK_TIP_NO: number;
  STOK_TIP_ADI: string | null;
  ACIKLAMA: string | null;
  URETILEN_RECETE_NO: number | null;
  URETILEN_REVIZYON_NO: number | null;
}

export interface NetSimRecipeSubItem {
  REVIZYON_DET_DET_NO: number;
  REVIZYON_DETAY_NO: number;
  SIRA_NO: number;
  DETAY_DEGISKEN_ADI: string;
  STOK_NO: number;
  STOK_KODU: string | null;
  STOK_ADI: string | null;
  DSTOK_NO: number;
  BIRIM: string;
  MIKTAR: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T | null;
  error: string | null;
}

interface QueryResult<T> {
  columns: string[];
  rows: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

class NetSimClient {
  private baseUrl: string;
  private connected: boolean = false;

  constructor(baseUrl: string = NETSIM_API_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      // Yanıt text olarak al
      const text = await response.text();

      // Boş yanıt kontrolü
      if (!text || text.trim() === '') {
        return {
          success: false,
          message: null,
          data: null,
          error: `API boş yanıt döndü (status: ${response.status})`,
        };
      }

      // JSON parse et
      try {
        return JSON.parse(text);
      } catch (parseError) {
        return {
          success: false,
          message: null,
          data: null,
          error: `JSON parse hatası: ${text.substring(0, 200)}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: null,
        data: null,
        error: error instanceof Error ? error.message : 'Baglanti hatasi',
      };
    }
  }

  // API Durumu
  async getStatus(): Promise<{ isConnected: boolean; currentDatabase: string | null }> {
    const result = await this.fetch<any>('/api/status');
    if (result.success && result.data) {
      this.connected = result.data.isConnected;
      return {
        isConnected: result.data.isConnected,
        currentDatabase: result.data.currentDatabase,
      };
    }
    return { isConnected: false, currentDatabase: null };
  }

  // Veritabani listesi
  async getDatabases(path: string = 'C:/Ofisnet/Data'): Promise<NetSimDatabase[]> {
    const result = await this.fetch<NetSimDatabase[]>(`/api/database/files?path=${encodeURIComponent(path)}`);
    return result.data || [];
  }

  // Veritabanina baglan
  async connect(databaseFile: string, username: string = 'SYSDBA', password: string = 'masterkey'): Promise<NetSimConnectionResult> {
    const result = await this.fetch<NetSimConnectionResult>('/api/database/connect', {
      method: 'POST',
      body: JSON.stringify({
        DatabasePath: 'C:/Ofisnet/Data',
        DatabaseFile: databaseFile,
        Username: username,
        Password: password,
        Charset: 'NONE',
      }),
    });

    if (result.success && result.data) {
      this.connected = result.data.isConnected;
      return result.data;
    }

    return {
      isConnected: false,
      serverVersion: null,
      tableCount: 0,
      errorMessage: result.error || 'Baglanti kurulamadi',
    };
  }

  // SQL Sorgusu calistir
  async query<T>(sql: string, maxRows: number = 1000): Promise<T[]> {
    const result = await this.fetch<QueryResult<T>>('/api/tables/query', {
      method: 'POST',
      body: JSON.stringify({ Sql: sql, MaxRows: maxRows }),
    });

    if (result.success && result.data) {
      return result.data.rows;
    }
    return [];
  }

  // Alinan siparisleri getir (ALISİP)
  async getOrders(options: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    onlyOpen?: boolean;
  } = {}): Promise<NetSimOrder[]> {
    const { limit = 100, offset = 0, onlyOpen = false } = options;

    let whereClause = "a.ISLEM_KODU LIKE 'ALIS%'"; // Alış siparişleri

    if (onlyOpen) {
      whereClause += " AND a.KAPANDI = 'H'";
    }

    const sql = `
      SELECT FIRST ${limit} SKIP ${offset}
        a.ALISSATIS_NO,
        a.TAKIP_NO,
        a.ISLEM_KODU,
        a.ISLEM_ADI,
        a.TARIH,
        a.TESLIM_TARIHI,
        a.DURUM,
        a.CARI_NO,
        c.CARI_UNVANI,
        a.GENEL_TOPLAM,
        a.DOVIZ_BIRIMI,
        a.ONAYLANDI,
        a.KAPANDI,
        a.ACIKLAMA,
        a.PERSONEL_NO
      FROM ALSAASIL a
      LEFT JOIN CARIKART c ON a.CARI_NO = c.CARI_NO
      WHERE ${whereClause}
      ORDER BY a.TARIH DESC
    `;

    return this.query<NetSimOrder>(sql, limit);
  }

  // Siparis detaylarini getir
  async getOrderDetails(alissatisNo: number): Promise<NetSimOrderDetail[]> {
    const sql = `
      SELECT
        d.ALISSATIS_DETAY_NO,
        d.ALISSATIS_NO,
        d.SIRA_NO,
        d.STOK_NO,
        d.STOK_ADI,
        s.STOK_KODU,
        d.MIKTAR,
        d.BIRIM,
        d.BIRIM_FIYAT,
        d.SATIR_TOPLAMI,
        d.SATIR_DURUM,
        d.ACIKLAMA,
        d.ACIKLAMA1,
        d.ACIKLAMA2,
        d.ACIKLAMA3,
        d.ACIKLAMA4,
        d.TESLIM_TAAHHUT_TARIHI,
        d.DSTOK_NO,
        ds.STOK_ADI as DST_ADI
      FROM ALSADETA d
      LEFT JOIN STOKKART s ON d.STOK_NO = s.STOK_NO
      LEFT JOIN STOKKART ds ON d.DSTOK_NO = ds.STOK_NO
      WHERE d.ALISSATIS_NO = ${alissatisNo}
      ORDER BY d.SIRA_NO
    `;

    return this.query<NetSimOrderDetail>(sql);
  }

  // Musteri bilgisi getir
  async getCustomer(cariNo: number): Promise<NetSimCustomer | null> {
    const sql = `
      SELECT
        c.CARI_NO,
        c.CARI_KOD,
        c.CARI_UNVANI,
        c.VERGI_DAIRESI,
        c.VERGI_NO
      FROM CARIKART c
      WHERE c.CARI_NO = ${cariNo}
    `;

    const results = await this.query<NetSimCustomer>(sql, 1);
    return results[0] || null;
  }

  // Urun bilgisi getir
  async getProduct(stokNo: number): Promise<NetSimProduct | null> {
    const sql = `
      SELECT
        s.STOK_NO,
        s.STOK_KODU,
        s.STOK_ADI,
        s.BIRIM1 as BIRIM,
        s.STOK_TIP_ADI
      FROM STOKKART s
      WHERE s.STOK_NO = ${stokNo}
    `;

    const results = await this.query<NetSimProduct>(sql, 1);
    return results[0] || null;
  }

  // Yeni siparisleri kontrol et (son X dakika icinde girilmis)
  async getNewOrders(minutesAgo: number = 60): Promise<NetSimOrder[]> {
    const sql = `
      SELECT FIRST 50
        a.ALISSATIS_NO,
        a.TAKIP_NO,
        a.ISLEM_KODU,
        a.ISLEM_ADI,
        a.TARIH,
        a.TESLIM_TARIHI,
        a.DURUM,
        a.CARI_NO,
        c.CARI_UNVANI,
        a.GENEL_TOPLAM,
        a.DOVIZ_BIRIMI,
        a.ONAYLANDI,
        a.KAPANDI,
        a.ACIKLAMA,
        a.PERSONEL_NO
      FROM ALSAASIL a
      LEFT JOIN CARIKART c ON a.CARI_NO = c.CARI_NO
      WHERE a.ISLEM_KODU LIKE 'ALIS%'
        AND a.KAPANDI = 'H'
        AND a.TARIH >= DATEADD(-${minutesAgo} MINUTE TO CURRENT_TIMESTAMP)
      ORDER BY a.TARIH DESC
    `;

    return this.query<NetSimOrder>(sql);
  }

  // Siparis sayisi
  async getOrderCount(onlyOpen: boolean = true): Promise<number> {
    let whereClause = "ISLEM_KODU LIKE 'ALIS%'";
    if (onlyOpen) {
      whereClause += " AND KAPANDI = 'H'";
    }
    const sql = `SELECT COUNT(*) as CNT FROM ALSAASIL WHERE ${whereClause}`;
    const results = await this.query<{ CNT: number }>(sql, 1);
    return results[0]?.CNT || 0;
  }

  // Teslim tarihini guncelle (NetSim'e yaz)
  async updateDeliveryDate(alissatisNo: number, deliveryDate: Date): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.fetch<any>('/api/tables/order/delivery-date', {
        method: 'POST',
        body: JSON.stringify({
          AlissatisNo: alissatisNo,
          DeliveryDate: deliveryDate.toISOString(),
        }),
      });

      // API yanıtını kontrol et - result.success API başarısı, result.data SQL UPDATE sonucu
      if (result.success && result.data) {
        return { success: true };
      }

      return { success: false, error: result.error || result.message || "Sipariş bulunamadı veya güncellenemedi" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Bağlantı hatası" };
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Veritabanindaki tablolari listele
  async getTables(): Promise<{ TABLE_NAME: string; RECORD_COUNT: number }[]> {
    const sql = `
      SELECT RDB$RELATION_NAME as TABLE_NAME
      FROM RDB$RELATIONS
      WHERE RDB$VIEW_BLF IS NULL
        AND RDB$SYSTEM_FLAG = 0
      ORDER BY RDB$RELATION_NAME
    `;
    return this.query<{ TABLE_NAME: string; RECORD_COUNT: number }>(sql, 500);
  }

  // Tablo kolonlarini getir (şema)
  async getTableColumns(tableName: string): Promise<{
    FIELD_NAME: string;
    FIELD_TYPE: string;
    FIELD_LENGTH: number;
    FIELD_NULL: string;
  }[]> {
    const sql = `
      SELECT
        RF.RDB$FIELD_NAME as FIELD_NAME,
        CASE F.RDB$FIELD_TYPE
          WHEN 7 THEN 'SMALLINT'
          WHEN 8 THEN 'INTEGER'
          WHEN 10 THEN 'FLOAT'
          WHEN 12 THEN 'DATE'
          WHEN 13 THEN 'TIME'
          WHEN 14 THEN 'CHAR'
          WHEN 16 THEN 'BIGINT'
          WHEN 27 THEN 'DOUBLE'
          WHEN 35 THEN 'TIMESTAMP'
          WHEN 37 THEN 'VARCHAR'
          WHEN 261 THEN 'BLOB'
          ELSE 'OTHER'
        END as FIELD_TYPE,
        F.RDB$FIELD_LENGTH as FIELD_LENGTH,
        CASE RF.RDB$NULL_FLAG WHEN 1 THEN 'NOT NULL' ELSE 'NULL' END as FIELD_NULL
      FROM RDB$RELATION_FIELDS RF
      JOIN RDB$FIELDS F ON RF.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
      WHERE RF.RDB$RELATION_NAME = '${tableName.toUpperCase()}'
      ORDER BY RF.RDB$FIELD_POSITION
    `;
    return this.query<any>(sql, 100);
  }

  // Recete tablosunu dinamik olarak bul
  async findRecipeTable(): Promise<string | null> {
    const tables = await this.getTables();
    const possibleNames = ['STOKREC', 'RECETE', 'RECETEAS', 'URETIMREC', 'URETIM_RECETE', 'BOM'];

    for (const table of tables) {
      const tableName = table.TABLE_NAME?.trim().toUpperCase();
      if (possibleNames.some(name => tableName?.includes(name))) {
        return tableName;
      }
    }
    return null;
  }

  // Urunleri listele (recete secimi icin)
  async getProducts(options: { limit?: number; offset?: number; search?: string } = {}): Promise<NetSimProduct[]> {
    const { limit = 50, offset = 0, search } = options;

    let whereClause = "1=1";
    if (search) {
      whereClause = `(UPPER(s.STOK_KODU) LIKE UPPER('%${search}%') OR UPPER(s.STOK_ADI) LIKE UPPER('%${search}%'))`;
    }

    const sql = `
      SELECT FIRST ${limit} SKIP ${offset}
        s.STOK_NO,
        s.STOK_KODU,
        s.STOK_ADI,
        s.BIRIM1 as BIRIM,
        s.STOK_TIP_ADI
      FROM STOKKART s
      WHERE ${whereClause}
      ORDER BY s.STOK_ADI
    `;

    return this.query<NetSimProduct>(sql, limit);
  }

  // Tum receteleri listele
  async getRecipes(options: { limit?: number; offset?: number; search?: string } = {}): Promise<NetSimRecipe[]> {
    const { limit = 50, offset = 0, search } = options;

    let whereClause = "1=1";
    if (search) {
      whereClause = `(UPPER(U.RECETE_KODU) LIKE UPPER('%${search}%') OR UPPER(U.RECETE_ADI) LIKE UPPER('%${search}%'))`;
    }

    const sql = `
      SELECT FIRST ${limit} SKIP ${offset}
        U.URETIM_RECETE_NO,
        U.RECETE_KODU,
        U.RECETE_ADI,
        U.AKTIF,
        U.STOK_NO,
        S.STOK_KODU,
        S.STOK_ADI,
        U.ACIKLAMA
      FROM URETRECE U
      LEFT JOIN STOKKART S ON U.STOK_NO = S.STOK_NO
      WHERE ${whereClause}
      ORDER BY U.RECETE_KODU ASC
    `;

    return this.query<NetSimRecipe>(sql, limit);
  }

  // Recete revizyonlarini getir
  async getRecipeRevisions(uretimReceteNo: number): Promise<NetSimRecipeRevision[]> {
    const sql = `
      SELECT
        UR.URETIM_REVIZYON_NO,
        UR.URETIM_RECETE_NO,
        UR.REVIZYON_KODU,
        UR.AKTIF,
        UR.VARSAYILAN,
        UR.KATSAYI,
        UR.MIKTAR,
        UR.ACIKLAMA,
        UR.TARIH
      FROM URETREVI UR
      WHERE UR.URETIM_RECETE_NO = ${uretimReceteNo}
      ORDER BY UR.VARSAYILAN DESC, UR.REVIZYON_KODU ASC
    `;

    return this.query<NetSimRecipeRevision>(sql);
  }

  // Recete detaylarini getir (hammaddeler) - Revizyon bazli
  async getRecipeDetails(uretimRevizyonNo: number): Promise<NetSimRecipeItem[]> {
    const sql = `
      SELECT
        URE.REVIZYON_DETAY_NO,
        URE.URETIM_REVIZYON_NO,
        URE.ISLEM_ADI,
        URE.ISLEM_YONU,
        URE.DEGISKEN_ADI,
        URE.SIRA_NO,
        URE.STOK_NO,
        S.STOK_KODU,
        S.STOK_ADI,
        URE.BIRIM,
        URE.BIRIMX,
        URE.DSTOK_NO,
        DS.STOK_KODU as DSTOK_KODU,
        DS.STOK_ADI as DSTOK_ADI,
        URE.STOK_TIP_NO,
        ST.STOK_TIP_ADI,
        URE.ACIKLAMA,
        URE.URETILEN_RECETE_NO,
        URE.URETILEN_REVIZYON_NO
      FROM URETREDE URE
      LEFT JOIN STOKKART S ON URE.STOK_NO = S.STOK_NO
      LEFT JOIN STOKKART DS ON URE.DSTOK_NO = DS.STOK_NO
      LEFT JOIN STOKTIPI ST ON URE.STOK_TIP_NO = ST.STOK_TIP_NO
      WHERE URE.URETIM_REVIZYON_NO = ${uretimRevizyonNo}
      ORDER BY URE.SIRA_NO ASC
    `;

    return this.query<NetSimRecipeItem>(sql);
  }

  // Recete alt detaylarini getir (URETREDD)
  async getRecipeSubDetails(revizyonDetayNo: number): Promise<NetSimRecipeSubItem[]> {
    const sql = `
      SELECT
        URD.REVIZYON_DET_DET_NO,
        URD.REVIZYON_DETAY_NO,
        URD.SIRA_NO,
        URD.DETAY_DEGISKEN_ADI,
        URD.STOK_NO,
        S.STOK_KODU,
        S.STOK_ADI,
        URD.DSTOK_NO,
        URD.BIRIM,
        URD.MIKTAR
      FROM URETREDD URD
      LEFT JOIN STOKKART S ON URD.STOK_NO = S.STOK_NO
      WHERE URD.REVIZYON_DETAY_NO = ${revizyonDetayNo}
      ORDER BY URD.SIRA_NO ASC
    `;

    return this.query<NetSimRecipeSubItem>(sql);
  }

  // Recete detaylarini recete numarasina gore getir (varsayilan revizyon)
  async getRecipeDetailsByRecipeNo(uretimReceteNo: number): Promise<NetSimRecipeItem[]> {
    // Once varsayilan revizyonu bul
    const revSql = `
      SELECT FIRST 1 URETIM_REVIZYON_NO
      FROM URETREVI
      WHERE URETIM_RECETE_NO = ${uretimReceteNo}
      ORDER BY VARSAYILAN DESC, AKTIF DESC
    `;
    const revResults = await this.query<{ URETIM_REVIZYON_NO: number }>(revSql, 1);

    if (revResults.length > 0) {
      return this.getRecipeDetails(revResults[0].URETIM_REVIZYON_NO);
    }
    return [];
  }

  // Recete sayisi
  async getRecipeCount(): Promise<number> {
    const sql = `SELECT COUNT(*) as CNT FROM URETRECE`;
    const results = await this.query<{ CNT: number }>(sql, 1);
    return results[0]?.CNT || 0;
  }

  // Urun recetesini getir (hammaddeler) - eski metod, yeni yapiya yonlendir
  async getProductRecipe(stokNo: number): Promise<NetSimRecipeItem[]> {
    // Stok numarasina gore recete bul
    const sql = `
      SELECT FIRST 1 U.URETIM_RECETE_NO
      FROM URETRECE U
      JOIN URETREVI UR ON U.URETIM_RECETE_NO = UR.URETIM_RECETE_NO
      JOIN URETREDE URE ON UR.URETIM_REVIZYON_NO = URE.URETIM_REVIZYON_NO
      WHERE URE.STOK_NO = ${stokNo} OR URE.DSTOK_NO = ${stokNo}
    `;
    const results = await this.query<{ URETIM_RECETE_NO: number }>(sql, 1);

    if (results.length > 0) {
      return this.getRecipeDetails(results[0].URETIM_RECETE_NO);
    }
    return [];
  }

  // Recetesi olan urunleri listele - artik dogrudan URETRECE kullan
  async getProductsWithRecipe(options: { limit?: number; offset?: number } = {}): Promise<NetSimProduct[]> {
    const { limit = 100, offset = 0 } = options;

    // Receteleri urun gibi dondur
    const sql = `
      SELECT FIRST ${limit} SKIP ${offset}
        U.URETIM_RECETE_NO as STOK_NO,
        U.RECETE_KODU as STOK_KODU,
        U.RECETE_ADI as STOK_ADI,
        '' as BIRIM,
        U.AKTIF as STOK_TIP_ADI
      FROM URETRECE U
      ORDER BY U.RECETE_KODU ASC
    `;

    return this.query<NetSimProduct>(sql, limit);
  }

  // Recetesi olan urun sayisi
  async getProductsWithRecipeCount(): Promise<number> {
    return this.getRecipeCount();
  }
}

// Singleton instance
export const netSimClient = new NetSimClient();

// Server action icin yardimci fonksiyonlar
export async function fetchNetSimOrders(options?: Parameters<typeof netSimClient.getOrders>[0]) {
  return netSimClient.getOrders(options);
}

export async function fetchNetSimOrderDetails(alissatisNo: number) {
  return netSimClient.getOrderDetails(alissatisNo);
}

export async function fetchNetSimNewOrders(minutesAgo?: number) {
  return netSimClient.getNewOrders(minutesAgo);
}

export async function connectToNetSim(databaseFile: string, username?: string, password?: string) {
  return netSimClient.connect(databaseFile, username, password);
}

export async function getNetSimStatus() {
  return netSimClient.getStatus();
}
