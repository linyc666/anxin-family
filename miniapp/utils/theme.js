// utils/theme.js - 主题管理
var THEMES = {
  light: {
    name: '暖白纸感',
    key: 'light',
    bg: '#F9F5EE',
    cardBg: '#FFFCF7',
    cardBorder: '#E3DBD0',
    accent: '#8E6B3E',
    navFront: '#000000',
    pageClass: ''
  },
  dark: {
    name: '暖夜墨韵',
    key: 'dark',
    bg: '#1E1D1A',
    cardBg: '#2A2824',
    cardBorder: '#3D3A34',
    accent: '#B8976A',
    navFront: '#ffffff',
    pageClass: 'theme-dark'
  }
};

function getTheme() {
  try {
    return wx.getStorageSync('app_theme') || 'light';
  } catch(e) {
    return 'light';
  }
}

function setTheme(key) {
  if (!THEMES[key]) return;
  try { wx.setStorageSync('app_theme', key); } catch(e) {}
  syncGlobalData(key);
  applyTheme(key);
}

function getThemeColors(key) {
  return THEMES[key || getTheme()] || THEMES.light;
}

function getThemeList() {
  return [
    { key: 'light', name: '暖白纸感' },
    { key: 'dark', name: '暖夜墨韵' }
  ];
}

function syncGlobalData(key) {
  var t = THEMES[key] || THEMES.light;
  var app = getApp();
  app.globalData.theme = key;
  app.globalData.themeColors = t;
  app.globalData.pageThemeClass = t.pageClass;
}

function applyTheme(key) {
  var t = THEMES[key] || THEMES.light;

  // 更新所有已存在的页面
  var pages = getCurrentPages();
  pages.forEach(function(page) {
    if (page.setData) {
      page.setData({ pageThemeClass: t.pageClass, tColors: t });
    }
  });

  // 设置导航栏
  wx.setNavigationBarColor({
    frontColor: t.navFront,
    backgroundColor: t.cardBg
  });

  // 设置页面背景色（下拉刷新区域等）
  wx.setBackgroundColor({
    backgroundColor: t.bg,
    backgroundColorTop: t.cardBg,
    backgroundColorBottom: t.cardBg
  });
  wx.setBackgroundTextStyle({
    textStyle: key === 'dark' ? 'light' : 'dark'
  });

  // 更新所有页面的 tab bar
  pages.forEach(function(page) {
    try {
      if (typeof page.getTabBar === 'function') {
        var tabBar = page.getTabBar();
        if (tabBar && tabBar.setData) {
          tabBar.setData({
            tabBg: t.cardBg,
            tabBorder: t.cardBorder,
            pageThemeClass: t.pageClass
          });
        }
      }
    } catch(e) {}
  });
}

// 初始化：app.onLaunch 调用
function initTheme() {
  var key = getTheme();
  syncGlobalData(key);
  return key;
}

module.exports = {
  THEMES: THEMES,
  getTheme: getTheme,
  setTheme: setTheme,
  getThemeColors: getThemeColors,
  getThemeList: getThemeList,
  applyTheme: applyTheme,
  initTheme: initTheme
};
