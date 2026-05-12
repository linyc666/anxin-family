// cloudfunctions/extractPolicy/index.js
// 云函数：图片识别 + AI提取资料字段
// 调用链：接收图片fileID → 腾讯OCR → AI提取 → 返回结构化JSON
console.log('AI key configured:', !!(process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || process.env.CLAUDE_API_KEY));
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const axios = require('axios');

// Claude API 配置（建议放环境变量）
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || '';
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const MAX_DIRECT_DOCUMENT_BYTES = 28 * 1024 * 1024;

function buildMeta(opts) {
  return Object.assign({
    extractorVersion: '2026-05-10.2',
    extractedAt: new Date().toISOString()
  }, opts || {});
}

// 低文字量时的空数据模板
function emptyData(notes) {
  return {
    policyName: '', company: '', type: '', premium: 0,
    coverage: '', deductible: '', effectiveDate: '', expiryDate: '',
    guaranteeYears: '', insuredName: '', policyNo: '', features: '',
    confidence: 'low', notes: notes || ''
  };
}

function addExtractionNote(data, note) {
  data = data || {};
  if (note) data.extractionNote = note;
  return data;
}

// 从提取数据构建结构化 contentItems
function buildContentItems(extracted, ocrText) {
  extracted = extracted || {};
  var text = (ocrText || extracted.ocrText || '').toLowerCase();
  var items = [];
  // 额度类
  var cov = (extracted.coverage || '').toLowerCase();
  if (cov) {
    var m300 = cov.match(/(\d+)\s*万/g);
    if (m300 && m300.length >= 2) {
      items.push({ key: 'inpatientAmount', label: '住院相关额度', value: m300[0] + '，' + m300[1] });
    } else if (m300) {
      items.push({ key: 'mainAmount', label: '主要额度', value: m300[0] });
    }
    var proton = cov.match(/质子[^\d]*(\d+万)/i) || text.match(/质子[^\d]*(\d+万)/i);
    if (proton) items.push({ key: 'protonAmount', label: '专项额度', value: '质子重离子 ' + proton[1] });
    var drug = cov.match(/特[效药][^\d]*(\d+万)/i) || text.match(/特[效药][^\d]*(\d+万)/i);
    if (drug) items.push({ key: 'drugAmount', label: '特定药品额度', value: drug[1] });
  }
  // 费用边界
  var ded = extracted.deductible || '';
  if (ded) items.push({ key: 'deductible', label: '费用边界', value: ded });
  else if (text.match(/免赔[额金额]*[：:]*\s*(\d+)/)) {
    var dm = text.match(/免赔[额金额]*[：:]*\s*(\d+)/);
    items.push({ key: 'deductible', label: '费用边界', value: '免除金额 ' + dm[1] + '元/年' });
  }
  // 比例
  var ratio = text.match(/(\d+%)\s*[赔给付报销]/g);
  if (ratio) items.push({ key: 'ratio', label: '比例说明', value: ratio.join('，') });
  // 等待期
  var wait = text.match(/等待期[：:]*\s*(\d+)\s*天/g) || cov.match(/等待期[：:]*\s*(\d+)\s*天/g);
  if (wait) items.push({ key: 'waiting', label: '等待期', value: wait[0] });
  // 总限额
  var total = cov.match(/(\d+万).*限额/i) || text.match(/总[额限].*(\d+万)/i);
  if (total) items.push({ key: 'totalLimit', label: '总额度', value: total[1] });
  // 年龄
  var age = text.match(/[\d零一二三四五六七八九十]+[周]?岁[至\-~][\d零一二三四五六七八九十]+[周]?岁/);
  if (age) items.push({ key: 'ageRange', label: '年龄范围', value: age[0] });
  // 日期
  if (extracted.effectiveDate) items.push({ key: 'effectiveDate', label: '生效日期', value: extracted.effectiveDate });
  if (extracted.expiryDate) items.push({ key: 'expiryDate', label: '到期日期', value: extracted.expiryDate });
  // 延续
  if (extracted.guaranteeYears) items.push({ key: 'guarantee', label: '延续条件', value: extracted.guaranteeYears });
  // 年费
  if (extracted.premium) items.push({ key: 'premium', label: '年度支出', value: '¥' + extracted.premium + '/年' });

  return items;
}

function buildReviewItems(extracted) {
  var items = [];
  if (!extracted.deductible || String(extracted.deductible).trim() === '') items.push({ label: '费用边界', reason: '建议核对免除金额和自付比例' });
  if (!extracted.effectiveDate || !extracted.expiryDate) items.push({ label: '有效日期', reason: '建议核对生效和到期时间' });
  if (!extracted.guaranteeYears || String(extracted.guaranteeYears).trim() === '') items.push({ label: '延续条件', reason: '建议核对能否延续和延续时间' });
  if (!extracted.premium) items.push({ label: '年度支出', reason: '建议核对年度费用' });
  return items;
}

