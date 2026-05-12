// pages/sample-detail/sample-detail.js - 参考样例详情
Page({
  data: {
    sample: null
  },

  onLoad() {
    var app = getApp();
    var sample = app.globalData.currentSampleDetail;
    if (!sample) {
      wx.showToast({ title: '缺少样例信息', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 800);
      return;
    }
    this.setData({ sample: sample });
  }
});