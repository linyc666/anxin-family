// utils/demo-data.js — 演示数据（贴近免费版：3人+1宠，≤6条资料）
module.exports = {
  getDemoData: function() {
    return {
      _meta: { isDemo: true, demoVersion: 3 },
      familyId: 'default',
      members: [
        { id:'m1', kind:'person', name:'林先生', age:35, role:'户主', yibao:'杭州职工社保', debt:'房贷120万', notes:'家庭主要收入来源' },
        { id:'m2', kind:'person', name:'陈女士', age:33, role:'配偶', yibao:'杭州职工社保', debt:'', notes:'' },
        { id:'m3', kind:'person', name:'小林', age:5, role:'子女', yibao:'杭州居民社保', debt:'', notes:'' },
        { id:'pet1', kind:'pet', name:'豆包', age:3, petType:'猫', breed:'英短', vaccineDate:'2025-04-01', dewormDate:'2026-02-10', checkupDate:'2025-06-01', notes:'' }
      ],
      policies: [
        { id:'p1', memberId:'m1', type:'百万医疗', name:'长期医疗资料样例', company:'公开资料来源A', premium:443, coverage:'400万', guaranteedYears:'20年延续', effective:'2026-04-21', expiry:'2027-04-20', tags:'含CAR-T,外购药100万', detail:'一般医疗200万·大额支出400万·含质子重离子' },
        { id:'p2', memberId:'m1', type:'意外险', name:'综合意外风险资料样例', company:'公开资料来源B', premium:298, coverage:'意外100万+猝死50万', guaranteedYears:'1年期', effective:'2026-04-23', expiry:'2027-04-22', tags:'0免赔,不限社保', detail:'意外医疗10.5万·住院津贴150元/天' },
        { id:'p3', memberId:'m2', type:'百万医疗', name:'0免赔医疗资料样例', company:'公开资料来源C', premium:453, coverage:'400万·0免赔', guaranteedYears:'6年延续', effective:'2025-10-29', expiry:'2026-10-28', tags:'0免赔,含CAR-T', detail:'1万内30%报销·含质子重离子' },
        { id:'p4', memberId:'m3', type:'惠民保', name:'城市惠民保2026', company:'市医保局指导', premium:88, coverage:'300万', guaranteedYears:'1年期', effective:'2026-07-01', expiry:'2027-06-30', tags:'', detail:'医保内300万·医保外300万' }
      ]
    };
  }
};
