// utils/api.js — 统一接口（云函数优先 · 本地回退 · 自动补全）
var localEngine = require('./insurance-engine');
var productLoader = require('./product-loader');

/** 注入最新产品到引擎（只注入可展示的） */
function syncProducts() {
  localEngine.setProducts(productLoader.getDisplayableProducts());
}

/** 调用云函数 */
function callCloud(action, data) {
  return wx.cloud.callFunction({
    name: 'analyzeFamily',
    data: Object.assign({ action: action }, data)
  }).then(function(res) {
    if (res.result && res.result.success) return res.result.data;
    throw new Error(res.result ? res.result.error : '云函数失败');
  });
}

/** 分析家庭资料 */
function analyzeFamily(members, policies) {
  return new Promise(function(resolve) {
    syncProducts();
    if (wx && wx.cloud) {
      callCloud('analyze', { members: members, policies: policies })
        .then(function(data) { resolve(data); })
        .catch(function() { resolve(localAnalyze(members, policies)); });
    } else {
      resolve(localAnalyze(members, policies));
    }
  });
}

/** 样例搜索（资料表单自动补全） */
function searchProducts(query) {
  return new Promise(function(resolve) {
    if (!query || query.trim().length < 1) { resolve([]); return; }
    if (wx && wx.cloud) {
      callCloud('searchProducts', { query: query })
        .then(function(data) { resolve(data); })
        .catch(function() { resolve(localSearch(query)); });
    } else {
      resolve(localSearch(query));
    }
  });
}

function localAnalyze(members, policies) {
  syncProducts();
  return localEngine.analyze({ members: members, policies: policies });
}

function localSearch(query) {
  var q = query.trim().toLowerCase();
  var products = productLoader.getDisplayableProducts();
  return products.filter(function(p) {
    return p.name.toLowerCase().indexOf(q) > -1 || p.company.toLowerCase().indexOf(q) > -1 || p.type.indexOf(q) > -1;
  }).slice(0, 8).map(function(p) {
    return { id: p.id, name: p.name, company: p.company, type: p.type, companyRating: p.companyRating, coverage: p.coverage, guaranteeType: p.guaranteeType, features: p.features.slice(0,4), deductible: p.deductible, waitingDays: p.waitingDays, healthStrictness: p.healthStrictness };
  });
}

module.exports = { analyzeFamily: analyzeFamily, searchProducts: searchProducts };
