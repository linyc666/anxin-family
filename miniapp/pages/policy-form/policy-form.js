// pages/policy-form/policy-form.js - 资料记录表单
var api = require('../../utils/api');
var membership = require('../../utils/membership');
var display = require('../../utils/display-sanitizer');
var attachmentUtil = require('../../utils/attachments');
var dedupe = require('../../utils/record-dedupe');

function getTypeLabel(options, value) {
  for (var i = 0; i < options.length; i++) {
    if (options[i].value === value) return options[i].label;
  }
  return display.getTypeLabel(value) || value || '';
}

function firstImageAttachment(list) {
  list = list || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].type === 'image') return list[i];
  }
  return null;
}

function normalizeExtractedType(type) {
  var map = {
    '医疗支出': '百万医疗',
    '百万医疗': '百万医疗',
    '意外风险': '意外险',
    '意外险': '意外险',
    '大额支出': '重疾险',
    '重疾险': '重疾险',
    '家庭责任': '定寿',
    '定寿': '定寿',
    '健康专项': '防癌险',
    '防癌险': '防癌险',
    '城市补充': '惠民保',
    '惠民保': '惠民保',
    '车辆资料': '车险',
    '车险': '车险',
    '房屋资料': '房险',
    '房险': '房险',
    '家财资料': '家财险',
    '家财险': '家财险',
    '储蓄资料': '分红险',
    '分红险': '分红险',
    '其他': '其他'
  };
  return map[type] || type || '';
}

