// pages/member-form/member-form.js - 添加/编辑家人或宠物
var membership = require('../../utils/membership');
var smartParse = require('../../utils/smart-parse');

Page({
  data: {
    editingId: '',
    kind: 'person',
    form: { name:'', age:'', role:'', yibao:'', debt:'', notes:'', petType:'', breed:'', vaccineDate:'', dewormDate:'', checkupDate:'' },
    roleOptions: ['户主','配偶','父亲','母亲','子女','岳父','岳母','其他'],
    petTypeOptions: ['猫','狗','兔子','鸟类','其他'],
    insuranceOptions: ['深圳一档社保','深圳二档社保','广州职工社保','佛山职工社保','东莞职工社保','惠州职工社保','杭州职工社保','汕头居民社保','汕尾居民社保','其他城市社保(手动输入)','无购买社保'],
    showCustomYibao: false,
    customYibao: '',
    // 智能录入
    smartText: '',
    smartPlaceholder: '如：张三，35岁，爸爸，杭州社保，房贷120万，家庭主要收入来源'
  },

  onLoad(opts) {
    var kind = opts.kind === 'pet' ? 'pet' : 'person';
    if (opts.id) {
      this.setData({ editingId: opts.id });
      var app = getApp();
      var member = app.globalData.family.members.find(function(m){ return m.id === opts.id; });
      if (member) {
        kind = member.kind === 'pet' ? 'pet' : 'person';
        this.setData({ kind: kind, form: {
          name: member.name||'', age: member.age||'',
          role: member.role||'', yibao: member.yibao||'',
          debt: member.debt||'', notes: member.notes||'',
          petType: member.petType||'', breed: member.breed||'',
          vaccineDate: member.vaccineDate||'', dewormDate: member.dewormDate||'', checkupDate: member.checkupDate||''
        }});
      }
    } else {
      this.setData({ kind: kind });
    }
    this.updatePlaceholder();
    wx.setNavigationBarTitle({ title: opts.id ? (kind === 'pet' ? '编辑宠物' : '编辑家人') : (kind === 'pet' ? '添加宠物' : '添加家人') });
  },

  updatePlaceholder() {
    var kind = this.data.kind;
    var ph = kind === 'pet'
      ? '如：豆包，金毛，3岁，去年10月打过疫苗，12月驱虫，最近体检正常'
      : '如：张三，35岁，爸爸，杭州社保，房贷120万，家庭主要收入来源';
    this.setData({ smartPlaceholder: ph });
  },

  // === 智能录入 ===
  onSmartInput(e) {
    this.setData({ smartText: e.detail.value });
  },

  onSmartParse() {
    var text = this.data.smartText.trim();
    if (!text) {
      wx.showToast({ title: '请输入要整理的信息', icon: 'none' });
      return;
    }

    var parsed = smartParse.parseSmart(text, this.data.kind);
    if (!parsed) {
      wx.showToast({ title: '未识别明显字段，已记录到备注', icon: 'none' });
      // 将输入内容写入备注
      var f = this.data.form;
      if (!f.notes) {
        f.notes = text;
        this.setData({ form: f });
      }
      return;
    }

    // 合并：不覆盖已手动填写的非空字段
    var form = this.data.form;
    var merged = false;

    var personFields = ['name','age','role','yibao','debt','notes'];
    var petFields = ['name','age','petType','breed','vaccineDate','dewormDate','checkupDate','notes'];
    var fields = this.data.kind === 'pet' ? petFields : personFields;
    var structuredFields = fields.filter(function(field) { return field !== 'notes'; });
    var hasStructured = structuredFields.some(function(field) {
      return parsed[field] !== null && parsed[field] !== undefined && parsed[field] !== '';
    });

    fields.forEach(function(field) {
      if (parsed[field] !== null && parsed[field] !== undefined && parsed[field] !== '' && !form[field]) {
        form[field] = parsed[field];
        merged = true;
      }
    });

    // notes 特殊处理：如果解析出了notes且当前为空，写入；如果当前已有内容则追加
    if (parsed.notes && !form.notes) {
      form.notes = parsed.notes;
      merged = true;
    }

    this.setData({ form: form });

    if (hasStructured && merged) {
      wx.showToast({ title: '已整理，请核对', icon: 'success' });
    } else {
      wx.showToast({ title: '已记录到备注，可继续手动完善', icon: 'none' });
      if (!form.notes) {
        form.notes = text;
        this.setData({ form: form });
      }
    }
  },

  // === 字段输入 ===
  onInput(e) {
    var field = e.currentTarget.dataset.field;
    var form = this.data.form;
    form[field] = e.detail.value;
    this.setData({ form: form });
  },

  onRoleChange(e) {
    var form = this.data.form;
    form.role = this.data.roleOptions[e.detail.value];
    this.setData({ form: form });
  },

  onPetTypeChange(e) {
    var form = this.data.form;
    form.petType = this.data.petTypeOptions[e.detail.value];
    this.setData({ form: form });
  },

  onDateChange(e) {
    var field = e.currentTarget.dataset.field;
    var form = this.data.form;
    form[field] = e.detail.value;
    this.setData({ form: form });
  },

  onInsuranceChange(e) {
    var form = this.data.form;
    var selected = this.data.insuranceOptions[e.detail.value];
    if (selected === '其他城市社保(手动输入)') {
      this.setData({ showCustomYibao: true });
    } else {
      form.yibao = selected;
      this.setData({ form: form, showCustomYibao: false });
    }
  },

  onCustomYibaoInput(e) {
    this.setData({ customYibao: e.detail.value });
    var form = this.data.form;
    form.yibao = e.detail.value;
    this.setData({ form: form });
  },

  onSave() {
    var f = this.data.form;
    if (!f.name || !f.age) { wx.showToast({ title: this.data.kind === 'pet' ? '请填写名字和年龄' : '请填写姓名和年龄', icon:'none' }); return; }

    var app = getApp();
    if (!this.data.editingId) {
      if (this.data.kind === 'pet' && !membership.canAddPet(app.globalData.family)) {
        membership.showUpgradeToast('免费版最多可添加1只宠物。升级后可继续整理更多宠物档案。');
        return;
      }
      if (this.data.kind !== 'pet' && !membership.canAddPerson(app.globalData.family)) {
        membership.showUpgradeToast('免费版最多可添加3位家人。升级后可继续整理更多家庭资料。');
        return;
      }
    }

    var member = {
      id: this.data.editingId || ('m_'+Date.now()),
      kind: this.data.kind,
      name: f.name, age: parseInt(f.age) || 0,
      role: f.role, yibao: f.yibao, debt: f.debt, notes: f.notes,
      petType: f.petType, breed: f.breed,
      vaccineDate: f.vaccineDate, dewormDate: f.dewormDate, checkupDate: f.checkupDate
    };

    if (this.data.editingId) {
      var idx = app.globalData.family.members.findIndex(function(m){ return m.id === this.data.editingId; }.bind(this));
      if (idx > -1) app.globalData.family.members[idx] = member;
    } else {
      app.globalData.family.members.push(member);
    }
    app.saveData();
    wx.navigateBack();
  }
});
