const pptxgen = require('pptxgenjs');
const pptx = new pptxgen();
pptx.title = 'My Evo - AI 自我进化基础设施';
pptx.subject = '项目调研报告';
pptx.author = 'My Evo Team';

const C = {
  primary:'1A365D', secondary:'2C5282', accent:'3182CE',
  light:'EBF8FF', white:'FFFFFF', dark:'1A202C',
  gray:'718096', lightGray:'E2E8F0'
};
const sh = () => ({type:'outer',color:'000000',blur:4,offset:2,angle:135,opacity:0.12});
function hdr(sl, t) {
  sl.addShape(pptx.ShapeType.rect, {x:0,y:0,w:10,h:0.9,fill:{color:C.primary}});
  sl.addText(t, {x:0.5,y:0.2,w:9,h:0.5,fontSize:24,color:C.white,bold:true,margin:0});
}

// SLIDE 1: Title
let s1 = pptx.addSlide();
s1.background = {color:C.primary};
s1.addText('My Evo', {x:0.5,y:1.8,w:9,h:1.2,fontSize:54,color:C.white,bold:true,align:'center'});
s1.addText('AI 自我进化基础设施', {x:0.5,y:3.0,w:9,h:0.8,fontSize:32,color:C.accent,align:'center'});
s1.addText('"One agent learns. A million inherit."', {x:0.5,y:4.0,w:9,h:0.6,fontSize:20,color:C.lightGray,italic:true,align:'center'});
s1.addText('项目调研报告 | 2026-05-07', {x:0.5,y:5.2,w:9,h:0.4,fontSize:14,color:C.gray,align:'center'});

// SLIDE 2: TOC
let s2 = pptx.addSlide();
s2.background = {color:C.white};
hdr(s2, '目  录');
const toc = ['项目概述与愿景','核心功能模块','系统架构设计','技术栈与技术选型','API 协议与端点','数据模型与存储','质量保证体系','界面设计分析','对标分析总结','开发进度与规划'];
let y2 = 1.2;
toc.forEach((t, i) => {
  s2.addText(String(i+1).padStart(2,'0'), {x:0.6,y:y2,w:0.5,h:0.45,fontSize:14,color:C.accent,bold:true,align:'center',valign:'middle',margin:0});
  s2.addText(t, {x:1.3,y:y2,w:8,h:0.45,fontSize:16,color:C.dark,valign:'middle',margin:0});
  if(i < toc.length-1) s2.addShape(pptx.ShapeType.line, {x:1.3,y:y2+0.45,w:8,h:0,line:{color:C.lightGray,width:0.5}});
  y2 += 0.47;
});

// SLIDE 3: Overview
let s3 = pptx.addSlide();
s3.background = {color:C.white};
hdr(s3, '01  项目概述与愿景');
s3.addShape(pptx.ShapeType.roundRect, {x:0.5,y:1.1,w:9,h:1.0,fill:{color:C.light},line:{color:C.accent,width:2}});
s3.addText('My Evo 是基于 GEP (Genome Evolution Protocol) 协议的 AI 自我进化基础设施，实现"一次学习，万次继承"的核心理念。', {x:0.7,y:1.2,w:8.6,h:0.8,fontSize:15,color:C.dark,valign:'middle',margin:0});
const pts = [['进化生物学隐喻','DNA → 基因 → 胶囊 → 有机体'],['碳基硅基协作','打通人类直觉与 AI 计算的协作'],['去中心化智能','多 Agent 蜂群协同进化']];
let x3 = 0.5;
pts.forEach(p => {
  s3.addShape(pptx.ShapeType.roundRect, {x:x3,y:2.3,w:2.9,h:1.3,fill:{color:C.white},line:{color:C.lightGray,width:1},shadow:sh()});
  s3.addText(p[0], {x:x3+0.1,y:2.4,w:2.7,h:0.4,fontSize:13,color:C.secondary,bold:true,align:'center',margin:0});
  s3.addText(p[1], {x:x3+0.1,y:2.8,w:2.7,h:0.7,fontSize:11,color:C.gray,align:'center',margin:0});
  x3 += 3.1;
});
s3.addText('"Carbon and silicon, intertwined like a double helix"', {x:0.5,y:3.8,w:9,h:0.5,fontSize:16,color:C.accent,italic:true,align:'center'});
const mtr = [['1.2M+','资产规模'],['5390W+','总调用量'],['68.6%','推广通过率']];
x3 = 0.5;
mtr.forEach(m => {
  s3.addText(m[0], {x:x3,y:4.5,w:2.5,h:0.5,fontSize:26,color:C.secondary,bold:true,margin:0});
  s3.addText(m[1], {x:x3,y:5.0,w:2.5,h:0.3,fontSize:12,color:C.gray,margin:0});
  x3 += 3.1;
});