function getMediaTypeByExt(ext, fallback) {
  ext = String(ext || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return fallback || 'image/jpeg';
}

function pickTempFileURL(result, fileID) {
  var item = result && result.fileList && result.fileList[0];
  if (!item || item.status !== 0 || !item.tempFileURL) {
    throw new Error('无法获取临时文件链接: ' + (item && item.errMsg ? item.errMsg : fileID || 'unknown'));
  }
  return item.tempFileURL;
}

async function getTempURL(fileID) {
  var urlResult = await cloud.getTempFileURL({ fileList: [fileID] });
  return pickTempFileURL(urlResult, fileID);
}

async function extractFromTextAI(text) {
  if (DEEPSEEK_API_KEY) return callDeepSeekText(text);
  if (CLAUDE_API_KEY) return callClaudeText(text);
  return regexExtract(text);
}

function hasAnyAIKey() {
  return !!(DEEPSEEK_API_KEY || CLAUDE_API_KEY);
}

exports.main = async (event, context) => {
  var { fileID, fileIDs, fileType, fileName, mediaType, sourceType, text, isLongImage: isLongImageParam } = event;
  if (sourceType !== 'text' && !fileID && (!fileIDs || fileIDs.length === 0)) return { success: false, error: '缺少fileID' };

  try {
    if (sourceType === 'text') {
      var rawText = String(text || '').trim();
      if (!rawText) {
        return {
          success: true, partial: true,
          errorCode: 'TEXT_EMPTY',
          message: '请先输入需要整理的资料文字。',
          data: emptyData('未输入资料文字。'),
          contentItems: [], reviewItems: buildReviewItems({}),
          extractionMeta: buildMeta({ sourceType: 'text', textSource: 'manual_text', textLength: 0, errorCode: 'TEXT_EMPTY' })
        };
      }

      var textData;
      var textSource = hasAnyAIKey() ? (DEEPSEEK_API_KEY ? 'manual_text_deepseek' : 'manual_text_claude') : 'manual_text_regex';
      try {
        textData = await extractFromTextAI(rawText);
      } catch(textAiErr) {
        console.log('Manual text AI extraction failed:', textAiErr && textAiErr.message ? textAiErr.message : textAiErr);
        textData = addExtractionNote(regexExtract(rawText), '文字AI提取失败，已使用本地规则提取');
        textSource = 'manual_text_regex_ai_failed';
      }

      var textQuality = assessExtractionQuality(textData);
      var textContentItems = buildContentItems(textData, rawText);
      var textReviewItems = buildReviewItems(textData);
      var textMeta = buildMeta({
        sourceType: 'text',
        textSource: textSource,
        textLength: rawText.replace(/\s/g, '').length,
        qualityLevel: textQuality.level
      });

      if (textQuality.filled < 4) {
        return {
          success: true, partial: true,
          errorCode: 'TEXT_LOW_INFO',
          message: '这段文字里可提取的信息较少，已尽量整理，建议继续补充名称、来源、类别和日期。',
          data: textData, ocrText: rawText, contentItems: textContentItems, reviewItems: textReviewItems,
          quality: textQuality, extractionMeta: Object.assign(textMeta, { errorCode: 'TEXT_LOW_INFO' })
        };
      }

      return {
        success: true,
        data: textData,
        ocrText: rawText,
        contentItems: textContentItems,
        reviewItems: textReviewItems,
        quality: textQuality,
        extractionMeta: textMeta
      };
    }

    const ext = String(fileType || (fileName || '').split('.').pop() || '').toLowerCase();
    var isPDF = sourceType === 'pdf' || ext === 'pdf' || mediaType === 'application/pdf';

    // === 不支持的文件类型 ===
    if (!isPDF && sourceType !== 'image' && ext && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png' && ext !== 'webp') {
      return {
        success: true, partial: true,
        errorCode: 'FILE_UNSUPPORTED',
        message: '当前文件类型暂不支持识别，已保存附件。可尝试上传截图进行图片识别。',
        data: emptyData('文件类型暂不支持识别，请使用图片或PDF格式。'),
        contentItems: [], reviewItems: buildReviewItems({}),
        extractionMeta: buildMeta({ sourceType: sourceType || ext || 'file', textSource: 'unsupported', errorCode: 'FILE_UNSUPPORTED' })
      };
    }

    // === PDF 路径 ===
    if (isPDF) {
      try {
        var fileURL = await getTempURL(fileID);
        var pdfBuffer = await downloadBuffer(fileURL);
        var pdfTextResult = await extractPdfText(pdfBuffer);
        var pdfText = pdfTextResult.text || '';
        var pdfTextLen = pdfText.replace(/\s/g, '').length;
        var extractedData;
        var pdfTextSource = 'pdf_document';

        if (pdfTextLen >= 80 && hasAnyAIKey()) {
          try {
            extractedData = await extractFromTextAI(pdfText);
            pdfTextSource = DEEPSEEK_API_KEY ? 'pdf_text_deepseek' : 'pdf_text_claude';
          } catch(aiPdfErr) {
            console.log('PDF AI extraction failed:', aiPdfErr && aiPdfErr.message ? aiPdfErr.message : aiPdfErr);
            extractedData = addExtractionNote(regexExtract(pdfText), 'PDF AI提取失败，已使用本地规则提取');
            pdfTextSource = 'pdf_text_regex_ai_failed';
          }
        } else if (CLAUDE_API_KEY && pdfBuffer.length <= MAX_DIRECT_DOCUMENT_BYTES) {
          extractedData = await callClaudeDocumentBuffer(pdfBuffer, 'application/pdf');
        } else if (pdfTextLen > 0) {
          extractedData = addExtractionNote(regexExtract(pdfText), 'AI不可用或文件较大，已使用本地规则提取');
          pdfTextSource = hasAnyAIKey() ? 'pdf_text_regex_size_limit' : 'pdf_text_regex_no_api_key';
        } else if (!CLAUDE_API_KEY) {
          return {
            success: true, partial: true,
            errorCode: 'PDF_NO_API_KEY',
            message: 'PDF没有可直接复制的文字。DeepSeek当前链路不能直接读取扫描版PDF，文件已保存，可上传关键页截图识别。',
            data: emptyData('扫描版PDF请上传关键页截图，或改配支持文档视觉解析的模型。'),
            contentItems: [], reviewItems: buildReviewItems({}),
            extractionMeta: buildMeta({ sourceType: 'pdf', textSource: 'none', errorCode: 'PDF_NO_API_KEY' })
          };
        } else {
          return {
            success: true, partial: true,
            errorCode: 'PDF_TOO_LARGE',
            message: 'PDF文件较大，暂不直接送入AI解析。文件已保存，建议上传关键页截图或压缩后重试。',
            data: emptyData('PDF文件较大，建议上传关键页截图或压缩后重试。'),
            contentItems: [], reviewItems: buildReviewItems({}),
            extractionMeta: buildMeta({ sourceType: 'pdf', textSource: 'size_limit', errorCode: 'PDF_TOO_LARGE' })
          };
        }

        // 检查 PDF 提取结果的完整度
        var pdfQuality = assessExtractionQuality(extractedData);
        var pdfMeta = buildMeta({
          sourceType: 'pdf',
          textSource: pdfTextSource,
          textLength: pdfTextLen,
          pageCount: pdfTextResult.pageCount || 0,
          qualityLevel: pdfQuality.level
        });
        var pdfContentItems = buildContentItems(extractedData, pdfText);
        var pdfReviewItems = buildReviewItems(extractedData);
        if (pdfQuality.filled === 0) {
          return {
            success: true, partial: true,
            errorCode: 'PDF_NO_TEXT',
            message: 'PDF未解析出有效文字，可能是扫描件图片。已保存附件，建议上传关键页截图进行图片识别。',
            data: emptyData('PDF未解析出有效文字，可能是扫描件。建议上传关键页截图或手动填写。'),
            contentItems: [], reviewItems: pdfReviewItems, quality: pdfQuality,
            extractionMeta: Object.assign(pdfMeta, { errorCode: 'PDF_NO_TEXT' })
          };
        }
        if (pdfQuality.filled < 4) {
          return {
            success: true, partial: true,
            errorCode: 'PDF_LOW_TEXT',
            message: 'PDF中识别到的信息较少，部分字段已自动填入。建议核对并补充剩余字段。',
            data: extractedData, contentItems: pdfContentItems, reviewItems: pdfReviewItems, quality: pdfQuality,
            extractionMeta: Object.assign(pdfMeta, { errorCode: 'PDF_LOW_TEXT' })
          };
        }
        return { success: true, data: extractedData, contentItems: pdfContentItems, reviewItems: pdfReviewItems, quality: pdfQuality, extractionMeta: pdfMeta };
      } catch (pdfErr) {
        return {
          success: true, partial: true,
          errorCode: 'PDF_PARSE_ERROR',
          message: 'PDF解析失败。文件已保存为附件，建议上传关键页截图进行图片识别，或手动补充字段。',
          data: emptyData('PDF解析失败：' + (pdfErr.message || '')),
          contentItems: [], reviewItems: buildReviewItems({}),
          extractionMeta: buildMeta({ sourceType: 'pdf', textSource: 'parse_error', errorCode: 'PDF_PARSE_ERROR' })
        };
      }
    }

    // === 图片路径 ===
    // 支持 fileIDs[] 长图切块识别
    var imageIDs = fileIDs && fileIDs.length > 0 ? fileIDs.slice() : [fileID];
    // 长图切块如果 OCR 全失败，原图常常还能被腾讯 OCR 识别；把原图追加为兜底。
    if (fileID && imageIDs.indexOf(fileID) === -1) imageIDs.push(fileID);
    var allOcrTexts = [];
    var allImageURLs = [];
    var ocrError = null;
    var segSuccess = 0;
    var segFailed = 0;

    for (var i = 0; i < imageIDs.length; i++) {
      try {
        var imgURL = await getTempURL(imageIDs[i]);
        allImageURLs.push(imgURL);
        var ocrSeg = await recognizeImageText(imgURL);
        var segText = normalizeOcrText(ocrSeg);
        if (segText && segText.trim()) {
          allOcrTexts.push('【第' + (i + 1) + '段】\n' + segText);
          segSuccess++;
        } else {
          segFailed++;
        }
      } catch(segErr) {
        ocrError = segErr.message;
        segFailed++;
      }
    }

    var ocrText = allOcrTexts.join('\n');
    var firstImageURL = allImageURLs && allImageURLs.length > 0 ? allImageURLs[0] : null;
    var isLongImage = isLongImageParam || imageIDs.length > 1;

    // === 图片提取策略 ===
    // OCR 失败或文字少时，不要直接放弃，按优先级尝试：
    // 1. Claude Vision（单图，有 API Key）
    // 2. Claude Text（有 OCR 文字，有 API Key）
    // 3. regexExtract（本地兜底，永远可用）

    var textLen = (ocrText || '').replace(/\s/g, '').length;
    var imgErrorCode = '';
    var imgPartial = false;

    var extractedData = null;
    var textSource = 'ocr_text';

    // 策略选择
    if (CLAUDE_API_KEY && firstImageURL && !isLongImage) {
      // 单图优先用 Claude Vision（不受 OCR 质量影响）
      try {
        extractedData = await callClaudeVision(firstImageURL, getMediaTypeByExt(ext, mediaType || 'image/jpeg'));
        textSource = 'vision';
      } catch(visionErr) {
        // Vision 失败，回退到 OCR 文字或正则
        if (ocrText && textLen >= 40) {
          try {
            extractedData = await callClaudeText(ocrText);
            textSource = 'ocr_text_fallback';
          } catch(textErr) {
            extractedData = addExtractionNote(regexExtract(ocrText), 'Claude文本提取失败，已使用本地规则提取');
            imgPartial = true;
            textSource = 'regex_fallback';
          }
        } else if (ocrText && textLen > 0) {
          extractedData = addExtractionNote(regexExtract(ocrText), '视觉识别失败，已使用本地规则提取');
          imgPartial = true;
          textSource = 'regex_fallback';
        } else {
          extractedData = emptyData('Vision和OCR均未获取到有效内容。');
          imgErrorCode = 'VISION_FAILED';
          imgPartial = true;
        }
      }
    } else if (hasAnyAIKey() && ocrText && textLen > 0) {
      // 多图/长图或无单图URL：从合并 OCR 文本提取
      try {
        extractedData = await extractFromTextAI(ocrText);
        textSource = DEEPSEEK_API_KEY ? 'ocr_text_deepseek' : 'ocr_text_claude';
      } catch(textErr) {
        console.log('AI text extraction failed:', textErr && textErr.message ? textErr.message : textErr);
        extractedData = addExtractionNote(regexExtract(ocrText), 'AI文本提取失败，已使用本地规则提取');
        imgPartial = true;
        textSource = 'regex_fallback';
      }
    } else if (ocrText && textLen > 0) {
      // 无 API Key：正则提取
      extractedData = addExtractionNote(regexExtract(ocrText), '未配置AI Key，已使用本地规则提取');
      textSource = 'regex';
      if (textLen < 40) imgPartial = true;
    } else {
      // OCR 完全失败且无可用视觉模型
      extractedData = regexExtract(ocrText);
      textSource = 'regex_only';
      imgErrorCode = 'OCR_FAILED';
      imgPartial = true;
    }

    var quality = assessExtractionQuality(extractedData);
    var contentItems = buildContentItems(extractedData, ocrText);
    var reviewItems = buildReviewItems(extractedData);

    if (imgPartial || quality.filled < 4) {
      var errCode = imgErrorCode || (textLen < 10 ? 'LOW_TEXT' : '');
      var partialMessage = errCode === 'OCR_FAILED'
        ? '图片文字识别未拿到有效内容，附件已保存。请检查腾讯OCR权限，或上传更清晰的关键页截图。'
        : '已尝试整理图片内容，部分字段建议核对补充。附件已保存。';
      return {
        success: true, partial: true,
        errorCode: errCode,
        message: partialMessage,
        data: extractedData, ocrText: ocrText, quality: quality,
        contentItems: contentItems, reviewItems: reviewItems,
        segmentSuccessCount: segSuccess, segmentFailedCount: segFailed,
        extractionMeta: buildMeta({
          sourceType: 'image', textSource: textSource, textLength: textLen,
          segmentSuccessCount: segSuccess, segmentFailedCount: segFailed,
          qualityLevel: quality.level, errorCode: errCode
        })
      };
    }

    return {
      success: true,
      ocrText: ocrText,
      data: extractedData,
      contentItems: contentItems,
      reviewItems: reviewItems,
      quality: quality,
      longImage: isLongImage || undefined,
      longImageSegments: isLongImage ? imageIDs.length : undefined,
      segmentSuccessCount: segSuccess,
      segmentFailedCount: segFailed,
      extractionMeta: buildMeta({
        sourceType: 'image', textSource: textSource, textLength: textLen,
        segmentSuccessCount: segSuccess,
        segmentFailedCount: segFailed,
        qualityLevel: quality.level,
        longImage: isLongImage || false
      })
    };
  } catch (err) {
    return {
      success: true, partial: true,
      errorCode: 'UNKNOWN_ERROR',
      message: '识别过程出现异常，文件已保存为附件。请手动补充字段。',
      data: emptyData('识别异常：' + (err.message || '')),
      contentItems: [], reviewItems: buildReviewItems({}),
      extractionMeta: buildMeta({ sourceType: sourceType || '', textSource: 'unknown_error', errorCode: 'UNKNOWN_ERROR' })
    };
  }
};

// 评估提取质量：计算已填充字段数/总字段数
var EXTRACTION_FIELDS = ['policyName', 'company', 'type', 'premium', 'coverage', 'deductible', 'effectiveDate', 'expiryDate', 'guaranteeYears', 'insuredName', 'policyNo'];
function assessExtractionQuality(data) {
  data = data || {};
  var total = EXTRACTION_FIELDS.length;
  var filled = 0;
  var fieldStatus = {};
  EXTRACTION_FIELDS.forEach(function(f) {
    var v = data[f];
    var isFilled = v !== undefined && v !== null && String(v).trim().length > 0 && v !== 0;
    if (isFilled) filled++;
    fieldStatus[f] = isFilled ? 'extracted' : 'missing';
  });
  return {
    filled: filled,
    total: total,
    level: filled >= 7 ? 'high' : filled >= 4 ? 'partial' : 'low',
    fieldStatus: fieldStatus
  };
}

async function recognizeImageText(imgURL) {
  try {
    return await cloud.openapi.ocr.printedText({ imgUrl: imgURL });
  } catch(e) {
    console.log('Tencent OCR failed:', e && (e.errMsg || e.message || JSON.stringify(e)));
  }
  try {
    return await callBaiduOCR(imgURL);
  } catch(e2) {
    console.log('Fallback OCR failed:', e2 && (e2.errMsg || e2.message || JSON.stringify(e2)));
    return null;
  }
}

function normalizeOcrText(ocrSeg) {
  if (!ocrSeg) return '';
  if (ocrSeg.items && Array.isArray(ocrSeg.items)) {
    return ocrSeg.items.map(function(item) {
      return item.text || item.itemstring || item.words || '';
    }).filter(Boolean).join('\n');
  }
  if (ocrSeg.words_result && Array.isArray(ocrSeg.words_result)) {
    return ocrSeg.words_result.map(function(item) {
      return item.words || '';
    }).filter(Boolean).join('\n');
  }
  if (ocrSeg.text) return String(ocrSeg.text);
  return '';
}

// ========== Claude Vision 直接看图提取 ==========
async function callClaudeVision(imageURL, explicitMediaType) {
  // 下载图片转base64
  const response = await axios.get(imageURL, { responseType: 'arraybuffer' });
  const base64 = Buffer.from(response.data).toString('base64');
  const headerType = String(response.headers['content-type'] || '').split(';')[0];
  const mediaType = /^image\//.test(headerType) ? headerType : (explicitMediaType || 'image/jpeg');

  const data = await callClaudeMessages({
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 }
        },
        {
          type: 'text',
          text: '请从资料截图中整理家庭资料记录信息，只做资料整理，不提供购买建议。输出JSON，不确定字段留空。\n'+
            '{\n'+
            '  "policyName":"原文名称","company":"机构","type":"医疗支出/意外风险/大额支出/家庭责任/健康专项/城市补充/车辆资料/房屋资料/家财资料/其他",\n'+
            '  "premium":年度支出数字,"coverage":"额度摘要","deductible":"费用边界",\n'+
            '  "effectiveDate":"YYYY-MM-DD","expiryDate":"YYYY-MM-DD","guaranteeYears":"延续条件",\n'+
            '  "insuredName":"姓名","policyNo":"编号",\n'+
            '  "coreSummary":"一行概括核心内容，如：医保内住院300万·医保外住院300万·特药100万",\n'+
            '  "contentGroups":[{"title":"住院医疗","items":[{"label":"医保内住院","value":"300万"}]}],\n'+
            '  "boundaryItems":[{"label":"免除金额","value":"2万/年"}],\n'+
            '  "reviewItems":[{"label":"医院范围","reason":"建议核对"}],\n'+
            '  "confidence":"high/medium/low"\n'+
            '}\n规则：医疗类重点提取住院、特药、质重、免除金额、比例、等待期。意外类提取身故伤残、猝死、医疗、交通、津贴。大额支出提取重疾额度、轻中症、等待期、期限。家庭责任提取身故全残、猝死、期限、支出、健康要求。不输出推荐/购买建议/性价比/行业第一/通过率高等销售判断。'
        }
      ]
    }]
  });

  const text = getClaudeText(data);
  // 提取JSON（去掉可能的markdown包裹）
  return parseClaudeJSON(text);
}

