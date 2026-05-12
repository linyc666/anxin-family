// utils/record-dedupe.js - 重复资料检测
var attachmentUtil = require('./attachments');

function normalizeText(s) { return (s || '').replace(/\s+/g, '').toLowerCase(); }

function detectDuplicateRecord(family, currentRecord, editingId) {
  var result = { type: 'none', matchedRecord: null, matchedMemberId: null, hasAttachmentDup: false, dupAttachmentId: null };
  var policies = (family && family.policies) || [];
  var members = (family && family.members) || [];

  for (var i = 0; i < policies.length; i++) {
    var p = policies[i];
    if (editingId && p.id === editingId) continue;

    // 强重复判断：同一成员 + 名称相似 + (编号相同 或 到期日相同)
    if (p.memberId === currentRecord.memberId) {
      var nameSimilar = normalizeText(p.name) === normalizeText(currentRecord.name || '');
      var noSame = currentRecord.policyNo && p.policyNo === currentRecord.policyNo;
      var expirySame = currentRecord.expiry && p.expiry === currentRecord.expiry;
      if (nameSimilar && (noSame || expirySame)) {
        result.type = 'sameMemberStrong';
        result.matchedRecord = p;
        result.matchedMemberId = p.memberId;
        break;
      }
    }

    // 弱重复：不同成员 + 名称/来源相似
    if (p.memberId !== currentRecord.memberId) {
      var nSim = normalizeText(p.name) === normalizeText(currentRecord.name || '');
      var cSim = normalizeText(p.company) === normalizeText(currentRecord.company || '');
      if (nSim && cSim) {
        result.type = 'otherMemberSimilar';
        result.matchedRecord = p;
        result.matchedMemberId = p.memberId;
      }
    }
  }

  // 附件重复检测
  var curAtts = currentRecord.attachments || [];
  for (var j = 0; j < policies.length; j++) {
    if (editingId && policies[j].id === editingId) continue;
    var exAtts = attachmentUtil.normalize(policies[j]);
    for (var ci = 0; ci < curAtts.length; ci++) {
      for (var ei = 0; ei < exAtts.length; ei++) {
        if (curAtts[ci].name === exAtts[ei].name && curAtts[ci].size === exAtts[ei].size && curAtts[ci].size > 0) {
          result.hasAttachmentDup = true;
          result.dupAttachmentId = curAtts[ci].id;
          break;
        }
      }
      if (result.hasAttachmentDup) break;
    }
    if (result.hasAttachmentDup) break;
  }

  return result;
}

function getMemberName(family, memberId) {
  var m = (family && family.members || []).find(function(x) { return x.id === memberId; });
  return m ? m.name : '';
}

module.exports = { detectDuplicateRecord: detectDuplicateRecord, getMemberName: getMemberName };
