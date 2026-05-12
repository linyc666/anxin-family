// utils/payment-model.js - 支付订单与会员权益模型（微信支付预留）
var PLANS = {
  monthly: {
    key: 'monthly', name: '安心月卡', price: 9.9, standardPrice: 19.9, period: 'month',
    daysValid: 31,
    entitlements: {
      people: 8, pets: 3, records: 100,
      reminders: 50, attachments: 100, ocrMonthly: 30,
      cloudBackup: true, dataRecovery: true,
      annualReport: 'full', familyReport: 'full',
      multiFamily: false, familyShare: false,
      scope: 'single_family', maxFamilies: 1, maxSharedUsers: 0
    }
  },
  yearly: {
    key: 'yearly', name: '家庭年卡', price: 68, standardPrice: 128, period: 'year',
    daysValid: 366,
    entitlements: {
      people: 8, pets: 3, records: 100,
      reminders: 50, attachments: 100, ocrMonthly: 360,
      cloudBackup: true, dataRecovery: true,
      annualReport: 'full', familyReport: 'full',
      multiFamily: false, familyShare: true,
      scope: 'single_family', maxFamilies: 1, maxSharedUsers: 0
    }
  }
};

/**
 * 创建支付订单
 * @param {string} planKey - 'monthly' | 'yearly'
 * @returns {object} order
 */
function createOrder(planKey) {
  var plan = PLANS[planKey];
  if (!plan) return null;
  return {
    orderId: 'ord_' + Date.now(),
    planKey: plan.key,
    planName: plan.name,
    amount: plan.price,
    status: 'pending',        // pending | paid | cancelled | expired
    createdAt: new Date().toISOString(),
    paidAt: null,
    // 微信支付字段预留
    wxPayArgs: null,          // wx.requestPayment 参数
    transactionId: null       // 微信支付交易号
  };
}

/**
 * 激活会员权益
 * @param {string} planKey
 * @param {object} order - 已支付的订单
 */
function activateEntitlement(planKey, order) {
  var plan = PLANS[planKey];
  if (!plan) return null;
  var now = Date.now();
  return {
    planKey: plan.key,
    planName: plan.name,
    period: plan.period,
    activatedAt: new Date().toISOString(),
    expireAt: new Date(now + plan.daysValid * 86400000).toISOString(),
    orderId: order.orderId,
    transactionId: order.transactionId,
    entitlements: plan.entitlements
  };
}

/**
 * 检查权益是否有效
 * @param {object} entitlement
 * @returns {boolean}
 */
function isEntitlementValid(entitlement) {
  if (!entitlement || !entitlement.expireAt) return false;
  return new Date(entitlement.expireAt) > Date.now();
}

/**
 * 获取剩余天数
 * @param {object} entitlement
 * @returns {number}
 */
function getDaysLeft(entitlement) {
  if (!entitlement || !entitlement.expireAt) return 0;
  var days = Math.ceil((new Date(entitlement.expireAt) - Date.now()) / 86400000);
  return Math.max(0, days);
}

/**
 * 获取全部订单记录
 * @returns {array}
 */
function getOrders() {
  try {
    return wx.getStorageSync('pay_orders') || [];
  } catch(e) { return []; }
}

/**
 * 保存订单记录
 * @param {object} order
 */
function saveOrder(order) {
  try {
    var orders = getOrders();
    var idx = orders.findIndex(function(o) { return o.orderId === order.orderId; });
    if (idx > -1) orders[idx] = Object.assign({}, orders[idx], order);
    else orders.push(order);
    wx.setStorageSync('pay_orders', orders);
  } catch(e) {}
}

/**
 * 获取当前权益
 * @returns {object|null}
 */
function getCurrentEntitlement() {
  try {
    var ent = wx.getStorageSync('current_entitlement');
    if (ent && isEntitlementValid(ent)) return ent;
    // 过期清理
    if (ent) wx.removeStorageSync('current_entitlement');
    return null;
  } catch(e) { return null; }
}

/**
 * 保存当前权益
 * @param {object} entitlement
 */
