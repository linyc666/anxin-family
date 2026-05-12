// cloudfunctions/memberships/index.js
// 会员与支付管理（服务端可信：价格/天数/权益全部服务端内置）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 服务端内置计划定义（客户端不可篡改）
var PLANS = {
  monthly: {
    key: 'monthly', name: '安心月卡', price: 9.9, standardPrice: 19.9, period: 'month', daysValid: 31
  },
  yearly: {
    key: 'yearly', name: '家庭年卡', price: 68, standardPrice: 128, period: 'year', daysValid: 366
  }
};

exports.main = async (event, context) => {
  var { action } = event;
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  if (!openid) {
    return { success: false, error: '未登录' };
  }

  try {
    switch (action) {

      // === 创建预订单（只收 planKey，价格从服务端读取） ===
      case 'createOrder': {
        var { planKey } = event;
        if (!planKey) return { success: false, error: '缺少planKey' };
        var plan = PLANS[planKey];
        if (!plan) return { success: false, error: '无效的planKey' };

        var order = {
          openid: openid,
          planKey: plan.key,
          planName: plan.name,
          amount: plan.price,
          status: 'pending',
          createdAt: new Date(),
          paidAt: null,
          transactionId: null
        };
        var res = await db.collection('payOrders').add({ data: order });
        return { success: true, data: { _id: res._id, orderId: res._id, amount: plan.price } };
      }

      // === 确认支付（内测模拟开关；真实接入微信支付后改为支付回调验签） ===
      case 'confirmPay': {
        var { orderId, transactionId } = event;
        if (!orderId) return { success: false, error: '缺少orderId' };

        // 默认拒绝客户端确认支付。内测需要模拟支付时，在云函数环境变量设置 PAY_MODE=mock。
        // 真实微信支付接入后，此 action 应移到支付回调验签链路，不接受客户端直接调用。
        if ((process.env.PAY_MODE || 'production') !== 'mock') {
          return { success: false, error: '支付确认通道未开放' };
        }

        var orderRes = await db.collection('payOrders').doc(orderId).get();
        if (!orderRes.data) return { success: false, error: '订单不存在' };
        if (orderRes.data.openid !== openid) return { success: false, error: '无权操作此订单' };
        if (orderRes.data.status !== 'pending') return { success: false, error: '订单状态不允许支付' };

        await db.collection('payOrders').doc(orderId).update({
          data: {
            status: 'paid',
            paidAt: new Date(),
            transactionId: transactionId || ('sim_' + Date.now())
          }
        });
        return { success: true };
      }

      // === 激活权益（校验订单归属 + 已支付 + daysValid从服务端读取） ===
      case 'activateEntitlement': {
        var { orderId, planKey } = event;
        if (!orderId || !planKey) return { success: false, error: '缺少orderId或planKey' };

        var plan = PLANS[planKey];
        if (!plan) return { success: false, error: '无效的planKey' };

        // 校验订单
        var orderRes = await db.collection('payOrders').doc(orderId).get();
        if (!orderRes.data) return { success: false, error: '订单不存在' };
        if (orderRes.data.openid !== openid) return { success: false, error: '无权操作此订单' };
        if (orderRes.data.status !== 'paid') return { success: false, error: '订单未支付' };
        if (orderRes.data.planKey !== planKey) return { success: false, error: '订单与计划不匹配' };

        var existingEnt = await db.collection('entitlements')
          .where({ openid: openid, orderId: orderId })
          .limit(1)
          .get();
        if (existingEnt.data && existingEnt.data.length > 0) {
          var existed = existingEnt.data[0];
          return {
            success: true,
            data: {
              _id: existed._id,
              expireAt: existed.expireAt instanceof Date ? existed.expireAt.toISOString() : existed.expireAt,
              planKey: existed.planKey
            }
          };
        }

        // 服务端计算过期时间
        var now = Date.now();
        var expireAt = new Date(now + plan.daysValid * 86400000);

        var ent = {
          openid: openid,
          planKey: plan.key,
          planName: plan.name,
          period: plan.period,
          orderId: orderId,
          activatedAt: new Date(),
          expireAt: expireAt,
          createdAt: new Date()
        };
        var res = await db.collection('entitlements').add({ data: ent });
        return { success: true, data: { _id: res._id, expireAt: expireAt.toISOString(), planKey: plan.key } };
      }

      // === 获取当前有效权益 ===
      case 'getEntitlement': {
        var res = await db.collection('entitlements')
          .where({ openid: openid, expireAt: _.gt(new Date()) })
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        var ent = (res.data && res.data.length > 0) ? res.data[0] : null;
        return { success: true, data: ent };
      }

      // === 获取订单列表 ===
      case 'getOrders': {
        var res = await db.collection('payOrders')
          .where({ openid: openid })
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();
        return { success: true, data: res.data || [] };
      }

      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch(e) {
    return { success: false, error: e.message };
  }
};
