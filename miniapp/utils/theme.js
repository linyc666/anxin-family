// utils/theme.js - 暖白纸感统一主题，深色留作后续扩展
var THEMES = {
  light: {
    name: '暖白纸感',
    bg: '#F8F4EC',
    cardBg: '#FFFCF6',
    cardBorder: '#E1D7C7',
    accent: '#9B7A45',
    accentLight: 'rgba(155,122,69,.08)',
    accentBorder: 'rgba(155,122,69,.22)',
    text: '#29302B',
    textBody: '#48534B',
    textSecondary: '#717C73',
    textMuted: '#969D92',
    green: '#527F68',
    blue: '#527F96',
    red: '#B95F57',
    innerBg: '#F2EBDD',
    innerBorder: '#E1D7C7',
    navFront: '#000000'
  },
  deep: {
    name: '静谧青灰',
    bg: '#0F1413',
    cardBg: '#171D1B',
    cardBorder: '#2A3531',
    accent: '#BFA46A',
    accentLight: 'rgba(191,164,106,.10)',
    accentBorder: 'rgba(191,164,106,.24)',
    text: '#EEF3EF',
    textBody: '#D5DED8',
    textSecondary: '#9AA9A1',
    textMuted: '#66756D',
    green: '#86B99A',
    blue: '#8CAFC2',
    red: '#D07A72',
    innerBg: '#202724',
    innerBorder: '#2A3531',
    navFront: '#ffffff'
  }
};

// 当前阶段强制暖白，不读取本地缓存的主题选择
function getTheme() {
  var cached = 'light';
  try { cached = wx.getStorageSync('app_theme') || 'light'; } catch(e) {}
  if (cached !== 'light') {
    try { wx.setStorageSync('app_theme', 'light'); } catch(e) {}
  }
  return 'light';
}

function setTheme(key) {
  if (!THEMES[key]) return;
  try { wx.setStorageSync('app_theme', key); } catch(e) {}
}

function getThemeColors(key) {
  return THEMES[key || 'light'] || THEMES.light;
}

// 当前只暴露暖白，深色后续扩展
function getThemeList() {
  return [{ key: 'light', name: '暖白纸感' }];
}

module.exports = {
  THEMES: THEMES,
  getTheme: getTheme,
  setTheme: setTheme,
  getThemeColors: getThemeColors,
  getThemeList: getThemeList
};
