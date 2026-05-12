// scraper/sources/_template.js
// 数据源抓取模板 — 复制此文件创建新的数据源模块
// 每个数据源实现 scrape() 函数，返回产品数组

var axios = require('axios');
var cheerio = require('cheerio');

/**
 * 抓取数据源
 * @returns {Promise<Array>} 产品对象数组（未转换的原始格式）
 */
async function scrape() {
  var products = [];

  try {
    // TODO: 实现具体抓取逻辑
    // 示例：抓取网页
    // var res = await axios.get('https://example.com/products');
    // var $ = cheerio.load(res.data);
    // $('.product-item').each(function(i, el) { ... });
  } catch(e) {
    console.error('抓取失败:', e.message);
  }

  return products;
}

module.exports = {
  name: 'template',           // 数据源名称
  displayName: '模板数据源',   // 显示名称
  scrape: scrape,
  // 可选：数据源健康检查
  healthCheck: async function() {
    try {
      await axios.get('https://example.com', { timeout: 5000 });
      return true;
    } catch(e) { return false; }
  }
};
