// utils/membership.js - 安心家册会员与免费额度骨架
var FREE_LIMITS = {
  people: 3,
  pets: 1,
  records: 20,
  reminders: 5,
  attachments: 3,
  ocrMonthly: 3
};

var PLAN_LIMITS = {
  free: FREE_LIMITS,
  monthly: {
    people: 8,
    pets: 3,
    records: 100,
    reminders: 50,
    attachments: 100,
    ocrMonthly: 30
  },
  yearly: {
    people: 8,
    pets: 3,
    records: 100,
    reminders: 50,
    attachments: 100,
    ocrMonthly: 360
  }
};

function getPlan() {
  try {
    var plan = wx.getStorageSync('membership_plan');
    return plan || 'free';
  } catch(e) {
    return 'free';
  }
}

function getLimits(plan) {
  return PLAN_LIMITS[plan || getPlan()] || FREE_LIMITS;
}

function countUsage(family) {
  family = family || { members: [], policies: [] };
  var members = family.members || [];
  var people = members.filter(function(m) { return (m.kind || 'person') !== 'pet'; }).length;
  var pets = members.filter(function(m) { return m.kind === 'pet'; }).length;
  var records = (family.policies || []).length;
  return { people: people, pets: pets, records: records };
}

function canAddPerson(family, plan) {
  return countUsage(family).people < getLimits(plan).people;
}

function canAddPet(family, plan) {
  return countUsage(family).pets < getLimits(plan).pets;
}

function canAddRecord(family, plan) {
  return countUsage(family).records < getLimits(plan).records;
}

function getUsageText(family, plan) {
  var usage = countUsage(family);
  var limits = getLimits(plan);
  return '家人 ' + usage.people + '/' + limits.people +
    ' · 宠物 ' + usage.pets + '/' + limits.pets +
    ' · 记录 ' + usage.records + '/' + limits.records;
}

function showUpgradeToast(message) {
  wx.showModal({
    title: '升级安心家册',
    content: message || '当前免费版额度已用完，升级后可继续添加更多家庭资料。',
    confirmText: '了解',
    showCancel: false
  });
}

// === OCR 月度次数 ===
function getOcrMonthKey() {
  var now = new Date();
  return 'ocr_usage_' + now.getFullYear() + '_' + (now.getMonth() + 1);
}

function getOcrUsage() {
  try {
    var key = getOcrMonthKey();
    return wx.getStorageSync(key) || 0;
  } catch(e) { return 0; }
}

function incrementOcrUsage() {
  try {
    var key = getOcrMonthKey();
    var count = getOcrUsage() + 1;
    wx.setStorageSync(key, count);
    return count;
  } catch(e) { return 999; }
}

function canUseOcr() {
  var plan = getPlan();
  var limit = getLimits(plan).ocrMonthly;
  return getOcrUsage() < limit;
}

function getOcrUsageText() {
  var plan = getPlan();
  var limit = getLimits(plan).ocrMonthly;
  var used = getOcrUsage();
  return '识别 ' + used + '/' + limit + ' 次（本月）';
}

// === 附件数量 ===
function getAttachmentCount(family) {
  try {
    return require('./attachments').countFamilyAttachments(family || { policies: [] });
  } catch(e) {
    family = family || { members: [], policies: [] };
    var count = 0;
    (family.policies || []).forEach(function(p) {
      if (p.attachments && p.attachments.length > 0) {
        count += p.attachments.length;
      } else if (p.screenshot) {
        count++;
      }
    });
    return count;
  }
}

function canAddAttachment(family) {
  var plan = getPlan();
  var limit = getLimits(plan).attachments;
  return getAttachmentCount(family) < limit;
}

function setPlan(planKey) {
  try {
    wx.setStorageSync('membership_plan', planKey);
  } catch(e) {}
}

function getPlanLabel(plan) {
  var labels = { free: '免费版', monthly: '安心月卡', yearly: '家庭年卡' };
  return labels[plan || getPlan()] || '免费版';
}

module.exports = {
  FREE_LIMITS: FREE_LIMITS,
  PLAN_LIMITS: PLAN_LIMITS,
  getPlan: getPlan,
  getLimits: getLimits,
  countUsage: countUsage,
  canAddPerson: canAddPerson,
  canAddPet: canAddPet,
  canAddRecord: canAddRecord,
  getUsageText: getUsageText,
  showUpgradeToast: showUpgradeToast,
  getOcrUsage: getOcrUsage,
  incrementOcrUsage: incrementOcrUsage,
  canUseOcr: canUseOcr,
  getOcrUsageText: getOcrUsageText,
  getAttachmentCount: getAttachmentCount,
  canAddAttachment: canAddAttachment,
  setPlan: setPlan,
  getPlanLabel: getPlanLabel
};
