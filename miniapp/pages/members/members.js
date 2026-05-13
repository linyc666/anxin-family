// pages/members/members.js - 家庭档案夹
var api = require('../../utils/api');
var membership = require('../../utils/membership');
var petReminders = require('../../utils/pet-reminders');
var display = require('../../utils/display-sanitizer');
var recordProfile = require('../../utils/record-profile');
var attachmentUtil = require('../../utils/attachments');
var recordContent = require('../../utils/record-content');
var profileSections = require('../../utils/record-profile-sections');
var productLoader = require('../../utils/product-loader');

function getTypeLabel(type) {
  return display.getTypeLabel(type) || '';
}

function cleanText(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function hasUsefulValue(v) {
  var s = cleanText(v);
  return s && s !== '待补充' && s !== '-' && s !== 'undefined';
}

function pushDisplayItem(list, label, value, key, source) {
  label = cleanText(label);
  value = cleanText(value);
  if (!label) return;
  var existing = list.find(function(it) { return it.label === label; });
  if (existing) {
    if (existing.status === 'missing' && hasUsefulValue(value)) {
      existing.value = value;
      existing.status = source === 'product_db' ? 'reference' : 'filled';
      existing.source = source || 'user_record';
    }
    return;
  }
  if (list.length >= 4) return;
  list.push({
    key: key || label,
    label: label,
    value: hasUsefulValue(value) ? value : '待补充',
    status: hasUsefulValue(value) ? (source === 'product_db' ? 'reference' : 'filled') : 'missing',
    source: source || 'user_record'
  });
}

function firstMatch(text, patterns) {
  text = cleanText(text);
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) return m[1] || m[0];
  }
  return '';
}

function allText(policy) {
  return [policy.coverage, policy.detail, policy.tags, policy.guaranteedYears].map(cleanText).filter(Boolean).join(' · ');
}

