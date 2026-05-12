// pages/mine/membership.js - 安心家册会员
var membership = require('../../utils/membership');
var paymentModel = require('../../utils/payment-model');

Page({
  data: {
    currentPlan: 'free',
    currentEntitlement: null,
    daysLeft: 0,
    plansObj: { free: { name: '免费版' }, monthly: { name: '安心月卡' }, yearly: { name: '家庭年卡' } },
    plans: [
      {
        key: 'free', name: '免费版', price: '0', standardPrice: '', period: '',
        people: 3, pets: 1, records: 20,
        summary: '适合体验，先感受安心整理的价值',
        recommended: false
      },
      {
        key: 'monthly', name: '安心月卡', price: '9.9', standardPrice: '19.9', period: '/月',
        people: 8, pets: 3, records: 100,
        summary: '低门槛体验完整功能，适合临时整理需求',
        recommended: false
      },
      {
        key: 'yearly', name: '家庭年卡', price: '68', standardPrice: '128', period: '/年',
        people: 8, pets: 3, records: 100,
        summary: '长期管好全家重要资料和宠物健康节点',
        recommended: true
      }
    ]
  },

  onLoad() {
    var that = this;
    // 优先从云端获取权益
    paymentModel.fetchEntitlementFromCloud().then(function(cloudEnt) {
      if (cloudEnt && paymentModel.isEntitlementValid(cloudEnt)) {
        membership.setPlan(cloudEnt.planKey);
        that.setData({
          currentPlan: cloudEnt.planKey,
          currentEntitlement: cloudEnt,
          daysLeft: paymentModel.getDaysLeft(cloudEnt)
        });
      } else {
        // 云端无有效权益，读本地
        var plan = membership.getPlan();
        var ent = paymentModel.getCurrentEntitlement();
        that.setData({
          currentPlan: plan,
          currentEntitlement: ent,
          daysLeft: ent ? paymentModel.getDaysLeft(ent) : 0
        });
      }
    }).catch(function() {
      var plan = membership.getPlan();
      var ent = paymentModel.getCurrentEntitlement();
      that.setData({
        currentPlan: plan,
        currentEntitlement: ent,
        daysLeft: ent ? paymentModel.getDaysLeft(ent) : 0
      });
    });
  },

  onUpgradePlan(e) {
    var planKey = e.currentTarget.dataset.plan;
    if (planKey === 'free') {
      wx.showToast({ title: '当前已是免费版', icon: 'none' });
      return;
    }

    var plan = paymentModel.PLANS[planKey];
    var that = this;
    wx.showModal({
      title: '确认开通',
      content: '开通 ' + plan.name + '（¥' + plan.price + '/' + (planKey === 'yearly' ? '年' : '月') + '）\n\n支付金额以当前页面价格为准，后续价格调整不影响已开通周期。',
      confirmText: '确认开通',
      cancelText: '取消',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          paymentModel.createOrderCloud(planKey).then(function(order) {
            if (!order) throw new Error('创建订单失败');
            return paymentModel.confirmPayCloud(order.orderId || order._id, 'sim_' + Date.now()).then(function(ok) {
              if (!ok) throw new Error('支付确认失败');
              return order;
            });
          }).then(function(order) {
            // 云端激活成功后才写本地
            return paymentModel.activateEntitlementCloud(planKey, order.orderId || order._id).then(function(ent) {
              return ent;
            });
          }).then(function(ent) {
            membership.setPlan(ent.planKey);
            wx.hideLoading();
            wx.showToast({ title: '开通成功！', icon: 'success' });
            setTimeout(function() { wx.navigateBack(); }, 1200);
          }).catch(function(err) {
            wx.hideLoading();
            wx.showModal({
              title: '开通失败',
              content: err && err.message ? err.message : '当前暂时无法完成升级，请稍后重试。',
              showCancel: false
            });
          });
        }
      }
    });
  }
});
