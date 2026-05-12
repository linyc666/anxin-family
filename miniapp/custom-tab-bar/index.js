var theme = require('../utils/theme');

Component({
  data: {
    selected: 0,
    tabBg: '#FFFCF6',
    tabBorder: '#E1D7C7',
    list: [
      { pagePath: '/pages/index/index', text: '总览', icon: '◎' },
      { pagePath: '/pages/members/members', text: '资料', icon: '□' },
      { pagePath: '/pages/analysis/analysis', text: '清单', icon: '✓' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: '●' }
    ]
  },

  attached() {
    var t = theme.getThemeColors();
    this.setData({ tabBg: t.cardBg, tabBorder: t.cardBorder });
  },

  pageLifetimes: {
    show() {
      var t = theme.getThemeColors();
      this.setData({ tabBg: t.cardBg, tabBorder: t.cardBorder });
    }
  },

  methods: {
    switchTab(e) {
      var index = e.currentTarget.dataset.index;
      var item = this.data.list[index];
      wx.switchTab({ url: item.pagePath });
    }
  }
});