function saveEntitlement(entitlement) {
  try {
    wx.setStorageSync('current_entitlement', entitlement);
    wx.setStorageSync('membership_plan', entitlement.planKey);
  } catch(e) {}
}

// === 云端同步 ===

/** 通过云函数创建订单（只传planKey，价格由服务端决定） */
function createOrderCloud(planKey) {
  if (!wx.cloud) return Promise.reject(new Error('云开发未初始化'));
  return wx.cloud.callFunction({
    name: 'memberships',
    data: { action: 'createOrder', planKey: planKey }
  }).then(function(res) {
    if (res.result && res.result.success) {
      var cloudOrder = res.result.data;
      var order = {
        orderId: cloudOrder.orderId,
        _id: cloudOrder._id,
        planKey: planKey,
        planName: PLANS[planKey] ? PLANS[planKey].name : '',
        amount: cloudOrder.amount,
        status: 'pending',
        createdAt: new Date().toISOString(),
        paidAt: null,
        transactionId: null
      };
      saveOrder(order);
      return order;
    }
    throw new Error(res.result ? res.result.error : '创建订单失败');
  });
}

/** 通过云函数确认支付 */
function confirmPayCloud(orderId, transactionId) {
  if (!wx.cloud) return Promise.resolve(false);
  return wx.cloud.callFunction({
    name: 'memberships',
    data: {
      action: 'confirmPay',
      orderId: orderId,
      transactionId: transactionId
    }
  }).then(function(res) {
    var ok = res.result && res.result.success;
    if (ok) {
      var order = getOrders().find(function(o) { return o.orderId === orderId; });
      if (order) {
        order.status = 'paid';
        order.paidAt = new Date().toISOString();
        order.transactionId = transactionId || ('sim_' + Date.now());
        saveOrder(order);
      }
    }
    return ok;
  }).catch(function() {
    return false;
  });
}

/** 通过云函数激活权益（orderId+planKey，云端成功后才写本地） */
function activateEntitlementCloud(planKey, orderId) {
  if (!wx.cloud) {
    return Promise.reject(new Error('云开发未初始化'));
  }
  // 云端先激活，成功后本地再写
  return wx.cloud.callFunction({
    name: 'memberships',
    data: { action: 'activateEntitlement', orderId: orderId, planKey: planKey }
  }).then(function(res) {
    if (res.result && res.result.success && res.result.data) {
      var cloudData = res.result.data;
      var order = { orderId: orderId, transactionId: 'sim_' + Date.now() };
      var ent = activateEntitlement(planKey, order);
      ent.expireAt = cloudData.expireAt;
      ent.planKey = cloudData.planKey || planKey;
      saveEntitlement(ent);
      return ent;
    }
    throw new Error(res.result ? res.result.error : '激活失败');
  });
}

/** 从云端获取当前权益 */
function fetchEntitlementFromCloud() {
  return new Promise(function(resolve) {
    if (!wx.cloud) { resolve(null); return; }
    wx.cloud.callFunction({
      name: 'memberships',
      data: { action: 'getEntitlement' }
    }).then(function(res) {
      if (res.result && res.result.success && res.result.data) {
        var cloudEnt = res.result.data;
        // 同步到本地
        saveEntitlement(cloudEnt);
        resolve(cloudEnt);
      } else {
        resolve(null);
      }
    }).catch(function() {
      resolve(null);
    });
  });
}

module.exports = {
  PLANS: PLANS,
  createOrder: createOrder,
  activateEntitlement: activateEntitlement,
  isEntitlementValid: isEntitlementValid,
  getDaysLeft: getDaysLeft,
  getOrders: getOrders,
  saveOrder: saveOrder,
  getCurrentEntitlement: getCurrentEntitlement,
  saveEntitlement: saveEntitlement,
  createOrderCloud: createOrderCloud,
  confirmPayCloud: confirmPayCloud,
  activateEntitlementCloud: activateEntitlementCloud,
  fetchEntitlementFromCloud: fetchEntitlementFromCloud
};
