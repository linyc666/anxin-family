// utils/product-loader.js — 产品缓存层
// 三级获取：内存缓存 → 本地存储缓存 → 引擎兜底 PRODUCTS
var engine = require('./insurance-engine');

var memoryCache = null;
var cacheVersion = 0;

function getLocalCache() {
  try {
    var cache = wx.getStorageSync('product_cache');
    if (cache && cache.length > 0) return cache;
  } catch(e) {}
  return null;
}

function getLocalVersion() {
  try {
    return wx.getStorageSync('productVersion') || 0;
  } catch(e) { return 0; }
}

function setLocalCache(products, version) {
  try {
    wx.setStorageSync('product_cache', products);
    wx.setStorageSync('productVersion', version);
    wx.setStorageSync('productCacheTime', Date.now());
  } catch(e) {}
}

/** 同步获取产品列表 */
function getProducts() {
  if (memoryCache && memoryCache.length > 0) return memoryCache;
  var local = getLocalCache();
  if (local && local.length > 0) {
    memoryCache = local;
    return local;
  }
  return engine.getProducts();
}

/** 异步从云端刷新产品库 */
function refreshFromCloud() {
  return new Promise(function(resolve) {
    if (!wx || !wx.cloud) { resolve(false); return; }
    wx.cloud.callFunction({
      name: 'analyzeFamily',
      data: { action: 'getAllProducts', version: getLocalVersion() }
    }).then(function(res) {
      if (res.result && res.result.success) {
        var data = res.result.data;
        if (data.products && data.products.length > 0) {
          memoryCache = data.products;
          setLocalCache(data.products, data.version || 0);
          engine.setProducts(data.products);
          resolve(true);
          return;
        }
      }
      resolve(false);
    }).catch(function() {
      resolve(false);
    });
  });
}

/** 手动注入产品（管理员导入后调用） */
function injectProducts(products) {
  if (!products || products.length === 0) return;
  memoryCache = products;
  engine.setProducts(products);
  setLocalCache(products, Date.now());
}

/** 重置为默认产品库 */
function resetToDefault() {
  memoryCache = null;
  engine.resetProducts();
  try {
    wx.removeStorageSync('product_cache');
    wx.removeStorageSync('productVersion');
    wx.removeStorageSync('productCacheTime');
  } catch(e) {}
}

var MS_PER_DAY = 86400000;

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / MS_PER_DAY);
}

function getReviewStatus(product) {
  var days = daysSince(product.lastReviewedAt);
  if (days === Infinity) return 'never';
  if (days <= 90) return 'current';
  if (days <= 180) return 'stale';
  return 'expired';
}

/** 是否有最小可展示字段集 */
function hasMinFields(product) {
  if (!product.name || !product.type) return false;
  if (product.price === undefined || product.price === null) return false;
  if (!product.coverage && (!product.recordItems || product.recordItems.length === 0)) return false;
  return true;
}

function isDisplayable(product) {
  if (!product) return false;
  if (product.status && product.status !== 'active') return false;
  if (product.active === false) return false;
  if (product.displayAllowed === false) return false;
  if (product.qualityScore !== undefined && product.qualityScore < 70) return false;
  if (product.coverageCompleteness !== undefined && product.coverageCompleteness < 60) return false;
  if (!hasMinFields(product)) return false;
  // 超过 180 天未复核，默认不展示
  if (getReviewStatus(product) === 'expired') return false;
  return true;
}

function getDisplayableProducts() {
  return getProducts().filter(isDisplayable);
}

/** 按复核新鲜度排序：current 优先, stale 靠后 */
function getSamplesByType(type, count) {
  var displayable = getDisplayableProducts().filter(function(p) { return p.type === type; });
  displayable.sort(function(a, b) {
    var ra = getReviewStatus(a);
    var rb = getReviewStatus(b);
    var order = { current: 0, stale: 1 };
    return (order[ra] || 2) - (order[rb] || 2);
  });
  var basic = displayable.filter(function(p) { return p.contentLevel !== 'complete'; });
  var complete = displayable.filter(function(p) { return p.contentLevel === 'complete'; });
  var result = [];
  if (basic.length > 0) result.push(basic[0]);
  if (complete.length > 0 && (!count || result.length < count)) result.push(complete[0]);
  if (result.length === 0 && displayable.length > 0) result.push(displayable[0]);
  return result;
}

module.exports = {
  getProducts: getProducts,
  getDisplayableProducts: getDisplayableProducts,
  getSamplesByType: getSamplesByType,
  isDisplayable: isDisplayable,
  getReviewStatus: getReviewStatus,
  hasMinFields: hasMinFields,
  refreshFromCloud: refreshFromCloud,
  injectProducts: injectProducts,
  resetToDefault: resetToDefault
};
