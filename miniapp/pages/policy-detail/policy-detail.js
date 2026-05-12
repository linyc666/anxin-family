// pages/policy-detail/policy-detail.js - 资料详情
var display = require('../../utils/display-sanitizer');
var attachmentUtil = require('../../utils/attachments');
var recordProfile = require('../../utils/record-profile');
var recordContent = require('../../utils/record-content');
var profileSections = require('../../utils/record-profile-sections');

function getExtractSourceLabel(meta) {
  if (!meta) return '';
  if (meta.sourceType === 'pdf' && meta.textSource === 'pdf_text') return 'PDF文本读取';
  if (meta.sourceType === 'pdf' && meta.textSource === 'pdf_document') return 'PDF文档解析';
  if (meta.sourceType === 'image' && meta.longImage) return '长图分段识别';
  if (meta.sourceType === 'image') return '图片识别';
  return '';
}

Page({
  data: {
    policyId: '',
    recordName: '',
    memberName: '',
    fields: [],
    ownedSummary: null,
    attachments: [],
    hasAttachments: false
  },

  onLoad(opts) {
    if (!opts.policyId) {
      wx.showToast({ title: '缺少资料ID', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 1000);
      return;
    }
    this.setData({ policyId: opts.policyId });
    this.loadData();
  },

  onShow() {
    if (this.data.policyId) this.loadData();
  },

  loadData() {
    var app = getApp();
    var family = app.globalData.family || { members: [], policies: [] };
    var policy = family.policies.find(function(p) { return p.id === this.data.policyId; }.bind(this));
    if (!policy) {
      wx.showToast({ title: '资料不存在', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 1000);
      return;
    }

    var member = family.members.find(function(m) { return m.id === policy.memberId; }) || null;
    var safeName = display.aliasRecordName(policy.name, policy.type);
    var safeCompany = display.aliasSource(policy.company);
    var safeType = display.getTypeLabel(policy.type);
    var safeCoverage = display.sanitizeText(policy.coverage || '');
    var safeGuarantee = display.sanitizeText(policy.guaranteedYears || '');
    var safeTags = display.sanitizeText(policy.tags || '');
    var safeDetail = display.sanitizeText(policy.detail || '');

    var fields = [];
    if (policy.name) fields.push({ label: '记录名称', value: safeName });
    if (member) fields.push({ label: '所属家人', value: member.name });
    if (policy.company) fields.push({ label: '机构/来源', value: safeCompany });
    if (policy.type) fields.push({ label: '资料类别', value: safeType });
    if (policy.premium) fields.push({ label: '年度支出', value: '¥' + parseInt(policy.premium).toLocaleString() + '/年' });
    if (policy.policyNo) fields.push({ label: '编号', value: policy.policyNo });
    if (policy.effective) fields.push({ label: '生效日期', value: policy.effective });
    if (policy.expiry) fields.push({ label: '到期日期', value: policy.expiry });
    if (safeCoverage) fields.push({ label: '额度/范围', value: safeCoverage });
    if (safeGuarantee) fields.push({ label: '延续条件', value: safeGuarantee });
    if (safeTags) fields.push({ label: '标签', value: safeTags });
    if (policy.extractionMeta) {
      var sourceLabel = getExtractSourceLabel(policy.extractionMeta);
      if (sourceLabel) fields.push({ label: '识别方式', value: sourceLabel });
      if (policy.extractionMeta.textLength) fields.push({ label: '读取字数', value: String(policy.extractionMeta.textLength) });
    }
    if (safeDetail) fields.push({ label: '详细说明', value: safeDetail, full: true });

    var attachments = attachmentUtil.normalize(policy);
    var ownedSummary = recordProfile.buildOwnedSummary({
      type: policy.type,
      premium: policy.premium,
      coverage: safeCoverage,
      effective: policy.effective,
      expiry: policy.expiry,
      guaranteedYears: safeGuarantee
    });
    var contentItems = (policy.contentItems && policy.contentItems.length > 0) ? policy.contentItems : recordContent.buildContentItems(policy);
    var reviewItems = policy.reviewItems || [];
    var profile = profileSections.buildProfile(policy, 'user_record');
    this.setData({
      recordName: safeName || '未命名资料',
      memberName: member ? member.name : '',
      fields: fields,
      ownedSummary: ownedSummary,
      contentItems: contentItems,
      reviewItems: reviewItems,
      profile: profile,
      attachments: attachments,
      hasAttachments: attachments.length > 0,
      verified: policy.verified !== false
    });
  },

  // === 标记已核对 ===
  onMarkVerified() {
    var that = this;
    var app = getApp();
    var policy = app.globalData.family.policies.find(function(p) { return p.id === that.data.policyId; });
    if (policy) {
      policy.verified = true;
      app.saveData();
      this.setData({ verified: true });
      wx.showToast({ title: '已标记为已核对', icon: 'success' });
    }
  },

  onOpenAttachment(e) {
    var id = e.currentTarget.dataset.id;
    var att = (this.data.attachments || []).find(function(a) { return a.id === id; });
    if (!att) return;
    var path = att.fileID || att.tempPath;
    if (!path) {
      wx.showToast({ title: '附件路径无效', icon: 'none' });
      return;
    }

    if (att.type === 'image') {
      var images = this.data.attachments.filter(function(a) { return a.type === 'image'; }).map(function(a) { return a.fileID || a.tempPath; });
      wx.previewImage({ urls: images, current: path });
      return;
    }

    var openLocal = function(localPath) {
      wx.openDocument({
        filePath: localPath,
        showMenu: true,
        fail: function() { wx.showToast({ title: '暂无法打开该文档', icon: 'none' }); }
      });
    };

    if (att.fileID && wx.cloud) {
      wx.showLoading({ title: '打开中...' });
      wx.cloud.downloadFile({
        fileID: att.fileID,
        success: function(res) {
          wx.hideLoading();
          openLocal(res.tempFilePath);
        },
        fail: function() {
          wx.hideLoading();
          wx.showToast({ title: '文档下载失败', icon: 'none' });
        }
      });
    } else {
      openLocal(att.tempPath);
    }
  },

  onEdit() {
    wx.navigateTo({ url: '/pages/policy-form/policy-form?editId=' + this.data.policyId });
  },

  onCheck() {
    wx.navigateTo({ url: '/pages/checklist/checklist?policyId=' + this.data.policyId });
  },

  onDelete() {
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '删除该资料记录？此操作不可恢复。',
      confirmText: '删除',
      cancelText: '取消',
      success: function(res) {
        if (res.confirm) {
          var app = getApp();
          app.globalData.family.policies = app.globalData.family.policies.filter(function(p) { return p.id !== that.data.policyId; });
          app.saveData();
          wx.switchTab({ url: '/pages/members/members' });
        }
      }
    });
  }
});
