// utils/display-sanitizer.js - 用户可见文案降敏

function sanitizeText(text) {
  return (text || '')
    .replace(/医疗保险|重大疾病|重疾险|意外险|寿险|防癌险|产险|保单/g, '')
    .replace(/重疾/g, '大额支出')
    .replace(/保险|投保/g, '')
    .replace(/理赔/g, '给付')
    .replace(/赔付/g, '比例说明')
    .replace(/保证续保|续保/g, '延续期限')
    .replace(/被保险人|投保人/g, '相关人')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTypeLabel(type) {
  var map = {
    '百万医疗': '医疗支出',
    '意外险': '意外风险',
    '重疾险': '大额支出',
    '定寿': '家庭责任',
    '防癌险': '健康专项',
    '惠民保': '城市补充',
    '车险': '车辆资料',
    '房险': '房屋资料',
    '家财险': '家财资料',
    '分红险': '储蓄资料',
    '年金险': '长期储蓄'
  };
  return map[type] || sanitizeText(type) || '';
}

function aliasSource(source) {
  var text = sanitizeText(source)
    .replace(/中国人民/g, '')
    .replace(/中国/g, '')
    .replace(/健康|人寿/g, '')
    .trim();
  return text || '公开资料来源';
}

function aliasRecordName(name, type) {
  var text = sanitizeText(name)
    .replace(/互联网/g, '线上')
    .replace(/个人/g, '')
    .replace(/长期/g, '')
    .replace(/版/g, '')
    .trim();
  if (!text || text.length < 3) return getTypeLabel(type) + '资料样例';
  return text;
}

function friendlyGapTitle(title) {
  return sanitizeText((title || '')
    .replace(/缺少/g, '')
    .replace(/百万医疗/g, '医疗支出资料待完善')
    .replace(/重疾险/g, '大额支出资料待完善')
    .replace(/意外险/g, '意外风险资料待完善')
    .replace(/定寿/g, '家庭责任资料待完善')
    .replace(/惠民保/g, '城市补充权益资料待完善')
    .replace(/为1年期不保证续保/g, '记录稳定性需关注'));
}

function friendlyGapDesc(desc) {
  return sanitizeText((desc || '')
    .replace(/住院\/大病医疗费用报销/g, '用于记录住院或大额医疗支出的相关资料')
    .replace(/意外伤害医疗和身故保障/g, '用于记录意外风险相关资料')
    .replace(/政府指导的低价补充保险/g, '用于记录城市补充权益资料')
    .replace(/确诊重疾后的收入补偿/g, '用于记录大额支出和收入补偿相关资料')
    .replace(/家庭支柱身故后的债务覆盖/g, '用于记录家庭责任和债务备忘')
    .replace(/高龄癌症专项保障/g, '用于记录长辈健康专项资料')
    .replace(/一旦患病次年可能被拒保。/g, '年度型记录到期后可能存在变化，建议提前核实。'));
}

module.exports = {
  sanitizeText: sanitizeText,
  getTypeLabel: getTypeLabel,
  aliasSource: aliasSource,
  aliasRecordName: aliasRecordName,
  friendlyGapTitle: friendlyGapTitle,
  friendlyGapDesc: friendlyGapDesc
};
