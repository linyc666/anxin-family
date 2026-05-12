// scraper/upload-cloudbase.js — 云数据库直传工具
// 使用 CloudBase Admin SDK 直接写入 products 集合
// 用法：node upload-cloudbase.js [products-transformed.json]
// 前提：已配置 CLOUDBASE_ENV_ID 和 CLOUDBASE_SECRET_KEY 环境变量

var fs = require('fs');
var path = require('path');
var transform = require('./transform');
var validate = require('./validate');

/** 使用 HTTP API 方式上传（无需 Admin SDK，通过云函数转发） */
async function uploadViaCloudFunction(products) {
  var https = require('https');
  var cfUrl = process.env.CF_TRIGGER_URL;

  if (!cfUrl) {
    console.log('未配置 CF_TRIGGER_URL，输出 JSON 文件供手动导入');
    return uploadAsFile(products);
  }

  // 通过云函数 HTTP 触发器上传
  var batchSize = 50;
  var results = { created: 0, updated: 0, skipped: 0, failed: 0 };

  for (var i = 0; i < products.length; i += batchSize) {
    var batch = products.slice(i, i + batchSize);
    try {
      var data = JSON.stringify({ action: 'bulkCreate', products: batch });
      var result = await httpPost(cfUrl, data);
      if (result.success) {
        results.created += result.data.created || 0;
        results.skipped += result.data.skipped || 0;
      }
      console.log('批次 ' + Math.floor(i / batchSize + 1) + ': 已处理 ' + batch.length + ' 款');
    } catch(e) {
      console.error('批次 ' + Math.floor(i / batchSize + 1) + ' 失败:', e.message);
      results.failed += batch.length;
    }
  }

  return results;
}

function httpPost(url, data) {
  return new Promise(function(resolve, reject) {
    var urlObj = new URL(url);
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error('Invalid response')); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/** 输出为文件，用于手动导入 */
function uploadAsFile(products) {
  var outPath = path.join(__dirname, 'output', 'products-for-import.json');
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2), 'utf8');
  console.log('已输出到: ' + outPath);
  console.log('请在管理端 → 导入 → 选择此文件或粘贴内容');
  console.log('共 ' + products.length + ' 款产品');
  return { created: products.length, file: outPath };
}

// CLI
if (require.main === module) {
  var inputPath = process.argv[2] || path.join(__dirname, 'output', 'products-transformed.json');
  if (!fs.existsSync(inputPath)) {
    // 尝试原始抓取数据
    inputPath = path.join(__dirname, 'output', 'products.json');
    if (!fs.existsSync(inputPath)) {
      console.error('没有找到产品数据文件。请先运行：');
      console.error('  node scrape-sources.js');
      console.error('  node transform.js');
      process.exit(1);
    }
  }

  var data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  var products = Array.isArray(data) ? data : (data.products || data.data || [data]);

  // 先校验
  var report = validate.validateBatch(products);
  console.log('=== 上传前校验 ===');
  console.log('总计: ' + report.total + ', 有效: ' + report.valid + ', 无效: ' + report.invalid);

  if (report.invalid > 0) {
    console.log('存在无效产品，仅上传有效数据...');
    products = products.filter(function(p, i) {
      return report.results[i] && report.results[i].valid;
    });
  }

  if (products.length === 0) {
    console.error('没有可上传的有效产品');
    process.exit(1);
  }

  console.log('准备上传 ' + products.length + ' 款产品...');
  uploadViaCloudFunction(products).then(function(results) {
    console.log('上传完成:', JSON.stringify(results, null, 2));
  }).catch(function(e) {
    console.error('上传失败:', e.message);
    // 降级为文件输出
    uploadAsFile(products);
  });
}

module.exports = { uploadViaCloudFunction: uploadViaCloudFunction };
