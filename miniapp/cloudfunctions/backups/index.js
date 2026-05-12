// cloudfunctions/backups/index.js
// 云端备份记录管理：record / list / delete
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { success: false, error: '未登录' };
  }

  try {
    switch (action) {

      // 记录一条备份
      case 'record': {
        var { fileID, size, familyName, hash } = event;
        if (!fileID) return { success: false, error: '缺少fileID' };
        var doc = {
          openid: openid,
          fileID: fileID,
          size: size || 0,
          familyName: familyName || '',
          hash: hash || '',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        var res = await db.collection('backups').add({ data: doc });
        return { success: true, data: { _id: res._id, fileID: fileID } };
      }

      // 获取当前用户的备份列表
      case 'list': {
        var res = await db.collection('backups')
          .where({ openid: openid })
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();
        return { success: true, data: res.data || [] };
      }

      // 删除一条备份记录（校验归属 + 使用数据库记录的fileID）
      case 'delete': {
        var { backupId } = event;
        if (!backupId) return { success: false, error: '缺少backupId' };
        // 查记录，校验归属
        var doc = await db.collection('backups').doc(backupId).get();
        if (!doc.data) return { success: false, error: '备份记录不存在' };
        if (doc.data.openid !== openid) return { success: false, error: '无权操作此备份' };
        // 删除数据库记录
        await db.collection('backups').doc(backupId).remove();
        // 使用数据库记录的fileID删云文件（不信任前端传参）
        if (doc.data.fileID) {
          try {
            await cloud.deleteFile({ fileList: [doc.data.fileID] });
          } catch(e) {
            console.log('删除云文件失败:', e.message);
          }
        }
        return { success: true };
      }

      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch(e) {
    return { success: false, error: e.message };
  }
};
