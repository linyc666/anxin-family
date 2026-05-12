// utils/record-content.js - 资料核心内容结构化解析
// 从 record 的 detail/coverage/tags/guaranteedYears 字段解析结构化内容项

var FIELD_DEFS = {};
FIELD_DEFS['百万医疗'] = [
  { key: 'inpatientAmount', label: '医保内/一般住院', hint: '一般住院年度上限，常见200万-300万' },
  { key: 'criticalAmount', label: '医保外/大额事项', hint: '范围外或大额事项单独额度' },
  { key: 'drugCoverage', label: '特药/外购药', hint: '特定药品、院外药或外购药额度' },
  { key: 'costBoundary', label: '费用边界', hint: '免除金额、自付比例、社保内外限制' },
  { key: 'guarantee', label: '延续条件', hint: '1年/6年/20年/长期，是否可延续' }
];
FIELD_DEFS['意外险'] = [
  { key: 'generalAmount', label: '一般意外额度', hint: '常见50万-100万' },
  { key: 'suddenDeath', label: '猝死额度', hint: '是否单独列明猝死责任' },
  { key: 'accidentMedical', label: '意外医疗', hint: '就医费用额度、免除金额和范围' },
  { key: 'trafficAmount', label: '交通场景额度', hint: '飞机/火车/汽车可能不同' },
  { key: 'extraLiability', label: '津贴/第三方', hint: '住院津贴、第三者责任等附加内容' }
];
FIELD_DEFS['重疾险'] = [
  { key: 'mainAmount', label: '大额事项额度', hint: '一次性或分次给付，常见30万-80万' },
  { key: 'mildAmount', label: '轻度事项额度', hint: '常见为主项的20%-40%' },
  { key: 'term', label: '责任期限', hint: '长期/定期/至固定年龄' },
  { key: 'waiting', label: '等待期', hint: '常见90-180天' },
  { key: 'relatedParty', label: '相关人', hint: '受益人/关联方是否已明确' }
];
FIELD_DEFS['定寿'] = [
  { key: 'coverageAmount', label: '责任额度', hint: '常见与房贷、收入责任相关' },
  { key: 'term', label: '责任期限', hint: '20年/30年/至固定年龄' },
  { key: 'relatedParty', label: '相关人信息', hint: '受益人是否已指定' },
  { key: 'effectiveDate', label: '生效日期', hint: '合同生效时间' },
  { key: 'expiry', label: '到期时间', hint: '合同到期日' }
];
FIELD_DEFS['惠民保'] = [
  { key: 'amount', label: '额度', hint: '常见百万级' },
  { key: 'deductible', label: '免除/自付', hint: '免赔额常见1万-2万' },
  { key: 'payRatio', label: '给付比例', hint: '常见60%-80%' },
  { key: 'cityScope', label: '适用城市', hint: '通常仅限参保城市' },
  { key: 'expiry', label: '有效期', hint: '多数按年度核对' }
];
FIELD_DEFS['防癌险'] = [
  { key: 'amount', label: '专项额度', hint: '常见10万-30万' },
  { key: 'drugCoverage', label: '药品费用', hint: '特定药品是否单独列明' },
  { key: 'waiting', label: '等待期', hint: '常见90天' },
  { key: 'guarantee', label: '延续条件', hint: '长期型/年度型' },
  { key: 'expiry', label: '到期日期', hint: '到期时间' }
];
FIELD_DEFS['车险'] = [
  { key: 'thirdPartyAmount', label: '三者额度', hint: '常见100万/200万/300万' },
  { key: 'vehicleDamage', label: '车损相关', hint: '是否包含车辆损失' },
  { key: 'driverPassenger', label: '驾乘相关', hint: '是否单列驾驶/乘坐' },
  { key: 'extraItems', label: '附加项目', hint: '道路救援、代步车等' },
  { key: 'expiry', label: '到期时间', hint: '建议提前提醒' }
];
FIELD_DEFS['房险'] = [
  { key: 'propertyScope', label: '房屋/财产范围', hint: '地址、建筑面积、财产清单' },
  { key: 'thirdParty', label: '第三方责任', hint: '对他人造成的损失额度' },
  { key: 'damageScope', label: '水火盗损边界', hint: '火灾/水浸/盗窃/自然灾害' },
  { key: 'address', label: '地址/标的', hint: '具体房屋地址' },
  { key: 'expiry', label: '到期时间', hint: '到期日期' }
];
FIELD_DEFS['家财险'] = [
  { key: 'propertyScope', label: '财产范围', hint: '家具、电器、贵重物品' },
  { key: 'liability', label: '责任边界', hint: '对第三方的责任额度' },
  { key: 'premium', label: '年度支出', hint: '年度费用' },
  { key: 'effectiveDate', label: '生效日期', hint: '合同生效时间' },
  { key: 'expiry', label: '到期日期', hint: '合同到期日' }
];
FIELD_DEFS['分红险'] = [
  { key: 'premium', label: '年度支出', hint: '年缴金额' },
  { key: 'term', label: '储蓄期限', hint: '缴费期限和满期时间' },
  { key: 'expectation', label: '预期说明', hint: '公开资料中的参考信息' },
  { key: 'effectiveDate', label: '生效日期', hint: '合同生效时间' },
  { key: 'policyNo', label: '编号/凭证号', hint: '用于查找和管理' }
];