function buildCoreItemsByType(policy) {
  var t = allText(policy);
  var items = [];
  var type = policy.type || '';

  if (type === '意外险') {
    pushDisplayItem(items, '一般意外额度', firstMatch(t, [/一般意外[^0-9]*(\d+(?:\.\d+)?万)/, /意外(?:身故\/伤残)?[^0-9]*(\d+(?:\.\d+)?万)/]), 'generalAmount');
    pushDisplayItem(items, '意外医疗', firstMatch(t, [/意外医疗[^0-9]*(\d+(?:\.\d+)?万)/, /医疗[^0-9]*(\d+(?:\.\d+)?万)/]), 'accidentMedical');
    pushDisplayItem(items, '交通场景额度', firstMatch(t, [/航空[^0-9]*(\d+(?:\.\d+)?万)/, /交通[^0-9]*(\d+(?:\.\d+)?万)/, /火车\/轮船\/地铁[^0-9]*(\d+(?:\.\d+)?万)/]), 'trafficAmount');
    pushDisplayItem(items, '津贴/第三方', firstMatch(t, [/(住院津贴\d+元\/天[^·，,]*)/, /(第三者责任\d+(?:\.\d+)?万)/]), 'extraLiability');
    pushDisplayItem(items, '猝死额度', firstMatch(t, [/猝死[^0-9]*(\d+(?:\.\d+)?万)/]), 'suddenDeath');
    return items;
  }

  if (type === '百万医疗' || type === '惠民保' || type === '防癌险') {
    pushDisplayItem(items, '医保内住院', firstMatch(t, [/医保内[^0-9]*(\d+(?:\.\d+)?万)/, /一般[^0-9]*(\d+(?:\.\d+)?万)/]), 'inSocialMedical');
    pushDisplayItem(items, '医保外住院', firstMatch(t, [/医保外[^0-9]*(\d+(?:\.\d+)?万)/, /范围外[^0-9]*(\d+(?:\.\d+)?万)/]), 'outSocialMedical');
    pushDisplayItem(items, '大额事项额度', firstMatch(t, [/重疾[^0-9]*(\d+(?:\.\d+)?万)/, /大额[^0-9]*(\d+(?:\.\d+)?万)/, /癌症医疗[^0-9]*(\d+(?:\.\d+)?万)/]), 'criticalAmount');
    pushDisplayItem(items, '特药/外购药', firstMatch(t, [/特药[^0-9]*(\d+(?:\.\d+)?万)/, /外购药[^0-9]*(\d+(?:\.\d+)?万)/]), 'drugAmount');
    pushDisplayItem(items, '特殊项目', firstMatch(t, [/(质子重离子[^·，,]*)/, /(CAR-T[^·，,]*)/]), 'specialItems');
    return items;
  }

  if (type === '重疾险') {
    pushDisplayItem(items, '大额事项额度', firstMatch(t, [/重疾[^0-9]*(\d+(?:\.\d+)?万)/, /大额[^0-9]*(\d+(?:\.\d+)?万)/]), 'mainAmount');
    pushDisplayItem(items, '轻度事项额度', firstMatch(t, [/轻症[^0-9]*(\d+(?:\.\d+)?万)/]), 'mildAmount');
    pushDisplayItem(items, '特定责任', firstMatch(t, [/特定[^0-9]*(\d+(?:\.\d+)?万)/, /中症[^0-9]*(\d+(?:\.\d+)?万)/]), 'specialAmount');
    pushDisplayItem(items, '等待期', firstMatch(t, [/等待期[^0-9]*(\d+天)/]), 'waiting');
    return items;
  }

  if (type === '定寿') {
    pushDisplayItem(items, '身故/全残', firstMatch(t, [/身故\/全残[^0-9]*(\d+(?:\.\d+)?万)/, /身故[^0-9]*(\d+(?:\.\d+)?万)/]), 'deathAmount');
    pushDisplayItem(items, '猝死额外', firstMatch(t, [/猝死[^0-9]*(\d+(?:\.\d+)?万)/]), 'suddenDeath');
    pushDisplayItem(items, '责任期限', firstMatch(t, [/(保至\d+岁)/, /(\d+年固定期限)/, /(\d+年期)/]), 'term');
    pushDisplayItem(items, '年度支出', policy.premium ? ('¥' + parseInt(policy.premium).toLocaleString() + '/年') : '', 'premium');
    return items;
  }

  if (type === '车险') {
    pushDisplayItem(items, '三者额度', firstMatch(t, [/三者[^0-9]*(\d+(?:\.\d+)?万)/]), 'thirdPartyAmount');
    pushDisplayItem(items, '车损相关', /车损/.test(t) ? '含车损' : '', 'vehicleDamage');
    pushDisplayItem(items, '驾乘相关', firstMatch(t, [/驾乘[^0-9]*(\d+(?:\.\d+)?万)/, /车上人员[^0-9]*(\d+(?:\.\d+)?万)/]), 'driverPassenger');
    pushDisplayItem(items, '附加项目', firstMatch(t, [/(医保外用药[^·，,]*)/, /(道路救援[^·，,]*)/]), 'extraItems');
    return items;
  }

  return items;
}

function normalizeForMatch(v) {
  return cleanText(v)
    .replace(/保险|保单|资料|样例|尊享|经典|互联网|个人|长期|版|\(|\)|（|）|·|\s/g, '')
    .toLowerCase();
}

function tokenScore(a, b) {
  a = normalizeForMatch(a);
  b = normalizeForMatch(b);
  if (!a || !b) return 0;
  if (a.indexOf(b) > -1 || b.indexOf(a) > -1) return 1;
  var shortLen = Math.min(a.length, b.length);
  var same = 0;
  for (var i = 0; i < a.length; i++) {
    if (b.indexOf(a[i]) > -1) same++;
  }
  return shortLen ? Math.min(1, same / shortLen) : 0;
}

function findMatchedProduct(policy) {
  var products = [];
  try { products = productLoader.getProducts() || []; } catch(e) { products = []; }
  var best = null;
  var bestScore = 0;
  products.forEach(function(p) {
    if (!p || p.active === false || p.type !== policy.type) return;
    var score = tokenScore(policy.name, p.name) * 0.75 + tokenScore(policy.company, p.company) * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  });
  return bestScore >= 0.55 ? best : null;
}