function getMediaTypeByExt(ext, fallback) {
  ext = String(ext || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return fallback || 'image/jpeg';
}

Page({
  data: {
    memberId: '',
    memberName: '',
    editingId: '',
    form: {
      name: '', company: '', type: '百万医疗', premium: '',
      coverage: '', guaranteedYears: '', effectiveDate: '', expiryDate: '',
      tags: '', detail: '', policyNo: '', screenshot: '', attachments: []
    },
    memberOptions: [],
    memberIndex: -1,
    typeLabel: '医疗支出',
    typeOptions: [
      { label: '医疗支出', value: '百万医疗' },
      { label: '意外风险', value: '意外险' },
      { label: '大额支出', value: '重疾险' },
      { label: '家庭责任', value: '定寿' },
      { label: '健康专项', value: '防癌险' },
      { label: '城市补充', value: '惠民保' },
      { label: '车辆资料', value: '车险' },
      { label: '房屋资料', value: '房险' },
      { label: '家财资料', value: '家财险' },
      { label: '储蓄资料', value: '分红险' },
      { label: '其他', value: '其他' }
    ],
    guaranteeOptions: ['终身延续','20年延续','6年延续','1年期','年度型延续不稳定','其他'],
    acMatches: [], acShow: false, acIndex: -1,
    ocrImage: '', ocrRunning: false, ocrResult: null,
    manualText: '', textExtractRunning: false,
    uploadingAttachment: false,
    extractedContentItems: [],
    extractedReviewItems: [],
    extractedCoreSummary: '',
    extractedContentGroups: [],
    extractedBoundaryItems: [],
    extractedMeta: null
  },

  onLoad(opts) {
    this.loadMemberOptions(opts.memberId || '');
    if (opts.memberId) {
      this.setData({ memberId: opts.memberId });
      var app = getApp();
      var member = app.globalData.family.members.find(function(m){ return m.id === opts.memberId; });
      if (member) this.setData({ memberName: member.name });
    }
    if (opts.editId) {
      this.setData({ editingId: opts.editId });
      this.loadExistingPolicy(opts.editId);
    }
  },

  loadMemberOptions(selectedId) {
    var app = getApp();
    var members = ((app.globalData.family && app.globalData.family.members) || [])
      .filter(function(m) { return (m.kind || 'person') !== 'pet'; });
    var memberIndex = -1;
    members.forEach(function(m, idx) {
      if (m.id === selectedId) memberIndex = idx;
    });
    this.setData({ memberOptions: members, memberIndex: memberIndex });
  },

  loadExistingPolicy(id) {
    var app = getApp();
    var policy = app.globalData.family.policies.find(function(p){ return p.id === id; });
    if (!policy) return;
    var member = app.globalData.family.members.find(function(m){ return m.id === policy.memberId; });
    var attachments = attachmentUtil.normalize(policy);
    this.setData({
      memberId: policy.memberId || this.data.memberId,
      memberName: member ? member.name : this.data.memberName,
      typeLabel: getTypeLabel(this.data.typeOptions, policy.type || '百万医疗'),
      form: {
        name: policy.name||'', company: policy.company||'', type: policy.type||'百万医疗',
        premium: policy.premium||'', coverage: policy.coverage||'',
        guaranteedYears: policy.guaranteedYears||'', effectiveDate: policy.effective||'',
        expiryDate: policy.expiry||'', tags: policy.tags||'', detail: policy.detail||'',
        policyNo: policy.policyNo||'', screenshot: policy.screenshot||'', attachments: attachments
      },
      extractedContentItems: policy.contentItems || [],
      extractedReviewItems: policy.reviewItems || [],
      extractedCoreSummary: policy.coreSummary || '',
      extractedContentGroups: policy.contentGroups || [],
      extractedBoundaryItems: policy.boundaryItems || [],
      extractedMeta: policy.extractionMeta || null
    });
  },

  onInput(e) {
    var field = e.currentTarget.dataset.field;
    var form = this.data.form;
    form[field] = e.detail.value;
    this.setData({ form: form });
    if (field === 'name') this.searchProducts(e.detail.value);
  },

  onManualTextInput(e) {
    this.setData({ manualText: e.detail.value });
  },

  onTypeChange(e) {
    var option = this.data.typeOptions[e.detail.value];
    var f=this.data.form;
    f.type=option.value;
    this.setData({form:f, typeLabel: option.label});
  },

  onMemberChange(e) {
    var idx = parseInt(e.detail.value, 10);
    var member = this.data.memberOptions[idx];
    if (!member) return;
    this.setData({ memberId: member.id, memberName: member.name, memberIndex: idx });
  },

  onGuaranteeChange(e) {
    var f=this.data.form;
    f.guaranteedYears=this.data.guaranteeOptions[e.detail.value];
    this.setData({form:f});
  },

  onDateChange(e) {
    var field = e.currentTarget.dataset.field;
    var form = this.data.form;
    form[field] = e.detail.value;
    this.setData({ form: form });
  },

  searchProducts(query) {
    if (!query||query.trim().length<1){ this.setData({acShow:false,acMatches:[]});return; }
    var that = this;
    api.searchProducts(query).then(function(matches) {
      matches = (matches || []).map(function(prod) {
        return Object.assign({}, prod, {
          displayName: display.aliasRecordName(prod.name, prod.type),
          displayCompany: display.aliasSource(prod.company),
          displayType: display.getTypeLabel(prod.type),
          displayCoverage: display.sanitizeText(prod.coverage),
          displayDeductible: display.sanitizeText(prod.deductible),
          displayFeatures: display.sanitizeText((prod.features || []).slice(0, 5).join(','))
        });
      });
      that.setData({ acShow: matches.length>0, acMatches: matches, acIndex: -1 });
    });
  },

  selectProduct(e) {
    var idx=e.currentTarget.dataset.index;
    var prod=this.data.acMatches[idx];
    if(!prod)return;
    this.setData({
      acShow: false,
      form: Object.assign({}, this.data.form, {
        name: prod.displayName || display.aliasRecordName(prod.name, prod.type),
        company: prod.displayCompany || display.aliasSource(prod.company),
        type: prod.type,
        coverage: prod.displayCoverage || display.sanitizeText(prod.coverage),
        guaranteedYears: display.sanitizeText(prod.guaranteeType)||'',
        tags: prod.displayFeatures || '',
        detail: '额度/范围：'+(prod.displayCoverage || '-')+' · 条件：'+(prod.displayDeductible || '-')+' · 观察期：'+(prod.waitingDays||'-')+'天'
      })
    });
    this.setData({ typeLabel: getTypeLabel(this.data.typeOptions, prod.type) });
  },

  canAddMoreAttachment() {
    var app = getApp();
    var family = app.globalData.family || { policies: [] };
    var baseCount = attachmentUtil.countFamilyAttachments(family, this.data.editingId);
    var currentCount = (this.data.form.attachments || []).length;
    var limit = membership.getLimits(membership.getPlan()).attachments;
    return baseCount + currentCount < limit;
  },

  addAttachmentToForm(att, skipDupCheck) {
    var form = this.data.form;
    var list = (form.attachments || []).slice();
    // 检测附件重复（同名且同大小）
    if (!skipDupCheck) {
      var dup = list.find(function(a) { return a.name === att.name && a.size === att.size && att.size > 0; });
      if (dup) {
        var that = this;
        wx.showModal({
          title: '附件可能重复',
          content: '检测到已存在同名同大小的附件，是否替换旧附件？',
          confirmText: '替换', cancelText: '保留两者',
          success: function(res) {
            if (res.confirm) {
              var newList = list.filter(function(a) { return a.id !== dup.id; });
              newList.push(att);
              form.attachments = newList;
            } else {
              list.push(att);
              form.attachments = list;
            }
            var firstImage = firstImageAttachment(form.attachments);
            form.screenshot = firstImage ? (firstImage.fileID || firstImage.tempPath) : '';
            that.setData({ form: form });
          }
        });
        return;
      }
    }
    list.push(att);
    form.attachments = list;
    var firstImage = firstImageAttachment(list);
    form.screenshot = firstImage ? (firstImage.fileID || firstImage.tempPath) : '';
    this.setData({ form: form });
  },

  uploadAttachment(file, folder, fallbackType) {
    var that = this;
    return new Promise(function(resolve) {
      var ext = attachmentUtil.getExt(file.name || file.path || file.tempFilePath) || (fallbackType === 'image' ? 'jpg' : 'file');
      var path = file.path || file.tempFilePath;
      if (!wx.cloud || !path) {
        resolve(attachmentUtil.createAttachment(file, null, fallbackType));
        return;
      }
      wx.cloud.uploadFile({
        cloudPath: folder + '/' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.' + ext,
        filePath: path,
        success: function(uploadRes) {
          resolve(attachmentUtil.createAttachment(file, uploadRes, fallbackType));
        },
        fail: function() {
          resolve(attachmentUtil.createAttachment(file, null, fallbackType));
        }
      });
    });
  },

  onAddImageAttachment() {
    if (!this.canAddMoreAttachment()) {
      membership.showUpgradeToast('免费版附件数量已用完，升级后可继续添加图片和文档。');
      return;
    }
    var that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['camera', 'album'],
      success: function(res) {
        var file = (res.tempFiles && res.tempFiles[0]) || { path: res.tempFilePaths[0], size: 0 };
        file.name = file.name || '图片附件.jpg';
        that.setData({ uploadingAttachment: true });
        that.uploadAttachment(file, 'attachments/images', 'image').then(function(att) {
          that.setData({ uploadingAttachment: false });
          that.addAttachmentToForm(att);
        });
      }
    });
  },

  onAddFileAttachment() {
    if (!this.canAddMoreAttachment()) {
      membership.showUpgradeToast('免费版附件数量已用完，升级后可继续添加图片和文档。');
      return;
    }
    var that = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: attachmentUtil.DOC_EXTS,
      success: function(res) {
        var file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        that.setData({ uploadingAttachment: true });
        that.uploadAttachment(file, 'attachments/files', 'file').then(function(att) {
          that.setData({ uploadingAttachment: false });
          that.addAttachmentToForm(att);
        });
      }
    });
  },

  onRemoveAttachment(e) {
    var id = e.currentTarget.dataset.id;
    var form = this.data.form;
    form.attachments = (form.attachments || []).filter(function(a) { return a.id !== id; });
    var firstImage = firstImageAttachment(form.attachments);
    form.screenshot = firstImage ? (firstImage.fileID || firstImage.tempPath) : '';
    this.setData({ form: form });
  },

  applyExtractedData(extracted) {
    extracted = extracted || {};
    var old = this.data.form;
    var nextType = normalizeExtractedType(extracted.type) || old.type;
    var notes = extracted.notes || '';
    var isInternalNote = /正则提取|未经AI校验|JSON解析失败|调用失败|识别异常|PDF解析失败/.test(notes);
    this.setData({
      ocrResult: extracted,
      form: Object.assign({}, old, {
        name: extracted.policyName || old.name,
        company: extracted.company || old.company,
        type: nextType,
        premium: extracted.premium || old.premium,
        coverage: extracted.coverage || old.coverage,
        guaranteedYears: extracted.guaranteeYears || old.guaranteedYears,
        effectiveDate: extracted.effectiveDate || old.effectiveDate,
        expiryDate: extracted.expiryDate || old.expiryDate,
        policyNo: extracted.policyNo || old.policyNo,
        tags: extracted.features || old.tags,
        detail: isInternalNote ? old.detail : (notes || old.detail)
      }),
      typeLabel: getTypeLabel(this.data.typeOptions, nextType)
    });
  },

  callExtractFunction(att, options) {
    var that = this;
    options = options || {};
    var isRetry = options.isRetry || false;
    wx.cloud.callFunction({
      name: 'extractPolicy',
      data: {
        fileID: att.fileID,
        fileIDs: options.fileIDs || undefined,
        fileName: att.name,
        fileType: att.ext,
        mediaType: options.mediaType || '',
        sourceType: options.sourceType || att.type,
        isLongImage: options.isLongImage || false
      },
      success: function(fnRes) {
        that.setData({ ocrRunning: false });
        that.addAttachmentToForm(att);
        var result = fnRes.result || {};

        // === partial: 低置信度 / 失败但不中断 ===
        if (result.partial) {
          if (result.data) that.applyExtractedData(result.data);
          that.saveExtractedDetail(result);

          var code = result.errorCode || '';
          var guide = '';
          if (code === 'LOW_TEXT') {
            guide = '可重新拍摄完整页面，或手动补充字段。';
          } else if (code === 'PDF_NO_TEXT' || code === 'PDF_LOW_TEXT') {
            guide = '可上传关键页截图进行识别，或手动补充字段。';
          } else if (code === 'OCR_FAILED') {
            guide = '可稍后重试，或手动填写字段。';
          } else if (code === 'FILE_UNSUPPORTED') {
            guide = '可上传截图进行识别，或手动填写字段。';
          } else {
            guide = '可重新选择文件或手动补充字段。';
          }

          // 以下情况不消耗次数：系统能力未配置、未预期错误、无有效文字
          var NO_CONSUME = ['LOW_TEXT', 'OCR_FAILED', 'VISION_FAILED', 'FILE_UNSUPPORTED', 'PDF_NO_TEXT', 'PDF_NO_API_KEY', 'PDF_TOO_LARGE', 'UNKNOWN_ERROR'];
          var shouldConsume = NO_CONSUME.indexOf(code) === -1;
          // PDF_PARSE_ERROR / PDF_LOW_TEXT：有提取到字段才消耗
          if (code === 'PDF_PARSE_ERROR' || code === 'PDF_LOW_TEXT') {
            var qCheck = result.quality || {};
            shouldConsume = (qCheck.filled || 0) > 0;
          }
          if (shouldConsume) {
            membership.incrementOcrUsage();
          }

          wx.showModal({
            title: '已保存附件',
            content: (result.message || '识别信息有限') + '\n\n' + guide,
            confirmText: '继续补充',
            cancelText: isRetry ? '关闭' : '重新识别',
            success: function(modalRes) {
              if (modalRes.confirm) {
                // 继续补充：留在表单，聚焦到名称字段
                // 用户直接看到表单开始手动填写
              } else if (!isRetry) {
                // 重新识别：根据类型重新触发
                if (options.sourceType === 'pdf' || options.mediaType === 'application/pdf') {
                  that.onRecognizeFile();
                } else {
                  that.onOCR();
                }
              }
            }
          });
          return;
        }

        // === 完全成功 ===
        if (result.success && result.data) {
          that.applyExtractedData(result.data);
          that.saveExtractedDetail(result);
          var q = result.quality || {};
          // 字段数 <4：按 partial 提示，不消耗次数
          if (q.filled < 4) {
            wx.showModal({
              title: '识别信息有限',
              content: '仅提取到 ' + q.filled + ' 个字段，建议手动核对并补充名称、来源、类别和到期日。',
              confirmText: '继续补充',
              showCancel: false
            });
          } else {
            membership.incrementOcrUsage();
            var isLong = result.longImage;
            if (q.filled >= 7) {
              var longMsg = isLong ? '已按长图尝试整理，请重点核对额度、日期和费用边界。' : '已提取 ' + q.filled + '/' + q.total + ' 个字段';
              if (isLong) {
                wx.showModal({ title: '长图识别完成', content: longMsg, confirmText: '核对', showCancel: false });
              } else {
                wx.showToast({ title: longMsg, icon: 'success' });
              }
            } else {
              wx.showModal({
                title: '部分识别成功',
                content: (isLong ? '已从长图中提取部分信息，' : '') + '已自动填入 ' + q.filled + ' 个字段，还有 ' + (q.total - q.filled) + ' 个字段建议手动核对补充。',
                confirmText: '继续补充',
                showCancel: false
              });
            }
          }
          return;
        }

        // === 兜底 ===
        wx.showModal({
          title: '提示',
          content: '识别未成功，附件已保存。建议先手动填写：记录名称、机构/来源、资料类别、到期日期。',
          confirmText: '继续补充',
          showCancel: false
        });
      },
      fail: function() {
        that.setData({ ocrRunning: false });
        that.addAttachmentToForm(att);
        wx.showModal({
          title: '识别失败，附件已保存',
          content: '云端识别暂时不可用。建议优先填写：名称、来源、类别和到期日。',
          confirmText: '继续补充',
          showCancel: false
        });
      }
    });
  },

  onExtractManualText() {
    if (!membership.canUseOcr()) {
      membership.showUpgradeToast('免费版识别次数已用完，升级后可获得更多识别次数。');
      return;
    }
    var text = (this.data.manualText || '').trim();
    if (!text) {
      wx.showToast({ title: '请先粘贴资料文字', icon: 'none' });
      return;
    }
    if (text.length < 20) {
      wx.showToast({ title: '文字太短，建议补充更多信息', icon: 'none' });
      return;
    }

    var that = this;
    this.setData({ textExtractRunning: true });
    wx.cloud.callFunction({
      name: 'extractPolicy',
      data: {
        sourceType: 'text',
        mediaType: 'text/plain',
        text: text
      },
      success: function(fnRes) {
        that.setData({ textExtractRunning: false });
        var result = fnRes.result || {};
        if (result.data) {
          that.applyExtractedData(result.data);
          that.saveExtractedDetail(result);
        }
        var q = result.quality || {};
        if (result.success && !result.partial && q.filled >= 4) {
          membership.incrementOcrUsage();
          wx.showToast({ title: '已整理 ' + q.filled + ' 个字段', icon: 'success' });
          return;
        }
        wx.showModal({
          title: '已尽量整理',
          content: (result.message || '这段文字可提取的信息有限。') + '\n\n建议核对并补充名称、来源、类别和日期。',
          confirmText: '继续补充',
          showCancel: false
        });
      },
      fail: function() {
        that.setData({ textExtractRunning: false });
        wx.showToast({ title: '文字整理失败', icon: 'none' });
      }
    });
  },

  onOCR() {
    if (!membership.canUseOcr()) {
      membership.showUpgradeToast('免费版识别次数已用完，升级后可获得更多识别次数。');
      return;
    }
    if (!this.canAddMoreAttachment()) {
      membership.showUpgradeToast('免费版附件数量已用完，升级后可继续保存识别图片。');
      return;
    }
    var that=this;
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['camera', 'album'],
      success: function(res) {
        var file = (res.tempFiles && res.tempFiles[0]) || { path: res.tempFilePaths[0], size: 0 };
        file.name = file.name || '识别图片.jpg';
        var tempFilePath=file.path || file.tempFilePath;
        that.setData({ ocrImage: tempFilePath, ocrRunning: true });

        // 检测长图：height/width > 1.6
        wx.getImageInfo({
          src: tempFilePath,
          success: function(info) {
            var isLong = (info.height / info.width) > 1.6;
            if (isLong) {
              that.uploadAndRecognizeLongImage(file, tempFilePath, info);
            } else {
              that.uploadSingleAndRecognize(file, tempFilePath);
            }
          },
          fail: function() {
            that.uploadSingleAndRecognize(file, tempFilePath);
          }
        });
      }
    });
  },

  uploadSingleAndRecognize(file, tempFilePath) {
    var that = this;
    var ext = attachmentUtil.getExt(file.name || tempFilePath) || 'jpg';
    wx.cloud.uploadFile({
      cloudPath: 'ocr/'+Date.now()+'.'+ext,
      filePath: tempFilePath,
      success: function(uploadRes) {
        var att = attachmentUtil.createAttachment(file, uploadRes, 'image');
        that.callExtractFunction(att, { sourceType: 'image', mediaType: getMediaTypeByExt(att.ext, 'image/jpeg') });
      },
      fail: function() {
        that.setData({ ocrRunning: false });
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    });
  },

  uploadAndRecognizeLongImage(file, tempFilePath, info) {
    var that = this;
    // 先整体上传作为附件保存
    var ext = attachmentUtil.getExt(file.name || tempFilePath) || 'jpg';
    wx.cloud.uploadFile({
      cloudPath: 'ocr/'+Date.now()+'.'+ext,
      filePath: tempFilePath,
      success: function(uploadRes) {
        var att = attachmentUtil.createAttachment(file, uploadRes, 'image');
        // 长图切块识别
        that.splitImageAndRecognize(tempFilePath, info, att);
      },
      fail: function() {
        that.setData({ ocrRunning: false });
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    });
  },

  splitImageAndRecognize(tempFilePath, info, mainAtt) {
    var that = this;
    var segCount = info.height / info.width > 2.5 ? 3 : 2;
    var segHeight = Math.floor(info.height / segCount);
    // 单段太短则减少分段
    if (segHeight < 900 && segCount > 2) segCount = 2;
    segHeight = Math.floor(info.height / segCount);
    var overlap = Math.floor(segHeight * 0.18);
    // 目标宽度：原图≥1000用min(原图,1400)，否则用原图宽度
    var targetWidth = info.width >= 1000 ? Math.min(info.width, 1400) : info.width;
    var segments = [];

    var query = wx.createSelectorQuery();
    query.select('#splitCanvas').fields({ node: true, size: true }).exec(function(selRes) {
      var canvasNode = selRes && selRes[0] ? selRes[0].node : null;
      if (!canvasNode) {
        that.fallbackLongImageUpload(mainAtt);
        return;
      }

      var ctx = canvasNode.getContext('2d');
      var canvasImg = canvasNode.createImage();

      canvasImg.onload = function() {
        var drawAndExport = function(idx) {
          if (idx >= segCount) {
            that.uploadSegmentsAndRecognize(segments, mainAtt, segCount);
            return;
          }
          var sy = Math.max(0, idx * segHeight - (idx > 0 ? overlap : 0));
          var sh = idx === segCount - 1 ? info.height - sy : segHeight + (idx > 0 ? overlap : 0) + (idx < segCount - 1 ? overlap : 0);
          sh = Math.min(sh, info.height - sy);
          var drawHeight = Math.floor(targetWidth * sh / info.width);

          canvasNode.width = targetWidth;
          canvasNode.height = drawHeight;
          ctx.clearRect(0, 0, targetWidth, drawHeight);
          ctx.drawImage(canvasImg, 0, sy, info.width, sh, 0, 0, targetWidth, drawHeight);

          wx.canvasToTempFilePath({
            canvas: canvasNode,
            x: 0, y: 0, width: targetWidth, height: drawHeight,
            destWidth: targetWidth, destHeight: drawHeight,
            fileType: 'jpg', quality: 1,
            success: function(tmpRes) {
              wx.cloud.uploadFile({
                cloudPath: 'ocr/seg_'+Date.now()+'_'+(idx+1)+'_of_'+segCount+'.jpg',
                filePath: tmpRes.tempFilePath,
                success: function(segUpload) {
                  segments.push(segUpload.fileID);
                  drawAndExport(idx + 1);
                },
                fail: function() { drawAndExport(idx + 1); }
              });
            },
            fail: function() { drawAndExport(idx + 1); }
          });
        };
        drawAndExport(0);
      };

      canvasImg.onerror = function() {
        that.fallbackLongImageUpload(mainAtt);
      };
      canvasImg.src = tempFilePath;
    });
  },

  uploadSegmentsAndRecognize(segments, mainAtt, segCount) {
    if (segments.length === 0) {
      this.fallbackLongImageUpload(mainAtt);
      return;
    }
    wx.showToast({ title: '长图分' + segments.length + '段识别中...', icon: 'none', duration: 1500 });
    this.callExtractFunction(mainAtt, {
      sourceType: 'image',
      mediaType: getMediaTypeByExt(mainAtt.ext, 'image/jpeg'),
      isLongImage: true,
      fileIDs: segments,
      segCount: segCount || segments.length
    });
  },

  fallbackLongImageUpload(mainAtt) {
    wx.showToast({ title: '已按长图尝试整理，请重点核对', icon: 'none', duration: 2000 });
    this.callExtractFunction(mainAtt, { sourceType: 'image', mediaType: getMediaTypeByExt(mainAtt.ext, 'image/jpeg'), isLongImage: true });
  },

  onRecognizeFile() {
    if (!membership.canUseOcr()) {
      membership.showUpgradeToast('免费版识别次数已用完，升级后可获得更多识别次数。');
      return;
    }
    if (!this.canAddMoreAttachment()) {
      membership.showUpgradeToast('免费版附件数量已用完，升级后可继续保存识别文件。');
      return;
    }
    var that = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: function(res) {
        var file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        var ext = attachmentUtil.getExt(file.name || file.path || file.tempFilePath);
        if (ext !== 'pdf') {
          wx.showToast({ title: '当前先支持PDF识别', icon: 'none' });
          return;
        }
        that.setData({ ocrRunning: true });
        that.uploadAttachment(file, 'ocr/files', 'file').then(function(att) {
          if (!att.fileID) {
            that.setData({ ocrRunning: false });
            that.addAttachmentToForm(att);
            wx.showToast({ title: '已保存附件，识别需云端上传', icon: 'none' });
            return;
          }
          that.callExtractFunction(att, { sourceType: 'pdf', mediaType: 'application/pdf' });
        });
      }
    });
  },

  onSave() {
    var f=this.data.form;
    if(!f.name||!f.company||!f.type){ wx.showToast({title:'请填写记录名称、来源和类别',icon:'none'});return; }
    if(!this.data.memberId){ wx.showToast({title:'请选择所属家人',icon:'none'});return; }

    var attachments = attachmentUtil.normalize({ attachments: f.attachments || [], screenshot: f.screenshot });
    var firstImage = firstImageAttachment(attachments);
    var isVerified = this.data.editingId ? true : (!this.data.ocrResult);
    var policy={
      id: this.data.editingId||('p_'+Date.now()),
      memberId: this.data.memberId,
      type: f.type, name: f.name, company: f.company,
      premium: parseInt(f.premium)||0, coverage: f.coverage,
      guaranteedYears: f.guaranteedYears,
      effective: f.effectiveDate, expiry: f.expiryDate||'终身',
      tags: f.tags, detail: f.detail, policyNo: f.policyNo,
      screenshot: firstImage ? (firstImage.fileID || firstImage.tempPath) : '',
      attachments: attachments,
      verified: isVerified,
      contentItems: this.data.extractedContentItems || [],
      reviewItems: this.data.extractedReviewItems || [],
      coreSummary: this.data.extractedCoreSummary || '',
      contentGroups: this.data.extractedContentGroups || [],
      boundaryItems: this.data.extractedBoundaryItems || [],
      extractionMeta: this.data.extractedMeta || null
    };

    var app=getApp();
    if (!this.data.editingId && !membership.canAddRecord(app.globalData.family)) {
      membership.showUpgradeToast('免费版最多可添加20条重要记录。升级后可继续整理更多资料。');
      return;
    }
    if (attachmentUtil.countFamilyAttachments(app.globalData.family, this.data.editingId) + attachments.length > membership.getLimits(membership.getPlan()).attachments) {
      membership.showUpgradeToast('免费版附件数量已用完，升级后可继续添加图片和文档。');
      return;
    }

    // 附件重复检测
    var dupResult = dedupe.detectDuplicateRecord(app.globalData.family, policy, this.data.editingId);
    if (dupResult.hasAttachmentDup) {
      var that0 = this;
      wx.showModal({
        title: '附件可能重复',
        content: '检测到有相同名称和大小的附件已存在，是否继续保存？',
        confirmText: '继续', cancelText: '取消',
        success: function(res) {
          if (res.confirm) that0.checkRecordDupAndSave(app, policy, dupResult);
        }
      });
      return;
    }
    this.checkRecordDupAndSave(app, policy, dupResult);
  },

  checkRecordDupAndSave(app, policy, dupResult) {
    if (dupResult.type === 'sameMemberStrong') {
      var that = this;
      wx.showModal({
        title: '可能重复',
        content: '检测到该成员已有一份相似的资料记录，是否覆盖旧记录？',
        confirmText: '覆盖', cancelText: '仍新增',
        success: function(res) {
          if (res.confirm) {
            that.saveToFamily(app, policy, dupResult.matchedRecord.id);
          } else {
            that.saveToFamily(app, policy, null);
          }
        }
      });
      return;
    }
    if (dupResult.type === 'otherMemberSimilar') {
      var otherName = dedupe.getMemberName(app.globalData.family, dupResult.matchedMemberId);
      var that2 = this;
      wx.showModal({
        title: '提示',
        content: '检测到' + (otherName || '其他家人') + '有相似资料，是否继续为当前家人新增？',
        confirmText: '继续', cancelText: '取消',
        success: function(res) {
          if (res.confirm) that2.saveToFamily(app, policy, null);
        }
      });
      return;
    }
    this.saveToFamily(app, policy, null);
  },

  saveExtractedDetail(result) {
    var updates = {};
    if (result.contentItems) updates.extractedContentItems = result.contentItems;
    if (result.reviewItems) updates.extractedReviewItems = result.reviewItems;
    if (result.data && result.data.coreSummary) updates.extractedCoreSummary = result.data.coreSummary;
    if (result.data && result.data.contentGroups) updates.extractedContentGroups = result.data.contentGroups;
    if (result.data && result.data.boundaryItems) updates.extractedBoundaryItems = result.data.boundaryItems;
    if (result.extractionMeta || result.quality) {
      updates.extractedMeta = Object.assign({}, result.extractionMeta || {}, {
        quality: result.quality || null,
        segmentSuccessCount: result.segmentSuccessCount,
        segmentFailedCount: result.segmentFailedCount,
        longImage: !!result.longImage,
        longImageSegments: result.longImageSegments || 0
      });
    }
    if (Object.keys(updates).length > 0) this.setData(updates);
  },

  saveToFamily(app, policy, replaceId) {
    if (replaceId) {
      var idx = app.globalData.family.policies.findIndex(function(p) { return p.id === replaceId; });
      if (idx > -1) {
        app.globalData.family.policies[idx] = policy;
        app.saveData();
        wx.navigateBack();
        return;
      }
    }
    if (this.data.editingId) {
      var editIdx = app.globalData.family.policies.findIndex(function(p) { return p.id === this.data.editingId; }.bind(this));
      if (editIdx > -1) app.globalData.family.policies[editIdx] = policy;
    } else {
      app.globalData.family.policies.push(policy);
    }
    app.saveData();
    wx.navigateBack();
  }
});
