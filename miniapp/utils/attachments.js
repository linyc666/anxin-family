// utils/attachments.js - 资料附件工具
var IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
var DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];

function getExt(nameOrPath) {
  var text = (nameOrPath || '').split('?')[0];
  var idx = text.lastIndexOf('.');
  return idx > -1 ? text.slice(idx + 1).toLowerCase() : '';
}

function isImageExt(ext) {
  return IMAGE_EXTS.indexOf((ext || '').toLowerCase()) > -1;
}

function getTypeByExt(ext) {
  return isImageExt(ext) ? 'image' : 'file';
}

function formatSize(size) {
  size = parseInt(size, 10) || 0;
  if (!size) return '';
  if (size < 1024) return size + 'B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + 'KB';
  return (size / 1024 / 1024).toFixed(1) + 'MB';
}

function createAttachment(file, uploadRes, fallbackType) {
  var name = file.name || ('附件_' + Date.now());
  var tempPath = file.path || file.tempFilePath || '';
  var ext = getExt(name || tempPath);
  var type = fallbackType || getTypeByExt(ext);
  return {
    id: 'att_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    type: type,
    name: name,
    size: file.size || 0,
    sizeText: formatSize(file.size || 0),
    ext: ext,
    tempPath: tempPath,
    fileID: uploadRes && uploadRes.fileID ? uploadRes.fileID : '',
    createdAt: new Date().toISOString()
  };
}

function normalize(policy) {
  policy = policy || {};
  var list = Array.isArray(policy.attachments) ? policy.attachments.slice() : [];
  if (policy.screenshot && !list.some(function(a) { return (a.tempPath || a.fileID) === policy.screenshot; })) {
    list.unshift({
      id: 'legacy_screenshot',
      type: 'image',
      name: '图片附件',
      size: 0,
      sizeText: '',
      ext: 'jpg',
      tempPath: policy.screenshot,
      fileID: '',
      createdAt: policy.createdAt || ''
    });
  }
  return list.map(function(a, idx) {
    var ext = a.ext || getExt(a.name || a.tempPath || a.fileID);
    var type = a.type || getTypeByExt(ext);
    return Object.assign({}, a, {
      id: a.id || ('att_' + idx),
      type: type,
      ext: ext,
      name: a.name || (type === 'image' ? '图片附件' : '文档附件'),
      sizeText: a.sizeText || formatSize(a.size || 0)
    });
  });
}

function countFamilyAttachments(family, excludeRecordId) {
  family = family || { policies: [] };
  var count = 0;
  (family.policies || []).forEach(function(p) {
    if (excludeRecordId && p.id === excludeRecordId) return;
    count += normalize(p).length;
  });
  return count;
}

module.exports = {
  DOC_EXTS: DOC_EXTS,
  IMAGE_EXTS: IMAGE_EXTS,
  getExt: getExt,
  formatSize: formatSize,
  createAttachment: createAttachment,
  normalize: normalize,
  countFamilyAttachments: countFamilyAttachments
};