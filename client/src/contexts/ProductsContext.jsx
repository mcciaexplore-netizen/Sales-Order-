import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const ProductsContext = createContext(null);

const STORAGE_PREFIX = 'sales_products_';

export const UNITS = ['Pieces', 'Kilograms', 'Litres', 'Boxes', 'Metres'];
export const GST_RATES = [0, 5, 12, 18, 28];

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};

const readAll = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (key, products) => {
  localStorage.setItem(key, JSON.stringify(products));
};

export function validateProduct(data) {
  if (!data.name || !data.name.trim()) return 'Product name is required';
  if (!data.sku || !data.sku.trim()) return 'SKU code is required';
  if (!data.category || !data.category.trim()) return 'Category is required';
  if (!UNITS.includes(data.unit)) return 'Please choose a unit of measurement';

  const purchase = Number(data.purchasePrice);
  const selling = Number(data.sellingPrice);
  if (!Number.isFinite(purchase) || purchase < 0) return 'Purchase price must be 0 or higher';
  if (!Number.isFinite(selling) || selling < 0) return 'Selling price must be 0 or higher';

  if (!GST_RATES.includes(Number(data.gstRate))) return 'GST rate must be 0%, 5%, 12%, 18%, or 28%';

  const stock = Number(data.stock);
  const alert = Number(data.lowStockAlert);
  if (!Number.isFinite(stock) || stock < 0) return 'Stock quantity must be 0 or higher';
  if (!Number.isFinite(alert) || alert < 0) return 'Low-stock alert level must be 0 or higher';

  return null;
}

export function ProductsProvider({ children }) {
  const { user } = useAuth();
  const businessId = user?.business?.id || null;
  const key = businessId ? `${STORAGE_PREFIX}${businessId}` : null;

  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!key) {
      setProducts([]);
      return;
    }
    setProducts(readAll(key));

    const onStorage = (e) => {
      if (e.key === key) setProducts(readAll(key));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const persist = useCallback((next) => {
    if (!key) return;
    writeAll(key, next);
    setProducts(next);
  }, [key]);

  const normalize = (data) => ({
    name: String(data.name || '').trim(),
    sku: String(data.sku || '').trim(),
    category: String(data.category || '').trim(),
    hsnCode: String(data.hsnCode || '').trim(),
    description: String(data.description || '').trim(),
    unit: data.unit,
    purchasePrice: Math.max(0, Number(data.purchasePrice) || 0),
    sellingPrice: Math.max(0, Number(data.sellingPrice) || 0),
    gstRate: Number(data.gstRate),
    stock: Math.max(0, Math.floor(Number(data.stock) || 0)),
    lowStockAlert: Math.max(0, Math.floor(Number(data.lowStockAlert) || 0)),
  });

  const create = useCallback((data) => {
    const error = validateProduct(data);
    if (error) throw new Error(error);
    const normalized = normalize(data);
    const skuClash = products.some((p) => p.sku.toLowerCase() === normalized.sku.toLowerCase());
    if (skuClash) throw new Error('A product with this SKU already exists');
    const now = new Date().toISOString();
    const product = { id: generateId(), ...normalized, createdAt: now, updatedAt: now };
    persist([product, ...products]);
    return product;
  }, [products, persist]);

  const importMany = useCallback((rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const now = new Date().toISOString();
    const next = [...products];
    const imported = [];

    rows.forEach((row) => {
      const error = validateProduct(row);
      if (error) throw new Error(`${row.name || row.sku || 'Product'}: ${error}`);
      const normalized = normalize(row);
      const existingIndex = next.findIndex(
        (p) => p.sku.toLowerCase() === normalized.sku.toLowerCase()
      );
      if (existingIndex >= 0) {
        const updated = { ...next[existingIndex], ...normalized, updatedAt: now };
        next[existingIndex] = updated;
        imported.push(updated);
      } else {
        const product = { id: row.id || generateId(), ...normalized, createdAt: now, updatedAt: now };
        next.unshift(product);
        imported.push(product);
      }
    });

    persist(next);
    return imported;
  }, [products, persist]);

  const update = useCallback((id, data) => {
    const error = validateProduct(data);
    if (error) throw new Error(error);
    const normalized = normalize(data);
    const skuClash = products.some(
      (p) => p.id !== id && p.sku.toLowerCase() === normalized.sku.toLowerCase()
    );
    if (skuClash) throw new Error('A product with this SKU already exists');
    const now = new Date().toISOString();
    persist(products.map((p) => (p.id === id ? { ...p, ...normalized, updatedAt: now } : p)));
  }, [products, persist]);

  const remove = useCallback((id) => {
    persist(products.filter((p) => p.id !== id));
  }, [products, persist]);

  const adjustStock = useCallback((id, delta) => {
    const now = new Date().toISOString();
    persist(
      products.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, p.stock + delta), updatedAt: now } : p
      )
    );
  }, [products, persist]);

  const applyStockChange = useCallback((items, sign) => {
    if (!items || items.length === 0) return;
    const now = new Date().toISOString();
    const lookup = new Map(items.map((i) => [i.productId, Number(i.quantity) || 0]));
    persist(
      products.map((p) => {
        const qty = lookup.get(p.id);
        if (!qty) return p;
        return { ...p, stock: Math.max(0, p.stock + sign * qty), updatedAt: now };
      })
    );
  }, [products, persist]);

  const checkStockAvailable = useCallback((items) => {
    for (const item of items || []) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      if (product.stock < Number(item.quantity)) {
        return `Not enough stock for ${product.name}. Available: ${product.stock}, needed: ${item.quantity}.`;
      }
    }
    return null;
  }, [products]);

  const findById = useCallback((id) => products.find((p) => p.id === id), [products]);

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock <= p.lowStockAlert).length,
    [products]
  );

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const value = {
    products,
    categories,
    lowStockCount,
    create,
    update,
    remove,
    importMany,
    adjustStock,
    applyStockChange,
    checkStockAvailable,
    findById,
  };

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used inside ProductsProvider');
  return ctx;
}