// ========== Claude 文本提取（长图/多图合并后用） ==========
async function callClaudeText(ocrText) {
  var data = await callClaudeMessages({
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: '请从资料原文中整理家庭资料记录信息，只做资料整理，不提供购买建议。输出JSON，不确定的字段留空。\n' +
        '{\n' +
        '  "policyName": "原文资料名称",\n' +
        '  "company": "机构/来源",\n' +
        '  "type": "医疗支出/意外风险/大额支出/家庭责任/健康专项/城市补充/车辆资料/房屋资料/家财资料/其他",\n' +
        '  "premium": 年度支出金额数字,\n' +
        '  "coverage": "整体额度和范围摘要",\n' +
        '  "deductible": "免除金额、自付比例、费用边界",\n' +
        '  "effectiveDate": "YYYY-MM-DD",\n' +
        '  "expiryDate": "YYYY-MM-DD",\n' +
        '  "guaranteeYears": "延续/期限条件",\n' +
        '  "insuredName": "姓名",\n' +
        '  "policyNo": "资料编号",\n' +
        '  "coreSummary": "用一行短句概括核心内容，例如：医保内住院300万 · 医保外住院300万 · 特药100万",\n' +
        '  "contentGroups": [{"title":"住院医疗","items":[{"label":"医保内住院","value":"300万"}]}],\n' +
        '  "boundaryItems": [{"label":"免除金额","value":"2万/年"},{"label":"等待期","value":"30天"}],\n' +
        '  "reviewItems": [{"label":"医院范围","reason":"建议核对是否限制医院类型"}],\n' +
        '  "confidence": "high/medium/low"\n' +
        '}\n' +
        '规则：医疗类重点提取住院、特药、质子重离子、免除金额、比例、等待期。\n' +
        '意外类重点提取身故/伤残、猝死、意外医疗、交通场景、津贴。\n' +
        '大额支出类重点提取重疾额度、轻/中症、特定疾病、等待期、责任期限。\n' +
        '家庭责任类重点提取身故/全残、猝死、责任期限、年度支出、健康要求。\n' +
        '不要输出推荐、购买建议、性价比、行业第一、通过率高等销售判断。\n\n' +
        'OCR文本：\n' + ocrText
    }]
  });
  return parseClaudeJSON(getClaudeText(data));
}

