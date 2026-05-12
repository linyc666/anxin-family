// utils/record-profile.js - 资料类目说明与核对指引
var PROFILE = {
  '百万医疗': {
    label: '医疗支出资料',
    summary: '主要记录住院、大额医疗支出、延续条件和到期时间。',
    gapMeaning: '缺少医疗支出资料，通常用于记录住院或大额医疗支出的额度、年度支出和延续条件。',
    gapContentItems: [
      { label: '住院相关额度', hint: '如200万-300万' },
      { label: '大额事项额度', hint: '如400万-600万' },
      { label: '费用边界', hint: '免除金额、自付比例、范围限制' },
      { label: '延续条件', hint: '1年/6年/20年/长期' },
      { label: '到期日期', hint: '用于提醒' }
    ],
    checkItems: [
      { label: '住院额度', hint: '是否写清年度上限' },
      { label: '大额事项额度', hint: '是否单列更高额度' },
      { label: '费用边界', hint: '是否有免除、自付比例或范围限制' },
      { label: '延续条件', hint: '是否写明可延续时间' },
      { label: '到期日期', hint: '是否需要提前提醒' }
    ]
  },
  '意外险': {
    label: '意外风险资料',
    summary: '主要记录一般意外、交通场景和就医费用的额度与到期时间。',
    gapMeaning: '缺少意外风险资料，通常用于记录一般意外和交通场景的额度与费用范围。',
    gapContentItems: [
      { label: '一般意外额度', hint: '如50万-100万' },
      { label: '交通场景额度', hint: '飞机/火车/汽车可能不同' },
      { label: '医疗费用范围', hint: '是否含门急诊、住院' },
      { label: '职业/场景限制', hint: '是否有限制' },
      { label: '到期日期', hint: '通常按年核对' }
    ],
    checkItems: [
      { label: '意外额度', hint: '是否写明意外身故/伤残额度' },
      { label: '交通场景额度', hint: '不同交通工具额度可能不同' },
      { label: '医疗费用', hint: '是否包含意外医疗和住院费用' },
      { label: '职业限制', hint: '是否有职业或场景排除' },
      { label: '到期日期', hint: '是否需要按年提醒' }
    ]
  },
  '重疾险': {
    label: '大额支出资料',
    summary: '主要记录大额事项和轻度事项的额度、责任期限和等待期。',
    gapMeaning: '缺少大额支出资料，通常用于记录大额事项额度和收入补偿相关信息。',
    gapContentItems: [
      { label: '大额事项额度', hint: '如30万-80万' },
      { label: '轻度事项额度', hint: '如为主项的20%-40%' },
      { label: '责任期限', hint: '长期/定期/至固定年龄' },
      { label: '等待期', hint: '如90-180天' },
      { label: '编号/凭证号', hint: '用于查找' }
    ],
    checkItems: [
      { label: '大额事项额度', hint: '是否写明确诊给付金额' },
      { label: '轻度事项比例', hint: '是否写明轻度事项的给付比例' },
      { label: '责任期限', hint: '是长期还是定期' },
      { label: '等待期', hint: '等待期是否已过' },
      { label: '编号/凭证号', hint: '是否已记录便于查找' }
    ]
  },
  '定寿': {
    label: '家庭责任资料',
    summary: '主要记录家庭责任额度、责任期限和相关人信息。',
    gapMeaning: '缺少家庭责任资料，通常用于记录责任额度、责任期限和债务备忘。',
    gapContentItems: [
      { label: '责任额度', hint: '如与房贷、收入匹配' },
      { label: '责任期限', hint: '如20年/30年' },
      { label: '相关人信息', hint: '受益人是否明确' },
      { label: '生效日期', hint: '合同开始时间' },
      { label: '编号/凭证号', hint: '用于查找' }
    ],
    checkItems: [
      { label: '责任额度', hint: '是否与家庭责任匹配' },
      { label: '责任期限', hint: '是否覆盖关键责任期' },
      { label: '相关人信息', hint: '受益人是否已指定' },
      { label: '生效日期', hint: '是否在有效期内' },
      { label: '编号/凭证号', hint: '是否已记录便于查找' }
    ]
  },
  '惠民保': {
    label: '城市补充资料',
    summary: '主要记录城市补充权益的额度、范围和有效期。',
    gapMeaning: '缺少城市补充资料，通常用于记录城市补充权益的额度和有效期。',
    gapContentItems: [
      { label: '额度', hint: '如百万级' },
      { label: '免除/自付', hint: '如免赔1万-2万' },
      { label: '给付比例', hint: '如60%-80%' },
      { label: '适用城市', hint: '通常限参保地' },
      { label: '有效期', hint: '年度核对' }
    ],
    checkItems: [
      { label: '免赔额', hint: '是否写清年度免除金额' },
      { label: '给付比例', hint: '是否写清报销比例' },
      { label: '适用城市', hint: '是否在参保城市范围内' },
      { label: '有效期', hint: '是否需要在指定时间内使用' },
      { label: '特定项目', hint: '是否包含特定药品或治疗' }
    ]
  },
  '防癌险': {
    label: '健康专项资料',
    summary: '主要记录特定健康事项的专项额度、等待期和延续条件。',
    gapMeaning: '缺少健康专项资料，通常用于记录特定健康事项的专项额度和等待期。',
    gapContentItems: [
      { label: '专项额度', hint: '如10万-30万' },
      { label: '药品费用', hint: '是否单独列明' },
      { label: '等待期', hint: '如90天' },
      { label: '延续条件', hint: '长期/年度型' },
      { label: '到期日期', hint: '用于提醒' }
    ],
    checkItems: [
      { label: '专项额度', hint: '是否写清给付金额' },
      { label: '药品费用', hint: '特定药品是否覆盖' },
      { label: '等待期', hint: '等待期是否已过' },
      { label: '延续条件', hint: '到期后能否延续' },
      { label: '到期日期', hint: '是否需要提前提醒' }
    ]
  },
  '车险': {
    label: '车辆资料',
    summary: '主要记录车辆信息、三者额度、车损相关和到期时间。',
    gapMeaning: '缺少车辆资料，通常用于记录车辆信息、三者额度和到期时间。',
    gapContentItems: [
      { label: '三者额度', hint: '如100万/200万/300万' },
      { label: '车损相关', hint: '是否包含' },
      { label: '驾乘相关', hint: '是否单列' },
      { label: '附加项目', hint: '道路救援、代步等' },
      { label: '到期日期', hint: '提前提醒' }
    ],
    checkItems: [
      { label: '车辆信息', hint: '车牌号、车型是否记录' },
      { label: '三者额度', hint: '是否写清第三方责任额度' },
      { label: '车损相关', hint: '是否包含车辆损失' },
      { label: '附加项目', hint: '道路救援、代步等是否列明' },
      { label: '到期日期', hint: '是否需要提前提醒' }
    ]
  },
  '房险': {
    label: '房屋资料',
    summary: '主要记录房屋地址、财产范围、责任边界和年度支出。',
    gapMeaning: '缺少房屋资料，通常用于记录房屋地址、财产范围和责任边界。',
    gapContentItems: [
      { label: '房屋/财产范围', hint: '地址、面积、清单' },
      { label: '第三方责任', hint: '对他人损失额度' },
      { label: '水火盗损边界', hint: '具体覆盖情况' },
      { label: '地址/标的', hint: '具体地址' },
      { label: '到期时间', hint: '到期日' }
    ],
    checkItems: [
      { label: '房屋地址', hint: '是否记录具体地址' },
      { label: '财产范围', hint: '是否列明保障范围和限额' },
      { label: '责任边界', hint: '是否写清第三方责任额度' },
      { label: '年度支出', hint: '是否记录年度费用' },
      { label: '到期日期', hint: '是否需要提前提醒' }
    ]
  },
  '家财险': {
    label: '家庭财产资料',
    summary: '主要记录家庭财产的保障范围和年度支出。',
    gapMeaning: '缺少家庭财产资料，通常用于记录家庭财产范围和年度支出。',
    gapContentItems: [
      { label: '财产范围', hint: '家具、电器、贵重物' },
      { label: '责任边界', hint: '第三方责任额度' },
      { label: '年度支出', hint: '年缴金额' },
      { label: '生效日期', hint: '合同生效时间' },
      { label: '到期日期', hint: '合同到期日' }
    ],
    checkItems: [
      { label: '财产范围', hint: '是否列明财产清单和限额' },
      { label: '责任边界', hint: '是否写清免赔和自付' },
      { label: '年度支出', hint: '是否记录年度费用' },
      { label: '生效日期', hint: '是否在有效期内' },
      { label: '到期日期', hint: '是否需要提前提醒' }
    ]
  },
  '分红险': {
    label: '储蓄资料',
    summary: '主要记录长期储蓄相关信息和年度支出。',
    gapMeaning: '缺少储蓄资料，通常用于记录长期储蓄信息和年度支出。',
    gapContentItems: [
      { label: '年度支出', hint: '年缴金额' },
      { label: '储蓄期限', hint: '缴费和满期时间' },
      { label: '预期说明', hint: '公开资料参考' },
      { label: '生效日期', hint: '合同生效时间' },
      { label: '编号/凭证号', hint: '用于查找' }
    ],
    checkItems: [
      { label: '年度支出', hint: '是否记录年缴金额' },
      { label: '储蓄期限', hint: '是否写清缴费和满期时间' },
      { label: '预期说明', hint: '是否了解收益说明' },
      { label: '生效日期', hint: '是否在有效期内' },
      { label: '编号/凭证号', hint: '是否已记录便于查找' }
    ]
  }
};

