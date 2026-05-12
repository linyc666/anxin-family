// utils/record-profile-sections.js - 资料画像结构化展示
// 按资料类型生成 profileSections，用于资料卡/详情页/清单页

var TYPE_TEMPLATES = {
  '百万医疗': {
    categoryLabel: '医疗支出资料',
    summaryTemplate: function(r) {
      var parts = [];
      var cov = r.coverage || '';
      if (cov) parts.push(cov.replace(/万/g, '万').split('·')[0] || cov);
      var prem = r.premium ? '¥' + parseInt(r.premium).toLocaleString() + '/年' : '';
      if (prem) parts.push(prem);
      return parts.join(' · ') || '医疗支出相关资料';
    },
    sections: function(r, source) {
      var s = [];
      s.push({ title: '类目', text: '医疗支出资料', source: source });
      if (r.name) s.push({ title: '原文名称', text: r.name, source: source });
      // 核心内容
      var core = [];
      var cov = r.coverage || r.detail || '';
      if (cov) {
        var nums = cov.match(/(\d+万[^\s，,·]*)/g);
        if (nums) core = nums.slice(0, 5);
        else core = [cov.slice(0, 60)];
      }
      if (r.contentItems) {
        var ciTexts = r.contentItems.filter(function(ci) { return ci.value && ci.value !== '待补充'; }).map(function(ci) { return ci.label + ' ' + ci.value; });
        if (ciTexts.length > 0) core = ciTexts.slice(0, 5);
      }
      if (core.length > 0) s.push({ title: '核心内容', text: core.join(' · '), source: source });
      // 费用边界
      var boundary = [];
      if (r.deductible) boundary.push(r.deductible);
      if (r.guaranteedYears) boundary.push(r.guaranteedYears.replace(/保证/g, '').replace(/续保/g, '延续'));
      var detailKV = parseDetailKV(r.detail || '');
      if (detailKV['等待期']) boundary.push('等待期' + detailKV['等待期']);
      if (detailKV['赔付比例'] || detailKV['比例']) boundary.push((detailKV['赔付比例'] || detailKV['比例']));
      if (r.tags && boundary.length < 3) boundary.push(r.tags.slice(0, 30));
      if (boundary.length > 0) s.push({ title: '费用边界', text: boundary.join(' · '), source: source });
      // 时间
      var time = [];
      if (r.effective) time.push(r.effective);
      if (r.expiry) time.push(r.expiry);
      if (time.length > 0) s.push({ title: '时间', text: time.join(' 至 '), source: source });
      // 重点核对
      s.push({ title: '重点核对', text: '医院范围 · 外购药 · 特药清单 · 延续条件 · 健康告知', source: source === 'user_record' ? 'user_record' : 'category_template', needsConfirm: source !== 'user_record' });
      return s;
    }
  },
  '意外险': {
    categoryLabel: '意外风险资料',
    summaryTemplate: function(r) {
      var cov = r.coverage || '';
      return (cov ? cov.replace(/万/g, '万').split('·')[0] : '意外风险相关资料');
    },
    sections: function(r, source) {
      var s = [];
      s.push({ title: '类目', text: '意外风险资料', source: source });
      if (r.name) s.push({ title: '原文名称', text: r.name, source: source });
      var cov = r.coverage || r.detail || '';
      if (cov) s.push({ title: '核心内容', text: cov.replace(/意外/g, '').slice(0, 80), source: source });
      var boundary = [];
      if (r.deductible) boundary.push(r.deductible);
      if (r.guaranteedYears) boundary.push(r.guaranteedYears.replace(/保证/g, '').replace(/续保/g, '延续'));
      if (r.tags) boundary.push(r.tags.slice(0, 30));
      var prem = r.premium ? '¥' + parseInt(r.premium).toLocaleString() + '/年' : '';
      if (prem) s.push({ title: '支出', text: prem, source: source });
      if (boundary.length > 0) s.push({ title: '费用边界/附加', text: boundary.join(' · '), source: source });
      var t = [];
      if (r.effective) t.push(r.effective);
      if (r.expiry) t.push(r.expiry);
      if (t.length > 0) s.push({ title: '时间', text: t.join(' 至 '), source: source });
      s.push({ title: '重点核对', text: '职业类别 · 高风险运动 · 是否限社保 · 交通责任是否叠加', source: source === 'user_record' ? 'user_record' : 'category_template', needsConfirm: source !== 'user_record' });
      return s;
    }
  },
  '重疾险': {
    categoryLabel: '大额支出资料',
    summaryTemplate: function(r) {
      var cov = r.coverage || '';
      return (cov ? cov.replace(/万/g, '万').split('·')[0] : '大额支出相关资料');
    },
    sections: function(r, source) {
      var s = [];
      s.push({ title: '类目', text: '大额支出资料', source: source });
      if (r.name) s.push({ title: '原文名称', text: r.name, source: source });
      var cov = r.coverage || r.detail || '';
      if (cov) s.push({ title: '核心内容', text: cov.slice(0, 80), source: source });
      var boundary = [];
      if (r.guaranteedYears) boundary.push(r.guaranteedYears.replace(/保证/g, '').replace(/续保/g, '延续'));
      var detailKV = parseDetailKV(r.detail || '');
      if (detailKV['等待期']) boundary.push('等待期' + detailKV['等待期']);
      var prem = r.premium ? '¥' + parseInt(r.premium).toLocaleString() + '/年' : '';
      if (prem) s.push({ title: '支出', text: prem, source: source });
      if (boundary.length > 0) s.push({ title: '期限/等待', text: boundary.join(' · '), source: source });
      var t = [];
      if (r.effective) t.push(r.effective);
      if (r.expiry) t.push(r.expiry);
      if (t.length > 0) s.push({ title: '时间', text: t.join(' 至 '), source: source });
      s.push({ title: '重点核对', text: '病种分组 · 给付次数 · 等待期 · 后续是否需重新核对健康情况', source: source === 'user_record' ? 'user_record' : 'category_template', needsConfirm: source !== 'user_record' });
      return s;
    }
  },
  '定寿': {
    categoryLabel: '家庭责任资料',
    summaryTemplate: function(r) {
      var cov = r.coverage || '';
      return (cov ? cov.slice(0, 60) : '家庭责任相关资料');
    },
    sections: function(r, source) {
      var s = [];
      s.push({ title: '类目', text: '家庭责任资料', source: source });
      if (r.name) s.push({ title: '原文名称', text: r.name, source: source });
      var cov = r.coverage || r.detail || '';
      if (cov) s.push({ title: '核心内容', text: cov.slice(0, 80), source: source });
      var boundary = [];
      if (r.guaranteedYears) boundary.push(r.guaranteedYears.replace(/保证/g, '').replace(/续保/g, '延续'));
      var prem = r.premium ? '¥' + parseInt(r.premium).toLocaleString() + '/年' : '';
      if (prem) s.push({ title: '支出', text: prem, source: source });
      if (boundary.length > 0) s.push({ title: '期限', text: boundary.join(' · '), source: source });
      var t = [];
      if (r.effective) t.push(r.effective);
      if (r.expiry) t.push(r.expiry);
      if (t.length > 0) s.push({ title: '时间', text: t.join(' 至 '), source: source });
      s.push({ title: '重点核对', text: '免责条款 · 受益人 · 职业限制 · 健康要求', source: source === 'user_record' ? 'user_record' : 'category_template', needsConfirm: source !== 'user_record' });
      return s;
    }
  },
  '车险': {
    categoryLabel: '车辆资料',
    summaryTemplate: function(r) { return (r.coverage || '车辆相关资料').slice(0, 60); },
    sections: function(r, source) {
      var s = [];
      s.push({ title: '类目', text: '车辆资料', source: source });
      if (r.name) s.push({ title: '原文名称', text: r.name, source: source });
      var cov = r.coverage || r.detail || '';
      if (cov) s.push({ title: '核心内容', text: cov.slice(0, 80), source: source });
      var prem = r.premium ? '¥' + parseInt(r.premium).toLocaleString() + '/年' : '';
      if (prem) s.push({ title: '支出', text: prem, source: source });
      var t = [];
      if (r.effective) t.push(r.effective);
      if (r.expiry) t.push(r.expiry);
      if (t.length > 0) s.push({ title: '时间', text: t.join(' 至 '), source: source });
      s.push({ title: '重点核对', text: '车辆信息 · 驾驶人范围 · 免除责任 · 附加项目是否齐全', source: source === 'user_record' ? 'user_record' : 'category_template', needsConfirm: source !== 'user_record' });
      return s;
    }
  }
};

