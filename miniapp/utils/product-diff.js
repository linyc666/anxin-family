// utils/product-diff.js — 产品库对比更新机制
// 用于比较本地产品库与云端/导入数据的差异
var qualityFilter = require('./quality-filter');

/**
 * 对比两套产品数据，输出差异报告
 * @param {Array} current - 当前产品库
 * @param {Array} incoming - 待导入的产品数据
 * @returns 差异报告
 */
function diff(current, incoming) {
  var curMap = {};
  current.forEach(function(p) { curMap[p.id || p._id] = p; });

  var incMap = {};
  incoming.forEach(function(p) { incMap[p.id || p._id] = p; });

  var report = { added: [], updated: [], unchanged: [], removed: [], stats: {} };

  // 检查新增和更新
  incoming.forEach(function(p) {
    var id = p.id || p._id;
    var existing = curMap[id];
    if (!existing) {
      report.added.push({ id: id, name: p.name, type: p.type, product: p });
    } else {
      var changes = compareFields(existing, p);
      if (changes.length > 0) {
        report.updated.push({ id: id, name: p.name, type: p.type, changes: changes, before: existing, after: p });
      } else {
        report.unchanged.push({ id: id, name: p.name, type: p.type });
      }
    }
  });

  // 检查移除（当前库有但导入数据没有）
  current.forEach(function(p) {
    var id = p.id || p._id;
    if (!incMap[id]) {
      report.removed.push({ id: id, name: p.name, type: p.type, product: p });
    }
  });

  report.stats = {
    totalIncoming: incoming.length,
    totalCurrent: current.length,
    added: report.added.length,
    updated: report.updated.length,
    unchanged: report.unchanged.length,
    removed: report.removed.length
  };

  return report;
}

/** 比较两个产品对象的字段差异 */
function compareFields(a, b) {
  var fields = ['name', 'company', 'type', 'coverage', 'deductible', 'guaranteeType',
                'guaranteeYears', 'score', 'active', 'healthStrictness', 'ageRange'];
  var changes = [];
  fields.forEach(function(f) {
    var va = a[f] !== undefined ? a[f] : '';
    var vb = b[f] !== undefined ? b[f] : '';
    if (String(va) !== String(vb)) {
      changes.push({ field: f, from: va, to: vb });
    }
  });

  // 价格数组特殊比较
  var paA = JSON.stringify(a.prices || []);
  var paB = JSON.stringify(b.prices || []);
  if (paA !== paB) {
    changes.push({ field: 'prices', from: '(价格已变更)', to: '(新价格)' });
  }

  return changes;
}

/**
 * 智能合并：以导入数据为准更新，但保留本地额外字段
 */
function smartMerge(current, incoming, mode) {
  mode = mode || 'update'; // 'update' | 'overwrite' | 'skipExisting'

  var curMap = {};
  current.forEach(function(p) { curMap[p.id || p._id] = p; });

  var result = current.slice();

  incoming.forEach(function(p) {
    var id = p.id || p._id;
    var existing = curMap[id];

    if (!existing) {
      result.push(p); // 新产品直接添加
    } else if (mode === 'overwrite') {
      // 完全覆盖
      result = result.map(function(ep) { return (ep.id || ep._id) === id ? p : ep; });
    } else if (mode === 'update') {
      // 仅更新核心字段
      var merged = Object.assign({}, existing);
      ['name', 'company', 'type', 'coverage', 'deductible', 'guaranteeType',
       'guaranteeYears', 'score', 'active', 'prices', 'features', 'healthStrictness',
       'ageRange', 'healthCheck', 'waitingDays', 'companyRating', 'solvency',
       'needSocialIns', 'regionRestrict', 'priceNoSocialFactor'].forEach(function(f) {
        if (p[f] !== undefined) merged[f] = p[f];
      });
      result = result.map(function(ep) { return (ep.id || ep._id) === id ? merged : ep; });
    }
    // mode === 'skipExisting': 不做任何操作
  });

  return result;
}

module.exports = { diff: diff, smartMerge: smartMerge, compareFields: compareFields };
