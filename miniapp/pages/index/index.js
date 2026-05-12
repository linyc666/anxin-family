// pages/index/index.js - 安心总览
var api = require('../../utils/api');
var membership = require('../../utils/membership');
var petReminders = require('../../utils/pet-reminders');

function getGreetingInfo() {
  var h = new Date().getHours();
  if (h < 6) return { text: '夜深了', emoji: '🌙' };
  if (h < 9) return { text: '早上好', emoji: '🌅' };
  if (h < 12) return { text: '上午好', emoji: '☀️' };
  if (h < 14) return { text: '中午好', emoji: '🌤️' };
  if (h < 18) return { text: '下午好', emoji: '🌿' };
  return { text: '晚上好', emoji: '🌙' };
}

function getTodayDate() {
  var d = new Date();
  var weekMap = ['日', '一', '二', '三', '四', '五', '六'];
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  var w = weekMap[d.getDay()];
  return y + '年' + m + '月' + day + '日 · 星期' + w;
}

Page({
  data: {
    greeting: getGreetingInfo().text,
    greetingEmoji: getGreetingInfo().emoji,
    todayDate: getTodayDate(),
    stats: { members:0, pets:0, policies:0, premium:0, gaps:0, p0Gaps:0 },
    attentionCount: 0,
    topAlerts: [],
    moreAlerts: [],
    allAlerts: [],
    isDemo: false,
    familyName: '我的家庭',
    privacyAccepted: false,
    tColors: null
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    var app = getApp();
    var tc = app.globalData.themeColors;
    if (tc) {
      wx.setNavigationBarColor({ frontColor: tc.navFront || '#000000', backgroundColor: tc.cardBg });
    }
    this.setData({
      greeting: getGreetingInfo().text,
      greetingEmoji: getGreetingInfo().emoji,
      todayDate: getTodayDate(),
      familyName: app.globalData.familyName || '我的家庭',
      privacyAccepted: app.globalData.privacyAccepted || false,
      tColors: tc
    });
    this.loadData();
    this.refresh();
  },

  loadData() {
    var app = getApp();
    var family = app.globalData.family || { members:[], policies:[] };
    var isDemo = !!(family._meta && family._meta.isDemo);
    this.setData({ isDemo: isDemo });
  },
  refresh() {
    var app = getApp();
    var family = app.globalData.family || { members:[], policies:[] };
    var that = this;
    var totalPremium = (family.policies || []).reduce(function(s,p){ return s+(parseInt(p.premium)||0); }, 0);
    var peopleCount = (family.members || []).filter(function(m){ return (m.kind || 'person') !== 'pet'; }).length;
    var petCount = (family.members || []).filter(function(m){ return m.kind === 'pet'; }).length;

    api.analyzeFamily(family.members, family.policies).then(function(result) {
      var alerts = [];

      // 缺口
      result.gaps.forEach(function(g) {
        alerts.push({
          key: 'gap_' + g.memberId + '_' + g.type,
          memberId: g.memberId, dataType: 'gap',
          priority: g.priority === 'P0' ? 0 : 1,
          title: g.memberName + '：' + g.title,
          desc: g.desc,
          tag: g.priority === 'P0' ? '重要' : '建议',
          expired: false, urgent: g.priority === 'P0',
          sortTime: g.priority === 'P0' ? 0 : 99
        });
      });

      // 到期提醒
      (result.renewalAlerts || []).forEach(function(r) {
        alerts.push({
          key: 'renewal_' + r.memberName + '_' + (r.policy ? r.policy.name : ''),
          memberId: r.memberId, dataType: 'renewal',
          priority: r.expired ? 0 : r.urgent ? 1 : 2,
          title: r.memberName + ' · ' + (r.policy ? r.policy.name : ''),
          desc: r.expired ? '资料已过期' : '资料即将到期',
          tag: r.expired ? '已过期' + r.absDays + '天' : r.daysLeft + '天',
          expired: r.expired, urgent: r.urgent,
          sortTime: r.expired ? -1 : r.daysLeft
        });
      });

      // 宠物提醒
      var petAlerts = petReminders.getAllPetAlerts(family.members);
      petAlerts.forEach(function(pa) {
        pa.urgentItems.forEach(function(ri) {
          alerts.push({
            key: 'pet_' + pa.petId + '_' + ri.type,
            memberId: pa.petId, dataType: 'pet',
            priority: ri.expired ? 0 : ri.urgent ? 1 : 2,
            title: pa.petName + ' · ' + ri.typeLabel,
            desc: ri.label,
            tag: ri.expired ? '已过期' : '即将到期',
            expired: ri.expired, urgent: ri.urgent,
            sortTime: ri.expired ? -1 : ri.daysLeft || 999
          });
        });
      });

      alerts.sort(function(a, b) {
        if (a.expired !== b.expired) return a.expired ? -1 : 1;
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        return (a.sortTime || 999) - (b.sortTime || 999);
      });

      var attentionCount = alerts.filter(function(a) { return a.expired || a.urgent; }).length;

      that.setData({
        stats: {
          members: peopleCount, pets: petCount, policies: family.policies.length,
          gaps: result.stats.totalGaps
        },
        attentionCount: attentionCount,
        topAlerts: alerts.slice(0, 2),
        moreAlerts: alerts.slice(2, 5),
        allAlerts: alerts
      });
    });
  },

  // === 主行动 ===
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
  onAddRecord() {
    var app = getApp();
    if (!membership.canAddRecord(app.globalData.family)) {
      membership.showUpgradeToast('免费版最多可添加20条重要记录。');
      return;
    }
    wx.switchTab({ url: '/pages/members/members' });
  },

  // === 提醒点击 ===
  onTapAlert(e) {
    var type = e.currentTarget.dataset.type;
    var memberId = e.currentTarget.dataset.memberId;
    var app = getApp();
    if (type === 'gap') {
      app.globalData.focusMemberId = memberId;
      wx.switchTab({ url: '/pages/analysis/analysis' });
    } else {
      wx.switchTab({ url: '/pages/members/members' });
    }
  },

  // 查看全部提醒 → 清单页
  onViewAll() {
    wx.switchTab({ url: '/pages/analysis/analysis' });
  },

  onLoadDemo() {
    var app = getApp();
    var demo = require('../../utils/demo-data').getDemoData();
    app.globalData.family = demo;
    app.saveData();
    this.refresh();
  },

  // === 隐私 ===
  onAcceptPrivacy() {
    var app = getApp();
    app.acceptPrivacy();
    this.setData({ privacyAccepted: true });
  },
  onFullPrivacy() {
    wx.navigateTo({ url: '/pages/mine/mine' });
  },

  // === 家庭设置 ===
  onEditFamily() {
    var that = this;
    wx.showModal({
      title: '家庭名称设置',
      editable: true,
      placeholderText: '输入家庭名称',
      success: function(res) {
        if (res.confirm && res.content && res.content.trim()) {
          var app = getApp();
          app.setFamilyName(res.content.trim());
          that.setData({ familyName: res.content.trim() });
        }
      }
    });
  },

  // === 管理入口 ===
  onLongPressSetting() {
    if (!wx.cloud) return;
    var that = this;
    wx.cloud.callFunction({
      name: 'adminProducts',
      data: { action: 'verifyAdmin' }
    }).then(function(res) {
      if (res.result && res.result.success && res.result.data && res.result.data.isAdmin) {
        var app = getApp();
        app.globalData.isAdmin = true;
        try { wx.setStorageSync('is_admin', true); } catch(e) {}
        wx.navigateTo({ url: '/pages/admin/products/products' });
      } else {
        wx.showToast({ title: '无管理权限', icon: 'none' });
      }
    }).catch(function() {
      wx.showToast({ title: '验证失败', icon: 'none' });
    });
  }
});