function productToPolicyLike(product, policy) {
  if (!product) return null;
  var price = policy.premium || 0;
  if (!price && product.prices && product.prices.length > 0) price = product.prices[0].price;
  return {
    type: product.type,
    name: product.name,
    company: product.company,
    premium: price,
    coverage: product.coverage || '',
    deductible: product.deductible || '',
    guaranteedYears: product.guaranteeType || (product.guaranteeYears ? product.guaranteeYears + '年延续' : ''),
    tags: (product.features || []).join('·'),
    detail: (product.features || []).join('·')
  };
}

function addProductReferenceItems(items, product, policy) {
  var ref = productToPolicyLike(product, policy);
  if (!ref) return;
  var refItems = buildCoreItemsByType(ref);
  refItems.forEach(function(it) {
    pushDisplayItem(items, it.label, it.value, it.key, 'product_db');
  });
}

function buildHighlightItems(policy, contentItems, matchedProduct) {
  var items = [];
  buildCoreItemsByType(policy).forEach(function(it) {
    pushDisplayItem(items, it.label, it.value, it.key, it.source);
  });
  (policy.contentGroups || []).forEach(function(group) {
    (group.items || []).forEach(function(it) {
      pushDisplayItem(items, it.label, it.value, group.title + '_' + it.label);
    });
  });
  (contentItems || []).forEach(function(ci) {
    pushDisplayItem(items, ci.label, ci.value, ci.key);
  });
  (policy.boundaryItems || []).forEach(function(bi) {
    pushDisplayItem(items, bi.label, bi.value, bi.label);
  });
  addProductReferenceItems(items, matchedProduct, policy);
  return items.slice(0, 4);
}

function buildBoundaryLine(policy, contentItems) {
  var parts = [];
  (policy.boundaryItems || []).forEach(function(bi) {
    if (parts.length < 3 && hasUsefulValue(bi.value)) parts.push(cleanText(bi.label) + bi.value);
  });
  if (parts.length < 3) {
    (contentItems || []).forEach(function(ci) {
      var label = cleanText(ci.label);
      if (parts.length >= 3 || !hasUsefulValue(ci.value)) return;
      if (/费用|边界|免|比例|等待|延续|期限/.test(label)) parts.push(label + ci.value);
    });
  }
  if (parts.length < 3 && hasUsefulValue(policy.guaranteedYears)) parts.push(policy.guaranteedYears);
  if (parts.length < 3 && /免赔|不限社保|100%|报销/.test(cleanText(policy.tags))) parts.push(cleanText(policy.tags));
  return parts.join(' · ');
}

function sectionText(profile, title) {
  var hit = (profile.sections || []).find(function(sec) { return sec.title === title; });
  return hit ? cleanText(hit.text) : '';
}

function buildReviewTags(policy, profile, typeProfile) {
  var tags = [];
  (policy.reviewItems || []).forEach(function(r) {
    if (tags.length < 5) tags.push(cleanText(r.label || r));
  });
  if (tags.length === 0) {
    sectionText(profile, '重点核对').split('·').forEach(function(t) {
      t = cleanText(t);
      if (t && tags.length < 5) tags.push(t);
    });
  }
  if (tags.length === 0) {
    (typeProfile.checkItems || []).forEach(function(c) {
      if (tags.length < 5) tags.push(cleanText(c.label || c));
    });
  }
  return tags.filter(Boolean);
}