// 默认模板
var DEFAULT_TEMPLATE = {
  categoryLabel: '重要资料',
  summaryTemplate: function(r) { return (r.coverage || r.name || '重要资料').slice(0, 60); },
  sections: function(r, source) {
    var s = [];
    s.push({ title: '类目', text: r.type || '重要资料', source: source });
    if (r.name) s.push({ title: '原文名称', text: r.name, source: source });
    if (r.coverage) s.push({ title: '核心内容', text: r.coverage.slice(0, 80), source: source });
    if (r.premium) s.push({ title: '支出', text: '¥' + parseInt(r.premium).toLocaleString() + '/年', source: source });
    var t = [];
    if (r.effective) t.push(r.effective);
    if (r.expiry) t.push(r.expiry);
    if (t.length > 0) s.push({ title: '时间', text: t.join(' 至 '), source: source });
    s.push({ title: '重点核对', text: '额度/范围 · 到期时间 · 延续条件 · 编号/凭证号', source: source === 'user_record' ? 'user_record' : 'category_template', needsConfirm: source !== 'user_record' });
    return s;
  }
};

function parseDetailKV(detail) {
  if (!detail) return {};
  var result = {};
  var parts = detail.split(/[;；·\n]/);
  parts.forEach(function(p) {
    p = p.trim();
    if (!p) return;
    var idx = p.indexOf('：');
    if (idx === -1) idx = p.indexOf(':');
    if (idx > -1) {
      var k = p.slice(0, idx).trim();
      var v = p.slice(idx + 1).trim();
      if (k && v) result[k] = v;
    }
  });
  return result;
}

function getTemplate(type) {
  return TYPE_TEMPLATES[type] || DEFAULT_TEMPLATE;
}

function buildProfile(record, sourceType) {
  sourceType = sourceType || 'user_record';
  var tpl = getTemplate(record.type || '');
  return {
    categoryLabel: tpl.categoryLabel,
    originalName: record.name || '',
    summaryLine: tpl.summaryTemplate(record),
    sections: tpl.sections(record, sourceType),
    sourceType: sourceType,
    needsConfirm: sourceType !== 'user_record'
  };
}

// 清单页缺口画像
function buildGapProfile(gapType, gapTitle) {
  var tpl = getTemplate(gapType);
  return {
    categoryLabel: tpl.categoryLabel,
    summaryLine: '缺少' + tpl.categoryLabel,
    sections: tpl.sections({ type: gapType, name: gapTitle || '' }, 'category_template'),
    sourceType: 'category_template',
    needsConfirm: true
  };
}

module.exports = {
  getTemplate: getTemplate,
  buildProfile: buildProfile,
  buildGapProfile: buildGapProfile
};
