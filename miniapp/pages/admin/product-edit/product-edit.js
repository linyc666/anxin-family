// pages/admin/product-edit/product-edit.js - 样例编辑表单
var productLoader = require('../../../utils/product-loader');

Page({
  data: {
    isEdit: false,
    editId: '',
    product: {
      id: '', name: '', type: '百万医疗', company: '', companyRating: 'A类',
      solvency: '', coverage: '', deductible: '', guaranteeType: '',
      guaranteeYears: '', waitingDays: 90, ageRange: '', healthCheck: '',
      healthStrictness: 2, needSocialIns: false, active: true, score: 80,
      priceNoSocialFactor: 1.0, regionRestrict: '', purchaseLink: '',
      features: [], prices: []
    },
    types: ['百万医疗', '重疾险', '意外险', '定寿', '防癌险', '惠民保', '财产险', '分红险', '年金险', '车险'],
    ratings: ['AA', 'A类', 'B+类', 'B类', '政府指导'],
    strictnessLabels: ['宽松', '中等', '严格'],
    priceStr: '',
    featureStr: ''
  },

  onLoad(options) {
    if (options.id) {
      var products = productLoader.getProducts();
      var p = products.find(function(item) { return (item.id || item._id) === options.id; });
      if (p) {
        this.setData({
          isEdit: true, editId: options.id, product: JSON.parse(JSON.stringify(p)),
          priceStr: (p.prices || []).map(function(pr) {
            return pr.ageMin + '-' + pr.ageMax + '岁: ¥' + pr.price;
          }).join('\n'),
          featureStr: (p.features || []).join(', ')
        });
        wx.setNavigationBarTitle({ title: '编辑样例：' + p.name });
      }
    }
  },

  onNameInput(e) { this.setData({ 'product.name': e.detail.value }); },
  onCompanyInput(e) { this.setData({ 'product.company': e.detail.value }); },
  onCoverageInput(e) { this.setData({ 'product.coverage': e.detail.value }); },
  onDeductibleInput(e) { this.setData({ 'product.deductible': e.detail.value }); },
  onGuaranteeTypeInput(e) { this.setData({ 'product.guaranteeType': e.detail.value }); },
  onGuaranteeYearsInput(e) { this.setData({ 'product.guaranteeYears': parseInt(e.detail.value) || '' }); },
  onWaitingDaysInput(e) { this.setData({ 'product.waitingDays': parseInt(e.detail.value) || 0 }); },
  onAgeRangeInput(e) { this.setData({ 'product.ageRange': e.detail.value }); },
  onHealthCheckInput(e) { this.setData({ 'product.healthCheck': e.detail.value }); },
  onSolvencyInput(e) { this.setData({ 'product.solvency': e.detail.value }); },
  onRegionInput(e) { this.setData({ 'product.regionRestrict': e.detail.value }); },
  onScoreInput(e) { this.setData({ 'product.score': parseInt(e.detail.value) || 0 }); },
  onFactorInput(e) { this.setData({ 'product.priceNoSocialFactor': parseFloat(e.detail.value) || 1.0 }); },
  onPriceStrInput(e) { this.setData({ priceStr: e.detail.value }); },
  onFeatureStrInput(e) { this.setData({ featureStr: e.detail.value }); },

  onTypeChange(e) {
    this.setData({ 'product.type': this.data.types[e.detail.value] });
  },
  onRatingChange(e) {
    this.setData({ 'product.companyRating': this.data.ratings[e.detail.value] });
  },
  onStrictnessChange(e) {
    this.setData({ 'product.healthStrictness': parseInt(e.detail.value) + 1 });
  },
  onSocialToggle() {
    this.setData({ 'product.needSocialIns': !this.data.product.needSocialIns });
  },
  onActiveToggle() {
    this.setData({ 'product.active': !this.data.product.active });
  },

  parsePrices() {
    var lines = this.data.priceStr.split('\n').filter(Boolean);
    var prices = [];
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/(\d+)\s*-\s*(\d+)\s*岁?\s*:\s*[¥￥]?\s*(\d+)/);
      if (m) {
        prices.push({ ageMin: parseInt(m[1]), ageMax: parseInt(m[2]), price: parseInt(m[3]) });
      }
    }
    return prices;
  },

  save() {
    var product = this.data.product;
    if (!product.name || !product.company || !product.type) {
      wx.showToast({ title: '请填写名称、机构和类别', icon: 'none' }); return;
    }
    product.prices = this.parsePrices();
    if (product.prices.length === 0) {
      wx.showToast({ title: '请填写至少一个年龄阶梯价格', icon: 'none' }); return;
    }
    product.features = this.data.featureStr.split(/[,，]/).map(function(s) {
      return s.trim();
    }).filter(Boolean);

    // 新样例的 id 由时间生成
    if (!this.data.isEdit) {
      product.id = 'custom_' + Date.now();
    }

    var products = productLoader.getProducts();
    if (this.data.isEdit) {
      products = products.map(function(p) {
        return (p.id || p._id) === this.data.editId ? product : p;
      }.bind(this));
    } else {
      products.unshift(product);
    }

    productLoader.injectProducts(products);
    wx.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(function() { wx.navigateBack(); }, 800);
  }
});