Page({
  data: {
    members: [],
    visibleMembers: [],
    activeKind: 'person',
    peopleCount: 0,
    petCount: 0,
    pageThemeClass: '',
    loading: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    var app = getApp();
    var tc = app.globalData.themeColors;
    if (tc) wx.setNavigationBarColor({ frontColor: tc.navFront || '#000000', backgroundColor: tc.cardBg });
    this.setData({ tColors: tc, pageThemeClass: app.globalData.pageThemeClass || '' });
    // 首页跳转到指定成员
    if (app.globalData.focusMemberId) {
      var targetMember = (app.globalData.family.members || []).find(function(m) { return m.id === app.globalData.focusMemberId; });
      if (targetMember) {
        this.setData({ activeKind: targetMember.kind === 'pet' ? 'pet' : 'person' });
      }
      app.globalData.focusMemberId = '';
    }
    this.refresh();
    this.syncTabBar();
  },

  syncTabBar() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshTheme();
    }
  },

  refresh() {
    var app = getApp();
    var family = (app && app.globalData && app.globalData.family) ? app.globalData.family : { members:[], policies:[] };
    var that = this;

    api.analyzeFamily(family.members, family.policies).then(function(result) {
      that.processResult(family, result);
    });
  },

  processResult(family, result) {
    var that = this;
    var members = family.members.map(function(m) {
      var ps = family.policies.filter(function(p) { return p.memberId === m.id; });
      var gaps = result.gaps.filter(function(g) { return g.memberId === m.id; });
      var p0Gaps = gaps.filter(function(g) { return g.priority === 'P0'; });
      var totalPremium = ps.reduce(function(s,p) { return s + (parseInt(p.premium) || 0); }, 0);

      return {
        id: m.id, kind: m.kind || 'person', isPet: m.kind === 'pet',
        name: m.name, age: m.age, role: m.role || '',
        yibao: m.yibao || '', debt: m.debt || '', notes: m.notes || '',
        petType: m.petType || '狗', breed: m.breed || '',
        vaccineDate: m.vaccineDate || '', dewormDate: m.dewormDate || '',
        checkupDate: m.checkupDate || '',
        petReminders: m.kind === 'pet' ? petReminders.getPetReminders(m) : null,
        totalPremium: totalPremium.toLocaleString(),
        gapCount: gaps.length, p0Gaps: p0Gaps.length,
        collapsed: true,
        policies: ps.map(function(p) {
          var expDate = p.expiry && p.expiry !== '终身' ? new Date(p.expiry) : null;
          var daysLeft = expDate ? Math.ceil((expDate - Date.now()) / 86400000) : null;
          var typeProfile = recordProfile.getProfile(p.type);
          var completeness = recordProfile.getCompleteness(p);
          var atts = attachmentUtil.normalize(p);
          var contentItems = (p.contentItems && p.contentItems.length > 0) ? p.contentItems : recordContent.buildContentItems(p);
          var profile = profileSections.buildProfile(p, 'user_record');
          if (p.coreSummary) profile.summaryLine = p.coreSummary;
          var matchedProduct = findMatchedProduct(p);
          var highlightItems = buildHighlightItems(p, contentItems, matchedProduct);
          var boundaryLine = buildBoundaryLine(p, contentItems);
          var reviewTags = buildReviewTags(p, profile, typeProfile);
          return {
            id: p.id, name: p.name, company: p.company, type: p.type,
            displayName: p.name,
            displayCompany: p.company,
            displayType: getTypeLabel(p.type),
            premium: (parseInt(p.premium) || 0).toLocaleString(),
            premiumRaw: parseInt(p.premium) || 0,
            coverage: display.sanitizeText(p.coverage || ''),
            guaranteedYears: display.sanitizeText(p.guaranteedYears || ''),
            effective: p.effective, expiry: p.expiry,
            daysLeft: daysLeft, absDays: daysLeft !== null ? Math.abs(daysLeft) : null,
            expSoon: daysLeft !== null && daysLeft < 90 && daysLeft >= 0,
            expired: daysLeft !== null && daysLeft < 0,
            profileLabel: typeProfile.label,
            profileSummary: typeProfile.summary,
            checkItems: typeProfile.checkItems,
            completeness: { filled: completeness.filled, total: completeness.total, pct: completeness.percent },
            attachmentCount: atts.length,
            verified: p.verified !== false,
            contentItems: contentItems,
            highlightItems: highlightItems,
            boundaryLine: boundaryLine,
            reviewTags: reviewTags,
            productMatchName: matchedProduct ? display.aliasRecordName(matchedProduct.name, matchedProduct.type) : '',
            profile: profile
          };
        })
      };
    });

    this.setData({
      members: members,
      peopleCount: members.filter(function(m){ return !m.isPet; }).length,
      petCount: members.filter(function(m){ return m.isPet; }).length,
      loading: false
    });
    this.applyFilter();
  },

  // === 家人/宠物切换 ===
  onSwitchKind(e) {
    this.setData({ activeKind: e.currentTarget.dataset.kind });
    this.applyFilter();
  },

  applyFilter() {
    var kind = this.data.activeKind;
    var visible = this.data.members.filter(function(m) {
      return kind === 'pet' ? m.isPet : !m.isPet;
    });
    this.setData({ visibleMembers: visible });
  },

  // === 展开/收起档案夹 ===
  onToggleFolder(e) {
    var id = e.currentTarget.dataset.id;
    var members = this.data.members.map(function(m) {
      if (m.id === id) m.collapsed = !m.collapsed;
      return m;
    });
    this.setData({ members: members });
    this.applyFilter();
  },

  // === 导航 ===
  onAddMember() {
    var app = getApp();
    if (!membership.canAddPerson(app.globalData.family)) {
      membership.showUpgradeToast('免费版最多可添加3位家人。');
      return;
    }
    wx.navigateTo({ url: '/pages/member-form/member-form' });
  },
  onAddPet() {
    var app = getApp();
    if (!membership.canAddPet(app.globalData.family)) {
      membership.showUpgradeToast('免费版最多可添加1只宠物。');
      return;
    }
    wx.navigateTo({ url: '/pages/member-form/member-form?kind=pet' });
  },
  onEditMember(e) {
    wx.navigateTo({ url: '/pages/member-form/member-form?id=' + e.currentTarget.dataset.id });
  },
  onAddPolicy(e) {
    var app = getApp();
    if (!membership.canAddRecord(app.globalData.family)) {
      membership.showUpgradeToast('免费版最多可添加20条重要记录。');
      return;
    }
    wx.navigateTo({ url: '/pages/policy-form/policy-form?memberId=' + e.currentTarget.dataset.memberId });
  },
  onViewPolicy(e) {
    wx.navigateTo({ url: '/pages/policy-detail/policy-detail?policyId=' + e.currentTarget.dataset.id });
  },
  onCheckPolicy(e) {
    wx.navigateTo({ url: '/pages/checklist/checklist?policyId=' + e.currentTarget.dataset.id });
  },
  onEditPolicy(e) {
    wx.navigateTo({ url: '/pages/policy-form/policy-form?editId=' + e.currentTarget.dataset.id });
  },

  // === 下拉刷新 ===
  onPullDownRefresh() {
    this.refresh();
    wx.vibrateShort({ type: 'light' });
    setTimeout(function() { wx.stopPullDownRefresh(); }, 600);
  },

  // === 删除 ===
  onDeleteMember(e) {
    var id = e.currentTarget.dataset.id;
    var that = this;
    wx.vibrateShort({ type: 'medium' });
    wx.showModal({
      title: '确认删除', content: '将删除该成员及其所有资料记录，不可恢复。',
      success: function(res) {
        if (res.confirm) {
          var app = getApp();
          app.globalData.family.members = app.globalData.family.members.filter(function(m) { return m.id !== id; });
          app.globalData.family.policies = app.globalData.family.policies.filter(function(p) { return p.memberId !== id; });
          app.saveData(); that.refresh();
          wx.vibrateShort({ type: 'light' });
        }
      }
    });
  },
  onDeletePolicy(e) {
    var id = e.currentTarget.dataset.id;
    var that = this;
    wx.vibrateShort({ type: 'medium' });
    wx.showModal({
      title: '确认删除', content: '删除该资料记录？',
      success: function(res) {
        if (res.confirm) {
          var app = getApp();
          app.globalData.family.policies = app.globalData.family.policies.filter(function(p) { return p.id !== id; });
          app.saveData(); that.refresh();
          wx.vibrateShort({ type: 'light' });
        }
      }
    });
  }
});