async function downloadBuffer(fileURL) {
  const response = await axios.get(fileURL, { responseType: 'arraybuffer', timeout: 20000 });
  return Buffer.from(response.data);
}

async function extractPdfText(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(buffer);
    return {
      text: parsed && parsed.text ? parsed.text : '',
      pageCount: parsed && parsed.numpages ? parsed.numpages : 0
    };
  } catch (e) {
    return { text: '', pageCount: 0, error: e.message || String(e) };
  }
}

// ========== Claude PDF 文档提取 ==========
async function callClaudeDocument(fileURL, mediaType) {
  var buffer = await downloadBuffer(fileURL);
  return callClaudeDocumentBuffer(buffer, mediaType);
}

async function callClaudeDocumentBuffer(buffer, mediaType) {
  const base64 = Buffer.from(buffer).toString('base64');

  const data = await callClaudeMessages({
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: mediaType || 'application/pdf', data: base64 }
        },
        {
          type: 'text',
          text: '请从PDF资料中整理家庭资料记录信息，只做资料整理，不提供购买建议。输出JSON，不确定字段留空。\n' +
            '{\n' +
            '  "policyName":"原文名称","company":"机构","type":"医疗支出/意外风险/大额支出/家庭责任/健康专项/城市补充/车辆资料/房屋资料/家财资料/其他",\n' +
            '  "premium":年度支出数字,"coverage":"额度摘要","deductible":"费用边界",\n' +
            '  "effectiveDate":"YYYY-MM-DD","expiryDate":"YYYY-MM-DD","guaranteeYears":"延续条件",\n' +
            '  "insuredName":"姓名","policyNo":"编号",\n' +
            '  "coreSummary":"一行概括核心内容",\n' +
            '  "contentGroups":[{"title":"住院医疗","items":[{"label":"医保内住院","value":"300万"}]}],\n' +
            '  "boundaryItems":[{"label":"免除金额","value":"2万/年"}],\n' +
            '  "reviewItems":[{"label":"医院范围","reason":"建议核对"}],\n' +
            '  "confidence":"high/medium/low"\n' +
            '}\n规则：医疗类提取住院、特药、质重、免除金额、比例、等待期。意外类提取身故伤残、猝死、医疗、交通、津贴。大额支出提取重疾额度、轻中症、等待期、期限。家庭责任提取身故全残、期限、支出、健康要求。不输出推荐/购买建议/性价比等销售判断。'
        }
      ]
    }]
  });

  return parseClaudeJSON(getClaudeText(data));
}

