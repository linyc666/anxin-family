// pages/checklist/checklist.js - 资料核对清单
var docCheck = require('../../utils/doc-checklist');

Page({
  data: {
    recordName: '',
    filledFields: [],
    missingFields: [],
    expiryStatus: {},
    annualSpending: {},
    completeness: {},
    preConsultList: []
  },

  onLoad(opts) {
    if (!opts.policyId) {
      wx.showToast({ title: '缺少资料ID', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 1000);
      return;
    }
    var app = getApp();
    var family = app.globalData.family || { members: [], policies: [] };
    var policy = family.policies.find(function(p) { return p.id === opts.policyId; });
    if (!policy) {
      wx.showToast({ title: '资料不存在', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 1000);
      return;
    }
    var member = family.members.find(function(m) { return m.id === policy.memberId; }) || null;
    var result = docCheck.generateChecklist(policy, member);
    this.setData({
      recordName: result.recordName,
      filledFields: result.filledFields,
      missingFields: result.missingFields,
      expiryStatus: result.expiryStatus,
      annualSpending: result.annualSpending,
      completeness: result.completeness,
      preConsultList: result.preConsultList
    });
  }
});
