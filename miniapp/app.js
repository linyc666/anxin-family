// app.js - 安心家册小程序入口
var ENABLE_LOCAL_TEST_MEMBERSHIP = true;

App({
  globalData: {
    family: { members: [], policies: [] },
    familyName: '我的家庭',
    currentFamilyId: 'default',
    isAdmin: false,
    privacyAccepted: false,
    engineReady: false,
    userInfo: null,
    theme: 'light',
    themeColors: null
  },

  onLaunch() {
    try {
      if (wx.cloud) {
        wx.cloud.init({ env: 'cloudbase-d2gxofxyb319026fa', traceUser: true });
      }
    } catch(e) { console.log('云开发初始化失败', e); }

    var theme = require('./utils/theme');
    var themeKey = theme.initTheme();

    this.loadLocalData();
    if (ENABLE_LOCAL_TEST_MEMBERSHIP) this.enableLocalTestMembership();

    try {
      var productLoader = require('./utils/product-loader');
      productLoader.refreshFromCloud();
    } catch(e) {}

    this.syncCloudEntitlement();

    try {
      this.globalData.isAdmin = wx.getStorageSync('is_admin') || false;
      this.globalData.privacyAccepted = wx.getStorageSync('privacy_accepted') || false;
      var famName = wx.getStorageSync('family_name');
      if (famName) this.globalData.familyName = famName;
    } catch(e) {}
  },

  enableLocalTestMembership() {
    try {
      var now = new Date();
      var expireAt = new Date(Date.now() + 366 * 86400000).toISOString();
      wx.setStorageSync('membership_plan', 'yearly');
      wx.setStorageSync('current_entitlement', {
        planKey: 'yearly',
        planName: '家庭年卡',
        period: 'year',
        activatedAt: now.toISOString(),
        expireAt: expireAt,
        orderId: 'local_test_' + now.getTime(),
        transactionId: 'local_test',
        entitlements: {
          people: 8,
          pets: 3,
          records: 100,
          reminders: 50,
          attachments: 100,
          ocrMonthly: 360
        },
        localTest: true
      });
      wx.removeStorageSync('ocr_usage_' + now.getFullYear() + '_' + (now.getMonth() + 1));
      console.log('本地测试年卡已开通，OCR次数已重置');
    } catch(e) {
      console.log('本地测试会员开通失败', e);
    }
  },

  acceptPrivacy() {
    this.globalData.privacyAccepted = true;
    try { wx.setStorageSync('privacy_accepted', true); } catch(e) {}
  },

  setFamilyName(name) {
    this.globalData.familyName = name;
    try { wx.setStorageSync('family_name', name); } catch(e) {}
  },

  getFreshDemoData() {
    return require('./utils/demo-data').getDemoData();
  },

  isLegacyDemoData(data) {
    if (!data || !data.members || !data.policies) return false;
    if (data._meta && data._meta.isDemo && data._meta.demoVersion === 2) return false;

    var peopleCount = data.members.filter(function(m) { return (m.kind || 'person') !== 'pet'; }).length;
    var hasDemoPolicy = data.policies.some(function(p) {
      var text = [p.name, p.company, p.detail, p.tags].join(' ');
      return text.indexOf('样例') > -1 || text.indexOf('公开资料') > -1 || text.indexOf('演示') > -1;
    });

    return peopleCount > 3 && hasDemoPolicy;
  },

  normalizeLocalFamily(data, storageKey) {
    if (this.isLegacyDemoData(data)) {
      var demo = this.getFreshDemoData();
      try { wx.setStorageSync(storageKey, demo); } catch(e) {}
      return demo;
    }
    return data;
  },

  loadLocalData() {
    try {
      if (wx.getStorageSync('is_admin')) {
        var adminData = wx.getStorageSync('admin_family_data');
        if (adminData && adminData.members && adminData.members.length > 0) {
          this.globalData.family = this.normalizeLocalFamily(adminData, 'admin_family_data');
          return;
        }
      }

      var data = wx.getStorageSync('family_data');
      if (data && data.members && data.members.length > 0) {
        this.globalData.family = this.normalizeLocalFamily(data, 'family_data');
        return;
      }
    } catch(e) {}

    try {
      this.globalData.family = this.getFreshDemoData();
    } catch(e) {
      this.globalData.family = { members: [], policies: [] };
    }
  },

  setAdminData(data) {
    this.globalData.family = data;
    try { wx.setStorageSync('admin_family_data', data); wx.setStorageSync('is_admin', true); } catch(e) {}
    this.saveData();
    this.globalData.isAdmin = true;
  },

  saveData() {
    try {
      var fid = this.globalData.currentFamilyId || 'default';
      // 新格式：按 familyId 分键存储
      if (fid !== 'default') {
        wx.setStorageSync('family_data_' + fid, this.globalData.family);
      }
      // 兼容旧格式：写入默认键
      wx.setStorageSync('family_data', this.globalData.family);
    } catch(e) {}
  },

  getAnalysis() {
    var InsuranceEngine = require('./utils/insurance-engine');
    return InsuranceEngine.analyze(this.globalData.family);
  },

  syncCloudEntitlement() {
    try {
      var paymentModel = require('./utils/payment-model');
      var membership = require('./utils/membership');
      paymentModel.fetchEntitlementFromCloud().then(function(cloudEnt) {
        if (cloudEnt && paymentModel.isEntitlementValid(cloudEnt)) {
          membership.setPlan(cloudEnt.planKey);
          console.log('云端权益已同步', cloudEnt.planKey);
        }
      }).catch(function() {});
    } catch(e) {}
  }
});
