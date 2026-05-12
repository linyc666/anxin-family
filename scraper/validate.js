// scraper/validate.js — 产品数据校验器
// 验证产品数据完整性和一致性
// 用法：node validate.js [products.json]

var fs = require('fs');
var path = require('path');

var VALID_TYPES = ['百万医疗', '重疾险', '意外险', '定寿', '防癌险', '惠民保'];
var VALID_RATINGS = ['AA', 'A类', 'B+类', 'B类', '政府指导', '—'];

/** 校验单个产品 */
function validateProduct(product, index) {
  var errors = [];
  var warnings = [];

  // 必填字段检查
  if (!product.name) errors.push('缺少产品名称');
  if (!product.company) errors.push('缺少保险公司');
  if (!product.type || VALID_TYPES.indexOf(product.type) === -1) {
    errors.push('险种类型无效: ' + product.type);
  }
  if (!product.guaranteeType) errors.push('缺少续保类型');
  if (!product.coverage) errors.push('缺少保额描述');

  // 价格检查
  if (!product.prices || !Array.isArray(product.prices) || product.prices.length === 0) {
    errors.push('缺少价格数据');
  } else {
    product.prices.forEach(function(price, i) {
      if (price.ageMin === undefined || price.ageMax === undefined || !price.price) {
        errors.push('价格阶梯 ' + i + ' 数据不完整');
      }
      if (price.ageMin > price.ageMax) {
        errors.push('价格阶梯 ' + i + ' 年龄范围无效');
      }
    });
  }

  // 数值检查
  if (product.score !== undefined && (product.score < 0 || product.score > 100)) {
    warnings.push('评分超出 0-100 范围: ' + product.score);
  }
  if (product.healthStrictness !== undefined && (product.healthStrictness < 1 || product.healthStrictness > 3)) {
    warnings.push('健告严格度应为 1-3: ' + product.healthStrictness);
  }
  if (product.waitingDays !== undefined && product.waitingDays < 0) {
    warnings.push('等待期不能为负数');
  }

  // 评级检查
  if (product.companyRating && VALID_RATINGS.indexOf(product.companyRating) === -1) {
    warnings.push('未知公司评级: ' + product.companyRating);
  }

  // 惠民保特殊检查
  if (product.type === '惠民保' && !product.regionRestrict) {
    warnings.push('惠民保缺少地区限制（regionRestrict）');
  }

  return {
    index: index,
    name: product.name || '(无名)',
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/** 批量校验 */
function validateBatch(products) {
  var results = products.map(validateProduct);
  return {
    total: results.length,
    valid: results.filter(function(r) { return r.valid; }).length,
    invalid: results.filter(function(r) { return !r.valid; }).length,
    withWarnings: results.filter(function(r) { return r.warnings.length > 0; }).length,
    results: results
  };
}

// CLI
if (require.main === module) {
  var inputPath = process.argv[2] || path.join(__dirname, 'output', 'products-transformed.json');
  if (!fs.existsSync(inputPath)) {
    console.error('输入文件不存在:', inputPath);
    process.exit(1);
  }

  var data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  var products = Array.isArray(data) ? data : (data.products || data.data || [data]);
  var report = validateBatch(products);

  console.log('=== 校验报告 ===');
  console.log('总计:', report.total);
  console.log('有效:', report.valid);
  console.log('无效:', report.invalid);
  console.log('有警告:', report.withWarnings);
  console.log('');

  report.results.forEach(function(r) {
    if (r.errors.length > 0) {
      console.log('✗ [' + r.index + '] ' + r.name);
      r.errors.forEach(function(e) { console.log('  错误: ' + e); });
    }
    if (r.warnings.length > 0) {
      console.log('⚠ [' + r.index + '] ' + r.name);
      r.warnings.forEach(function(w) { console.log('  警告: ' + w); });
    }
  });

  // 输出报告
  var reportPath = path.join(__dirname, 'output', 'validate-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n报告已保存到:', reportPath);

  if (report.invalid > 0) process.exit(1);
}

module.exports = { validateProduct: validateProduct, validateBatch: validateBatch };
