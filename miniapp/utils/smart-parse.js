// utils/smart-parse.js - 智能录入：一句话解析家人/宠物档案
// 纯本地规则匹配，不调AI，不调云函数

/** 从文本中提取第一个疑似姓名的片段（2-4个中文字符） */
function extractName(text) {
  var m = text.match(/^[\s，,]*([一-龥]{2,4})(?:[，,\s]|$)/);
  if (m) return m[1];
  // 回退：取第一段中文字符
  var m2 = text.match(/([一-龥]{2,4})/);
  return m2 ? m2[1] : '';
}

/** 从文本中提取年龄 */
function extractAge(text) {
  var m = text.match(/(\d{1,3})\s*岁/);
  return m ? parseInt(m[1], 10) : null;
}

/* ================================================================
   一、家人解析
   ================================================================ */

/** 解析家庭角色 */
function extractRole(text) {
  var roleMap = [
    { pattern: /爸爸|父亲|老爸|爸/, role: '父亲' },
    { pattern: /妈妈|母亲|老妈|妈/, role: '母亲' },
    { pattern: /配偶|妻子|老公|丈夫|爱人|另一半/, role: '配偶' },
    { pattern: /儿子|女儿|子女|孩子|小孩/, role: '子女' },
    { pattern: /岳父|公公|丈人/, role: '岳父' },
    { pattern: /岳母|婆婆|丈母娘/, role: '岳母' },
    { pattern: /爷爷|奶奶|外公|外婆|祖父|祖母/, role: '父母' },
    { pattern: /本人|自己|户主|我/, role: '户主' },
    { pattern: /家庭主要收入|主要收入|顶梁柱/, role: '户主' },
    { pattern: /哥哥|姐姐|弟弟|妹妹|兄妹|兄妹/, role: '子女' }
  ];
  for (var i = 0; i < roleMap.length; i++) {
    if (roleMap[i].pattern.test(text)) return roleMap[i].role;
  }
  return '';
}

/** 解析医保/社保 */
function extractYibao(text) {
  var patterns = [
    /(杭州|上海|北京|深圳|广州|成都|武汉|南京|苏州|东莞|佛山|惠州|汕头|汕尾|珠海|厦门|福州|长沙|郑州|济南|青岛|大连|沈阳|哈尔滨|西安|重庆|天津|合肥|南昌|南宁|昆明|贵阳|兰州|太原|石家庄|长春|海口|银川|西宁|拉萨|乌鲁木齐)[一-龥]*?(社保|医保)/,
    /(职工社保|居民社保|一档社保|二档社保)/,
    /无.*?(社保|医保)|没有.*?(社保|医保)|自费/
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) {
      if (m[0].indexOf('无') > -1 || m[0].indexOf('没有') > -1 || m[0].indexOf('自费') > -1) {
        return '无购买社保';
      }
      return m[0];
    }
  }
  return '';
}

/** 解析负债/贷款 */
function extractDebt(text) {
  var m = text.match(/((?:房贷|车贷|信用贷|经营贷|负债|贷款|借款).*?(?:万|W|w))/);
  if (m) return m[1];
  var m2 = text.match(/(\d{2,4})\s*万.*?(?:贷|负债)/);
  if (m2) return m2[0];
  return '';
}

/** 综合解析家人 */
function parsePerson(text) {
  if (!text || !text.trim()) return null;
  var t = text.trim();
  var result = {
    name: extractName(t),
    age: extractAge(t),
    role: extractRole(t),
    yibao: extractYibao(t),
    debt: extractDebt(t),
    notes: t
  };
  return result;
}

/* ================================================================
   二、宠物解析
   ================================================================ */

/** 解析宠物类型 */
function extractPetType(text) {
  var map = [
    { pattern: /狗|狗狗|汪|金毛|柯基|泰迪|柴犬|哈士奇|拉布拉多|边牧|牧羊犬|雪纳瑞|博美|比熊|法斗|英斗|巴哥|萨摩耶|贵宾/, type: '狗' },
    { pattern: /猫|猫咪|喵|布偶|英短|美短|田园猫|暹罗|加菲|波斯猫|橘猫|蓝猫|无毛猫|折耳猫/, type: '猫' },
    { pattern: /兔|兔子|兔兔/, type: '兔子' },
    { pattern: /鸟|鹦鹉|鸽子|金丝雀/, type: '鸟类' }
  ];
  for (var i = 0; i < map.length; i++) {
    if (map[i].pattern.test(text)) return map[i].type;
  }
  return '';
}

