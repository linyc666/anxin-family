var theme = require('../utils/theme');

Component({
  data: {
    selected: 0,
    tabBg: '#FFFCF6',
    tabBorder: '#E1D7C7',
    pageThemeClass: '',
    list: [
      { pagePath: '/pages/index/index', text: '总览', icon: '🏠' },
      { pagePath: '/pages/members/members', text: '资料', icon: '📂' },
      { pagePath: '/pages/analysis/analysis', text: '清单', icon: '📋' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: '👤' }
    ]
  },

  attached() {
    this.refreshTheme();
  },

  pageLifetimes: {
    show() {
      this.refreshTheme();
    }
  },

  methods: {
    refreshTheme() {
      var app = getApp();
      var tc = (app && app.globalData && app.globalData.themeColors)
        || theme.getThemeColors();
      var cls = (app && app.globalData && app.globalData.pageThemeClass !== undefined)
        ? app.globalData.pageThemeClass
        : (tc.pageClass || '');
      this.setData({
        tabBg: tc.cardBg,
        tabBorder: tc.cardBorder,
        pageThemeClass: cls
      });
    },

    switchTab(e) {
      var index = e.currentTarget.dataset.index;
      var item = this.data.list[index];
      wx.switchTab({ url: item.pagePath });
    }
  }
});