async function callClaudeMessages(payload) {
  try {
    var response = await axios.post(CLAUDE_API_URL, Object.assign({ model: CLAUDE_MODEL }, payload), {
      timeout: 45000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    if (!response.data || response.data.error) {
      throw new Error(response.data && response.data.error ? response.data.error.message : 'Claude返回为空');
    }
    return response.data;
  } catch(e) {
    var msg = e && e.response && e.response.data && e.response.data.error
      ? e.response.data.error.message
      : (e.message || 'Claude调用失败');
    throw new Error('Claude调用失败：' + msg);
  }
}

function getClaudeText(data) {
  var content = data && data.content ? data.content : [];
  for (var i = 0; i < content.length; i++) {
    if (content[i] && content[i].type === 'text' && content[i].text) return content[i].text;
  }
  return '';
}

function parseClaudeJSON(text) {
  text = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  var jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { error: 'JSON解析失败', raw: text };
  try {
    return JSON.parse(jsonMatch[0]);
  } catch(e) {
    return { error: 'JSON解析失败', raw: text };
  }
}

async function callDeepSeekText(ocrText) {
  var prompt = '请从资料原文中整理家庭资料记录信息，只做资料整理，不提供购买建议。输出JSON，不确定的字段留空。\n' +
    '{\n' +
    '  "policyName": "原文资料名称",\n' +
    '  "company": "机构/来源",\n' +
    '  "type": "医疗支出/意外风险/大额支出/家庭责任/健康专项/城市补充/车辆资料/房屋资料/家财资料/其他",\n' +
    '  "premium": 年度支出金额数字,\n' +
    '  "coverage": "整体额度和范围摘要",\n' +
    '  "deductible": "免除金额、自付比例、费用边界",\n' +
    '  "effectiveDate": "YYYY-MM-DD",\n' +
    '  "expiryDate": "YYYY-MM-DD",\n' +
    '  "guaranteeYears": "延续/期限条件",\n' +
    '  "insuredName": "姓名",\n' +
    '  "policyNo": "资料编号",\n' +
    '  "coreSummary": "用一行短句概括核心内容，例如：医保内住院300万 · 医保外住院300万 · 特药100万",\n' +
    '  "contentGroups": [{"title":"住院医疗","items":[{"label":"医保内住院","value":"300万"}]}],\n' +
    '  "boundaryItems": [{"label":"免除金额","value":"2万/年"},{"label":"等待期","value":"30天"}],\n' +
    '  "reviewItems": [{"label":"医院范围","reason":"建议核对是否限制医院类型"}],\n' +
    '  "confidence": "high/medium/low"\n' +
    '}\n' +
    '规则：医疗类重点提取住院、特药、质子重离子、免除金额、比例、等待期。\n' +
    '意外类重点提取身故/伤残、猝死、意外医疗、交通场景、津贴。\n' +
    '大额支出类重点提取重疾额度、轻/中症、特定疾病、等待期、责任期限。\n' +
    '家庭责任类重点提取身故/全残、猝死、责任期限、年度支出、健康要求。\n' +
    '不要输出推荐、购买建议、性价比、行业第一、通过率高等销售判断。\n\n' +
    '资料原文：\n' + ocrText;

  try {
    var response = await axios.post(DEEPSEEK_API_URL, {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: '你是严谨的信息抽取助手。只输出合法JSON，不输出Markdown。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    }, {
      timeout: 45000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
      }
    });
    var text = response.data &&
      response.data.choices &&
      response.data.choices[0] &&
      response.data.choices[0].message
      ? response.data.choices[0].message.content
      : '';
    return parseClaudeJSON(text);
  } catch(e) {
    var msg = e && e.response && e.response.data && e.response.data.error
      ? (e.response.data.error.message || JSON.stringify(e.response.data.error))
      : (e.message || 'DeepSeek调用失败');
    throw new Error('DeepSeek调用失败：' + msg);
  }
}

// ========== 正则回退提取（内联） ==========
function regexExtract(ocrText) {
  var result = {
    policyName: '', company: '', type: '', premium: 0,
    coverage: '', deductible: '', effectiveDate: '', expiryDate: '',
    guaranteeYears: '', insuredName: '', policyNo: '', features: '',
    confidence: 'low', notes: ''
  };
  var text = ocrText || '';

  // 机构识别
  var companyMap = [
    { pattern: /太平洋健康|太平洋保险|太保/g, name: '太平洋健康' },
    { pattern: /人保健康|中国人民健康/g, name: '人保健康' },
    { pattern: /人保财险|中国人保财险/g, name: '人保财险' },
    { pattern: /平安产险|中国平安|平安保险/g, name: '平安产险' },
    { pattern: /中国人寿|国寿/g, name: '中国人寿' },
    { pattern: /众安保险|众安在线/g, name: '众安保险' },
    { pattern: /华贵人寿/g, name: '华贵人寿' }
  ];
  companyMap.forEach(function(c) {
    if (c.pattern.test(text) && !result.company) result.company = c.name;
  });

  // 类别识别
  if (/百万医疗|住院医疗|医疗保险|长期医疗/g.test(text)) result.type = '百万医疗';
  else if (/意外险|意外伤害|综合意外/g.test(text)) result.type = '意外险';
  else if (/重疾险|重大疾病/g.test(text)) result.type = '重疾险';
  else if (/定期寿险|定寿|寿险/g.test(text)) result.type = '定寿';
  else if (/防癌|癌症医疗/g.test(text)) result.type = '防癌险';
  else if (/惠民保|补充医疗/g.test(text)) result.type = '惠民保';

  // 年度支出
  var premiumMatch = text.match(/[¥￥]\s*([\d,]+)/) || text.match(/(\d{2,4})[\s]*[元/年]/);
  if (premiumMatch) result.premium = parseInt(premiumMatch[1].replace(/,/g, '')) || 0;

  // 额度/范围
  var coverageMatch = text.match(/[额度保额][：:]\s*([^\n，,]+)/) || text.match(/(\d+万[^\n，,]*)/);
  if (coverageMatch) result.coverage = coverageMatch[1].trim();

  // 日期
  var dateMatch = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g);
  if (dateMatch && dateMatch.length >= 2) {
    result.effectiveDate = dateMatch[0].replace(/\//g, '-');
    result.expiryDate = dateMatch[1].replace(/\//g, '-');
  } else if (dateMatch && dateMatch.length === 1) {
    result.effectiveDate = dateMatch[0].replace(/\//g, '-');
  }

  // 编号
  var noMatch = text.match(/[编号保单]号[：:]\s*(\w+)/) || text.match(/(\d{15,20})/);
  if (noMatch) result.policyNo = noMatch[1];

  // 姓名
  var nameMatch = text.match(/[被投保]人[：:]\s*([^\n，,]+)/);
  if (nameMatch) result.insuredName = nameMatch[1].trim();

  return result;
}

// ========== 百度OCR回退 ==========
async function callBaiduOCR(imageURL) {
  // 百度OCR API调用（需申请API Key）
  // POST https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=XXX
  // Body: { url: imageURL }
  // 返回: { words_result: [{ words: "..." }] }
  return { items: [] };
}
