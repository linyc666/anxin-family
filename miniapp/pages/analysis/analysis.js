// pages/analysis/analysis.js - 安心清单
var api = require('../../utils/api');
var display = require('../../utils/display-sanitizer');
var recordProfile = require('../../utils/record-profile');

function toFriendlyTitle(title) { return display.friendlyGapTitle(title); }
function toFriendlyDesc(desc) { return display.friendlyGapDesc(desc); }

function getSampleRecordItems(type) {
  var map = {
    '百万医疗': ['住院相关额度：约200万-300万', '大额事项额度：约400万-600万', '延续条件：6年/20年/长期均可见', '到期日期：建议单独记录'],
    '重疾险': ['大额事项额度：常见30万-80万', '轻度事项额度：常见为主项的一定比例', '延续条件：长期/年度型均可见', '编号与生效日期：建议完整记录'],
    '意外险': ['一般意外额度：约50万-100万', '交通场景额度：飞机等可见300万-500万', '费用范围：常见3万-10万', '到期日期：多数需要按年核对'],
    '定寿': ['家庭责任额度：常见与房贷、收入责任相关', '责任期限：常见20年/30年/至固定年龄', '受益人/相关人：建议单独核对', '编号与生效日期：建议完整记录'],
    '惠民保': ['城市范围：通常与参保城市相关', '年度支出：常见为百元级', '有效期：多数按年度核对', '适用范围：请以本人资料原文为准'],
    '防癌险': ['专项额度：常见围绕特定健康事项', '等待期：建议单独记录', '延续条件：年度型和长期型均可见', '到期日期：建议重点核对'],
    '车险': ['车辆相关责任：建议按资料原文记录', '三者额度：常见100万-300万', '车损相关：是否包含需按原文核对', '到期日期：多数按年度核对']
  };
  return map[type] || ['年度支出：建议记录', '额度/范围：按资料原文填写', '生效与到期日期：建议完整记录', '编号或凭证号：便于后续查找'];
}

function getSampleDetail(type) {
  var map = {
    '百万医疗': {
      amountExamples: ['住院相关额度常见约200万-300万', '大额事项额度常见约400万-600万', '部分公开资料会单列外购药或特定治疗项目'],
      periodExamples: ['常见1年期，延续条件有6年、20年或长期等不同表述', '建议单独记录到期日和延续条件原文'],
      boundaryNotes: ['免赔额、社保范围、等待期、既往情况说明需要按原文核对', '不同公开样例差异较大，不应只看额度数字'],
      checkFields: ['年度支出', '额度/范围', '免赔或费用边界', '延续条件', '到期日期']
    },
    '意外险': {
      amountExamples: ['一般意外额度常见约50万-100万', '飞机、火车、汽车等交通场景可能单列更高额度', '医疗费用范围常见约3万-10万'],
      periodExamples: ['多数为1年期，建议每年核对到期时间', '交通场景和职业限制需要看资料原文'],
      boundaryNotes: ['不同场景额度可能不叠加，需按原文理解', '职业类别、就医范围、免赔比例需要单独记录'],
      checkFields: ['一般额度', '交通场景额度', '费用范围', '职业/场景限制', '到期日期']
    },
    '重疾险': {
      amountExamples: ['大额事项额度常见约30万-80万', '轻度事项可能按主项一定比例记录', '部分资料会包含多次给付或专项内容'],
      periodExamples: ['长期型、定期型、年度型均可见', '建议记录责任期限和生效日期'],
      boundaryNotes: ['等待期、健康告知、责任范围、除外事项需要以原文为准', '不要只记录名称，需保留编号和关键页附件'],
      checkFields: ['大额事项额度', '轻度事项额度', '责任期限', '等待期', '编号/凭证号']
    },
    '车险': {
      amountExamples: ['三者额度常见100万-300万', '车辆损失、人员、附加服务需按原文核对', '交强相关与商业相关建议分开记录'],
      periodExamples: ['多数为年度资料，到期时间非常关键', '车辆信息和车牌号建议一并记录'],
      boundaryNotes: ['车辆用途、驾驶人、附加项目会影响资料含义', '建议上传电子PDF或截图作为附件'],
      checkFields: ['车牌/车辆信息', '三者额度', '车损相关', '附加项目', '到期日期']
    }
  };
  return map[type] || {
    amountExamples: ['按本人资料原文记录额度或范围', '如有多个场景，建议分项记录'],
    periodExamples: ['记录生效日期和到期日期', '如有延续条件，建议保留原文'],
    boundaryNotes: ['公开样例只用于了解常见记录项', '本人资料以原文和附件为准'],
    checkFields: ['年度支出', '额度/范围', '生效日期', '到期日期', '编号/凭证号']
  };
}

function aliasSampleName(name, type) { return display.aliasRecordName(name, type); }

