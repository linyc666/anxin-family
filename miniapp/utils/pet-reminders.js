// utils/pet-reminders.js - 宠物疫苗/驱虫/体检到期提醒
var INTERVALS = {
  vaccine: 365,   // 疫苗建议每年
  deworm: 90,     // 驱虫建议每3个月
  checkup: 365    // 体检建议每年
};

var LABELS = {
  vaccine: '疫苗',
  deworm: '驱虫',
  checkup: '体检'
};

/**
 * 计算单个提醒状态
 * @param {string} dateStr - 上次日期 YYYY-MM-DD
 * @param {string} type - vaccine | deworm | checkup
 * @returns {{ daysLeft: number|null, expired: boolean, urgent: boolean, label: string, type: string }}
 */
function getReminderStatus(dateStr, type) {
  var interval = INTERVALS[type] || 365;
  if (!dateStr) {
    return { daysLeft: null, expired: false, urgent: false, label: '未记录', type: type, typeLabel: LABELS[type] };
  }
  var date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { daysLeft: null, expired: false, urgent: false, label: '日期无效', type: type, typeLabel: LABELS[type] };
  }
  var daysSince = Math.ceil((Date.now() - date) / 86400000);
  var daysLeft = interval - daysSince;

  if (daysLeft < 0) {
    return {
      daysLeft: Math.abs(daysLeft),
      expired: true, urgent: true,
      label: '已过期' + Math.abs(daysLeft) + '天',
      type: type, typeLabel: LABELS[type]
    };
  } else if (daysLeft <= 30) {
    return {
      daysLeft: daysLeft,
      expired: false, urgent: true,
      label: daysLeft + '天后到期',
      type: type, typeLabel: LABELS[type]
    };
  } else {
    return {
      daysLeft: daysLeft,
      expired: false, urgent: false,
      label: daysLeft + '天后到期',
      type: type, typeLabel: LABELS[type]
    };
  }
}

/**
 * 获取宠物的全部提醒状态
 * @param {object} pet - 宠物成员对象
 * @returns {object} { vaccine, deworm, checkup, urgentCount, expiredCount }
 */
function getPetReminders(pet) {
  if (!pet || pet.kind !== 'pet') return null;
  var vaccine = getReminderStatus(pet.vaccineDate, 'vaccine');
  var deworm = getReminderStatus(pet.dewormDate, 'deworm');
  var checkup = getReminderStatus(pet.checkupDate, 'checkup');
  var all = [vaccine, deworm, checkup];
  return {
    vaccine: vaccine,
    deworm: deworm,
    checkup: checkup,
    items: all,
    urgentCount: all.filter(function(r) { return r.urgent && !r.expired; }).length,
    expiredCount: all.filter(function(r) { return r.expired; }).length,
    hasAlert: all.some(function(r) { return r.urgent; })
  };
}

/**
 * 获取家庭中所有宠物的提醒汇总
 * @param {array} members - 家庭成员数组
 * @returns {array} [{ petName, petId, reminders }]
 */
function getAllPetAlerts(members) {
  if (!members || !members.length) return [];
  return members
    .filter(function(m) { return m.kind === 'pet'; })
    .map(function(pet) {
      var reminders = getPetReminders(pet);
      return {
        petId: pet.id,
        petName: pet.name,
        reminders: reminders,
        urgentItems: reminders ? reminders.items.filter(function(r) { return r.urgent; }) : []
      };
    })
    .filter(function(a) { return a.urgentItems.length > 0; })
    .sort(function(a, b) { return b.urgentItems.length - a.urgentItems.length; });
}

module.exports = {
  INTERVALS: INTERVALS,
  LABELS: LABELS,
  getReminderStatus: getReminderStatus,
  getPetReminders: getPetReminders,
  getAllPetAlerts: getAllPetAlerts
};
