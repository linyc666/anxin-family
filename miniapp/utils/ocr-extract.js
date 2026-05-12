// ============================================================
//  资料图片识别 + AI 提取管道 v1.0
//  流程：截图/PDF → OCR文字 → AI结构化提取 → JSON字段
//  适用：H5端(调百度OCR+Claude API) / 小程序端(wx.OCR+云函数)
// ============================================================

var PolicyExtractor = (function() {
  'use strict';

  // ==========================================================
  //  一、AI 提取 Prompt 模板
  //  这个 prompt 发给 Claude/GPT，让它从 OCR 文字中提取
  //  结构化资料字段
  // ==========================================================
  var EXTRACTION_PROMPT = [
    '你是一个资料单证数据提取助手。请从以下OCR识别出的资料文字中，提取结构化信息。',
    '',
    '## 提取字段（能提取多少提取多少，不确定的留空）：',
    '- policyName: 资料/记录名称（如"长期医疗资料样例"）',
    '- company: 机构/来源（如"太平洋健康""人保健康"）',
    '- type: 资料类别（百万医疗/意外险/重疾险/定寿/防癌险/惠民保/车险/家财险/其他）',
    '- premium: 年度支出金额，只输出数字（如 443）',
    '- coverage: 额度/范围描述（如"一般200万·重疾400万"）',
    '- deductible: 免赔额描述（如"一般1万·重疾0免赔"）',
    '- effectiveDate: 生效日期，格式YYYY-MM-DD',
    '- expiryDate: 到期日期，格式YYYY-MM-DD（长期延续的留空）',
    '- guaranteeYears: 延续条件（长期延续/20年延续/6年延续/1年期/年度型不稳定）',
    '- insuredName: 姓名',
    '- policyNo: 资料编号',
    '- features: 关键特征标签，逗号分隔（如"含CAR-T,0免赔,外购药100万"）',
    '',
    '## 输出格式（严格遵守JSON）：',
    '{',
    '  "policyName": "",',
    '  "company": "",',
    '  "type": "",',
    '  "premium": 0,',
    '  "coverage": "",',
    '  "deductible": "",',
    '  "effectiveDate": "",',
    '  "expiryDate": "",',
    '  "guaranteeYears": "",',
    '  "insuredName": "",',
    '  "policyNo": "",',
    '  "features": "",',
    '  "confidence": "high/medium/low",',
    '  "notes": ""',
    '}',
    '',
    '## OCR识别文字：',
    '{ocrText}',
    '',
    '请只输出JSON，不要任何其他文字。'
  ].join('\n');

  // ==========================================================
  //  二、本地正则回退提取（不依赖AI API时使用）
  // ==========================================================
  function regexExtract(ocrText) {
    var result = {
      policyName: '', company: '', type: '', premium: 0,
      coverage: '', deductible: '', effectiveDate: '', expiryDate: '',
      guaranteeYears: '', insuredName: '', policyNo: '', features: '',
      confidence: 'low', notes: '正则提取（未经AI校验）'
    };

    var text = ocrText || '';

    // 公司识别
    var companyMap = [
      { pattern: /太平洋健康|太平洋保险|太保/g, name: '太平洋健康' },
      { pattern: /人保健康|中国人民健康/g, name: '人保健康' },
      { pattern: /人保财险|中国人保财险/g, name: '人保财险' },
      { pattern: /平安产险|中国平安|平安保险/g, name: '平安产险' },
      { pattern: /中国人寿|国寿/g, name: '中国人寿' },
      { pattern: /众安保险|众安在线/g, name: '众安保险' },
      { pattern: /华贵人寿/g, name: '华贵人寿' },
      { pattern: /复星联合/g, name: '复星联合健康' },
      { pattern: /三峡人寿/g, name: '三峡人寿' },
      { pattern: /君龙人寿/g, name: '君龙人寿' },
      { pattern: /国富人寿/g, name: '国富人寿' },
      { pattern: /国泰产险/g, name: '国泰产险' }
    ];
    companyMap.forEach(function(c) {
      if (c.pattern.test(text) && !result.company) {
        result.company = c.name;
      }
    });

    // 类型识别
    if (/百万医疗|住院医疗|医疗保险|长期医疗/g.test(text)) result.type = '百万医疗';
    else if (/意外险|意外伤害|综合意外/g.test(text)) result.type = '意外险';
    else if (/重疾险|重大疾病|重大疾病保险/g.test(text)) result.type = '重疾险';
    else if (/定期寿险|定寿|寿险/g.test(text)) result.type = '定寿';
    else if (/防癌|癌症医疗/g.test(text)) result.type = '防癌险';
    else if (/惠民保|补充医疗/g.test(text)) result.type = '惠民保';

    // 保费（匹配 ¥数字 或 数字元/年）
    var premiumMatch = text.match(/[¥￥]\s*([\d,]+)/) || text.match(/(\d{2,4})[\s]*[元/年]/);
    if (premiumMatch) result.premium = parseInt(premiumMatch[1].replace(/,/g, '')) || 0;

    // 保额
    var coverageMatch = text.match(/保额[：:]\s*([^\n，,]+)/) || text.match(/(\d+万[^\n，,]*)/);
    if (coverageMatch) result.coverage = coverageMatch[1].trim();

    // 日期
    var dateMatch = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g);
    if (dateMatch && dateMatch.length >= 2) {
      result.effectiveDate = dateMatch[0].replace(/\//g, '-');
      result.expiryDate = dateMatch[1].replace(/\//g, '-');
    } else if (dateMatch && dateMatch.length === 1) {
      result.effectiveDate = dateMatch[0].replace(/\//g, '-');
    }

    // 延续条件
    if (/终身保证续保|终身续保/g.test(text)) result.guaranteeYears = '终身延续';
    else if (/20年.*续保|保证续保.*20年/g.test(text)) result.guaranteeYears = '20年延续';
    else if (/6年.*续保|保证续保.*6年/g.test(text)) result.guaranteeYears = '6年延续';
    else if (/1年.*续保|不保证续保/g.test(text)) result.guaranteeYears = '年度型延续不稳定';
    else if (/1年期/g.test(text)) result.guaranteeYears = '1年期';

    // 资料编号
    var policyNoMatch = text.match(/保单号[：:]\s*(\w+)/) || text.match(/(\d{15,20})/);
    if (policyNoMatch) result.policyNo = policyNoMatch[1];

    // 姓名
    var insuredMatch = text.match(/被保险人[：:]\s*([^\n，,]+)/) || text.match(/投保人[：:]\s*([^\n，,]+)/);
    if (insuredMatch) result.insuredName = insuredMatch[1].trim();

    return result;
  }

  // ==========================================================
  //  三、主提取函数
  //  mode: "ai" = 调AI API, "regex" = 本地正则
  // ==========================================================
  function extract(ocrText, options) {
    var opts = options || {};
    var mode = opts.mode || 'regex';

    if (mode === 'regex' || !opts.aiApiKey) {
      return regexExtract(ocrText);
    }

    // AI模式：构建prompt并返回（实际调用由调用方发起）
    var prompt = EXTRACTION_PROMPT.replace('{ocrText}', ocrText);
    return {
      mode: 'ai',
      prompt: prompt,
      // 调用方需执行：fetch(aiEndpoint, { body: JSON.stringify({ model: 'claude...', messages: [{role:'user',content:prompt}] }) })
      // 然后解析返回的JSON
      parseResponse: function(aiResponse) {
        try {
          var json = JSON.parse(aiResponse.trim());
          json.confidence = json.confidence || 'high';
          json.notes = 'AI提取（Claude Vision处理）';
          return json;
        } catch(e) {
          return regexExtract(ocrText); // 回退到正则
        }
      }
    };
  }

  // ==========================================================
  //  四、小程序端OCR流程封装
  //  在小程序页面中调用：
  //  1. wx.chooseImage → 获取图片
  //  2. wx.cloud.callFunction({ name: 'ocr', data: { image } }) → OCR
  //  3. PolicyExtractor.extract(ocrText, { mode: 'ai', ... }) → 提取
  // ==========================================================
  function miniappFlow() {
    return {
      step1_chooseImage: 'wx.chooseImage({ count:1, sourceType:["camera","album"] })',
      step2_ocr: 'wx.cloud.callFunction({ name:"ocrPolicy", data:{ fileID } }) → 返回 OCR 文字',
      step3_extract: 'PolicyExtractor.extract(ocrText, { mode:"ai", aiApiKey: config.key }) → 结构化JSON',
      step4_fillForm: '将提取的JSON字段填入保单表单，用户确认后保存'
    };
  }

  // ==========================================================
  //  导出
  // ==========================================================
  return {
    extract: extract,
    regexExtract: regexExtract,
    EXTRACTION_PROMPT: EXTRACTION_PROMPT,
    miniappFlow: miniappFlow,
    // === 模拟OCR文字（用于演示） ===
    getSampleOCRText: function() {
      return [
        '太平洋健康保险股份有限公司',
        '互联网个人长期B款医疗保险',
        '保单号：019422611361839',
        '被保险人：张三',
        '投保人：张三',
        '保障期间：2026-04-21 至 2027-04-20',
        '保险金额：一般医疗保险金200万元',
        '重大疾病医疗保险金400万元',
        '含质子重离子医疗保险金',
        '含恶性肿瘤院外特定药品费用（CAR-T）',
        '外购药保险金100万元',
        '免赔额：一般医疗1万元，重疾0免赔',
        '年缴保费：¥443.00',
        '续保条件：20年保证续保',
        '等待期：90天',
        '本保单为1年期，20年保证续保期间内每年续保',
        '深圳市医保局指导·深圳惠民保2026',
        '医保内住院300万·医保外住院300万·特药100万'
      ].join('\n');
    }
  };
})();

// Node.js 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PolicyExtractor;
}
