// utils/cloud-backup.js - 云端备份/恢复
var BACKUP_PREFIX = 'backups/';

function getBackupHash(text) {
  text = text || '';
  var hash = 0;
  for (var i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  return String(hash);
}

/** 上传备份到云存储 */
function uploadBackup(familyData) {
  return new Promise(function(resolve, reject) {
    if (!wx.cloud) {
      reject(new Error('云开发未初始化'));
      return;
    }
    var json = JSON.stringify(familyData, null, 2);
    var hash = getBackupHash(json);
    var currentMeta = getBackupMeta();
    var lastMeta = currentMeta.length > 0 ? currentMeta[currentMeta.length - 1] : null;
    if (lastMeta && lastMeta.hash === hash && lastMeta.fileID) {
      resolve({ skipped: true, fileID: lastMeta.fileID, size: json.length, indexOk: true });
      return;
    }
    var fileName = BACKUP_PREFIX + 'backup_' + Date.now() + '.json';

    // 将JSON写入临时文件再上传
    var fs = wx.getFileSystemManager();
    var tmpPath = wx.env.USER_DATA_PATH + '/backup_temp.json';
    try {
      fs.writeFileSync(tmpPath, json, 'utf8');
    } catch(e) {
      reject(new Error('写入临时文件失败'));
      return;
    }

    wx.cloud.uploadFile({
      cloudPath: fileName,
      filePath: tmpPath,
      success: function(res) {
        // 本地元数据备份（兜底）
        var meta = getBackupMeta();
        meta.push({
          fileID: res.fileID,
          cloudPath: fileName,
          time: new Date().toISOString(),
          size: json.length,
          hash: hash
        });
        if (meta.length > 10) meta = meta.slice(-10);
        saveBackupMeta(meta);

        // 云端备份记录（等待索引写入）
        recordBackupToCloud(res.fileID, json.length, familyData, hash)
          .then(function() {
            resolve({ fileID: res.fileID, size: json.length, indexOk: true });
          })
          .catch(function() {
            resolve({ fileID: res.fileID, size: json.length, indexOk: false });
          });
      },
      fail: function(err) {
        reject(err);
      }
    });
  });
}

/** 从云存储下载备份 */
function downloadBackup(fileID) {
  return new Promise(function(resolve, reject) {
    if (!wx.cloud) {
      reject(new Error('云开发未初始化'));
      return;
    }
    wx.cloud.downloadFile({
      fileID: fileID,
      success: function(res) {
        try {
          var fs = wx.getFileSystemManager();
          var content = fs.readFileSync(res.tempFilePath, 'utf8');
          var data = JSON.parse(content);
          resolve(data);
        } catch(e) {
          reject(new Error('备份数据解析失败'));
        }
      },
      fail: function(err) {
        reject(err);
      }
    });
  });
}

/** 从云存储删除备份 */
function deleteBackup(fileID) {
  return new Promise(function(resolve, reject) {
    if (!wx.cloud) {
      reject(new Error('云开发未初始化'));
      return;
    }
    wx.cloud.deleteFile({
      fileList: [fileID],
      success: function(res) {
        resolve(res);
      },
      fail: function(err) {
        reject(err);
      }
    });
  });
}

/** 获取备份元数据列表 */
function getBackupMeta() {
  try {
    return wx.getStorageSync('backup_meta') || [];
  } catch(e) { return []; }
}

/** 保存备份元数据 */
function saveBackupMeta(meta) {
  try {
    wx.setStorageSync('backup_meta', meta);
  } catch(e) {}
}

/** 云端记录备份元数据（返回Promise） */
function recordBackupToCloud(fileID, size, familyData, hash) {
  if (!wx.cloud) return Promise.reject(new Error('云开发未初始化'));
  var familyName = (familyData && familyData.familyName) ? familyData.familyName : '';
  return wx.cloud.callFunction({
    name: 'backups',
    data: { action: 'record', fileID: fileID, size: size, familyName: familyName, hash: hash || '' }
  }).then(function(res) {
    if (res.result && res.result.success) return res.result;
    throw new Error(res.result ? res.result.error : '云端记录失败');
  });
}

/** 从云端获取备份列表 */
function fetchBackupListFromCloud() {
  return new Promise(function(resolve) {
    if (!wx.cloud) { resolve(null); return; }
    wx.cloud.callFunction({
      name: 'backups',
      data: { action: 'list' }
    }).then(function(res) {
      if (res.result && res.result.success) {
        resolve(res.result.data || []);
      } else {
        resolve(null);
      }
    }).catch(function() {
      resolve(null);
    });
  });
}

/** 获取最近备份时间 */
function getLastBackupTime() {
  var meta = getBackupMeta();
  if (meta.length === 0) return null;
  return meta[meta.length - 1].time;
}

/** 获取备份列表（优先云端，回退本地） */
function getBackupList() {
  return getBackupMeta().slice().reverse();
}

/** 云备份是否可用 */
function isCloudAvailable() {
  return !!(wx.cloud && wx.cloud.callFunction);
}

module.exports = {
  uploadBackup: uploadBackup,
  downloadBackup: downloadBackup,
  deleteBackup: deleteBackup,
  getBackupMeta: getBackupMeta,
  getLastBackupTime: getLastBackupTime,
  getBackupList: getBackupList,
  fetchBackupListFromCloud: fetchBackupListFromCloud,
  getBackupHash: getBackupHash,
  isCloudAvailable: isCloudAvailable
};
