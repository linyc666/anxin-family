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

function applyTheme(key) {
  var t = THEMES[key] || THEMES.light;
  // 设置页面 class
  var pages = getCurrentPages();
  pages.forEach(function(page) {
    if (page.setData) {
      page.setData({ pageThemeClass: t.pageClass });
    }
  });
  // 设置导航栏
  wx.setNavigationBarColor({
    frontColor: t.navFront,
    backgroundColor: t.cardBg
  });
  // 设置 tab bar
  if (typeof pages[pages.length - 1] === 'object' && pages[pages.length - 1].getTabBar) {
    var tabBar = pages[pages.length - 1].getTabBar();
    if (tabBar && tabBar.setData) {
      tabBar.setData({ tabBg: t.cardBg, tabBorder: t.cardBorder });
    }
  }
}

module.exports = {
  THEMES: THEMES,
  getTheme: getTheme,
  setTheme: setTheme,
  getThemeColors: getThemeColors,
  getThemeList: getThemeList,
  applyTheme: applyTheme
};
