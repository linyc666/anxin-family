// scraper/scrape-sources.js — 主调度器
// 运行所有数据源抓取，合并输出到 output/products.json
// 用法：node scrape-sources.js [--source=cbirc]

var fs = require('fs');
var path = require('path');

// 注册的数据源（在此添加新数据源）
var SOURCES = [
  // require('./sources/example-cbirc'),
  // 在此添加更多数据源：
  // require('./sources/taikang'),
  // require('./sources/pingan'),
];

/** 运行所有数据源 */
async function runAll(filter) {
  var allProducts = [];
  var results = {};

  console.log('=== 保险产品爬虫启动 ===');
  console.log('数据源数量:', SOURCES.length);
  console.log('');

  for (var i = 0; i < SOURCES.length; i++) {
    var source = SOURCES[i];

    if (filter && source.name !== filter) continue;

    console.log('[' + source.name + '] ' + source.displayName + ' — 开始...');
    try {
      // 健康检查
      if (source.healthCheck) {
        var healthy = await source.healthCheck();
        if (!healthy) {
          console.log('[' + source.name + '] 跳过（数据源不可用）');
          results[source.name] = { status: 'unavailable', count: 0 };
          continue;
        }
      }

      var products = await source.scrape();
      console.log('[' + source.name + '] 抓取到 ' + products.length + ' 款产品');

      // 标记数据来源
      products = products.map(function(p) {
        p.source = source.name;
        p.scrapeDate = new Date().toISOString();
        return p;
      });

      allProducts = allProducts.concat(products);
      results[source.name] = { status: 'ok', count: products.length };
    } catch(e) {
      console.error('[' + source.name + '] 错误:', e.message);
      results[source.name] = { status: 'error', error: e.message };
    }
  }

  console.log('');
  console.log('=== 抓取完成 ===');
  console.log('总产品数:', allProducts.length);

  // 输出文件
  if (allProducts.length > 0) {
    var outDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    var outPath = path.join(outDir, 'products.json');
    fs.writeFileSync(outPath, JSON.stringify(allProducts, null, 2), 'utf8');
    console.log('已输出到:', outPath);
  }

  // 输出摘要
  fs.writeFileSync(
    path.join(__dirname, 'output', 'scrape-summary.json'),
    JSON.stringify({
      date: new Date().toISOString(),
      totalProducts: allProducts.length,
      sources: results
    }, null, 2),
    'utf8'
  );

  return allProducts;
}

// CLI 入口
var filter = null;
var args = process.argv.slice(2);
args.forEach(function(arg) {
  var m = arg.match(/^--source=(.+)$/);
  if (m) filter = m[1];
});

runAll(filter).then(function() {
  console.log('完成。');
}).catch(function(e) {
  console.error('失败:', e);
  process.exit(1);
});
