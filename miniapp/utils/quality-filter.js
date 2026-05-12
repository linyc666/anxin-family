// utils/quality-filter.js — 产品入库质量门槛（小程序版）
// 评估产品入库质量，标注：推荐 / 有条件 / 不推荐

var RULES = {
  '百万医疗': [
    { check: function(p) { return (p.guaranteeYears || 0) >= 6; },
      fail: '延续期不足6年' },
    { check: function(p) { var cov = p.coverage || ''; return cov.indexOf('200万') > -1 || cov.indexOf('300万') > -1 || cov.indexOf('400万') > -1; },
      fail: '额度低于200万' },
    { check: function(p) { return (p.healthStrictness || 3) <= 2; },
      fail: '健告过于严格' }
  ],
  '重疾险': [
    { check: function(p) { var gt = p.guaranteeType || ''; return gt.indexOf('终身') > -1; },
      fail: '非长期延续' },
    { check: function(p) { var cov = p.coverage || ''; var m = cov.match(/(\d+)万/); return m && parseInt(m[1]) >= 30; },
      fail: '大额事项额度低于30万' }
  ],
  '意外险': [
    { check: function(p) { var ded = p.deductible || ''; return ded.indexOf('0免赔') > -1; },
      fail: '有费用边界限制' },
    { check: function(p) { var cov = p.coverage || ''; var m = cov.match(/(\d+)万/); return m && parseInt(m[1]) >= 20; },
      fail: '意外额度低于20万' }
  ],
  '定寿': [
    { check: function(p) { var cov = p.coverage || ''; var m = cov.match(/(\d+)万/); return m && parseInt(m[1]) >= 100; },
      fail: '责任额度低于100万' },
    { check: function(p) { var cr = p.companyRating || ''; return cr === 'AA' || cr === 'A类' || cr === 'B+类'; },
      fail: '公司评级偏低' }
  ],
  '防癌险': [
    { check: function(p) { var gt = p.guaranteeType || ''; return gt.indexOf('终身') > -1; },
      fail: '非长期延续' },
    { check: function(p) { var ded = p.deductible || ''; return ded.indexOf('0免赔') > -1; },
      fail: '有费用边界限制' }
  ],
  '惠民保': [
    { check: function(p) { return (p.companyRating || '') === '政府指导'; },
      fail: '非官方指导' }
  ],
  '财产险': [
    { check: function(p) { return (p.score || 0) >= 70; }, fail: '综合评分低于70' },
    { check: function(p) { return p.active === true; }, fail: '已停用' }
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

// 未知类型的通用兜底规则
function getFallbackRules() {
  return [
    { check: function(p) { return (p.score || 0) >= 60; }, fail: '综合评分低于60' }
  ];
}

var COMMON_RULES = [
  { check: function(p) { return (p.score || 0) >= 70; },
    fail: '综合评分低于70' },
  { check: function(p) { return p.active === true; },
    fail: '已停用' }
];

function evaluate(product) {
  var issues = [];
  var totalChecks = 0;
  var passedChecks = 0;

  COMMON_RULES.forEach(function(rule) {
    totalChecks++;
    if (!rule.check(product)) { issues.push({ reason: rule.fail, severity: 'high' }); }
    else { passedChecks++; }
  });

  var typeRules = RULES[product.type] || getFallbackRules();
  if (typeRules) {
    typeRules.forEach(function(rule) {
      totalChecks++;
      if (!rule.check(product)) {
        issues.push({ reason: rule.fail, severity: rule.fail.indexOf('建议优先') > -1 ? 'medium' : 'high' });
      } else { passedChecks++; }
    });
  }

  var ratio = totalChecks > 0 ? passedChecks / totalChecks : 1;
  var highCount = issues.filter(function(i) { return i.severity === 'high'; }).length;

  var level;
  if (highCount === 0 && ratio >= 0.8) { level = 'recommend'; }
  else if (highCount <= 1 && ratio >= 0.5) { level = 'conditional'; }
  else { level = 'reject'; }

  return {
    level: level,
    score: Math.round(ratio * 100),
    passed: passedChecks,
    total: totalChecks,
    issues: issues,
    label: level === 'recommend' ? '优质' : level === 'conditional' ? '可用' : '待改善'
  };
}

function filterBatch(products, minLevel) {
  minLevel = minLevel || 'conditional';
  var levelOrder = { recommend: 0, conditional: 1, reject: 2 };
  return products.filter(function(p) {
    var result = evaluate(p);
    return levelOrder[result.level] <= levelOrder[minLevel];
  });
}

module.exports = { evaluate: evaluate, filterBatch: filterBatch, RULES: RULES };
