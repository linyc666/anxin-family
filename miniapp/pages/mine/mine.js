// pages/mine/mine.js - 我的（会员、备份、隐私、反馈）
var membership = require('../../utils/membership');
var cloudBackup = require('../../utils/cloud-backup');
var theme = require('../../utils/theme');

Page({
  data: {
    plan: 'free',
    planLabel: '免费版',
    usageText: '',
    familyName: '',
    privacyAccepted: false,
    feedback: '',
    feedbackSent: false,
    lastBackupTime: '',
    cloudReady: false,
    currentTheme: 'light',
    themeList: [],
    tColors: null,
    pageThemeClass: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    var app = getApp();
    var tc = app.globalData.themeColors;
    if (tc) wx.setNavigationBarColor({ frontColor: tc.navFront || '#000000', backgroundColor: tc.cardBg });
    var themeKey = theme.getTheme();
    var themeClass = theme.getThemeColors(themeKey).pageClass || '';
    this.setData({ tColors: tc, currentTheme: themeKey, pageThemeClass: themeClass, themeList: theme.getThemeList() });
    this.refreshMineData();
    // 同步云端权益（刷新UI）
    var that = this;
    var paymentModel = require('../../utils/payment-model');
    paymentModel.fetchEntitlementFromCloud().then(function(cloudEnt) {
      if (cloudEnt && paymentModel.isEntitlementValid(cloudEnt)) {
        membership.setPlan(cloudEnt.planKey);
        that.refreshMineData();
      }
    }).catch(function() {});
  },

  refreshMineData() {
    var app = getApp();
    var plan = membership.getPlan();
    var planLabel = membership.getPlanLabel(plan);
    var lastTime = cloudBackup.getLastBackupTime();
    this.setData({
      plan: plan,
      planLabel: planLabel,
      usageText: membership.getUsageText(app.globalData.family),
      familyName: app.globalData.familyName || '我的家庭',
      privacyAccepted: app.globalData.privacyAccepted || false,
      lastBackupTime: lastTime ? lastTime.slice(0, 10) : '',
      cloudReady: cloudBackup.isCloudAvailable(),
      currentTheme: theme.getTheme(),
      themeList: theme.getThemeList()
    });
  },

  // === 升级会员 ===
  onUpgrade() {
    wx.navigateTo({ url: '/pages/mine/membership' });
  },

  // === 云备份 ===
  onBackup() {
    var that = this;
    if (!cloudBackup.isCloudAvailable()) {
      this.onExport(); // 回退到剪贴板导出
      return;
    }
    wx.showModal({
      title: '云备份',
      content: '将家庭资料上传至云端保存，后续可通过"恢复数据"下载还原。',
      confirmText: '开始备份',
      cancelText: '取消',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '备份中...' });
          var app = getApp();
          cloudBackup.uploadBackup(app.globalData.family).then(function(result) {
            wx.hideLoading();
            if (result.skipped) {
              that.setData({ lastBackupTime: new Date().toISOString().slice(0, 10) });
              wx.showToast({ title: '已是最新备份', icon: 'success' });
              return;
            }
            if (result.indexOk) {
              that.setData({ lastBackupTime: new Date().toISOString().slice(0, 10) });
              wx.showToast({ title: '云备份成功', icon: 'success' });
            } else {
              that.setData({ lastBackupTime: new Date().toISOString().slice(0, 10) });
              wx.showModal({
                title: '部分成功',
                content: '文件已上传，但备份列表同步失败。换设备时可能看不到此备份，建议稍后重试。',
                showCancel: false
              });
            }
          }).catch(function(err) {
            wx.hideLoading();
            wx.showModal({
              title: '备份失败',
              content: '云端备份暂不可用，请尝试导出到剪贴板手动保存。',
              showCancel: false
            });
          });
        }
      }
    });
  },

  // === 云恢复 ===
  onRestore() {
    var that = this;
    if (!cloudBackup.isCloudAvailable()) {
      wx.showToast({ title: '云开发未初始化', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '查询备份...' });
    // 优先从云端获取备份列表
    cloudBackup.fetchBackupListFromCloud().then(function(cloudList) {
      wx.hideLoading();
      var backups = (cloudList && cloudList.length > 0) ? cloudList : cloudBackup.getBackupList();
      if (!backups || backups.length === 0) {
        wx.showModal({
          title: '暂无云端备份',
          content: '请先进行云备份，或通过"导入数据"从JSON恢复。',
          showCancel: false
        });
        return;
      }
      // 使用最近一次备份
      var latest = backups[0];
      var timeStr = latest.createdAt ? latest.createdAt.slice(0, 16) : (latest.time ? latest.time.slice(0, 16) : '未知');
      var sizeStr = latest.size ? (latest.size / 1024).toFixed(1) + 'KB' : '未知';
      wx.showModal({
        title: '恢复数据',
        content: '将用云端备份覆盖当前数据。\n备份时间：' + timeStr + '\n大小：' + sizeStr + '\n\n此操作不可撤销，建议先导出当前数据。',
        confirmText: '确认恢复',
        cancelText: '取消',
        success: function(res) {
          if (res.confirm) {
            wx.showLoading({ title: '恢复中...' });
            cloudBackup.downloadBackup(latest.fileID).then(function(data) {
              wx.hideLoading();
              var app = getApp();
              app.globalData.family = data;
              app.saveData();
              that.onShow();
              wx.showToast({ title: '恢复成功', icon: 'success' });
            }).catch(function(err) {
              wx.hideLoading();
              wx.showToast({ title: '恢复失败', icon: 'none' });
            });
          }
        }
      });
    }).catch(function() {
      wx.hideLoading();
      wx.showToast({ title: '查询备份失败', icon: 'none' });
    });
  },

  // === 数据导出 ===
  onExport() {
    var app = getApp();
    var data = JSON.stringify(app.globalData.family, null, 2);
    wx.setClipboardData({
      data: data,
      success: function() {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  // === 导入数据 ===
  onImport() {
    var that = this;
    wx.showModal({
      title: '导入数据',
      content: '请将JSON数据粘贴到输入框中',
      editable: true,
      placeholderText: '粘贴JSON数据...',
      success: function(res) {
        if (res.confirm && res.content) {
          try {
            var data = JSON.parse(res.content);
            if (!data.members || !data.policies) throw new Error('格式不正确');
            var app = getApp();
            app.globalData.family = data;
            app.saveData();
            that.onShow();
            wx.showToast({ title: '导入成功', icon: 'success' });
          } catch(e) {
            wx.showToast({ title: '数据格式不正确', icon: 'none' });
          }
        }
      }
    });
  },

  // === 隐私与声明 ===
  onPrivacy() {
    var app = getApp();
    wx.showModal({
      title: '用户协议与声明',
      content: '隐私政策：安心家册用于帮助您记录家庭与宠物的重要资料、到期提醒和安心清单。您录入的数据默认保存在本机；当您主动使用云备份、图片识别或数据同步功能时，相关资料会上传至云端处理。你的数据不会被用于任何商业目的。\n\n免责声明：本工具不销售任何金融类服务，不提供购买建议，不构成专业咨询意见。市场样例基于公开资料整理，仅供归档参考。\n\n当前阶段：家庭年卡 ¥68/年开放中，免费版功能可继续使用。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // === 意见反馈 ===
  onFeedbackInput(e) {
    this.setData({ feedback: e.detail.value });
  },

  onSubmitFeedback() {
    var text = this.data.feedback.trim();
    if (!text) {
      wx.showToast({ title: '请输入建议内容', icon: 'none' });
      return;
    }
    try {
      var feedbacks = wx.getStorageSync('user_feedbacks') || [];
      feedbacks.push({ text: text, time: new Date().toISOString() });
      wx.setStorageSync('user_feedbacks', feedbacks);
    } catch(e) {}
    this.setData({ feedback: '', feedbackSent: true });
    setTimeout(function() {
      this.setData({ feedbackSent: false });
    }.bind(this), 3000);
  },

  // === 主题切换 ===
  onSwitchTheme(e) {
    var key = e.currentTarget.dataset.key;
    if (key === this.data.currentTheme) return;
    theme.setTheme(key);
    var app = getApp();
    var tc = theme.getThemeColors(key);
    app.globalData.theme = key;
    app.globalData.themeColors = tc;
    this.setData({ currentTheme: key, pageThemeClass: tc.pageClass || '' });
    theme.applyTheme(key);
    // 通知其他 tab 页面刷新主题
    var pages = getCurrentPages();
    pages.forEach(function(page) {
      if (page !== this && page.setData) {
        page.setData({ pageThemeClass: tc.pageClass || '' });
      }
    }, this);
    this.refreshMineData();
    wx.showToast({ title: '主题已切换', icon: 'success', duration: 1000 });
  },

  // === 关于 ===
  onAbout() {
    wx.showModal({
      title: '关于安心家册',
      content: '版本 1.0.0\n\n安心家册 — 把家人和宠物的重要资料、到期提醒、年度支出和安心清单，整理在一个安心的地方。\n\n家庭年卡 ¥68/年，长期管好全家重要资料。',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
