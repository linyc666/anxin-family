// cloudfunctions/adminProducts/index.js
// 产品库管理：list / getById / create / update / delete / bulkCreate / stats
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 管理员 openid 白名单（需在云函数环境变量或在代码中配置）
const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '').split(',').filter(Boolean);

function isAdmin(openid) {
  // 未配置白名单时默认拒绝所有管理操作
  if (ADMIN_OPENIDS.length === 0) return false;
  return ADMIN_OPENIDS.indexOf(openid) > -1;
}

/** 递增产品版本号 */
async function bumpVersion() {
  try {
    var doc = await db.collection('config').doc('productVersion').get();
    if (doc.data) {
      await db.collection('config').doc('productVersion').update({
        data: { version: _.inc(1), updatedAt: new Date() }
      });
    }
  } catch(e) {
    // 文档不存在则创建
    try {
      await db.collection('config').add({
        data: { _id: 'productVersion', version: 1, updatedAt: new Date() }
      });
    } catch(e2) {}
  }
}

exports.main = async (event, context) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // verifyAdmin 允许任何人调用（返回是否管理员）
  if (action === 'verifyAdmin') {
    return { success: true, data: { isAdmin: isAdmin(openid) } };
  }

  if (!isAdmin(openid) && action !== 'list' && action !== 'getById') {
    return { success: false, error: '无管理权限' };
  }

  try {
    switch (action) {

      // === 列表（分页） ===
      case 'list': {
        var { type, active, page, pageSize } = event;
        var query = {};
        if (type) query.type = type;
        if (active !== undefined) query.active = active;
        var skip = ((page || 1) - 1) * (pageSize || 50);
        var res = await db.collection('products')
          .where(query)
          .skip(skip)
          .limit(Math.min(pageSize || 50, 100))
          .orderBy('updatedAt', 'desc')
          .get();
        var countRes = await db.collection('products').where(query).count();
        return { success: true, data: { list: res.data, total: countRes.total } };
      }

      // === 单产品 ===
      case 'getById': {
        var res = await db.collection('products').doc(event.productId).get();
        return { success: true, data: res.data };
      }

      // === 创建 ===
      case 'create': {
        var product = event.product;
        if (!product.name || !product.type || !product.company) {
          return { success: false, error: '缺少必填字段（name/type/company）' };
        }
        product.createdAt = new Date();
        product.updatedAt = new Date();
        product._openid = openid;
        var res = await db.collection('products').add({ data: product });
        await bumpVersion();
        return { success: true, data: { _id: res._id } };
      }

      // === 更新 ===
      case 'update': {
        var { productId, product } = event;
        product.updatedAt = new Date();
        await db.collection('products').doc(productId).update({ data: product });
        await bumpVersion();
        return { success: true, data: { _id: productId } };
      }

      // === 软删除（停售） ===
      case 'delete': {
        await db.collection('products').doc(event.productId).update({
          data: { active: false, updatedAt: new Date() }
        });
        await bumpVersion();
        return { success: true, data: { _id: event.productId } };
      }

      // === 批量创建 ===
      case 'bulkCreate': {
        var products = event.products;
        if (!Array.isArray(products) || products.length === 0) {
          return { success: false, error: 'products 必须是非空数组' };
        }
        // 限制单次最多 20 条，防止超时
        var batch = products.slice(0, 20);
        var now = new Date();
        var results = { created: 0, skipped: 0, errors: [], total: products.length, processed: batch.length };
        // 先一次性查出所有已存在的 name+company
        var existingSet = {};
        try {
          for (var j = 0; j < batch.length; j += 5) {
            var names = batch.slice(j, j + 5).map(function(p) { return p.name; });
            var existRes = await db.collection('products')
              .where({ name: db.command.in(names) }).field({ name: true, company: true }).get();
            existRes.data.forEach(function(ep) {
              existingSet[ep.name + '||' + ep.company] = true;
            });
          }
        } catch(e) {}
        for (var i = 0; i < batch.length; i++) {
          var p = batch[i];
          if (!p.name || !p.type || !p.company) {
            results.errors.push({ index: i, error: '缺少必填字段' });
            continue;
          }
          if (existingSet[p.name + '||' + p.company]) {
            results.skipped++;
            continue;
          }
          try {
            p.createdAt = now;
            p.updatedAt = now;
            p._openid = openid;
            await db.collection('products').add({ data: p });
            results.created++;
          } catch(e) {
            results.errors.push({ index: i, error: e.message });
          }
        }
        if (results.created > 0) {
          try { await bumpVersion(); } catch(e) {}
        }
        return { success: true, data: results };
      }

      // === 统计 ===
      case 'stats': {
        var types = ['百万医疗', '重疾险', '意外险', '定寿', '防癌险', '惠民保'];
        var stats = { total: 0, active: 0, byType: {} };
        for (var i = 0; i < types.length; i++) {
          var countRes = await db.collection('products')
            .where({ type: types[i], active: true }).count();
          stats.byType[types[i]] = countRes.total;
          stats.active += countRes.total;
        }
        var totalRes = await db.collection('products').count();
        stats.total = totalRes.total;
        return { success: true, data: stats };
      }

      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch(e) {
    return { success: false, error: e.message };
  }
};
