// pages/admin/products/products.js - 样例库管理（含质量监测）
var productLoader = require('../../../utils/product-loader');

Page({
  data: {
    products: [],
    filtered: [],
    types: ['全部', '百万医疗', '重疾险', '意外险', '定寿', '防癌险', '惠民保', '财产险', '分红险', '年金险', '车险'],
    activeType: '全部',
    showInactive: false,
    searchText: '',
    showHealth: false,
    healthStats: null
  },

  onShow() {
    this.loadProducts();
  },

  loadProducts() {
    var all = productLoader.getProducts();
    // 计算复核状态标签
    all.forEach(function(p) {
      var status = productLoader.getReviewStatus(p);
      p._reviewStatus = status;
      p._reviewStatusLabel = status === 'current' ? '已复核' : status === 'stale' ? '待复核' : status === 'expired' ? '已过期，不展示' : '未复核';
    });
    this.setData({ products: all });
    this.applyFilter();
    this.computeHealth();
  },

  computeHealth() {
    var all = this.data.products;
    var riskProducts = [];
    var staleProducts = [];
    var warningProducts = [];

    all.forEach(function(p) {
      var risks = [];
      // 延续条件不稳定
      if (p.guaranteeType && (p.guaranteeType.indexOf('不保证') > -1)) {
        risks.push('延续条件不稳定');
      }
      // 公司评级低
      if (p.companyRating && (p.companyRating === 'B类' || p.companyRating.indexOf('B') === 0 && p.companyRating !== 'B+类')) {
        risks.push('公司评级' + p.companyRating);
      }
      // 健告严格
      if (p.healthStrictness >= 3) {
        risks.push('健告严格');
      }
      // 评分低
      if (p.score < 75 && p.score > 0) {
        risks.push('评分仅' + p.score);
      }

      if (risks.length >= 2) {
        riskProducts.push({ product: p, risks: risks });
      } else if (risks.length === 1) {
        warningProducts.push({ product: p, risks: risks });
      }

      // 停用样例
      if (p.active === false) {
        staleProducts.push(p);
      }
    });

    this.setData({
      healthStats: {
        total: all.length,
        active: all.filter(function(p) { return p.active !== false; }).length,
        inactive: staleProducts.length,
        lowQuality: all.filter(function(p) { return p.qualityScore !== undefined && p.qualityScore < 70; }).length,
        risk: riskProducts,
        warning: warningProducts,
        riskCount: riskProducts.length,
        warnCount: warningProducts.length
      }
    });
  },

  applyFilter() {
    var list = this.data.products;
    if (this.data.activeType !== '全部') {
      list = list.filter(function(p) { return p.type === this.data.activeType; }.bind(this));
    }
    if (!this.data.showInactive) {
      list = list.filter(function(p) { return p.active !== false; });
    }
    if (this.data.searchText) {
      var q = this.data.searchText.toLowerCase();
      list = list.filter(function(p) {
        return (p.name || '').toLowerCase().indexOf(q) > -1 ||
               (p.company || '').toLowerCase().indexOf(q) > -1;
      });
    }
    this.setData({ filtered: list });
  },

  onToggleHealth() {
    this.setData({ showHealth: !this.data.showHealth });
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value });
    this.applyFilter();
  },

  onFilterType(e) {
    this.setData({ activeType: e.currentTarget.dataset.type });
    this.applyFilter();
  },

  onToggleInactive() {
    this.setData({ showInactive: !this.data.showInactive });
    this.applyFilter();
  },

  onAddProduct() {
    wx.navigateTo({ url: '/pages/admin/product-edit/product-edit' });
  },

  onEditProduct(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/product-edit/product-edit?id=' + id });
  },

  onToggleActive(e) {
    var id = e.currentTarget.dataset.id;
    var products = this.data.products.map(function(p) {
      if ((p.id || p._id) === id) { p.active = !p.active; }
      return p;
    });
    this.setData({ products: products });
    productLoader.injectProducts(products);
    this.applyFilter();
    this.computeHealth();
    wx.showToast({ title: '已更新', icon: 'success' });
  },

  onMarkReviewed(e) {
    var id = e.currentTarget.dataset.id;
    var today = new Date().toISOString().slice(0, 10);
    var products = this.data.products.map(function(p) {
      if ((p.id || p._id) === id) {
        p.lastReviewedAt = today;
        p.nextReviewAt = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
        if (!p.status) p.status = 'active';
      }
      return p;
    });
    this.setData({ products: products });
    productLoader.injectProducts(products);
    this.applyFilter();
    this.computeHealth();
    wx.showToast({ title: '已标记为已复核', icon: 'success' });
  },

  // 批量停售
  onBatchDeactivate() {
    var that = this;
    wx.showModal({
      title: '批量维护建议',
      content: '将停用所有"不推荐"级别和有风险标记的样例。确定？',
      success: function(res) {
        if (res.confirm) {
          var ids = {};
          (that.data.healthStats.risk || []).forEach(function(r) { ids[r.product.id || r.product._id] = true; });
          var products = that.data.products.map(function(p) {
            if (ids[p.id || p._id]) { p.active = false; }
            return p;
          });
          that.setData({ products: products });
          productLoader.injectProducts(products);
          that.applyFilter();
          that.computeHealth();
          wx.showToast({ title: '已批量停用', icon: 'success' });
        }
      }
    });
  },

  // 清理停用样例
  onPurgeInactive() {
    var that = this;
    wx.showModal({
      title: '清理停用样例',
      content: '将删除所有已停用的样例，不可恢复。确定？',
      success: function(res) {
        if (res.confirm) {
          var products = that.data.products.filter(function(p) { return p.active !== false; });
          that.setData({ products: products });
          productLoader.injectProducts(products);
          that.applyFilter();
          that.computeHealth();
          wx.showToast({ title: '已清理', icon: 'success' });
        }
      }
    });
  },

  onImport() {
    wx.navigateTo({ url: '/pages/admin/import/import' });
  },

  // 手动分批同步全部样例到云数据库（每批15条防超时）
  onSyncCloud() {
    if (!wx.cloud) {
      wx.showToast({ title: '云开发未初始化', icon: 'none' }); return;
    }
    var that = this;
    var allProducts = this.data.products;
    var batchSize = 15;
    var batches = [];
    for (var i = 0; i < allProducts.length; i += batchSize) {
      batches.push(allProducts.slice(i, i + batchSize));
    }

    var totalCreated = 0, totalSkipped = 0, doneCount = 0;
    wx.showLoading({ title: '同步中 0/' + batches.length });

    function sendBatch(index) {
      if (index >= batches.length) {
        wx.hideLoading();
        wx.showToast({ title: '已同步：新增' + totalCreated + ' 跳过' + totalSkipped, icon: 'success' });
        that.computeHealth();
        return;
      }
      wx.showLoading({ title: '同步中 ' + (index + 1) + '/' + batches.length });
      wx.cloud.callFunction({
        name: 'adminProducts',
        data: { action: 'bulkCreate', products: batches[index] }
      }).then(function(res) {
        if (res.result && res.result.success) {
          totalCreated += (res.result.data.created || 0);
          totalSkipped += (res.result.data.skipped || 0);
        }
        sendBatch(index + 1);
      }).catch(function() {
        // 单批失败继续下一批
        sendBatch(index + 1);
      });
    }
    sendBatch(0);
  },

  onResetDefault() {
    var that = this;
    wx.showModal({
      title: '重置为默认样例库',
      content: '将清除所有自定义样例，恢复种子数据。确定？',
      success: function(res) {
        if (res.confirm) {
          productLoader.resetToDefault();
          that.loadProducts();
          wx.showToast({ title: '已重置', icon: 'success' });
        }
      }
    });
  }
});
