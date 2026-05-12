// database/init.js
// 微信云开发数据库初始化脚本
// 在云开发控制台 → 数据库 → 创建以下集合
// 或通过云函数调用 db.createCollection() 自动创建

module.exports = {
  // 集合定义 + 安全规则
  collections: [
    {
      name: 'users',
      desc: '用户表（openid唯一）',
      indexes: [{ field: 'openid', unique: true }],
      securityRule: {
        read: 'doc._id == auth.openid',
        write: 'doc._id == auth.openid'
      }
    },
    {
      name: 'families',
      desc: '家庭表',
      indexes: [{ field: 'creatorId' }],
      securityRule: {
        read: 'get("database.memberships").where({ userId: auth.openid, familyId: doc._id }).count() > 0',
        write: 'get("database.memberships").where({ userId: auth.openid, familyId: doc._id, role: "creator" }).count() > 0'
      }
    },
    {
      name: 'memberships',
      desc: '用户与家庭的成员资格关系',
      indexes: [
        { field: 'userId' },
        { field: 'familyId' },
        { field: ['userId', 'familyId'], unique: true }
      ],
      securityRule: {
        read: 'doc.userId == auth.openid',
        write: 'doc.userId == auth.openid || get("database.memberships").where({ userId: auth.openid, familyId: doc.familyId, role: "creator" }).count() > 0'
      }
    },
    {
      name: 'familyMembers',
      desc: '家庭成员（含家人和宠物）',
      indexes: [{ field: 'familyId' }],
      securityRule: {
        read: 'get("database.memberships").where({ userId: auth.openid, familyId: doc.familyId }).count() > 0',
        write: 'get("database.memberships").where({ userId: auth.openid, familyId: doc.familyId, role: { in: ["creator", "admin"] } }).count() > 0'
      }
    },
    {
      name: 'policies',
      desc: '资料记录表（familyRecords）',
      indexes: [
        { field: 'familyId' },
        { field: 'memberId' },
        { field: 'expiry' }
      ],
      securityRule: {
        read: 'get("database.memberships").where({ userId: auth.openid, familyId: doc.familyId }).count() > 0',
        write: 'get("database.memberships").where({ userId: auth.openid, familyId: doc.familyId, role: { in: ["creator", "admin"] } }).count() > 0 || (doc.createdBy == auth.openid)'
      }
    },
    {
      name: 'invitations',
      desc: '邀请表',
      indexes: [
        { field: 'code', unique: true },
        { field: 'familyId' }
      ],
      securityRule: {
        read: 'doc.inviterId == auth.openid',
        write: 'doc.inviterId == auth.openid'
      }
    },
    {
      name: 'products',
      desc: '样例库（sampleLibrary）',
      indexes: [
        { field: 'type' },
        { field: 'active' },
        { field: 'company' },
        { field: 'name' }
      ],
      securityRule: {
        read: true,
        write: 'doc._openid == auth.openid'
      }
    },
    {
      name: 'config',
      desc: '系统配置（版本号、开关等）',
      indexes: [],
      securityRule: {
        read: true,
        write: false
      }
    },
    {
      name: 'backups',
      desc: '云端备份记录（按openid索引）',
      indexes: [{ field: 'openid' }],
      securityRule: { read: 'doc.openid == auth.openid', write: false }
    },
    {
      name: 'payOrders',
      desc: '支付订单表（客户端只读，写入仅云函数）',
      indexes: [{ field: 'openid' }],
      securityRule: { read: 'doc.openid == auth.openid', write: false }
    },
    {
      name: 'entitlements',
      desc: '会员权益表',
      indexes: [{ field: 'openid' }],
      securityRule: { read: 'doc.openid == auth.openid', write: false }
    },
    {
      name: 'reminders',
      desc: '提醒表',
      indexes: [
        { field: 'userId' },
        { field: 'remindAt' }
      ],
      securityRule: {
        read: 'doc.userId == auth.openid',
        write: 'doc.userId == auth.openid'
      }
    }
  ],

  // 初始化云函数：创建所有集合
  async initCollections(db) {
    var results = [];
    for (var i = 0; i < this.collections.length; i++) {
      var col = this.collections[i];
      try {
        await db.createCollection(col.name);
        results.push({ name: col.name, status: 'created' });
      } catch (e) {
        if (e.errCode === -502005) {
          results.push({ name: col.name, status: 'exists' });
        } else {
          results.push({ name: col.name, status: 'error', error: e.message });
        }
      }
    }
    return results;
  }
};
