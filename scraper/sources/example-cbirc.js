// scraper/sources/example-cbirc.js
// 银保监人身保险产品信息库示例（公开备案数据）
// 数据来源：人身保险产品信息库（公开查询）
// 说明：此为框架示例，实际抓取需根据目标网站结构调整选择器

var axios = require('axios');
var cheerio = require('cheerio');

async function scrape() {
  var products = [];

  // 示例：抓取场景
  // 实际使用需要根据目标网站的 HTML 结构调整以下选择器

  try {
    // CBIRC 产品库是公开信息，所有备案的人身保险产品均可查询
    // URL 和选择器需根据实际访问页面调整
    console.log('[cbirc] 开始抓取...');

    // var res = await axios.get('https://...', {
    //   headers: { 'User-Agent': 'Mozilla/5.0...' }
    // });
    // var $ = cheerio.load(res.data);
    //
    // $('.product-row').each(function(i, el) {
    //   var name = $(el).find('.product-name').text().trim();
    //   var company = $(el).find('.company').text().trim();
    //   var type = $(el).find('.insurance-type').text().trim();
    //
    //   products.push({
    //     name: name,
    //     company: company,
    //     type: normalizeType(type),
    //     source: 'cbirc',
    //     scrapeDate: new Date().toISOString()
    //   });
    // });

    console.log('[cbirc] 抓取完成（框架就绪，待配置 URL 和选择器）');
  } catch(e) {
    console.error('[cbirc] 抓取失败:', e.message);
  }

  return products;
}

/** 将备案险种名称标准化为引擎识别的 6 种类型 */
function normalizeType(rawType) {
  var t = (rawType || '').toLowerCase();
  if (t.indexOf('医疗') > -1) return '百万医疗';
  if (t.indexOf('重疾') > -1 || t.indexOf('疾病') > -1) return '重疾险';
  if (t.indexOf('意外') > -1) return '意外险';
  if (t.indexOf('定期寿险') > -1 || t.indexOf('定寿') > -1) return '定寿';
  if (t.indexOf('防癌') > -1 || t.indexOf('癌症') > -1) return '防癌险';
  if (t.indexOf('惠民') > -1 || t.indexOf('普惠') > -1) return '惠民保';
  return '百万医疗'; // 默认归类
}

module.exports = {
  name: 'cbirc',
  displayName: '银保监产品备案库',
  scrape: scrape,
  healthCheck: async function() { return true; }
};