/** 解析品种 */
function extractBreed(text) {
  var breeds = [
    '金毛', '柯基', '泰迪', '柴犬', '哈士奇', '拉布拉多', '边牧', '牧羊犬', '雪纳瑞',
    '博美', '比熊', '法斗', '英斗', '巴哥', '萨摩耶', '贵宾', '吉娃娃', '阿拉斯加',
    '布偶', '英短', '美短', '田园猫', '暹罗', '加菲', '波斯猫', '橘猫', '蓝猫', '无毛猫',
    '折耳猫', '缅因猫', '德文', '矮脚猫', '金吉拉', '银渐层', '金渐层',
    '垂耳兔', '侏儒兔', '安哥拉兔', '虎皮鹦鹉', '玄凤鹦鹉', '牡丹鹦鹉'
  ];
  for (var i = 0; i < breeds.length; i++) {
    if (text.indexOf(breeds[i]) > -1) return breeds[i];
  }
  return '';
}

/** 解析相对日期为绝对日期 YYYY-MM（支持日期在关键词前或后） */
function parseRelativeDate(text, keyword) {
  var now = new Date();
  var thisYear = now.getFullYear();
  var parts = text.split(/[，,。；;、\n]/).filter(function(part) {
    return part.indexOf(keyword) > -1;
  });

  function normalizeMonth(month) {
    return String(parseInt(month, 10)).padStart(2, '0');
  }

  function parseDateInPart(part) {
    var m1 = part.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m1) return m1[1] + '-' + normalizeMonth(m1[2]) + '-' + String(parseInt(m1[3], 10)).padStart(2, '0');

    var m2 = part.match(/(\d{4})[-/](\d{1,2})/);
    if (m2) return m2[1] + '-' + normalizeMonth(m2[2]) + '-01';

    var m3 = part.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
    if (m3) return m3[1] + '-' + normalizeMonth(m3[2]) + '-01';

    var m4 = part.match(/去年\s*(\d{1,2})\s*月/);
    if (m4) return (thisYear - 1) + '-' + normalizeMonth(m4[1]) + '-01';

    var m5 = part.match(/今年\s*(\d{1,2})\s*月/);
    if (m5) return thisYear + '-' + normalizeMonth(m5[1]) + '-01';

    var m6 = part.match(/(\d{1,2})\s*月/);
    if (m6) return thisYear + '-' + normalizeMonth(m6[1]) + '-01';

    return '';
  }

  for (var i = 0; i < parts.length; i++) {
    var parsed = parseDateInPart(parts[i]);
    if (parsed) return parsed;
  }

  return '';
}

/** 综合解析宠物 */
function parsePet(text) {
  if (!text || !text.trim()) return null;
  var t = text.trim();
  var now = new Date();

  var result = {
    name: extractName(t),
    age: extractAge(t),
    petType: extractPetType(t),
    breed: extractBreed(t),
    vaccineDate: parseRelativeDate(t, '疫苗'),
    dewormDate: parseRelativeDate(t, '驱虫'),
    checkupDate: parseRelativeDate(t, '体检'),
    notes: t
  };

  // 如果没解析到体检日期，但提到了"体检正常""最近体检""体检过"，写入备注提示
  if (!result.checkupDate && /体检|健康检查/.test(t)) {
    // 不填具体日期，只保留在notes中
  }

  return result;
}

/* ================================================================
   三、统一入口
   ================================================================ */

/**
 * 智能解析入口
 * @param {string} text - 用户输入的描述文本
 * @param {string} kind - 'person' | 'pet'
 * @returns {object|null} 解析后的字段映射
 */
function parseSmart(text, kind) {
  if (kind === 'pet') return parsePet(text);
  return parsePerson(text);
}

module.exports = {
  parsePerson: parsePerson,
  parsePet: parsePet,
  parseSmart: parseSmart
};