var DEFAULT_FIELDS = [
  { key: 'amount', label: '额度/范围', hint: '核心额度或覆盖范围' },
  { key: 'premium', label: '年度支出', hint: '年度费用' },
  { key: 'effective', label: '生效日期', hint: '合同生效时间' },
  { key: 'expiry', label: '到期时间', hint: '到期日' },
  { key: 'guarantee', label: '延续条件', hint: '续期方式' }
];

function parseDetailKV(detail) {
  if (!detail) return {};
  var result = {};
  var lines = detail.split(/[;；\n·]/);
  lines.forEach(function(line) {
    line = line.trim();
    if (!line) return;
    var idx = line.indexOf(':');
    if (idx === -1) idx = line.indexOf('：');
    if (idx > -1) {
      var k = line.slice(0, idx).trim();
      var v = line.slice(idx + 1).trim();
      if (k && v) result[k] = v;
    }
  });
  return result;
}

function extractValue(record, fd) {
  var key = fd.key;
  var kv = parseDetailKV(record.detail || '');
  var coverage = record.coverage || '';
  var tags = record.tags || '';
  var text = [record.coverage, record.detail, record.tags, record.guaranteedYears].filter(Boolean).join(' · ');

  function numRe(prefix, suffix) {
    var re = new RegExp(prefix + '[^\\d]*(\\d+[万Ww])', 'i');
    var m = coverage.match(re);
    return m ? m[1] : '';
  }

  function matchText(patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i]);
      if (m) return m[1] || m[0];
    }
    return '';
  }

  switch (key) {
    case 'inpatientAmount': return matchText([/医保内[^0-9]*(\d+(?:\.\d+)?万)/, /一般[^0-9]*(\d+(?:\.\d+)?万)/, /住院[^0-9]*(\d+(?:\.\d+)?万)/]) || kv['住院额度'] || kv['住院'] || '';
    case 'criticalAmount': return matchText([/医保外[^0-9]*(\d+(?:\.\d+)?万)/, /范围外[^0-9]*(\d+(?:\.\d+)?万)/, /重疾[^0-9]*(\d+(?:\.\d+)?万)/, /大额[^0-9]*(\d+(?:\.\d+)?万)/]) || kv['大额事项额度'] || kv['大额'] || '';
    case 'costBoundary': return kv['费用边界'] || kv['免赔'] || matchText([/(0免赔[^·，,]*)/, /(不限社保[^·，,]*)/, /(100%[^·，,]*)/, /(一般\d+万?免赔[^·，,]*)/]) || (tags.indexOf('免赔') > -1 ? tags : '') || '';
    case 'specialItems': return kv['外购药'] || kv['特殊项目'] || matchText([/(CAR-T[^·，,]*)/, /(质子重离子[^·，,]*)/, /(外购药\d+(?:\.\d+)?万)/]) || (tags.indexOf('CAR-T') > -1 || tags.indexOf('外购') > -1 ? tags : '') || '';
    case 'guarantee': return record.guaranteedYears || kv['延续条件'] || '';
    case 'generalAmount': return matchText([/一般意外[^0-9]*(\d+(?:\.\d+)?万)/, /意外(?:身故\/伤残)?[^0-9]*(\d+(?:\.\d+)?万)/]) || kv['意外额度'] || '';
    case 'suddenDeath': return matchText([/猝死[^0-9]*(\d+(?:\.\d+)?万)/]) || kv['猝死'] || '';
    case 'accidentMedical': return matchText([/意外医疗[^0-9]*(\d+(?:\.\d+)?万)/, /医疗[^0-9]*(\d+(?:\.\d+)?万)/]) || kv['医疗费用'] || kv['费用范围'] || '';
    case 'trafficAmount': return matchText([/航空[^0-9]*(\d+(?:\.\d+)?万)/, /交通[^0-9]*(\d+(?:\.\d+)?万)/, /火车\/轮船\/地铁[^0-9]*(\d+(?:\.\d+)?万)/]) || kv['交通场景额度'] || '';
    case 'extraLiability': return matchText([/(住院津贴\d+元\/天[^·，,]*)/, /(第三者责任\d+(?:\.\d+)?万)/]) || kv['津贴'] || kv['第三方'] || '';
    case 'medicalRange': return kv['医疗费用'] || kv['费用范围'] || matchText([/意外医疗[^·，,]*/]) || coverage || '';
    case 'occupationLimit': return kv['职业限制'] || kv['场景限制'] || '';
    case 'mainAmount': return numRe('额度') || numRe('万') || kv['大额事项额度'] || kv['额度'] || coverage || '';
    case 'mildAmount': return kv['轻度事项额度'] || kv['轻度'] || '';
    case 'term': return record.guaranteedYears || kv['期限'] || kv['责任期限'] || '';
    case 'waiting': return kv['等待期'] || '';
    case 'relatedParty': return kv['受益人'] || kv['相关人'] || '';
    case 'thirdPartyAmount': return numRe('三者') || kv['三者额度'] || '';
    case 'vehicleDamage': return kv['车损'] || (tags.indexOf('车损') > -1 ? '含车损' : '') || '';
    case 'driverPassenger': return kv['驾乘'] || (tags.indexOf('驾乘') > -1 ? '含驾乘' : '') || '';
    case 'extraItems': return kv['附加'] || tags || '';
    case 'propertyScope': return coverage || kv['范围'] || '';
    case 'thirdParty': return kv['第三方'] || kv['责任'] || '';
    case 'damageScope': return kv['损毁范围'] || kv['边界'] || '';
    case 'address': return kv['地址'] || '';
    case 'effectiveDate': return record.effective || '';
    case 'expiry': return record.expiry || '';
    case 'amount': return coverage || kv['额度'] || '';
    case 'coverageAmount': return coverage || kv['额度'] || '';
    case 'cityScope': return kv['城市'] || kv['适用范围'] || '';
    case 'deductible': return kv['免赔'] || kv['费用边界'] || (tags.indexOf('免赔') > -1 ? tags : '') || '';
    case 'payRatio': return kv['给付比例'] || '';
    case 'drugCoverage': return kv['药品'] || kv['药品费用'] || '';
    case 'premium': return record.premium ? ('¥' + parseInt(record.premium).toLocaleString() + '/年') : '';
    case 'policyNo': return record.policyNo || '';
    case 'expectation': return kv['预期'] || kv['说明'] || '';
    default: return kv[key] || '';
  }
}

function buildContentItems(record) {
  if (!record) return [];
  var defs = FIELD_DEFS[record.type] || DEFAULT_FIELDS;
  return defs.map(function(fd) {
    var val = extractValue(record, fd);
    var clean = (val || '').replace(/\s+/g, ' ').trim();
    return {
      key: fd.key,
      label: fd.label,
      hint: fd.hint,
      value: clean || '待补充',
      status: clean ? 'filled' : 'missing'
    };
  });
}

function getFieldDefs(type) {
  return FIELD_DEFS[type] || DEFAULT_FIELDS;
}

module.exports = { buildContentItems: buildContentItems, getFieldDefs: getFieldDefs };
