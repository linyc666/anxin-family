// ============================================================
//  家庭资料分析引擎 v1.0
//  适用：H5 / 微信小程序 / Web App
//  用法：InsuranceEngine.analyze({ members, policies })
// ============================================================
var InsuranceEngine = (function() {
  'use strict';

  // ==========================================================
  //  一、样例数据库（可独立维护，定期更新）
  //  格式说明：
  //    prices: [{ ageMin, ageMax, price }] 按年龄阶梯的年度支出参考
  //    healthStrictness: 1=宽松 2=中等 3=严格(需体检)
  //    needSocialIns: 是否需要医保
  //    guaranteeYears: 延续年数（null=不延续）
  //    features[]: 样例特点标签
  //    active: 是否启用
  // ==========================================================
  var DEFAULT_PRODUCTS = [
    // ============ 百万医疗 ============
    {
      id: "med_taibao_b", type: "百万医疗", name: "太保互联网个人长期B款医疗保险",
      company: "太平洋健康", companyRating: "A类", solvency: "175%",
      prices: [
        { ageMin: 0, ageMax: 5, price: 380 }, { ageMin: 6, ageMax: 20, price: 200 },
        { ageMin: 21, ageMax: 25, price: 250 }, { ageMin: 26, ageMax: 30, price: 380 },
        { ageMin: 31, ageMax: 35, price: 450 }, { ageMin: 36, ageMax: 40, price: 600 },
        { ageMin: 41, ageMax: 45, price: 900 }, { ageMin: 46, ageMax: 50, price: 1400 },
        { ageMin: 51, ageMax: 55, price: 2358 }, { ageMin: 56, ageMax: 60, price: 3500 },
        { ageMin: 61, ageMax: 65, price: 4800 }
      ],
      priceNoSocialFactor: 1.7,
      guaranteeYears: 20, guaranteeType: "保证续保",
      coverage: "一般200万·重疾400万", deductible: "一般1万·重疾0免赔", waitingDays: 90,
      features: ["含CAR-T", "外购药100万", "含质子重离子", "含特需部可选", "20年保证"],
      ageRange: "0-65岁", healthCheck: "智能核保", healthStrictness: 2,
      needSocialIns: true, purchaseLink: "",
      score: 92, active: true
    },
    {
      id: "med_haoyibao_20y", type: "百万医疗", name: "好医保·长期医疗（20年版）",
      company: "人保健康", companyRating: "A类", solvency: "156%",
      prices: [
        { ageMin: 0, ageMax: 5, price: 350 }, { ageMin: 6, ageMax: 25, price: 220 },
        { ageMin: 26, ageMax: 30, price: 350 }, { ageMin: 31, ageMax: 40, price: 420 },
        { ageMin: 41, ageMax: 50, price: 850 }, { ageMin: 51, ageMax: 55, price: 2200 },
        { ageMin: 56, ageMax: 60, price: 3200 }
      ],
      priceNoSocialFactor: 1.7,
      guaranteeYears: 20, guaranteeType: "保证续保",
      coverage: "一般200万·重疾400万", deductible: "一般1万·重疾0免赔", waitingDays: 90,
      features: ["含CAR-T", "含质子重离子", "20年保证", "支付宝平台"],
      ageRange: "0-60岁", healthCheck: "智能核保", healthStrictness: 2,
      needSocialIns: true, purchaseLink: "",
      score: 90, active: true
    },
    {
      id: "med_renbao_0deduct", type: "百万医疗", name: "人保悠享健康·长期医疗（0免赔版）",
      company: "人保健康", companyRating: "A类", solvency: "156%",
      prices: [
        { ageMin: 0, ageMax: 5, price: 500 }, { ageMin: 6, ageMax: 25, price: 300 },
        { ageMin: 26, ageMax: 30, price: 453 }, { ageMin: 31, ageMax: 40, price: 550 },
        { ageMin: 41, ageMax: 50, price: 1100 }, { ageMin: 51, ageMax: 55, price: 2600 }
      ],
      priceNoSocialFactor: 1.8,
      guaranteeYears: 6, guaranteeType: "6年保证续保",
      coverage: "一般200万·重疾400万", deductible: "0免赔（1万内30%报销）", waitingDays: 30,
      features: ["0免赔", "含质子重离子", "含CAR-T", "等待期仅30天", "6年保证"],
      ageRange: "0-55岁", healthCheck: "健康告知", healthStrictness: 2,
      needSocialIns: true, purchaseLink: "",
      score: 85, active: true
    },
    {
      id: "med_zhongan_zunxiang", type: "百万医疗", name: "众安尊享e生2026",
      company: "众安保险", companyRating: "B类", solvency: "—",
      prices: [
        { ageMin: 0, ageMax: 25, price: 200 }, { ageMin: 26, ageMax: 30, price: 300 },
        { ageMin: 31, ageMax: 40, price: 380 }, { ageMin: 41, ageMax: 50, price: 700 },
        { ageMin: 51, ageMax: 55, price: 1500 }, { ageMin: 56, ageMax: 60, price: 2200 },
        { ageMin: 61, ageMax: 70, price: 3500 }
      ],
      priceNoSocialFactor: 1.6,
      guaranteeYears: null, guaranteeType: "不保证续保",
      coverage: "一般300万·重疾600万", deductible: "一般1万·重疾0免赔", waitingDays: 30,
      features: ["保额高", "70岁可投", "含质子重离子", "核保相对宽松"],
      ageRange: "0-70岁", healthCheck: "智能核保(较宽松)", healthStrictness: 1,
      needSocialIns: true, purchaseLink: "",
      score: 72, active: true
    },

    // ============ 重疾险 ============
    {
      id: "ci_wanmei8", type: "重疾险", name: "完美人生8号（终身）",
      company: "复星联合健康", companyRating: "A类", solvency: "175%",
      prices: [
        { ageMin: 0, ageMax: 5, price: 2200 }, { ageMin: 6, ageMax: 17, price: 2800 },
        { ageMin: 18, ageMax: 25, price: 4500 }, { ageMin: 26, ageMax: 30, price: 5800 },
        { ageMin: 31, ageMax: 35, price: 7200 }, { ageMin: 36, ageMax: 40, price: 9000 },
        { ageMin: 41, ageMax: 45, price: 11500 }, { ageMin: 46, ageMax: 50, price: 14500 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "终身保证·费率锁定",
      coverage: "50万重疾+30万中症(60%)+15万轻症(30%)", deductible: "给付型·无免赔", waitingDays: 180,
      features: ["终身保证", "费率锁定", "女性特疾额外10%", "中症60%赔付", "身故返保费"],
      ageRange: "0-55岁", healthCheck: "健康告知+智能核保", healthStrictness: 2,
      needSocialIns: false, purchaseLink: "",
      score: 90, active: true
    },
    {
      id: "ci_supermary16", type: "重疾险", name: "超级玛丽16号（终身）",
      company: "君龙人寿", companyRating: "B+类", solvency: "—",
      prices: [
        { ageMin: 0, ageMax: 5, price: 2400 }, { ageMin: 6, ageMax: 17, price: 3000 },
        { ageMin: 18, ageMax: 25, price: 5000 }, { ageMin: 26, ageMax: 30, price: 6500 },
        { ageMin: 31, ageMax: 35, price: 8000 }, { ageMin: 36, ageMax: 40, price: 10000 },
        { ageMin: 41, ageMax: 50, price: 13000 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "终身保证·费率锁定",
      coverage: "50万重疾+癌症多次赔付+住院报销", deductible: "给付型·无免赔", waitingDays: 180,
      features: ["终身保证", "癌症多次赔付", "结节友好·核保宽松", "住院报销附加"],
      ageRange: "0-50岁", healthCheck: "健康告知(结节友好)", healthStrictness: 1,
      needSocialIns: false, purchaseLink: "",
      score: 85, active: true
    },
    {
      id: "ci_darwin12", type: "重疾险", name: "达尔文12号（终身）",
      company: "三峡人寿", companyRating: "B类", solvency: "—",
      prices: [
        { ageMin: 0, ageMax: 5, price: 1800 }, { ageMin: 6, ageMax: 17, price: 2200 },
        { ageMin: 18, ageMax: 25, price: 3200 }, { ageMin: 26, ageMax: 30, price: 3700 },
        { ageMin: 31, ageMax: 35, price: 4800 }, { ageMin: 36, ageMax: 40, price: 6200 },
        { ageMin: 41, ageMax: 50, price: 8500 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "终身保证·费率锁定",
      coverage: "30万重疾+18万中症(60%)+9万轻症(30%)", deductible: "给付型·无免赔", waitingDays: 180,
      features: ["终身保证", "性价比高", "轻中症豁免", "30万起步档"],
      ageRange: "0-50岁", healthCheck: "健康告知", healthStrictness: 2,
      needSocialIns: false, purchaseLink: "",
      score: 83, active: true
    },

    // ============ 意外险 ============
    {
      id: "acc_littlebee_zx", type: "意外险", name: "小蜜蜂6号尊享版",
      company: "太平洋产险", companyRating: "A类", solvency: "—",
      prices: [
        { ageMin: 18, ageMax: 55, price: 298 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "1年期(续保稳定)",
      coverage: "意外100万+猝死50万+医疗10.5万", deductible: "0免赔·不限社保·100%报销", waitingDays: 0,
      features: ["100万意外", "50万猝死", "航空500万", "0免赔不限社保", "住院津贴150元/天"],
      ageRange: "18-55岁", healthCheck: "无需健告", healthStrictness: 1,
      needSocialIns: false, purchaseLink: "",
      score: 95, active: true
    },
    {
      id: "acc_littlebee_dc", type: "意外险", name: "小蜜蜂6号典藏版",
      company: "太平洋产险", companyRating: "A类", solvency: "—",
      prices: [
        { ageMin: 18, ageMax: 55, price: 156 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "1年期(续保稳定)",
      coverage: "意外50万+猝死30万+医疗5万", deductible: "0免赔·不限社保", waitingDays: 0,
      features: ["50万意外", "30万猝死", "航空300万", "0免赔不限社保", "性价比极高"],
      ageRange: "18-55岁", healthCheck: "无需健告", healthStrictness: 1,
      needSocialIns: false, purchaseLink: "",
      score: 88, active: true
    },
    {
      id: "acc_dahuba8_elder", type: "意外险", name: "大护甲8号高龄版",
      company: "人保财险", companyRating: "A类", solvency: "—",
      prices: [
        { ageMin: 50, ageMax: 60, price: 228 }, { ageMin: 61, ageMax: 70, price: 328 },
        { ageMin: 71, ageMax: 85, price: 488 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "1年期(续保稳定)",
      coverage: "意外10-20万+医疗5万+骨折5千", deductible: "100元免赔·限社保内", waitingDays: 0,
      features: ["含骨折保障", "驾驶额外30万", "住院津贴50元/天", "高龄专享"],
      ageRange: "50-85岁", healthCheck: "无需健告", healthStrictness: 1,
      needSocialIns: false, purchaseLink: "",
      score: 80, active: true
    },
    {
      id: "acc_xiaoanxin6", type: "意外险", name: "孝心安6号",
      company: "太平洋产险", companyRating: "A类", solvency: "—",
      prices: [
        { ageMin: 50, ageMax: 60, price: 198 }, { ageMin: 61, ageMax: 70, price: 288 },
        { ageMin: 71, ageMax: 80, price: 398 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "1年期(续保稳定)",
      coverage: "意外10-15万+骨折额外赔+医疗3万", deductible: "0免赔", waitingDays: 0,
      features: ["骨折额外赔", "意外医疗", "高龄专享", "0免赔"],
      ageRange: "50-80岁", healthCheck: "无需健告", healthStrictness: 1,
      needSocialIns: false, purchaseLink: "",
      score: 82, active: true
    },

    // ============ 定寿 ============
    {
      id: "term_damai2026", type: "定寿", name: "华贵大麦2026A款",
      company: "华贵人寿", companyRating: "AA", solvency: "—",
      prices: [
        { ageMin: 18, ageMax: 25, price: 1500 }, { ageMin: 26, ageMax: 30, price: 2426 },
        { ageMin: 31, ageMax: 35, price: 3200 }, { ageMin: 36, ageMax: 40, price: 4500 },
        { ageMin: 41, ageMax: 45, price: 6200 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: 30, guaranteeType: "保至60岁·锁定30年",
      coverage: "200万身故/全残+猝死额外50万", deductible: "给付型", waitingDays: 90,
      features: ["健告仅3条", "AA级公司", "定寿市场领导者", "200万保额"],
      ageRange: "18-50岁", healthCheck: "3条健告(极简)", healthStrictness: 1,
      needSocialIns: false, purchaseLink: "",
      score: 93, active: true
    },
    {
      id: "term_dinghaizhu8", type: "定寿", name: "国富定海柱8号",
      company: "国富人寿", companyRating: "B类", solvency: "—",
      prices: [
        { ageMin: 18, ageMax: 25, price: 1400 }, { ageMin: 26, ageMax: 30, price: 2348 },
        { ageMin: 31, ageMax: 35, price: 3100 }, { ageMin: 36, ageMax: 40, price: 4300 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: 30, guaranteeType: "保至60岁·锁定30年",
      coverage: "200万身故/全残·45岁前300万", deductible: "给付型", waitingDays: 90,
      features: ["45岁前额外50%", "比大麦便宜¥78/年", "45岁前=300万"],
      ageRange: "18-40岁", healthCheck: "5-7条健告", healthStrictness: 2,
      needSocialIns: false, purchaseLink: "",
      score: 88, active: true
    },

    // ============ 防癌险 ============
    {
      id: "cancer_renbao_warm", type: "防癌险", name: "人保温暖悠长防癌医疗保险",
      company: "人保健康", companyRating: "A类", solvency: "156%",
      prices: [
        { ageMin: 0, ageMax: 30, price: 150 }, { ageMin: 31, ageMax: 40, price: 249 },
        { ageMin: 41, ageMax: 50, price: 500 }, { ageMin: 51, ageMax: 60, price: 900 },
        { ageMin: 61, ageMax: 70, price: 1800 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "终身保证续保",
      coverage: "癌症医疗400万+质子重离子100万+特药100万", deductible: "0免赔·100%报销", waitingDays: 90,
      features: ["终身保证续保", "癌症400万", "0免赔100%报销", "战略性保单", "理赔后仍可续"],
      ageRange: "0-70岁", healthCheck: "健康告知", healthStrictness: 2,
      needSocialIns: false, purchaseLink: "",
      score: 91, active: true
    },

    // ============ 惠民保 ============
    {
      id: "hm_shenzhen_2026", type: "惠民保", name: "深圳惠民保2026",
      company: "深圳市医保局指导", companyRating: "政府指导", solvency: "—",
      prices: [
        { ageMin: 0, ageMax: 120, price: 88 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "1年期(年度续保)",
      coverage: "医保内300万+医保外300万+特药100万", deductible: "较高(各地不同)", waitingDays: 0,
      features: ["政府指导", "无健告", "抗癌针纳入", "既往症可投"],
      ageRange: "不限", healthCheck: "无需健告·无等待期", healthStrictness: 1,
      needSocialIns: true, purchaseLink: "",
      score: 75, active: true, regionRestrict: "深圳医保"
    },
    {
      id: "hm_guangzhou_2026", type: "惠民保", name: "广州惠民保2026",
      company: "广州市医保局指导", companyRating: "政府指导", solvency: "—",
      prices: [
        { ageMin: 0, ageMax: 120, price: 49 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "1年期(年度续保)",
      coverage: "医保内200万+医保外100万+特药100万", deductible: "较高", waitingDays: 0,
      features: ["政府指导", "无健告", "¥49超低价", "既往症可投"],
      ageRange: "不限", healthCheck: "无需健告", healthStrictness: 1,
      needSocialIns: true, purchaseLink: "",
      score: 73, active: true, regionRestrict: "广州医保"
    },
    {
      id: "hm_shanwei_2026", type: "惠民保", name: "汕尾惠民保",
      company: "汕尾市医保局指导", companyRating: "政府指导", solvency: "—",
      prices: [
        { ageMin: 0, ageMax: 120, price: 100 }
      ],
      priceNoSocialFactor: 1.0,
      guaranteeYears: null, guaranteeType: "1年期",
      coverage: "医保内200万+医保外100万", deductible: "较高", waitingDays: 0,
      features: ["政府指导", "无健告", "既往症可投"],
      ageRange: "不限", healthCheck: "无需健告", healthStrictness: 1,
      needSocialIns: true, purchaseLink: "",
      score: 70, active: true, regionRestrict: "汕尾医保"
    }
  ];

  var PRODUCTS = DEFAULT_PRODUCTS.slice();

  // ==========================================================
  //  二、社保/医保地区映射
  // ==========================================================
  var SOCIAL_INSURANCE_MAP = {
    "深圳一档社保": { city: "深圳", type: "职工", huiminId: "hm_shenzhen_2026" },
    "深圳二档社保": { city: "深圳", type: "职工", huiminId: "hm_shenzhen_2026" },
    "深圳灵活就业社保": { city: "深圳", type: "灵活就业", huiminId: "hm_shenzhen_2026" },
    "广州职工社保": { city: "广州", type: "职工", huiminId: "hm_guangzhou_2026" },
    "广州灵活就业社保": { city: "广州", type: "灵活就业", huiminId: "hm_guangzhou_2026" },
    "佛山职工社保": { city: "佛山", type: "职工", huiminId: null },
    "东莞职工社保": { city: "东莞", type: "职工", huiminId: null },
    "惠州职工社保": { city: "惠州", type: "职工", huiminId: null },
    "杭州职工社保": { city: "杭州", type: "职工", huiminId: null },
    "汕头居民社保": { city: "汕头", type: "居民", huiminId: null },
    "汕尾居民社保": { city: "汕尾", type: "居民", huiminId: "hm_shanwei_2026" },
    "汕尾城乡社保": { city: "汕尾", type: "居民", huiminId: "hm_shanwei_2026" },
    "无购买社保": null, "": null
  };

  // 通用匹配：从字符串中提取城市名
  function getSocialInfo(insuranceType) {
    if (!insuranceType) return null;
    // 精确匹配
    if (SOCIAL_INSURANCE_MAP.hasOwnProperty(insuranceType)) {
      return SOCIAL_INSURANCE_MAP[insuranceType];
    }
    // 从字符串提取城市（如"成都职工社保"→"成都"）
    var cityMatch = insuranceType.match(/^([一-龥]{2,3})/);
    if (cityMatch) {
      return { city: cityMatch[1], type: "未知", huiminId: null };
    }
    return null;
  }

  // ==========================================================
  //  三、险种需求规则
  //  定义每个人"应有的险种集合"及"触发条件"
  // ==========================================================
  var COVERAGE_REQUIREMENTS = [
    { type: "百万医疗", required: true, everyone: true, desc: "住院/大病医疗费用报销" },
    { type: "意外险", required: true, everyone: true, desc: "意外伤害医疗和身故保障" },
    { type: "惠民保", condition: function(m) { var si = SOCIAL_INSURANCE_MAP[m.yibao]; return si && si.huiminId; }, desc: "政府指导的低价补充保险" },
    { type: "重疾险", condition: function(m) { return m.age >= 18 && m.age <= 50; }, desc: "确诊重疾后的收入补偿", priority: "P1" },
    { type: "定寿", condition: function(m) { var debt = parseInt(m.debt) || 0; return (m.role === "户主" || m.role === "配偶") && debt > 0; }, desc: "家庭支柱身故后的债务覆盖", priority: "P0" },
    { type: "防癌险", condition: function(m) { return m.age >= 50; }, desc: "高龄癌症专项保障", priority: "P2" },
    { type: "财产险", required: false, everyone: false, desc: "房屋/财产损失保障" },
    { type: "分红险", required: false, everyone: false, desc: "储蓄分红型保险" },
    { type: "年金险", required: false, everyone: false, desc: "养老/教育年金" },
    { type: "车险", required: false, everyone: false, desc: "机动车保险" }
  ];

  // ==========================================================
  //  四、匹配算法
  // ==========================================================

  /** 查找产品适用的年龄阶梯价格 */
  function getProductPrice(product, age) {
    for (var i = 0; i < product.prices.length; i++) {
      var p = product.prices[i];
      if (age >= p.ageMin && age <= p.ageMax) return p.price;
    }
    return null; // 不在年龄范围内
  }

  /** 评估某成员是否满足某险种的投保条件 */
  function canInsure(product, member) {
    // 年龄范围
    if (!product.prices.some(function(p) { return member.age >= p.ageMin && member.age <= p.ageMax; })) return false;
    // 社保要求
    if (product.needSocialIns && (!member.yibao || member.yibao.indexOf("无购买社保") > -1 || member.yibao.indexOf("无社保") > -1)) {
      return { ok: false, reason: "需要医保才能按社保费率投保" };
    }
    if (product.regionRestrict) {
      var si = getSocialInfo(member.yibao);
      if (!si || product.regionRestrict.indexOf(si.city) === -1) {
        return { ok: false, reason: "需" + product.regionRestrict + "方可投保" };
      }
    }
    return { ok: true };
  }

  /** 产品综合评分（越低越好，用于排序） */
  function scoreProduct(product, member, gapPriority) {
    var price = getProductPrice(product, member.age);
    if (price === null) return 999;

    // 价格标准化（假设预算参考线）
    var priceScore = 0;
    if (price < 500) priceScore = 1;
    else if (price < 2000) priceScore = 2;
    else if (price < 5000) priceScore = 3;
    else if (price < 10000) priceScore = 4;
    else priceScore = 5;

    // 健告友好度（gap优先级越高越看重健告宽松度）
    var healthScore = 4 - product.healthStrictness; // 1=宽松→3, 3=严格→1

    // 续保条件
    var guaranteeScore = 0;
    if (product.guaranteeType.indexOf("终身") > -1) guaranteeScore = 3;
    else if (product.guaranteeYears >= 20) guaranteeScore = 3;
    else if (product.guaranteeYears >= 6) guaranteeScore = 2;
    else if (product.guaranteeType.indexOf("1年") > -1) guaranteeScore = 0;
    else guaranteeScore = 1;

    // 公司评级
    var companyScore = 0;
    if (product.companyRating === "AA") companyScore = 3;
    else if (product.companyRating.indexOf("A") > -1) companyScore = 2;
    else if (product.companyRating.indexOf("B") > -1) companyScore = 1;

    // 综合：价格×0.3 + 健告×0.2 + 续保×0.25 + 公司×0.25
    return {
      total: priceScore * 0.3 + healthScore * 0.2 + guaranteeScore * 0.25 + companyScore * 0.25,
      breakdown: { price: priceScore, health: healthScore, guarantee: guaranteeScore, company: companyScore }
    };
  }

  // ==========================================================
  //  五、主分析函数
  // ==========================================================
  function analyze(input) {
    var members = (input.members || []).filter(function(m) { return (m.kind || 'person') !== 'pet'; });
    var policies = input.policies || [];
    var results = { gaps: [], recommendations: [], renewalAlerts: [], stats: {} };

    members.forEach(function(member) {
      var memberPolicies = policies.filter(function(p) { return p.memberId === member.id; });
      var hasTypes = {};
      memberPolicies.forEach(function(p) { hasTypes[p.type] = true; });

      // 检测缺口
      COVERAGE_REQUIREMENTS.forEach(function(req) {
        var needed = req.everyone || (req.condition && req.condition(member));
        if (!needed) return;
        var existingPolicy = memberPolicies.find(function(p) { return p.type === req.type; });
        if (existingPolicy) {
          // 有该险种，但检查续保条件
          if ((req.type === "百万医疗" || req.type === "重疾险") && existingPolicy.guaranteedYears &&
              (existingPolicy.guaranteedYears.indexOf("1年不保证") > -1 || existingPolicy.guaranteedYears.indexOf("不稳定") > -1 || existingPolicy.guaranteedYears === "1年期")) {
            results.gaps.push({
              memberId: member.id, memberName: member.name,
              type: req.type, priority: "P1",
              title: req.type + "为1年期不保证续保",
              desc: member.name + "的" + existingPolicy.name + "一旦患病次年可能被拒保。",
              existingPolicy: existingPolicy,
              isUpgrade: true
            });
          }
          return;
        }

        // 确定优先级
        var priority = req.priority || (req.type === "百万医疗" || req.type === "定寿" ? "P0" : req.type === "意外险" ? "P1" : "P2");

        results.gaps.push({
          memberId: member.id, memberName: member.name,
          type: req.type, priority: priority,
          title: "缺少" + req.type,
          desc: req.desc,
          isUpgrade: false
        });
      });

      // 产品推荐
      results.gaps.forEach(function(gap) {
        if (gap.memberId !== member.id) return;

        var candidates = PRODUCTS.filter(function(p) {
          return p.type === gap.type && p.active && canInsure(p, member).ok;
        });

        // 排序
        candidates.sort(function(a, b) {
          return scoreProduct(b, member, gap.priority).total - scoreProduct(a, member, gap.priority).total;
        });

        var top2 = candidates.slice(0, 2).map(function(p) {
          return {
            product: p,
            price: getProductPrice(p, member.age),
            score: scoreProduct(p, member, gap.priority)
          };
        });

        if (top2.length > 0) {
          results.recommendations.push({
            memberId: member.id, memberName: member.name,
            gapType: gap.type, priority: gap.priority, isUpgrade: gap.isUpgrade,
            existingPolicy: gap.existingPolicy,
            candidates: top2
          });
        }
      });

      // 续保提醒
      memberPolicies.forEach(function(p) {
        if (!p.expiry || p.expiry === "终身") return;
        var daysLeft = Math.ceil((new Date(p.expiry) - Date.now()) / 86400000);
        if (daysLeft < 90) {
          results.renewalAlerts.push({
            memberId: member.id, memberName: member.name,
            policy: p, daysLeft: daysLeft,
            urgent: daysLeft < 30, expired: daysLeft < 0
          });
        }
      });
    });

    // 排序
    var priorityOrder = { P0: 0, P1: 1, P2: 2 };
    results.gaps.sort(function(a, b) { return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99); });
    results.recommendations.sort(function(a, b) { return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99); });
    results.renewalAlerts.sort(function(a, b) { return a.daysLeft - b.daysLeft; });

    // 统计
    results.stats = {
      totalMembers: members.length,
      totalPolicies: policies.length,
      totalGaps: results.gaps.length,
      p0Gaps: results.gaps.filter(function(g) { return g.priority === "P0"; }).length,
      p1Gaps: results.gaps.filter(function(g) { return g.priority === "P1"; }).length,
      renewalUrgent: results.renewalAlerts.filter(function(r) { return r.urgent; }).length
    };

    return results;
  }

  // ==========================================================
  //  六、工具API
  // ==========================================================
  return {
    analyze: analyze,
    PRODUCTS: PRODUCTS,
    DEFAULT_PRODUCTS: DEFAULT_PRODUCTS,
    setProducts: function(products) { if (products && products.length > 0) { PRODUCTS = products; } },
    getProducts: function() { return PRODUCTS; },
    resetProducts: function() { PRODUCTS = DEFAULT_PRODUCTS.slice(); },
    getProductPrice: getProductPrice,
    getSocialInfo: getSocialInfo,
    canInsure: canInsure,
    COVERAGE_REQUIREMENTS: COVERAGE_REQUIREMENTS,
    getProductsByType: function(type) { return PRODUCTS.filter(function(p) { return p.type === type && p.active; }); },
    getAllTypes: function() { var types = {}; PRODUCTS.forEach(function(p) { types[p.type] = true; }); return Object.keys(types); }
  };
})();

// 多环境导出（小程序/Node/浏览器）
if (typeof module !== 'undefined') { module.exports = InsuranceEngine; }
if (typeof window !== 'undefined') { window.InsuranceEngine = InsuranceEngine; }