Page({
  data: {
    gaps: [], filteredGaps: [],
    stats: { totalGaps:0, p0Gaps:0, p1Gaps:0 },
    activeMember: '', memberList: [], tColors: null, showAll: false, pageThemeClass: '', loading: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 2 });
    var app = getApp();
    var tc = app.globalData.themeColors;
    if (tc) wx.setNavigationBarColor({ frontColor: tc.navFront || '#000000', backgroundColor: tc.cardBg });
    this.setData({ tColors: tc, pageThemeClass: app.globalData.pageThemeClass || '' });
    this.refresh();
  },

  refresh() {
    var app = getApp();
    var family = (app && app.globalData && app.globalData.family) ? app.globalData.family : { members:[], policies:[] };
    var that = this;
    api.analyzeFamily(family.members, family.policies).then(function(result) {
      var priorityOrder = { P0:0, P1:1, P2:2 };
      result.gaps.sort(function(a,b) { return (priorityOrder[a.priority]||99) - (priorityOrder[b.priority]||99); });

      var recMap = {};
      (result.recommendations || []).forEach(function(rec) {
        if (!recMap[rec.memberId]) recMap[rec.memberId] = [];
        recMap[rec.memberId].push({
          gapType: rec.gapType,
          candidates: (rec.candidates || []).map(function(c, idx) {
            var product = c.product || {};
            var type = product.type || rec.gapType || '其他';
            var detail = getSampleDetail(type);
            return {
              rank: idx + 1,
              type: type,
              name: aliasSampleName(product.name, type),
              company: display.aliasSource(product.company),
              price: c.price ? c.price.toLocaleString() : '-',
              recordItems: getSampleRecordItems(type),
              amountExamples: detail.amountExamples,
              periodExamples: detail.periodExamples,
              boundaryNotes: detail.boundaryNotes,
              checkFields: detail.checkFields,
              level: idx === 0 ? 'basic' : 'complete',
              useHint: idx === 0 ? '基础记录格式和最少应记录字段' : '完整记录格式和更多可记录内容'
            };
          }).slice(0, 2)
        });
      });

      var gaps = result.gaps.map(function(g, index) {
        var recs = recMap[g.memberId] || [];
        var matchingRec = recs.find(function(r) { return r.gapType === g.type; });
        var profile = recordProfile.getProfile(g.type);
        return {
          gapKey: [g.memberId, g.type || 'unknown', index].join('_'),
          memberId: g.memberId, memberName: g.memberName, type: g.type,
          categoryLabel: profile.label,
          gapMeaning: profile.gapMeaning,
          gapContentItems: profile.gapContentItems || [],
          gapContentExpanded: false,
          title: toFriendlyTitle(g.title), desc: toFriendlyDesc(g.desc), priority: g.priority,
          samples: matchingRec ? matchingRec.candidates : [], samplesExpanded: false
        };
      });

      var memberMap = {}, memberList = [];
      gaps.forEach(function(g) {
        if (!memberMap[g.memberId]) { memberMap[g.memberId] = true; memberList.push({ id: g.memberId, name: g.memberName }); }
      });

      that.setData({
        gaps: gaps, memberList: memberList,
        stats: { totalGaps: result.stats.totalGaps, p0Gaps: result.stats.p0Gaps, p1Gaps: result.stats.p1Gaps },
        loading: false
      });
      that.applyFilter();
    });
  },

  onToggleGapContent(e) {
    var gapKey = e.currentTarget.dataset.gapKey;
    var gaps = this.data.gaps.map(function(g) {
      if (g.gapKey === gapKey) g.gapContentExpanded = !g.gapContentExpanded;
      return g;
    });
    this.setData({ gaps: gaps });
  },

  onToggleSamples(e) {
    var gapKey = e.currentTarget.dataset.gapKey;
    var gaps = this.data.gaps.map(function(g) {
      if (g.gapKey === gapKey) g.samplesExpanded = !g.samplesExpanded;
      return g;
    });
    this.setData({ gaps: gaps });
    this.applyFilter();
  },

  onViewSample(e) {
    var gapKey = e.currentTarget.dataset.gapKey;
    var rank = parseInt(e.currentTarget.dataset.rank, 10);
    var gap = this.data.gaps.find(function(g) { return g.gapKey === gapKey; });
    if (!gap) return;
    var sample = (gap.samples || []).find(function(s) { return s.rank === rank; });
    if (!sample) return;
    var app = getApp();
    app.globalData.currentSampleDetail = Object.assign({}, sample, {
      gapTitle: gap.title,
      memberName: gap.memberName
    });
    wx.navigateTo({ url: '/pages/sample-detail/sample-detail' });
  },

  onFilterMember(e) { this.setData({ activeMember: e.currentTarget.dataset.id }); this.applyFilter(); },

  applyFilter() {
    var aid = this.data.activeMember;
    var filtered = aid ? this.data.gaps.filter(function(g) { return g.memberId === aid; }) : this.data.gaps;
    if (!this.data.showAll) filtered = filtered.slice(0, 3);
    this.setData({ filteredGaps: filtered });
  },

  onShowAll() { this.setData({ showAll: true }); this.applyFilter(); },
  onGoMine() { wx.switchTab({ url: '/pages/mine/mine' }); }
});