var DEFAULT_PROFILE = {
  label: '重要资料',
  summary: '记录重要的额度、范围和时效信息，便于定期核对。',
  gapMeaning: '缺少重要资料记录，建议补充额度、范围和时效信息。',
  gapContentItems: [
    { label: '额度/范围', hint: '核心内容' },
    { label: '年度支出', hint: '费用记录' },
    { label: '生效日期', hint: '开始时间' },
    { label: '到期日期', hint: '用于提醒' }
  ],
  checkItems: [
    { label: '年度支出', hint: '是否记录年度费用' },
    { label: '额度/范围', hint: '是否写清核心内容' },
    { label: '生效日期', hint: '是否在有效期内' },
    { label: '到期日期', hint: '是否需要提前提醒' },
    { label: '编号/凭证号', hint: '是否已记录便于查找' }
  ]
};

function getProfile(type) { return PROFILE[type] || DEFAULT_PROFILE; }
function getLabel(type) { return getProfile(type).label; }
function getSummary(type) { return getProfile(type).summary; }
function getCheckItems(type) { return getProfile(type).checkItems; }

function getCompleteness(policy) {
  if (!policy) return { filled: 0, total: 9, percent: 0, text: '0/9' };
  var fields = ['name', 'type', 'company', 'premium', 'coverage', 'effective', 'expiry', 'guaranteedYears', 'policyNo'];
  var filled = 0;
  fields.forEach(function(f) { var v = policy[f]; if (v && String(v).trim().length > 0) filled++; });
  return { filled: filled, total: fields.length, percent: Math.round(filled / fields.length * 100), text: filled + '/' + fields.length };
}

function buildOwnedSummary(policy) {
  if (!policy) return null;
  var profile = getProfile(policy.type);
  return {
    label: profile.label,
    summary: profile.summary,
    checkItems: profile.checkItems,
    items: [
      { label: '额度/范围', value: (policy.coverage || '待补充') },
      { label: '年度支出', value: (policy.premium ? '¥' + parseInt(policy.premium).toLocaleString() : '待补充') },
      { label: '有效时间', value: (policy.effective || '-') + ' 至 ' + (policy.expiry || '-') },
      { label: '延续条件', value: (policy.guaranteedYears || '待补充') }
    ]
  };
}

module.exports = {
  getProfile: getProfile,
  getLabel: getLabel,
  getSummary: getSummary,
  getCheckItems: getCheckItems,
  getCompleteness: getCompleteness,
  buildOwnedSummary: buildOwnedSummary
};
