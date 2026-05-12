// utils/doc-checklist.js - 资料核对清单引擎
// 纯本地规则，不调AI，不判断能不能赔，不推荐购买
var display = require('./display-sanitizer');

/**
 * 生成单条资料的核对清单
 * @param {object} policy - 资料记录对象
 * @param {object} member - 所属成员对象（可选，用于关联信息）
 * @returns {object} checklist
 */
function generateChecklist(policy, member) {
  var p = policy || {};
  var now = Date.now();
  var recordName = display.aliasRecordName(p.name, p.type);
  var sourceName = display.aliasSource(p.company);
  var typeLabel = display.getTypeLabel(p.type);

  // === 已填写字段 ===
  var filled = [];
  if (p.name) filled.push({ label: '记录名称', value: recordName });
  if (p.company) filled.push({ label: '机构/来源', value: sourceName });
  if (p.type) filled.push({ label: '资料类别', value: typeLabel });
  if (p.premium) filled.push({ label: '年度支出', value: '¥' + parseInt(p.premium).toLocaleString() });
  if (p.coverage) filled.push({ label: '额度/范围', value: display.sanitizeText(p.coverage) });
  if (p.guaranteedYears) filled.push({ label: '延续条件', value: display.sanitizeText(p.guaranteedYears) });
  if (p.effective) filled.push({ label: '生效日期', value: p.effective });
  if (p.expiry) filled.push({ label: '到期日期', value: p.expiry });
  if (p.tags) filled.push({ label: '标签', value: display.sanitizeText(p.tags) });
  if (p.policyNo) filled.push({ label: '编号', value: p.policyNo });
  if (p.detail) {
    var detail = display.sanitizeText(p.detail);
    filled.push({ label: '详细说明', value: detail.length > 50 ? detail.slice(0, 50) + '...' : detail });
  }
  if (p.screenshot) filled.push({ label: '图片附件', value: '已上传' });

  // === 待补充字段 ===
  var missing = [];
  if (!p.name) missing.push({ label: '记录名称', hint: '便于识别和查找' });
  if (!p.company) missing.push({ label: '机构/来源', hint: '记录资料来自哪个机构' });
  if (!p.type) missing.push({ label: '资料类别', hint: '如医疗支出、意外风险等' });
  var hasPremium = !!p.premium && parseInt(p.premium) > 0;
  if (!hasPremium) missing.push({ label: '年度支出', hint: '便于年度统计' });
  if (!p.coverage) missing.push({ label: '额度/范围', hint: '记录额度、范围或适用说明' });
  if (!p.guaranteedYears) missing.push({ label: '延续条件', hint: '如长期延续、1年期等' });
  if (!p.effective) missing.push({ label: '生效日期', hint: '资料开始生效的日期' });
  if (!p.expiry) missing.push({ label: '到期日期', hint: '资料到期的日期（长期可填"长期"）' });
  if (!p.policyNo) missing.push({ label: '编号', hint: '合同号、凭证号等' });
  if (!p.detail) missing.push({ label: '详细说明', hint: '重要的条款、范围或备注' });

  // === 到期状态 ===
  var expiryStatus = { status: 'ok', text: '', cls: '' };
  if (p.expiry && p.expiry !== '终身') {
    var expDate = new Date(p.expiry);
    if (!isNaN(expDate.getTime())) {
      var daysLeft = Math.ceil((expDate - now) / 86400000);
      if (daysLeft < 0) {
        expiryStatus = { status: 'expired', text: '已过期 ' + Math.abs(daysLeft) + ' 天', cls: 'red', days: daysLeft };
      } else if (daysLeft <= 30) {
        expiryStatus = { status: 'soon', text: daysLeft + ' 天后到期，建议提前核对', cls: 'gold', days: daysLeft };
      } else if (daysLeft <= 90) {
        expiryStatus = { status: 'ok', text: daysLeft + ' 天后到期', cls: '', days: daysLeft };
      } else {
        expiryStatus = { status: 'ok', text: '到期日正常', cls: '', days: daysLeft };
      }
    }
  } else if (!p.expiry) {
    expiryStatus = { status: 'unknown', text: '未填写到期日期', cls: '' };
  } else {
    expiryStatus = { status: 'ok', text: '长期有效', cls: 'green' };
  }

  // === 年度支出状态 ===
  var annualSpending = { hasValue: hasPremium, text: '', cls: '' };
  if (hasPremium) {
    annualSpending.text = '已填写：¥' + parseInt(p.premium).toLocaleString() + '/年';
    annualSpending.cls = '';
  } else {
    annualSpending.text = '建议填写，便于年底统计家庭年度支出';
    annualSpending.cls = 'gold';
  }

  // === 完整度 ===
  var coreChecks = [
    !!p.name,
    !!p.company,
    !!p.type,
    hasPremium,
    !!p.coverage,
    !!p.guaranteedYears,
    !!p.effective,
    !!p.expiry,
    !!p.policyNo,
    !!p.detail
  ];
  var totalFields = coreChecks.length;
  var filledCount = coreChecks.filter(function(ok) { return ok; }).length;
  var percent = Math.round((filledCount / totalFields) * 100);

  // === 联系前可准备的资料清单 ===
  var preConsultList = [];
  preConsultList.push('本记录的编号或凭证号' + (p.policyNo ? '（已记录）' : '（待补充）'));
  preConsultList.push('记录名称与机构来源' + (p.name && p.company ? '（已记录）' : '（待补充）'));
  preConsultList.push('生效日期与到期日期' + (p.effective && p.expiry ? '（已记录）' : '（待补充）'));
  if (p.type && p.type.indexOf('医疗') > -1) {
    preConsultList.push('免赔额与等待期信息');
    preConsultList.push('是否含特药、质子重离子等');
  }
  preConsultList.push('近期的使用或变动记录（如有）');
  preConsultList.push('家庭成员的相关资料汇总');
  if (member) {
    preConsultList.push('所属家人：' + member.name + '，年龄：' + (member.age || '-') + '岁');
  }

  return {
    recordName: recordName || '未命名资料',
    filledFields: filled,
    missingFields: missing,
    expiryStatus: expiryStatus,
    annualSpending: annualSpending,
    completeness: { filled: filledCount, total: totalFields, percent: percent },
    preConsultList: preConsultList
  };
}

module.exports = {
  generateChecklist: generateChecklist
};
