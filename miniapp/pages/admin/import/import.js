// pages/admin/import/import.js - 批量导入样例（含质量筛选）
var productLoader = require('../../../utils/product-loader');
var qualityFilter = require('../../../utils/quality-filter');

Page({
  data: {
    jsonText: '',
    preview: [],
    qualityStats: null,
    importResult: null,
    importMode: 'skip',
    qualityMin: 'conditional'
  },

  onInputJSON(e) {
    this.setData({ jsonText: e.detail.value, importResult: null });
  },

  onPreview() {
    var text = this.data.jsonText.trim();
    if (!text) { wx.showToast({ title: '请粘贴JSON数据', icon: 'none' }); return; }
    try {
      var data = JSON.parse(text);
      var products = Array.isArray(data) ? data : (data.products || data.data || [data]);
      if (products.length === 0) { wx.showToast({ title: '未检测到样例数据', icon: 'none' }); return; }

      var recommend = 0, conditional = 0, reject = 0;
      var preview = products.map(function(p, i) {
        var valid = p.name && p.type && p.company;
        var qr = qualityFilter.evaluate(p);
        if (qr.level === 'recommend') recommend++;
        else if (qr.level === 'conditional') conditional++;
        else reject++;
        return {
          index: i, name: p.name || '(缺名称)', type: p.type || '?',
          company: p.company || '(缺公司)', valid: valid,
          quality: qr, raw: p
        };
      });

      this.setData({
        preview: preview,
        qualityStats: { recommend: recommend, conditional: conditional, reject: reject },
        importResult: null
      });
      wx.showToast({ title: '已解析 ' + products.length + ' 条样例', icon: 'success' });
    } catch(e) {
      wx.showToast({ title: 'JSON格式不正确', icon: 'none' });
    }
  },

  onToggleMode() {
    this.setData({ importMode: this.data.importMode === 'skip' ? 'overwrite' : 'skip' });
  },

  onQualityMinChange() {
    var levels = ['recommend', 'conditional', 'reject'];
    var cur = levels.indexOf(this.data.qualityMin);
    var next = levels[(cur + 1) % 3];
    this.setData({ qualityMin: next });
  },

  onDoImport() {
    var minLevel = this.data.qualityMin;
    var levelOrder = { recommend: 0, conditional: 1, reject: 2 };

    var validItems = this.data.preview.filter(function(p) {
      return p.valid && levelOrder[p.quality.level] <= levelOrder[minLevel];
    });

    if (validItems.length === 0) {
      wx.showToast({ title: '没有符合质量门槛的样例', icon: 'none' }); return;
    }

    var existingProducts = productLoader.getProducts();
    var created = 0, skipped = 0, updated = 0;
    var resultProducts = existingProducts.slice();
    var newProducts = []; // 需要同步到云端的

    validItems.forEach(function(item) {
      var p = item.raw;
      if (!p.id) { p.id = 'imp_' + Date.now() + '_' + item.index; }
      if (!p.features) { p.features = []; }
      if (p.score === undefined) { p.score = 80; }
      if (p.active === undefined) { p.active = true; }
      if (!p.prices || !Array.isArray(p.prices)) { p.prices = [{ ageMin: 0, ageMax: 65, price: 500 }]; }

      var exists = existingProducts.some(function(ep) { return (ep.id || ep._id) === p.id; });

      if (exists) {
        if (this.data.importMode === 'overwrite') {
          resultProducts = resultProducts.map(function(ep) {
            return (ep.id || ep._id) === p.id ? p : ep;
          });
          updated++;
        } else { skipped++; }
      } else {
        resultProducts.push(p);
        newProducts.push(p);
        created++;
      }
    }.bind(this));

    // 1. 先保存本地
    productLoader.injectProducts(resultProducts);

    // 2. 同步新产品到云数据库
    var that = this;
    var syncResult = { cloudOk: 0, cloudFail: 0 };
    if (newProducts.length > 0 && wx.cloud) {
      wx.cloud.callFunction({
        name: 'adminProducts',
        data: { action: 'bulkCreate', products: newProducts }
      }).then(function(res) {
        if (res.result && res.result.success) {
          syncResult.cloudOk = res.result.data.created || 0;
        }
        that.setData({ importResult: {
          total: validItems.length, created: created, updated: updated, skipped: skipped,
          cloudOk: syncResult.cloudOk, cloudFail: syncResult.cloudFail
        }});
      }).catch(function() {
        syncResult.cloudFail = newProducts.length;
        that.setData({ importResult: {
          total: validItems.length, created: created, updated: updated, skipped: skipped,
          cloudOk: 0, cloudFail: newProducts.length
        }});
      });
    }

    this.setData({ importResult: {
      total: validItems.length, created: created, updated: updated, skipped: skipped,
      cloudOk: syncResult.cloudOk, cloudFail: syncResult.cloudFail
    }});
    wx.showToast({ title: '导入完成', icon: 'success' });
  },

  onPickFile() {
    var that = this;
    wx.chooseMessageFile({
      count: 1, type: 'file',
      success: function(res) {
        var fs = wx.getFileSystemManager();
        var content = fs.readFileSync(res.tempFiles[0].path, 'utf8');
        that.setData({ jsonText: content, importResult: null });
        that.onPreview();
      }
    });
  }
});
