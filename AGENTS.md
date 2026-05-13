# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

"安心家册" — 微信小程序，帮助家庭整理重要资料、到期提醒和宠物节点。不是保险销售工具，不提供购买建议。

- 技术栈：微信小程序原生（WXML/WXSS/JS）+ 微信云开发（CloudBase）
- 云环境：`cloudbase-d2gxofxyb319026fa`
- AppID：`wx9a86f9e60e438f18`
- 主题色：暖白纸感 `#F8F4EC / #FFFCF6`，金色 `#9B7A45`

## 架构

4 Tab 架构（`app.json` → `custom-tab-bar/`）：

| Tab | 页面 | 功能 |
|-----|------|------|
| 总览 | `pages/index/` | 家庭概况，今日提醒，快捷入口 |
| 资料 | `pages/members/` | 家人/宠物档案夹，资料卡片展开+详情 |
| 清单 | `pages/analysis/` | 安心清单，待完善项，参考样例对比 |
| 我的 | `pages/mine/` | 会员卡，云备份/恢复，导出/导入，隐私声明 |

资料表单 `pages/policy-form/` 同时承载录入+编辑+OCR识别。详情页 `pages/policy-detail/` 仅在需要查看完整字段和附件时跳转。`pages/mine/membership` 为会员订阅页。

后台页面在分包 `pages/admin/`，通过长按"设置"进入。

## 核心数据模型

所有数据存储在 `app.globalData.family` 中，结构：

```js
{ members: [], policies: [] }
```

- **members**：`{ id, kind:'person'|'pet', name, age, role, yibao, debt, ...petFields }`
- **policies**（资料记录）：`{ id, memberId, type, name, company, premium, coverage, deductible, guaranteedYears, effective, expiry, policyNo, tags, detail, attachments[], screenshot, verified, contentItems[], reviewItems[], coreSummary, contentGroups[], boundaryItems[] }`

读取：`app.loadLocalData()` → `getFreshDemoData()` 兜底。 保存：`app.saveData()` → `wx.setStorageSync('family_data', ...)`。

## 敏感词原则

**前台禁止出现**：保险/保单/投保/理赔/赔付/续保/推荐购买/保障充足/更适合/排名/优先/试运营/公测/模拟支付/首年专享/升级。

**允许**：资料/记录/额度/范围/年度支出/到期提醒/参考样例/建议核对/识别/开通/家庭年卡。

内部引擎和正则匹配仍使用原文词汇匹配（如 "续保"、"保单号"），但通过 `display-sanitizer.js` 转换后展示。

## 会员与价格

价格统一在三个源：`utils/payment-model.js`、`cloudfunctions/memberships/index.js`、`pages/mine/membership.js`。免费版 3人+1宠+20条记录。年卡 ¥68/年（标准价 ¥128 仅作锚点，月卡 ¥9.9 弱展示）。本地测试模式 `app.js` 中 `ENABLE_LOCAL_TEST_MEMBERSHIP=true`。

## 识别链路

```
用户上传 → 云存储 → extractPolicy 云函数
  ├── 图片：OCR(WX OCR / BaiduOCR) → DeepSeek Vision/Codex Vision → regexExtract 兜底
  ├── PDF：pdf-parse 文本层抽取 → ≥200字走AI Text → <200字走AI Document
  └── 粘贴文字：AI Text 直接提取
  → 返回 contentItems/reviewItems/coreSummary/contentGroups
  → 前端 applyExtractedData() 填入表单
  → onSave() 写入 policy
```

识别次数由 `membership.js` OCR 月度计数控制。LOW_TEXT / OCR_FAILED / FILE_UNSUPPORTED / PDF_NO_TEXT / PDF_NO_API_KEY / UNKNOWN_ERROR 不消耗次数。

云函数 AI 调用自动适配：`DEEPSEEK_API_KEY` 优先走 DeepSeek，`CLAUDE_API_KEY` 走 Codex，都没有用本地 regex。

## 部署注意

- 修改云函数后：右键 `cloudfunctions/extractPolicy` → "上传并部署：云端安装依赖"
- 环境变量（云开发→云函数→extractPolicy→版本与配置）：`DEEPSEEK_API_KEY` 或 `CLAUDE_API_KEY`
- 超时时间：15秒以上（AI 调用需要）
- `node --check` 检查所有 JS 文件语法

## 关键工具模块

| 模块 | 作用 |
|------|------|
| `utils/display-sanitizer.js` | 敏感词替换，前台文案降敏 |
| `utils/record-profile.js` | 类目说明、checkItems、gapContentItems、完整度 |
| `utils/record-profile-sections.js` | 资料画像 sections 结构化输出 |
| `utils/record-content.js` | 从 coverage/detail/tags 解析核心内容字段 |
| `utils/record-dedupe.js` | 重复资料检测（强弱+附件） |
| `utils/attachments.js` | 新旧附件模型兼容（screenshot→attachments[]） |
| `utils/product-loader.js` | 产品缓存+质量过滤（isDisplayable） |
| `utils/membership.js` | 免费额度+OCR次数+附件限制 |
| `utils/payment-model.js` | 支付订单+权益模型+createOrder |
