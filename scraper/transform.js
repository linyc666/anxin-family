// scraper/transform.js — 数据转换器
// 将抓取的原始数据转换为引擎标准产品格式
// 用法：node transform.js [input.json]

var fs = require('fs');
var path = require('path');

/** 将原始产品数据转换为标准格式 */
function transform(rawProduct) {
  var p = rawProduct;

  // 自动生成 ID
  var typeMap = {
    '百万医疗': 'med',
    '重疾险': 'ci',
    '意外险': 'acc',
    '定寿': 'term',
    '防癌险': 'cancer',
    '惠民保': 'hm'
  };

  var prefix = typeMap[p.type] || 'other';
  var companyAbbr = (p.company || 'unknown').replace(/[（(].*$/, '').substring(0, 4);
  var id = p.id || (prefix + '_' + companyAbbr + '_' + Date.now().toString(36));

  var product = {
    id: id,
    type: p.type || '百万医疗',
    name: p.name || '',
    company: p.company || '',
    companyRating: p.companyRating || 'B类',
    solvency: p.solvency || '—',
    prices: normalizePrices(p.prices || p.price),
    priceNoSocialFactor: parseFloat(p.priceNoSocialFactor) || 1.0,
    guaranteeYears: p.guaranteeYears !== undefined ? p.guaranteeYears : null,
    guaranteeType: p.guaranteeType || '1年期',
    coverage: p.coverage || '',
    deductible: p.deductible || '',
    waitingDays: parseInt(p.waitingDays) || 90,
    features: Array.isArray(p.features) ? p.features : [],
    ageRange: p.ageRange || '',
    healthCheck: p.healthCheck || '健康告知',
    healthStrictness: parseInt(p.healthStrictness) || 2,
    needSocialIns: p.needSocialIns === true,
    purchaseLink: p.purchaseLink || '',
    score: parseInt(p.score) || 80,
    active: p.active !== false,
    regionRestrict: p.regionRestrict || '',
    // 元数据
    source: p.source || 'manual',
    sourceUrl: p.sourceUrl || '',
    version: 1
  };

  return product;
}

/** 标准化价格数组 */
function normalizePrices(prices) {
  if (!prices) return [{ ageMin: 0, ageMax: 65, price: 500 }];

  // 如果是单个数字价格，转为默认年龄阶梯
  if (typeof prices === 'number') {
    return [{ ageMin: 0, ageMax: 65, price: prices }];
  }

  // 如果是数组，确保格式正确
  if (Array.isArray(prices) && prices.length > 0) {
    return prices.map(function(p) {
      return {
        ageMin: parseInt(p.ageMin) || 0,
        ageMax: parseInt(p.ageMax) || 65,
        price: parseInt(p.price) || 0
      };
    });
  }

  return [{ ageMin: 0, ageMax: 65, price: 500 }];
}

/** 批量转换 */
function transformBatch(rawProducts) {
  return rawProducts.map(transform);
}

// CLI
if (require.main === module) {
  var inputPath = process.argv[2] || path.join(__dirname, 'output', 'products.json');
  if (!fs.existsSync(inputPath)) {
    console.error('输入文件不存在:', inputPath);
    process.exit(1);
  }

  var rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  var items = Array.isArray(rawData) ? rawData : (rawData.products || rawData.data || [rawData]);
  var transformed = transformBatch(items);

  var outPath = path.join(__dirname, 'output', 'products-transformed.json');
  fs.writeFileSync(outPath, JSON.stringify(transformed, null, 2), 'utf8');
  console.log('已转换 ' + transformed.length + ' 款产品 → ' + outPath);
}

module.exports = { transform: transform, transformBatch: transformBatch };