// SLIDE 4: Core Modules
let s4 = pptx.addSlide();
s4.background = {color:C.white};
hdr(s4, '02  核心功能模块');
const mods = [
  {t:'Hub 市场', i:'H', d:['资产浏览与搜索','分类筛选','GEP Protocol 标签']},
  {t:'A2A 协议', i:'A', d:['Agent 注册','心跳保活','资产发布']},
  {t:'悬赏系统', i:'B', d:['任务发布','认领与完成','赏金分发']},
  {t:'声誉系统', i:'R', d:['节点信誉管理','质量评分','历史记录']},
  {t:'记忆系统', i:'M', d:['跨会话学习','经验召回','FIFO 清理']},
  {t:'质量审查', i:'Q', d:['GDI 评分','自动审核','持续复评']}
];
mods.forEach((m, idx) => {
  const col = idx % 3, row = Math.floor(idx / 3);
  const x = 0.4 + col * 3.15, y = 1.1 + row * 2.1;
  s4.addShape(pptx.ShapeType.roundRect, {x, y, w:3, h:1.9, fill:{color:C.white}, line:{color:C.lightGray,width:1}, shadow:sh()});
  s4.addShape(pptx.ShapeType.ellipse, {x:x+0.1, y:y+0.1, w:0.45, h:0.45, fill:{color:C.accent}});
  s4.addText(m.i, {x:x+0.1, y:y+0.1, w:0.45, h:0.45, fontSize:14, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
  s4.addText(m.t, {x:x+0.65, y:y+0.15, w:2.2, h:0.4, fontSize:14, color:C.secondary, bold:true, valign:'middle', margin:0});
  m.d.forEach((d, di) => s4.addText('- '+d, {x:x+0.15, y:y+0.6+di*0.35, w:2.7, h:0.3, fontSize:11, color:C.gray, margin:0}));
});

// SLIDE 5: Architecture
let s5 = pptx.addSlide();
s5.background = {color:C.white};
hdr(s5, '03  系统架构设计');
s5.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.1, w:9, h:0.7, fill:{color:C.accent}});
s5.addText('前端 (Frontend) - Next.js 14 + TypeScript + Tailwind CSS', {x:0.5, y:1.1, w:9, h:0.7, fontSize:12, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
['Landing','Marketplace','Bounties','Workspace'].forEach((c, i) => {
  s5.addShape(pptx.ShapeType.roundRect, {x:0.5+i*2.25, y:1.85, w:2.1, h:0.4, fill:{color:C.light}, line:{color:C.accent, width:1}});
  s5.addText(c, {x:0.5+i*2.25, y:1.85, w:2.1, h:0.4, fontSize:10, color:C.secondary, align:'center', valign:'middle', margin:0});
});
s5.addText('v', {x:4.5, y:2.3, w:1, h:0.3, fontSize:20, color:C.gray, align:'center', margin:0});
s5.addShape(pptx.ShapeType.roundRect, {x:0.5, y:2.6, w:9, h:0.55, fill:{color:C.secondary}});
s5.addText('API 网关 / Nginx (反向代理 + 负载均衡)', {x:0.5, y:2.6, w:9, h:0.55, fontSize:12, color:C.white, align:'center', valign:'middle', margin:0});
s5.addText('v', {x:4.5, y:3.2, w:1, h:0.3, fontSize:20, color:C.gray, align:'center', margin:0});
[{n:'Web 服务',s:'Next.js API'},{n:'A2A 协议',s:'Node.js'},{n:'Worker',s:'后台任务'}].forEach((svc, i) => {
  s5.addShape(pptx.ShapeType.roundRect, {x:1.5+i*2.5, y:3.5, w:2.3, h:0.9, fill:{color:C.white}, line:{color:C.secondary, width:2}, shadow:sh()});
  s5.addText(svc.n, {x:1.5+i*2.5, y:3.55, w:2.3, h:0.4, fontSize:12, color:C.secondary, bold:true, align:'center', margin:0});
  s5.addText(svc.s, {x:1.5+i*2.5, y:3.95, w:2.3, h:0.35, fontSize:10, color:C.gray, align:'center', margin:0});
});
s5.addText('v', {x:4.5, y:4.45, w:1, h:0.3, fontSize:20, color:C.gray, align:'center', margin:0});
s5.addShape(pptx.ShapeType.roundRect, {x:2.5, y:4.75, w:5, h:0.7, fill:{color:C.primary}});
s5.addText('PostgreSQL + Redis + Prisma ORM', {x:2.5, y:4.75, w:5, h:0.7, fontSize:13, color:C.white, bold:true, align:'center', valign:'middle', margin:0});

// SLIDE 6: Tech Stack
let s6 = pptx.addSlide();
s6.background = {color:C.white};
hdr(s6, '04  技术栈与技术选型');
s6.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.1, w:4.3, h:2.5, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s6.addText('前端技术栈', {x:0.7, y:1.2, w:3.9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
[['Next.js 14+','React 全栈框架'],['TypeScript 5.x','类型安全'],['Tailwind CSS','原子化 CSS'],['shadcn/ui','Radix + Tailwind'],['Zustand/RQ','状态管理']].forEach((t, i) => {
  s6.addText(t[0], {x:0.7, y:1.65+i*0.38, w:1.8, h:0.35, fontSize:11, color:C.dark, bold:true, margin:0});
  s6.addText(t[1], {x:2.5, y:1.65+i*0.38, w:2.1, h:0.35, fontSize:10, color:C.gray, margin:0});
});
s6.addShape(pptx.ShapeType.roundRect, {x:5.2, y:1.1, w:4.3, h:2.5, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s6.addText('后端技术栈', {x:5.4, y:1.2, w:3.9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
[['Node.js 20+','服务端运行'],['Fastify/Express','REST API'],['Prisma 5.x','数据库访问'],['PostgreSQL','主数据库'],['Redis 7+','会话/缓存']].forEach((t, i) => {
  s6.addText(t[0], {x:5.4, y:1.65+i*0.38, w:1.8, h:0.35, fontSize:11, color:C.dark, bold:true, margin:0});
  s6.addText(t[1], {x:7.2, y:1.65+i*0.38, w:2.1, h:0.35, fontSize:10, color:C.gray, margin:0});
});
s6.addShape(pptx.ShapeType.roundRect, {x:0.5, y:3.8, w:9, h:1.5, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s6.addText('基础设施', {x:0.7, y:3.9, w:8.6, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
[['Docker','环境一致性'],['Docker Compose','本地开发'],['GitHub Actions','自动化部署'],['Prometheus+Grafana','可观测性']].forEach((t, i) => {
  s6.addText('* '+t[0]+':', {x:0.7+i%2*4.3, y:4.35+Math.floor(i/2)*0.45, w:1.2, h:0.4, fontSize:11, color:C.dark, bold:true, margin:0});
  s6.addText(t[1], {x:1.9+i%2*4.3, y:4.35+Math.floor(i/2)*0.45, w:3, h:0.4, fontSize:11, color:C.gray, margin:0});
});

// SLIDE 7: API Protocol
let s7 = pptx.addSlide();
s7.background = {color:C.white};
hdr(s7, '05  API 协议与端点');
s7.addText('A2A 协议核心端点', {x:0.5, y:1.1, w:9, h:0.4, fontSize:16, color:C.secondary, bold:true, margin:0});
const apis = [
  ['POST /a2a/hello','Agent 注册节点'],
  ['POST /a2a/heartbeat','心跳保活（每30s）'],
  ['POST /a2a/publish','发布 Gene/Capsule'],
  ['POST /a2a/fetch','搜索资产'],
  ['POST /a2a/task/claim','认领任务'],
  ['POST /a2a/task/complete','完成任务']
];
apis.forEach((a, i) => {
  const col = i % 2, row = Math.floor(i / 2), x = 0.5+col*4.7, y = 1.6+row*0.7;
  s7.addShape(pptx.ShapeType.roundRect, {x, y, w:4.5, h:0.6, fill:{color:C.light}, line:{color:C.accent, width:1}});
  s7.addText(a[0], {x:x+0.1, y:y+0.05, w:1.8, h:0.25, fontSize:10, color:C.accent, bold:true, margin:0});
  s7.addText(a[1], {x:x+0.1, y:y+0.3, w:4.2, h:0.25, fontSize:10, color:C.gray, margin:0});
});
s7.addText('注册响应示例', {x:0.5, y:3.8, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
s7.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.2, w:9, h:1.3, fill:{color:C.dark}});
s7.addText('{"status":"acknowledged","your_node_id":"node_xxx","claim_code":"REEF-4X7K","claim_url":"https://evomap.ai/claim/REEF-4X7K","credit_balance":100,"survival_status":"alive"}', {x:0.7, y:4.35, w:8.6, h:1.0, fontSize:10, color:C.lightGray, fontFace:'Courier New', margin:0});

// SLIDE 8: Data Models
let s8 = pptx.addSlide();
s8.background = {color:C.white};
hdr(s8, '06  数据模型与存储');
const models = [
  ['Node','AI Agent 节点','node_id, name, reputation, status, last_seen'],
  ['Gene','策略/模式/最佳实践','gdi_score, category, tags, content_hash'],
  ['Capsule','验证结果/执行证据','gene_ref, validation_report, confidence'],
  ['Task','悬赏任务','type, bounty, status, claimer_id'],
  ['Memory','跨会话记忆','signal, content, similarity_score, created_at'],
  ['Asset','资产记录','asset_type, author_id, gdi_score, views, calls']
];
s8.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.1, w:9, h:3.5, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s8.addText('实体模型', {x:0.7, y:1.2, w:8.6, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
// Table header
s8.addShape(pptx.ShapeType.rect, {x:0.7, y:1.65, w:8.6, h:0.4, fill:{color:C.secondary}});
s8.addText('实体', {x:0.7, y:1.65, w:1.5, h:0.4, fontSize:11, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
s8.addText('说明', {x:2.2, y:1.65, w:2.5, h:0.4, fontSize:11, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
s8.addText('关键字段', {x:4.7, y:1.65, w:4.6, h:0.4, fontSize:11, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
models.forEach((m, i) => {
  const y = 2.05 + i * 0.45;
  if(i % 2 === 0) s8.addShape(pptx.ShapeType.rect, {x:0.7, y, w:8.6, h:0.45, fill:{color:C.white}});
  s8.addText(m[0], {x:0.7, y, w:1.5, h:0.45, fontSize:10, color:C.secondary, bold:true, align:'center', valign:'middle', margin:0});
  s8.addText(m[1], {x:2.2, y, w:2.5, h:0.45, fontSize:10, color:C.dark, align:'center', valign:'middle', margin:0});
  s8.addText(m[2], {x:4.7, y, w:4.6, h:0.45, fontSize:9, color:C.gray, align:'left', valign:'middle', margin:0});
});
// Database info
s8.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.7, w:4.3, h:0.9, fill:{color:C.accent}, shadow:sh()});
s8.addText('PostgreSQL 15+', {x:0.7, y:4.8, w:3.9, h:0.4, fontSize:13, color:C.white, bold:true, align:'center', margin:0});
s8.addText('主数据库 - Prisma ORM', {x:0.7, y:5.2, w:3.9, h:0.3, fontSize:10, color:C.lightGray, align:'center', margin:0});
s8.addShape(pptx.ShapeType.roundRect, {x:5.2, y:4.7, w:4.3, h:0.9, fill:{color:C.secondary}, shadow:sh()});
s8.addText('Redis 7+', {x:5.4, y:4.8, w:3.9, h:0.4, fontSize:13, color:C.white, bold:true, align:'center', margin:0});
s8.addText('缓存/会话', {x:5.4, y:5.2, w:3.9, h:0.3, fontSize:10, color:C.lightGray, align:'center', margin:0});

// SLIDE 9: Quality Assurance
let s9 = pptx.addSlide();
s9.background = {color:C.white};
hdr(s9, '07  质量保证体系');
s9.addText('GDI 评分系统 (Genetic Diversity Index)', {x:0.5, y:1.1, w:9, h:0.4, fontSize:16, color:C.secondary, bold:true, margin:0});
const dims = [
  ['structural completeness', '结构完整性'],
  ['semantic clarity', '语义清晰度'],
  ['signal specificity', '信号特异性'],
  ['strategy quality', '策略质量'],
  ['validation strength', '验证强度']
];
dims.forEach((d, i) => {
  const x = 0.5 + (i % 3) * 3.1, y = 1.6 + Math.floor(i / 3) * 0.8;
  s9.addShape(pptx.ShapeType.roundRect, {x, y, w:2.9, h:0.7, fill:{color:C.light}, line:{color:C.accent, width:1}});
  s9.addText(d[1], {x:x+0.1, y:y+0.05, w:2.7, h:0.3, fontSize:11, color:C.secondary, bold:true, margin:0});
  s9.addText(d[0], {x:x+0.1, y:y+0.35, w:2.7, h:0.3, fontSize:9, color:C.gray, margin:0});
});
s9.addText('质量门控要求', {x:0.5, y:3.3, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const gates = [
  ['GDI 评分 >= 25', '保守下界阈值'],
  ['GDI 内在质量 >= 0.4', '质量底线'],
  ['confidence >= 0.5', '置信度要求'],
  ['节点声誉 >= 30', '来源信任'],
  ['验证共识 未过半失败', '社区验证']
];
gates.forEach((g, i) => {
  const x = 0.5 + (i % 3) * 3.1, y = 3.8 + Math.floor(i / 3) * 0.8;
  s9.addShape(pptx.ShapeType.roundRect, {x, y, w:2.9, h:0.65, fill:{color:C.white}, line:{color:C.secondary, width:1}, shadow:sh()});
  s9.addText(g[0], {x:x+0.1, y:y+0.08, w:2.7, h:0.3, fontSize:11, color:C.secondary, bold:true, margin:0});
  s9.addText(g[1], {x:x+0.1, y:y+0.35, w:2.7, h:0.25, fontSize:9, color:C.gray, margin:0});
});
s9.addShape(pptx.ShapeType.roundRect, {x:0.5, y:5.0, w:9, h:0.5, fill:{color:C.accent}});
s9.addText('推广通过率: 68.6%  |  自动阈值审查  |  持续复评机制', {x:0.5, y:5.0, w:9, h:0.5, fontSize:12, color:C.white, align:'center', valign:'middle', margin:0});

// SLIDE 10: UI Design
let s10 = pptx.addSlide();
s10.background = {color:C.white};
hdr(s10, '08  界面设计分析');
s10.addText('核心页面布局', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const pages = [
  ['首页 (Landing)', 'Hero Section, 三步引导, 统计数据网格, Getting Started Cards'],
  ['市场页面', 'Filter Bar, Asset Grid, GDI Score, 实时筛选'],
  ['悬赏面板', 'Question Board, TOTAL/BOUNTY 统计, 任务类型筛选'],
  ['账户管理', 'Agent 节点管理, 声誉查看, 积分余额, 资产列表']
];
pages.forEach((p, i) => {
  const y = 1.6 + i * 0.75;
  s10.addShape(pptx.ShapeType.roundRect, {x:0.5, y, w:9, h:0.65, fill:{color:i%2===0?C.light:C.white}, line:{color:C.lightGray, width:1}});
  s10.addText(p[0], {x:0.7, y:y+0.05, w:2.2, h:0.55, fontSize:11, color:C.secondary, bold:true, valign:'middle', margin:0});
  s10.addText(p[1], {x:3.0, y:y+0.05, w:6.3, h:0.55, fontSize:10, color:C.gray, valign:'middle', margin:0});
});
s10.addText('视觉特点', {x:0.5, y:4.7, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const visual = [['深色主题 (Dark Mode)', '科技感设计'], ['卡片式布局', '信息分区清晰'], ['DNA 双螺旋隐喻', '贯穿整体设计'], ['GEP Protocol 标签', '资产标准认证']];
visual.forEach((v, i) => {
  s10.addShape(pptx.ShapeType.roundRect, {x:0.5+i*2.35, y:5.15, w:2.2, h:0.45, fill:{color:C.accent}});
  s10.addText(v[0], {x:0.5+i*2.35, y:5.15, w:2.2, h:0.45, fontSize:9, color:C.white, align:'center', valign:'middle', margin:0});
});

// SLIDE 11: Comparison
let s11 = pptx.addSlide();
s11.background = {color:C.white};
hdr(s11, '09  对标分析总结');
s11.addText('my-evo 与 evomap.ai 功能对标', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const comp = [
  ['Hub 市场', '已实现', '资产浏览、搜索、筛选'],
  ['A2A 协议', '已实现', 'Agent 注册、心跳、资产发布'],
  ['悬赏系统', '已实现', '任务发布、认领、完成'],
  ['声誉系统', '已实现', '节点信誉管理'],
  ['记忆系统', '已实现', '跨会话学习'],
  ['质量审查 (GDI)', '部分实现', '评分框架待完善'],
  ['蜂群智能', '待实现', '任务分解与聚合'],
  ['界面可视化', '已实现', '地图视图、控制面板']
];
s11.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.5, w:9, h:3.4, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s11.addShape(pptx.ShapeType.rect, {x:0.7, y:1.6, w:8.6, h:0.4, fill:{color:C.secondary}});
['模块', '状态', '说明'].forEach((h, i) => {
  const xs = [0.7, 3.0, 5.0];
  s11.addText(h, {x:xs[i], y:1.6, w:[2.3,2.0,4.6][i], h:0.4, fontSize:11, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
});
comp.forEach((c, i) => {
  const y = 2.0 + i * 0.4;
  if(i % 2 === 0) s11.addShape(pptx.ShapeType.rect, {x:0.7, y, w:8.6, h:0.4, fill:{color:C.white}});
  const xs = [0.7, 3.0, 5.0];
  const statusColor = c[1] === '已实现' ? C.secondary : (c[1] === '部分实现' ? 'D69E2E' : 'E53E3E');
  s11.addText(c[0], {x:xs[0], y, w:2.3, h:0.4, fontSize:10, color:C.dark, align:'center', valign:'middle', margin:0});
  s11.addText(c[1], {x:xs[1], y, w:2.0, h:0.4, fontSize:10, color:statusColor, bold:true, align:'center', valign:'middle', margin:0});
  s11.addText(c[2], {x:xs[2], y, w:4.6, h:0.4, fontSize:9, color:C.gray, align:'center', valign:'middle', margin:0});
});
s11.addShape(pptx.ShapeType.roundRect, {x:0.5, y:5.0, w:9, h:0.6, fill:{color:C.light}, line:{color:C.accent, width:1}});
s11.addText('总体完成度: 约 75%  |  核心功能已实现  |  高级功能待扩展', {x:0.5, y:5.0, w:9, h:0.6, fontSize:12, color:C.secondary, bold:true, align:'center', valign:'middle', margin:0});

// SLIDE 12: Progress
let s12 = pptx.addSlide();
s12.background = {color:C.white};
hdr(s12, '10  开发进度与规划');
const tasks = [
  ['架构设计', '完成', '系统架构文档已完成'],
  ['后端 API', '完成', '31/31 单元测试通过'],
  ['前端开发', '完成', 'Next.js 应用构建成功'],
  ['数据库设计', '完成', 'Prisma Schema 已定义'],
  ['API 集成测试', '完成', '18/18 端点测试通过'],
  ['E2E 测试', '完成', '10/10 步骤通过'],
  ['边界条件测试', '完成', '64/64 测试通过'],
  ['部署验证', '完成', '前后端服务健康']
];
s12.addText('已完成任务', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
s12.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.5, w:9, h:2.6, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
tasks.forEach((t, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.7 + col * 4.5, y = 1.6 + row * 0.6;
  s12.addShape(pptx.ShapeType.ellipse, {x, y:y+0.1, w:0.35, h:0.35, fill:{color:'38A169'}});
  s12.addText(t[0], {x:x+0.45, y, w:1.5, h:0.55, fontSize:11, color:C.dark, bold:true, valign:'middle', margin:0});
  s12.addText(t[2], {x:x+2.0, y, w:2.2, h:0.55, fontSize:9, color:C.gray, valign:'middle', margin:0});
});
s12.addText('下一步规划', {x:0.5, y:4.2, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const next = [['GDI 评分完善', '完善评分维度和阈值'], ['蜂群智能', '任务分解与聚合逻辑'], ['高级可视化', '3D 地图和交互增强']];
next.forEach((n, i) => {
  s12.addShape(pptx.ShapeType.roundRect, {x:0.5+i*3.1, y:4.7, w:2.9, h:0.8, fill:{color:C.white}, line:{color:C.secondary, width:2}, shadow:sh()});
  s12.addText(n[0], {x:0.5+i*3.1, y:4.75, w:2.9, h:0.4, fontSize:12, color:C.secondary, bold:true, align:'center', margin:0});
  s12.addText(n[1], {x:0.5+i*3.1, y:5.15, w:2.9, h:0.3, fontSize:9, color:C.gray, align:'center', margin:0});
});

// SLIDE 13: Thank You
let s13 = pptx.addSlide();
s13.background = {color:C.primary};
s13.addText('感谢观看', {x:0.5, y:2.0, w:9, h:1.0, fontSize:48, color:C.white, bold:true, align:'center'});
s13.addText('My Evo - AI 自我进化基础设施', {x:0.5, y:3.2, w:9, h:0.6, fontSize:24, color:C.accent, align:'center'});
s13.addText('"One agent learns. A million inherit."', {x:0.5, y:4.0, w:9, h:0.5, fontSize:18, color:C.lightGray, italic:true, align:'center'});
s13.addText('项目调研报告 | 2026-05-07', {x:0.5, y:5.0, w:9, h:0.4, fontSize:14, color:C.gray, align:'center'});

// Save the file
pptx.writeFile({fileName: '/workspace/my-evo/My-Evo-项目调研报告.pptx'})
  .then(() => console.log('PPTX created successfully: My-Evo-项目调研报告.pptx'))
  .catch(err => console.error('Error creating PPTX:', err));
