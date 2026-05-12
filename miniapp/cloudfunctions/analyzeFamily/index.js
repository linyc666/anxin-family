// cloudfunctions/analyzeFamily/index.js
// 核心匹配引擎云函数
// 支持：analyze + searchProducts + getProduct + getAllProducts + getProductVersion
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const InsuranceEngine = require('./insurance-engine');
const db = cloud.database();

var dbProductsCache = null;
var dbCacheTime = 0;
var CACHE_TTL = 60000; // 1分钟缓存

function isDisplayableDB(p) {
  if (!p) return false;
  if (p.status && p.status !== 'active') return false;
  if (p.active === false) return false;
  if (p.displayAllowed === false) return false;
  if (p.qualityScore !== undefined && p.qualityScore < 70) return false;
  if (p.coverageCompleteness !== undefined && p.coverageCompleteness < 60) return false;
  if (!p.name || !p.type) return false;
  if (!p.price && p.price !== 0 && !p.coverage && (!p.recordItems || p.recordItems.length === 0)) return false;
  // 复核超过 180 天不展示
  if (p.lastReviewedAt) {
    var days = Math.floor((Date.now() - new Date(p.lastReviewedAt).getTime()) / 86400000);
    if (days > 180) return false;
  }
  return true;
}

/** 从数据库加载产品列表（不过滤，保留全量供后台管理） */
async function loadProductsFromDB() {
  var now = Date.now();
  if (dbProductsCache && (now - dbCacheTime) < CACHE_TTL) {
    return dbProductsCache;
  }
  try {
    var res = await db.collection('products').where({ active: true }).limit(200).get();
    if (res.data && res.data.length > 0) {
      dbProductsCache = res.data;
      dbCacheTime = now;
      return res.data;
    }
  } catch(e) {
    console.log('DB产品加载失败，使用兜底数据:', e.message);
  }
  return null;
}

/** 获取当前产品版本号 */
async function getProductVersion() {
  try {
    var res = await db.collection('config').doc('productVersion').get();
    return (res.data && res.data.version) || 0;
  } catch(e) {
    return 0;
  }
}

exports.main = async (event, context) => {
  const { action, members, policies, query, version } = event;

  try {
    switch (action) {
      // === 完整分析 ===
      case 'analyze':
        if (!members || !policies) {
          return { success: false, error: '缺少参数' };
        }
        var dbProducts = await loadProductsFromDB();
        if (dbProducts) {
          var displayableProducts = dbProducts.filter(isDisplayableDB);
          InsuranceEngine.setProducts(displayableProducts);
        }
        var result = InsuranceEngine.analyze({ members, policies });
        var priorityOrder = { P0:0, P1:1, P2:2 };
        result.gaps.sort((a,b) => (priorityOrder[a.priority]||99) - (priorityOrder[b.priority]||99));
        result.recommendations.sort((a,b) => (priorityOrder[a.priority]||99) - (priorityOrder[b.priority]||99));
        return {
          success: true, data: result,
          stats: {
            totalMembers: members.length, totalPolicies: policies.length,
            totalGaps: result.gaps.length,
            p0Gaps: result.gaps.filter(g => g.priority==='P0').length,
            p1Gaps: result.gaps.filter(g => g.priority==='P1').length
          }
        };

      // === 样例搜索（供资料表单自动补全） ===
      case 'searchProducts':
        if (!query || query.trim().length < 1) {
          return { success: true, data: [] };
        }
        var q = query.trim().toLowerCase();
        var dbProds = await loadProductsFromDB();
        var rawProducts = dbProds || InsuranceEngine.getProducts();
        var products = rawProducts.filter(isDisplayableDB);
        var matches = products.filter(function(p) {
          return p.name.toLowerCase().indexOf(q) > -1 ||
            p.company.toLowerCase().indexOf(q) > -1 ||
            p.type.indexOf(q) > -1;
        }).slice(0, 8).map(function(p) {
          return {
            id: p.id || p._id, name: p.name, company: p.company, type: p.type,
            companyRating: p.companyRating, coverage: p.coverage,
            guaranteeType: p.guaranteeType, features: (p.features || []).slice(0,4),
            deductible: p.deductible, waitingDays: p.waitingDays,
            healthStrictness: p.healthStrictness,
            ageRange: p.ageRange
          };
        });
        return { success: true, data: matches };

      // === 产品详情 ===
      case 'getProduct':
        var dbAll = await loadProductsFromDB();
        var all = dbAll || InsuranceEngine.getProducts();
        var prod = all.find(function(p) { return (p.id || p._id) === event.productId; });
        return prod ? { success: true, data: prod } : { success: false, error: '产品不存在' };

      // === 获取全部产品（客户端同步用） ===
      case 'getAllProducts':
        var currentVersion = await getProductVersion();
        if (version && version >= currentVersion && version > 0) {
          return { success: true, data: { products: [], version: currentVersion, unchanged: true } };
        }
        var allProducts = await loadProductsFromDB();
        if (!allProducts) {
          allProducts = InsuranceEngine.DEFAULT_PRODUCTS;
          currentVersion = 0;
        }
        return { success: true, data: { products: allProducts, version: currentVersion } };

      // === 获取产品版本号 ===
      case 'getProductVersion':
        var ver = await getProductVersion();
        return { success: true, data: { version: ver } };

      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
};
