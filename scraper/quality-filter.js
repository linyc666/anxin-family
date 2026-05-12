// scraper/quality-filter.js — 产品入库质量门槛
// 对每个产品进行分级评估：推荐 / 有条件 / 不推荐
// 用法：node -e "var qf=require('./quality-filter'); ..."

/**
 * 各险种质量门槛规则
 * 每条规则返回 { pass: bool, reason: string }
 */
var RULES = {
  '百万医疗': [
    { check: function(p) { return (p.guaranteeYears || 0) >= 6; },
      fail: '续保期不足6年，建议优先录入保证续保产品' },
    { check: function(p) { var cov = p.coverage || ''; return cov.indexOf('200万') > -1 || cov.indexOf('300万') > -1 || cov.indexOf('400万') > -1; },
      fail: '保额低于200万，保障不足' },
    { check: function(p) { return (p.healthStrictness || 3) <= 2; },
      fail: '健告过于严格，适用人群受限' }
  ],
  '重疾险': [
    { check: function(p) { var gt = p.guaranteeType || ''; return gt.indexOf('终身') > -1; },
      fail: '非终身保证，建议优先录入终身型重疾险' },
    { check: function(p) { var cov = p.coverage || ''; return /\d+万/.test(cov) && parseInt(cov.match(/\d+/)[0]) >= 30; },
      fail: '重疾保额低于30万，保障不足' },
    { check: function(p) { return (p.waitingDays || 999) <= 180; },
      fail: '等待期超过180天' }
  ],
  '意外险': [
    { check: function(p) { var ded = p.deductible || ''; return ded.indexOf('0免赔') > -1; },
      fail: '意外医疗有免赔额，建议优先0免赔产品' },
    { check: function(p) { var cov = p.coverage || ''; var m = cov.match(/(\d+)万/); return m && parseInt(m[1]) >= 20; },
      fail: '意外保额低于20万' }
  ],
  '定寿': [
    { check: function(p) { var cov = p.coverage || ''; var m = cov.match(/(\d+)万/); return m && parseInt(m[1]) >= 100; },
      fail: '定寿保额低于100万，覆盖不足' },
    { check: function(p) { var cr = p.companyRating || ''; return cr === 'AA' || cr === 'A类' || cr === 'B+类'; },
      fail: '公司评级偏低（B类及以下）' },
    { check: function(p) { return (p.healthStrictness || 3) <= 1; },
      fail: '健康告知条目过多' }
  ],
  '防癌险': [
    { check: function(p) { var gt = p.guaranteeType || ''; return gt.indexOf('终身') > -1; },
      fail: '非终身保证续保，建议优先终身型防癌险' },
    { check: function(p) { var ded = p.deductible || ''; return ded.indexOf('0免赔') > -1; },
      fail: '有免赔额，防癌险应优先0免赔' },
    { check: function(p) { return (p.healthStrictness || 3) <= 1; },
      fail: '健告过严，防癌险应宽松投保' }
  ],
  '惠民保': [
    { check: function(p) { return (p.companyRating || '') === '政府指导'; },
      fail: '非政府指导，可能非正规惠民保产品' }
  ],
  '财产险': [
    { check: function(p) { return (p.score || 0) >= 70; }, fail: '综合评分低于70' }
  ],
  '分红险': [
    { check: function(p) { return (p.score || 0) >= 70; }, fail: '综合评分低于70' },
    { check: function(p) { var cr = p.companyRating || ''; return cr === 'AA' || cr === 'A类' || cr === 'B+类'; }, fail: '公司评级偏低' }
  ],
  '年金险': [
    { check: function(p) { return (p.score || 0) >= 70; }, fail: '综合评分低于70' },
    { check: function(p) { var cr = p.companyRating || ''; return cr === 'AA' || cr === 'A类' || cr === 'B+类'; }, fail: '公司评级偏低' }
  ],
  '车险': [
    { check: function(p) { return (p.score || 0) >= 70; }, fail: '综合评分低于70' }
  ]
};

function getFallbackRules() {
  return [
    { check: function(p) { return (p.score || 0) >= 60; }, fail: '综合评分低于60' }
  ];
}

/** 默认规则（所有险种通用） */
var COMMON_RULES = [
  { check: function(p) { return (p.score || 0) >= 70; },
    fail: '综合评分低于70' },
  { check: function(p) { return p.active === true; },
    fail: '产品已停售' }
];

/**
 * 评估单个产品
 * @returns { level: 'recommend'|'conditional'|'reject', score: 0-100, issues: [] }
 */
function evaluate(product) {
  var issues = [];
  var totalChecks = 0;
  var passedChecks = 0;

  // 通用规则
  COMMON_RULES.forEach(function(rule) {
    totalChecks++;
    if (!rule.check(product)) {
      issues.push({ type: '通用', reason: rule.fail, severity: 'high' });
    } else {
      passedChecks++;
    }
  });

  // 险种特定规则
  var typeRules = RULES[product.type] || getFallbackRules();
  if (typeRules) {
    typeRules.forEach(function(rule) {
      totalChecks++;
      if (!rule.check(product)) {
        var severity = rule.fail.indexOf('建议优先') > -1 ? 'medium' : 'high';
        issues.push({ type: product.type, reason: rule.fail, severity: severity });
      } else {
        passedChecks++;
      }
    });
  }

  var ratio = totalChecks > 0 ? passedChecks / totalChecks : 1;
  var highIssues = issues.filter(function(i) { return i.severity === 'high'; });

  var level;
  if (highIssues.length === 0 && ratio >= 0.8) {
    level = 'recommend';
  } else if (highIssues.length <= 1 && ratio >= 0.5) {
    level = 'conditional';
  } else {
    level = 'reject';
  }

  return {
    level: level,
    score: Math.round(ratio * 100),
    passed: passedChecks,
    total: totalChecks,
    issues: issues,
    label: level === 'recommend' ? '✅ 推荐' : level === 'conditional' ? '⚠️ 有条件' : '❌ 不推荐'
  };
}

/**
 * 批量评估，返回筛选后的产品列表
 * @param {Array} products - 产品数组
 * @param {string} minLevel - 最低接受级别: 'recommend' | 'conditional' | 'reject'
 */
function filterBatch(products, minLevel) {
  minLevel = minLevel || 'conditional';
  var levelOrder = { recommend: 0, conditional: 1, reject: 2 };
  var results = products.map(function(p, i) {
    var evalResult = evaluate(p);
    return { index: i, product: p, evaluation: evalResult };
  });

  var filtered = results.filter(function(r) {
    return levelOrder[r.evaluation.level] <= levelOrder[minLevel];
  });

  var summary = {
    total: results.length,
    recommend: results.filter(function(r) { return r.evaluation.level === 'recommend'; }).length,
    conditional: results.filter(function(r) { return r.evaluation.level === 'conditional'; }).length,
    reject: results.filter(function(r) { return r.evaluation.level === 'reject'; }).length,
    accepted: filtered.length
  };

  return { results: results, filtered: filtered, summary: summary };
}

module.exports = { RULES: RULES, COMMON_RULES: COMMON_RULES, evaluate: evaluate, filterBatch: filterBatch };
