// cloudfunctions/seedProducts/index.js
// 一次性迁移：将16款种子产品写入 products 集合
// 部署后在云开发控制台 → 云函数 → seedProducts → 测试 即可触发
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 内联16款种子产品（避免依赖 insurance-engine.js 路径问题）
const SEED_PRODUCTS = require('./seed-data.json');

exports.main = async (event, context) => {
  const action = event.action || 'migrate';

  try {
    switch (action) {
      case 'migrate': {
        var results = { created: 0, skipped: 0, errors: [] };
        for (var i = 0; i < SEED_PRODUCTS.length; i++) {
          var p = SEED_PRODUCTS[i];
          try {
            // 检查是否已存在
            var exist = await db.collection('products').doc(p.id).get().catch(() => null);
            if (exist && exist.data) {
              results.skipped++;
              continue;
            }
            p.createdAt = new Date();
            p.updatedAt = new Date();
            p.source = 'seed';
            p.version = 1;
            await db.collection('products').doc(p.id).set({ data: p });
            results.created++;
          } catch(e) {
            results.errors.push({ id: p.id, name: p.name, error: e.message });
          }
        }
        // 初始化版本号
        try {
          await db.collection('config').doc('productVersion').set({
            data: { version: 1, updatedAt: new Date() }
          });
        } catch(e) {}
        return { success: true, data: results };
      }

      case 'reset': {
        // 清空所有产品，重新写入种子数据
        var allDocs = await db.collection('products').get();
        for (var j = 0; j < allDocs.data.length; j++) {
          await db.collection('products').doc(allDocs.data[j]._id).remove();
        }
        return exports.main({ action: 'migrate' }, context);
      }

      case 'count': {
        var count = await db.collection('products').count();
        return { success: true, data: { total: count.total } };
      }

      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch(e) {
    return { success: false, error: e.message };
  }
};
