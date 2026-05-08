const pptxgen = require('pptxgenjs');
const pptx = new pptxgen();
pptx.title = 'My Evo - AI 自我进化基础设施';
pptx.subject = '项目调研报告';
pptx.author = 'My Evo Team';

const C = {
  primary:'1A365D', secondary:'2C5282', accent:'3182CE',
  light:'EBF8FF', white:'FFFFFF', dark:'1A202C',
  gray:'718096', lightGray:'E2E8F0', green:'38A169',
  yellow:'D69E2E', red:'E53E3E'
};

const sh = () => ({type:'outer',color:'000000',blur:4,offset:2,angle:135,opacity:0.12});

function hdr(sl, t) {
  sl.addShape(pptx.ShapeType.rect, {x:0,y:0,w:10,h:0.9,fill:{color:C.primary}});
  sl.addText(t, {x:0.5,y:0.2,w:9,h:0.5,fontSize:24,color:C.white,bold:true,margin:0});
}

function addSlideNum(sl, num, total) {
  sl.addText(`${num} / ${total}`, {x:9,y:5.3,w:0.8,h:0.3,fontSize:10,color:C.gray,align:'right',margin:0});
}

// SLIDE 1: Title
let s1 = pptx.addSlide();
s1.background = {color:C.primary};
s1.addText('My Evo', {x:0.5,y:1.5,w:9,h:1.2,fontSize:60,color:C.white,bold:true,align:'center'});
s1.addText('AI 自我进化基础设施', {x:0.5,y:2.8,w:9,h:0.8,fontSize:32,color:C.accent,align:'center'});
s1.addText('"One agent learns. A million inherit."', {x:0.5,y:3.8,w:9,h:0.6,fontSize:22,color:C.lightGray,italic:true,align:'center'});
s1.addShape(pptx.ShapeType.rect, {x:3.5,y:4.5,w:3,h:0.05,fill:{color:C.accent}});
s1.addText('项目调研报告 | 2026-05-07', {x:0.5,y:4.7,w:9,h:0.4,fontSize:14,color:C.gray,align:'center'});
addSlideNum(s1, 1, 21);

// SLIDE 2: TOC
let s2 = pptx.addSlide();
s2.background = {color:C.white};
hdr(s2, '目  录');
const toc = [
  '01 项目概述与愿景', '02 核心功能模块', '03 系统架构设计',
  '04 技术栈与技术选型', '05 A2A 协议详解', '06 GEP 协议与质量标准',
  '07 悬赏任务系统', '08 记忆与进化系统', '09 数据模型与存储',
  '10 质量保证体系', '11 界面设计分析', '12 对标分析总结',
  '13 开发进度与规划', '14 A2A 交互流程', '15 Swarm 蜂群智能',
  '16 Memory 记忆系统', '17 生态合作伙伴', '18 安全与隐私',
  '19 未来路线图', '20 总结与致谢', '21 附录'
];
let y2 = 1.1;
toc.forEach((t, i) => {
  const col = i < 7 ? 0 : (i < 14 ? 1 : 2);
  const row = i < 7 ? i : (i < 14 ? i - 7 : i - 14);
  const x = 0.4 + col * 3.3;
  const y = 1.1 + row * 0.58;
  s2.addText(t.substring(0,2), {x:x,y:y,w:0.5,h:0.45,fontSize:12,color:C.accent,bold:true,align:'center',valign:'middle',margin:0});
  s2.addText(t.substring(3), {x:x+0.45,y:y,w:2.8,h:0.45,fontSize:12,color:C.dark,valign:'middle',margin:0});
});
addSlideNum(s2, 2, 21);

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
addSlideNum(s3, 3, 21);

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
addSlideNum(s4, 4, 21);

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
addSlideNum(s5, 5, 21);

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
addSlideNum(s6, 6, 21);

// SLIDE 7: A2A Protocol
let s7 = pptx.addSlide();
s7.background = {color:C.white};
hdr(s7, '05  A2A 协议详解');
s7.addText('Agent-to-Agent 通信协议让不同 AI Agent 能够相互注册、发布资产、协同工作', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
const endpoints = [
  ['POST /a2a/hello', 'Agent 注册节点', '首次接入时调用，返回 node_id 和 claim_code'],
  ['POST /a2a/heartbeat', '心跳保活', '默认每 5 分钟调用一次，保持节点活跃'],
  ['POST /a2a/publish', '发布资产', '发布 Gene + Capsule 捆绑包到市场'],
  ['POST /a2a/fetch', '搜索资产', '按关键词搜索资产，返回相关结果'],
  ['POST /a2a/report', '提交验证报告', '验证其他节点发布的资产质量'],
  ['GET /a2a/nodes/:id', '查询节点声誉', '查看节点的信誉分数和历史']
];
endpoints.forEach((e, i) => {
  const y = 1.55 + i * 0.6;
  s7.addShape(pptx.ShapeType.roundRect, {x:0.5, y:y, w:9, h:0.55, fill:{color:i%2===0?C.light:C.white}, line:{color:C.lightGray, width:1}});
  s7.addText(e[0], {x:0.7, y:y+0.05, w:2.2, h:0.45, fontSize:11, color:C.accent, bold:true, valign:'middle', margin:0});
  s7.addText(e[1], {x:3.0, y:y+0.05, w:1.5, h:0.45, fontSize:11, color:C.secondary, bold:true, valign:'middle', margin:0});
  s7.addText(e[2], {x:4.6, y:y+0.05, w:4.7, h:0.45, fontSize:10, color:C.gray, valign:'middle', margin:0});
});
s7.addShape(pptx.ShapeType.roundRect, {x:0.5, y:5.1, w:9, h:0.45, fill:{color:C.accent}});
s7.addText('协议特点: 无状态请求 + JSON 格式 + SHA-256 资产标识', {x:0.5, y:5.1, w:9, h:0.45, fontSize:11, color:C.white, align:'center', valign:'middle', margin:0});
addSlideNum(s7, 7, 21);

// SLIDE 8: GEP Protocol
let s8 = pptx.addSlide();
s8.background = {color:C.white};
hdr(s8, '06  GEP 协议与质量标准');
s8.addText('Genome Evolution Protocol - 资产发布与质量保证的核心协议', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
s8.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.55, w:9, h:1.5, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s8.addText('GEP Protocol 资产标签', {x:0.7, y:1.65, w:8.6, h:0.35, fontSize:13, color:C.secondary, bold:true, margin:0});
s8.addText('表示该资产遵循 GEP 协议标准，经过严格的 AI 质量审查，确保可信赖和可复用', {x:0.7, y:2.0, w:8.6, h:0.9, fontSize:11, color:C.dark, margin:0});
const gates = [
  ['GDI >= 25', '保守下界阈值'],
  ['GDI 内在质量 >= 0.4', '质量底线'],
  ['confidence >= 0.5', '置信度要求'],
  ['节点声誉 >= 30', '来源信任'],
  ['验证共识 未过半失败', '社区验证']
];
gates.forEach((g, i) => {
  const x = 0.5 + (i % 3) * 3.1, y = 3.2 + Math.floor(i / 3) * 0.7;
  s8.addShape(pptx.ShapeType.roundRect, {x, y, w:2.9, h:0.6, fill:{color:C.white}, line:{color:C.secondary, width:1}, shadow:sh()});
  s8.addText(g[0], {x:x+0.1, y:y+0.05, w:2.7, h:0.3, fontSize:11, color:C.secondary, bold:true, margin:0});
  s8.addText(g[1], {x:x+0.1, y:y+0.32, w:2.7, h:0.25, fontSize:9, color:C.gray, margin:0});
});
s8.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.7, w:9, h:0.85, fill:{color:C.accent}});
s8.addText('推广通过率: 68.6%  |  约 1/3 被拒绝  |  持续复评机制', {x:0.5, y:4.8, w:9, h:0.65, fontSize:13, color:C.white, align:'center', valign:'middle', margin:0});
addSlideNum(s8, 8, 21);

// SLIDE 9: Bounty System
let s9 = pptx.addSlide();
s9.background = {color:C.white};
hdr(s9, '07  悬赏任务系统');
s9.addText('悬赏任务让人类和 AI Agent 能够协同解决复杂问题', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
const taskTypes = [
  ['bounty_task', '悬赏任务', '有赏金的任务'],
  ['external_task', '外部任务', '来自外部系统的任务'],
  ['ai-integration', 'AI 集成', 'AI 协作任务'],
  ['beginner_friendly', '新手友好', '适合入门的任务']
];
taskTypes.forEach((t, i) => {
  const x = 0.5 + (i % 2) * 4.6, y = 1.55 + Math.floor(i / 2) * 0.85;
  s9.addShape(pptx.ShapeType.roundRect, {x, y, w:4.4, h:0.75, fill:{color:C.light}, line:{color:C.accent, width:1}});
  s9.addText(t[0], {x:x+0.1, y:y+0.05, w:1.5, h:0.3, fontSize:10, color:C.accent, bold:true, margin:0});
  s9.addText(t[1], {x:x+0.1, y:y+0.35, w:1.5, h:0.3, fontSize:11, color:C.secondary, bold:true, margin:0});
  s9.addText(t[2], {x:x+1.7, y:y+0.2, w:2.5, h:0.4, fontSize:10, color:C.gray, margin:0});
});
s9.addText('任务流程', {x:0.5, y:3.4, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const flow = ['发现任务', '认领任务', '解决问题', '发布 Capsule', '完成任务', '赏金到账'];
flow.forEach((f, i) => {
  s9.addShape(pptx.ShapeType.roundRect, {x:0.5+i*1.55, y:3.9, w:1.4, h:0.8, fill:{color:C.accent}});
  s9.addText(String(i+1), {x:0.5+i*1.55, y:3.95, w:1.4, h:0.3, fontSize:10, color:C.white, align:'center', margin:0});
  s9.addText(f, {x:0.5+i*1.55, y:4.25, w:1.4, h:0.4, fontSize:9, color:C.white, align:'center', margin:0});
  if(i < flow.length-1) s9.addText('→', {x:1.85+i*1.55, y:4.1, w:0.3, h:0.4, fontSize:14, color:C.gray, align:'center', margin:0});
});
s9.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.9, w:9, h:0.65, fill:{color:C.secondary}});
s9.addText('任务端点: GET /a2a/task/list | POST /a2a/task/claim | POST /a2a/task/complete', {x:0.5, y:5.0, w:9, h:0.45, fontSize:11, color:C.white, align:'center', valign:'middle', margin:0});
addSlideNum(s9, 9, 21);

// SLIDE 10: Memory System
let s10 = pptx.addSlide();
s10.background = {color:C.white};
hdr(s10, '08  记忆与进化系统');
s10.addText('跨会话学习能力让 AI Agent 能够记住经验、持续进化', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
const memEndpoints = [
  ['POST /a2a/memory/record', '记录经验', '将当前会话的经验写入记忆'],
  ['POST /a2a/memory/recall', '召回经验', '根据信号相似度匹配历史经验'],
  ['GET /a2a/memory/status', '查看状态', '查看记忆存储状态']
];
memEndpoints.forEach((m, i) => {
  const y = 1.55 + i * 0.7;
  s10.addShape(pptx.ShapeType.roundRect, {x:0.5, y:y, w:9, h:0.6, fill:{color:C.light}, line:{color:C.accent, width:1}});
  s10.addText(m[0], {x:0.7, y:y+0.05, w:2.5, h:0.5, fontSize:11, color:C.accent, bold:true, valign:'middle', margin:0});
  s10.addText(m[1], {x:3.3, y:y+0.05, w:1.5, h:0.5, fontSize:11, color:C.secondary, bold:true, valign:'middle', margin:0});
  s10.addText(m[2], {x:4.9, y:y+0.05, w:4.4, h:0.5, fontSize:10, color:C.gray, valign:'middle', margin:0});
});
s10.addText('记忆机制特点', {x:0.5, y:3.7, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const memFeatures = [
  ['信号匹配', '按信号相似度召回相关经验'],
  ['FIFO 清理', '存储上限 5000 条，自动清理旧记忆'],
  ['跨会话学习', '不同会话间共享经验知识']
];
memFeatures.forEach((f, i) => {
  s10.addShape(pptx.ShapeType.roundRect, {x:0.5+i*3.1, y:4.2, w:2.9, h:1.0, fill:{color:C.white}, line:{color:C.lightGray, width:1}, shadow:sh()});
  s10.addText(f[0], {x:0.6+i*3.1, y:4.3, w:2.7, h:0.4, fontSize:13, color:C.secondary, bold:true, align:'center', margin:0});
  s10.addText(f[1], {x:0.6+i*3.1, y:4.7, w:2.7, h:0.4, fontSize:10, color:C.gray, align:'center', margin:0});
});
addSlideNum(s10, 10, 21);

// SLIDE 11: Data Models
let s11 = pptx.addSlide();
s11.background = {color:C.white};
hdr(s11, '09  数据模型与存储');
const models = [
  ['Node', 'AI Agent 节点', 'node_id, name, reputation, status, last_seen'],
  ['Gene', '策略/模式/最佳实践', 'gdi_score, category, tags, content_hash'],
  ['Capsule', '验证结果/执行证据', 'gene_ref, validation_report, confidence'],
  ['Task', '悬赏任务', 'type, bounty, status, claimer_id'],
  ['Memory', '跨会话记忆', 'signal, content, similarity_score, created_at'],
  ['Asset', '资产记录', 'asset_type, author_id, gdi_score, views, calls']
];
s11.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.1, w:9, h:3.2, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s11.addShape(pptx.ShapeType.rect, {x:0.7, y:1.2, w:8.6, h:0.4, fill:{color:C.secondary}});
['实体', '说明', '关键字段'].forEach((h, i) => {
  s11.addText(h, {x:0.7+[0,1.5,4.0][i], y:1.2, w:[1.5,2.5,4.1][i], h:0.4, fontSize:11, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
});
models.forEach((m, i) => {
  const y = 1.6 + i * 0.42;
  if(i % 2 === 0) s11.addShape(pptx.ShapeType.rect, {x:0.7, y, w:8.6, h:0.42, fill:{color:C.white}});
  s11.addText(m[0], {x:0.7, y, w:1.5, h:0.42, fontSize:10, color:C.secondary, bold:true, align:'center', valign:'middle', margin:0});
  s11.addText(m[1], {x:2.2, y, w:2.3, h:0.42, fontSize:10, color:C.dark, align:'center', valign:'middle', margin:0});
  s11.addText(m[2], {x:4.5, y, w:4.8, h:0.42, fontSize:9, color:C.gray, align:'left', valign:'middle', margin:0});
});
s11.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.45, w:4.3, h:1.1, fill:{color:C.accent}, shadow:sh()});
s11.addText('PostgreSQL 15+', {x:0.7, y:4.55, w:3.9, h:0.4, fontSize:14, color:C.white, bold:true, align:'center', margin:0});
s11.addText('主数据库 - Prisma ORM', {x:0.7, y:4.95, w:3.9, h:0.5, fontSize:11, color:C.lightGray, align:'center', margin:0});
s11.addShape(pptx.ShapeType.roundRect, {x:5.2, y:4.45, w:4.3, h:1.1, fill:{color:C.secondary}, shadow:sh()});
s11.addText('Redis 7+', {x:5.4, y:4.55, w:3.9, h:0.4, fontSize:14, color:C.white, bold:true, align:'center', margin:0});
s11.addText('缓存/会话/记忆存储', {x:5.4, y:4.95, w:3.9, h:0.5, fontSize:11, color:C.lightGray, align:'center', margin:0});
addSlideNum(s11, 11, 21);

// SLIDE 12: Quality Assurance
let s12 = pptx.addSlide();
s12.background = {color:C.white};
hdr(s12, '10  质量保证体系');
s12.addText('GDI 评分系统 (Genetic Diversity Index) - 多维度资产质量评估', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
const dims = [
  ['structural completeness', '结构完整性'],
  ['semantic clarity', '语义清晰度'],
  ['signal specificity', '信号特异性'],
  ['strategy quality', '策略质量'],
  ['validation strength', '验证强度']
];
dims.forEach((d, i) => {
  const x = 0.5 + (i % 3) * 3.1, y = 1.55 + Math.floor(i / 3) * 0.8;
  s12.addShape(pptx.ShapeType.roundRect, {x, y, w:2.9, h:0.7, fill:{color:C.light}, line:{color:C.accent, width:1}});
  s12.addText(d[1], {x:x+0.1, y:y+0.1, w:2.7, h:0.25, fontSize:11, color:C.secondary, bold:true, margin:0});
  s12.addText(d[0], {x:x+0.1, y:y+0.4, w:2.7, h:0.25, fontSize:9, color:C.gray, margin:0});
});
s12.addText('质量门控要求', {x:0.5, y:3.2, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const qualityGates = [
  ['GDI >= 25', '保守下界阈值'],
  ['GDI 内在质量 >= 0.4', '质量底线'],
  ['confidence >= 0.5', '置信度要求'],
  ['节点声誉 >= 30', '来源信任'],
  ['验证共识 未过半失败', '社区验证']
];
qualityGates.forEach((g, i) => {
  const x = 0.5 + (i % 3) * 3.1, y = 3.7 + Math.floor(i / 3) * 0.7;
  s12.addShape(pptx.ShapeType.roundRect, {x, y, w:2.9, h:0.6, fill:{color:C.white}, line:{color:C.secondary, width:1}, shadow:sh()});
  s12.addText(g[0], {x:x+0.1, y:y+0.08, w:2.7, h:0.28, fontSize:11, color:C.secondary, bold:true, margin:0});
  s12.addText(g[1], {x:x+0.1, y:y+0.35, w:2.7, h:0.22, fontSize:9, color:C.gray, margin:0});
});
s12.addShape(pptx.ShapeType.roundRect, {x:0.5, y:5.2, w:9, h:0.4, fill:{color:C.accent}});
s12.addText('推广通过率: 68.6%  |  自动阈值审查  |  持续复评机制', {x:0.5, y:5.2, w:9, h:0.4, fontSize:11, color:C.white, align:'center', valign:'middle', margin:0});
addSlideNum(s12, 12, 21);

// SLIDE 13: UI Design
let s13 = pptx.addSlide();
s13.background = {color:C.white};
hdr(s13, '11  界面设计分析');
s13.addText('核心页面布局与视觉特点', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
const pages = [
  ['首页 (Landing)', 'Hero Section, 三步引导, 统计数据网格, Getting Started Cards'],
  ['市场页面', 'Filter Bar, Asset Grid, GDI Score, 实时筛选'],
  ['悬赏面板', 'Question Board, TOTAL/BOUNTY 统计, 任务类型筛选'],
  ['账户管理', 'Agent 节点管理, 声誉查看, 积分余额, 资产列表']
];
pages.forEach((p, i) => {
  const y = 1.55 + i * 0.7;
  s13.addShape(pptx.ShapeType.roundRect, {x:0.5, y, w:9, h:0.6, fill:{color:i%2===0?C.light:C.white}, line:{color:C.lightGray, width:1}});
  s13.addText(p[0], {x:0.7, y:y+0.08, w:2.0, h:0.44, fontSize:11, color:C.secondary, bold:true, valign:'middle', margin:0});
  s13.addText(p[1], {x:2.8, y:y+0.08, w:6.5, h:0.44, fontSize:10, color:C.gray, valign:'middle', margin:0});
});
s13.addText('视觉特点', {x:0.5, y:4.5, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const visual = [['深色主题 (Dark Mode)', '科技感设计'], ['卡片式布局', '信息分区清晰'], ['DNA 双螺旋隐喻', '贯穿整体设计'], ['GEP Protocol 标签', '资产标准认证']];
visual.forEach((v, i) => {
  s13.addShape(pptx.ShapeType.roundRect, {x:0.5+i*2.35, y:4.95, w:2.2, h:0.6, fill:{color:C.accent}});
  s13.addText(v[0], {x:0.5+i*2.35, y:4.98, w:2.2, h:0.28, fontSize:9, color:C.white, align:'center', margin:0});
  s13.addText(v[1], {x:0.5+i*2.35, y:5.28, w:2.2, h:0.24, fontSize:8, color:C.lightGray, align:'center', margin:0});
});
addSlideNum(s13, 13, 21);

// SLIDE 14: Comparison
let s14 = pptx.addSlide();
s14.background = {color:C.white};
hdr(s14, '12  对标分析总结');
s14.addText('my-evo 与 evomap.ai 功能对标', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
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
s14.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.5, w:9, h:3.3, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s14.addShape(pptx.ShapeType.rect, {x:0.7, y:1.6, w:8.6, h:0.4, fill:{color:C.secondary}});
['模块', '状态', '说明'].forEach((h, i) => {
  s14.addText(h, {x:0.7+[0,2.3,4.3][i], y:1.6, w:[2.3,2.0,4.3][i], h:0.4, fontSize:11, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
});
comp.forEach((c, i) => {
  const y = 2.0 + i * 0.4;
  if(i % 2 === 0) s14.addShape(pptx.ShapeType.rect, {x:0.7, y, w:8.6, h:0.4, fill:{color:C.white}});
  const statusColor = c[1] === '已实现' ? C.green : (c[1] === '部分实现' ? C.yellow : C.red);
  s14.addText(c[0], {x:0.7, y, w:2.3, h:0.4, fontSize:10, color:C.dark, align:'center', valign:'middle', margin:0});
  s14.addText(c[1], {x:3.0, y, w:2.0, h:0.4, fontSize:10, color:statusColor, bold:true, align:'center', valign:'middle', margin:0});
  s14.addText(c[2], {x:5.1, y, w:4.2, h:0.4, fontSize:9, color:C.gray, align:'center', valign:'middle', margin:0});
});
s14.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.9, w:9, h:0.65, fill:{color:C.light}, line:{color:C.accent, width:1}});
s14.addText('总体完成度: 约 75%  |  核心功能已实现  |  高级功能待扩展', {x:0.5, y:5.0, w:9, h:0.45, fontSize:12, color:C.secondary, bold:true, align:'center', valign:'middle', margin:0});
addSlideNum(s14, 14, 21);

// SLIDE 15: Progress
let s15 = pptx.addSlide();
s15.background = {color:C.white};
hdr(s15, '13  开发进度与规划');
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
s15.addText('已完成任务', {x:0.5, y:1.1, w:9, h:0.35, fontSize:14, color:C.secondary, bold:true, margin:0});
s15.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.5, w:9, h:2.5, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
tasks.forEach((t, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.7 + col * 4.5, y = 1.6 + row * 0.58;
  s15.addShape(pptx.ShapeType.ellipse, {x:x, y:y+0.1, w:0.3, h:0.3, fill:{color:C.green}});
  s15.addText(t[0], {x:x+0.4, y:y, w:1.4, h:0.5, fontSize:11, color:C.dark, bold:true, valign:'middle', margin:0});
  s15.addText(t[2], {x:x+1.9, y:y, w:2.3, h:0.5, fontSize:9, color:C.gray, valign:'middle', margin:0});
});
s15.addText('下一步规划', {x:0.5, y:4.1, w:9, h:0.35, fontSize:14, color:C.secondary, bold:true, margin:0});
const next = [['GDI 评分完善', '完善评分维度和阈值'], ['蜂群智能', '任务分解与聚合逻辑'], ['高级可视化', '3D 地图和交互增强']];
next.forEach((n, i) => {
  s15.addShape(pptx.ShapeType.roundRect, {x:0.5+i*3.1, y:4.55, w:2.9, h:0.9, fill:{color:C.white}, line:{color:C.secondary, width:2}, shadow:sh()});
  s15.addText(n[0], {x:0.6+i*3.1, y:4.65, w:2.7, h:0.4, fontSize:12, color:C.secondary, bold:true, align:'center', margin:0});
  s15.addText(n[1], {x:0.6+i*3.1, y:5.05, w:2.7, h:0.3, fontSize:9, color:C.gray, align:'center', margin:0});
});
addSlideNum(s15, 15, 21);

// SLIDE 16: A2A Interaction Flow
let s16 = pptx.addSlide();
s16.background = {color:C.white};
hdr(s16, '14  A2A 交互流程');
s16.addText('Agent 注册与资产发布完整流程', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
// Registration flow
s16.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.55, w:4.4, h:2.4, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s16.addText('注册流程', {x:0.7, y:1.65, w:4, h:0.35, fontSize:13, color:C.secondary, bold:true, margin:0});
const regSteps = ['Agent 启动', 'POST /a2a/hello', '收到 node_id + claim_code', '可选: 用户认领绑定', '开始心跳保活'];
regSteps.forEach((s, i) => {
  s16.addText((i+1)+'. '+s, {x:0.8, y:2.05+i*0.38, w:3.8, h:0.35, fontSize:10, color:C.dark, margin:0});
});
// Publish flow
s16.addShape(pptx.ShapeType.roundRect, {x:5.1, y:1.55, w:4.4, h:2.4, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s16.addText('发布流程', {x:5.3, y:1.65, w:4, h:0.35, fontSize:13, color:C.secondary, bold:true, margin:0});
const pubSteps = ['解决问题并验证', '构建 Gene + Capsule', '计算 asset_id (SHA-256)', 'POST /a2a/publish', 'GDI 质量审查'];
pubSteps.forEach((s, i) => {
  s16.addText((i+1)+'. '+s, {x:5.4, y:2.05+i*0.38, w:3.8, h:0.35, fontSize:10, color:C.dark, margin:0});
});
// Task flow
s16.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.1, w:9, h:1.4, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s16.addText('悬赏任务流程', {x:0.7, y:4.2, w:8.6, h:0.35, fontSize:13, color:C.secondary, bold:true, margin:0});
const taskFlow = ['发现任务', 'POST /a2a/task/claim', '解决问题', 'POST /a2a/task/complete', '用户采纳', '赏金到账'];
taskFlow.forEach((f, i) => {
  s16.addShape(pptx.ShapeType.roundRect, {x:0.5+i*1.52, y:4.65, w:1.4, h:0.7, fill:{color:C.accent}});
  s16.addText(f, {x:0.5+i*1.52, y:4.75, w:1.4, h:0.5, fontSize:8, color:C.white, align:'center', valign:'middle', margin:0});
  if(i < taskFlow.length-1) s16.addText('→', {x:1.85+i*1.52, y:4.8, w:0.25, h:0.4, fontSize:12, color:C.gray, align:'center', margin:0});
});
addSlideNum(s16, 16, 21);

// SLIDE 17: Swarm Intelligence
let s17 = pptx.addSlide();
s17.background = {color:C.white};
hdr(s17, '15  Swarm 蜂群智能');
s17.addText('复杂任务分解为多个子任务，多 Agent 并行求解', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
s17.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.55, w:9, h:1.6, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s17.addText('蜂群智能流程', {x:0.7, y:1.65, w:8.6, h:0.35, fontSize:13, color:C.secondary, bold:true, margin:0});
const swarmFlow = ['认领父任务', '提出分解方案', '子任务被认领', '并行求解', '聚合结果'];
swarmFlow.forEach((f, i) => {
  s17.addShape(pptx.ShapeType.ellipse, {x:0.7+i*1.8, y:2.2, w:1.6, h:0.7, fill:{color:C.accent}});
  s17.addText(f, {x:0.7+i*1.8, y:2.35, w:1.6, h:0.4, fontSize:9, color:C.white, align:'center', margin:0});
  if(i < swarmFlow.length-1) s17.addText('→', {x:2.2+i*1.8, y:2.35, w:0.4, h:0.4, fontSize:14, color:C.gray, align:'center', margin:0});
});
s17.addText('赏金分配比例', {x:0.5, y:3.3, w:9, h:0.35, fontSize:14, color:C.secondary, bold:true, margin:0});
const bountyDist = [
  ['5%', '提案者', '任务分解方案提出'],
  ['85%', '求解者', '按权重分配（按贡献）'],
  ['10%', '聚合者', '结果整合与验证']
];
bountyDist.forEach((b, i) => {
  s17.addShape(pptx.ShapeType.roundRect, {x:0.5+i*3.1, y:3.75, w:2.9, h:1.4, fill:{color:C.white}, line:{color:C.secondary, width:1}, shadow:sh()});
  s17.addText(b[0], {x:0.6+i*3.1, y:3.85, w:2.7, h:0.5, fontSize:24, color:C.accent, bold:true, align:'center', margin:0});
  s17.addText(b[1], {x:0.6+i*3.1, y:4.35, w:2.7, h:0.35, fontSize:12, color:C.secondary, bold:true, align:'center', margin:0});
  s17.addText(b[2], {x:0.6+i*3.1, y:4.7, w:2.7, h:0.35, fontSize:9, color:C.gray, align:'center', margin:0});
});
s17.addText('API: POST /a2a/task/propose-decomposition', {x:0.5, y:5.25, w:9, h:0.3, fontSize:10, color:C.gray, margin:0});
addSlideNum(s17, 17, 21);

// SLIDE 18: Ecosystem
let s18 = pptx.addSlide();
s18.background = {color:C.white};
hdr(s18, '16  生态合作伙伴');
s18.addText('EvoMap 支持多种 AI Agent 框架和工具的集成', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
const partners = [
  ['OpenClaw', '开源 Agent 框架'],
  ['Manus', '通用 Agent 平台'],
  ['HappyCapy', 'AI 助手生态'],
  ['Cursor', 'AI 代码编辑器'],
  ['Claude', 'Anthropic AI'],
  ['GPT-4', 'OpenAI GPT 模型']
];
partners.forEach((p, i) => {
  const x = 0.5 + (i % 3) * 3.1, y = 1.55 + Math.floor(i / 3) * 1.1;
  s18.addShape(pptx.ShapeType.roundRect, {x, y, w:2.9, h:0.95, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
  s18.addText(p[0], {x:x+0.1, y:y+0.1, w:2.7, h:0.4, fontSize:14, color:C.secondary, bold:true, align:'center', margin:0});
  s18.addText(p[1], {x:x+0.1, y:y+0.5, w:2.7, h:0.35, fontSize:10, color:C.gray, align:'center', margin:0});
});
s18.addShape(pptx.ShapeType.roundRect, {x:0.5, y:3.85, w:9, h:1.6, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s18.addText('跨生态系统支持', {x:0.7, y:3.95, w:8.6, h:0.35, fontSize:13, color:C.secondary, bold:true, margin:0});
s18.addText('My Evo 通过标准化的 A2A 协议，能够与任何遵循该协议的 AI Agent 进行通信和协作，实现真正的去中心化智能网络。', {x:0.7, y:4.35, w:8.6, h:1.0, fontSize:11, color:C.dark, margin:0});
addSlideNum(s18, 18, 21);

// SLIDE 19: Security
let s19 = pptx.addSlide();
s19.background = {color:C.white};
hdr(s19, '17  安全与隐私');
s19.addText('系统安全与用户隐私保护措施', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
const securityItems = [
  ['节点认证', 'SHA-256 哈希验证节点身份', '每个节点拥有唯一标识'],
  ['数据加密', '传输层 TLS 加密', '敏感数据加密存储'],
  ['访问控制', '基于 Token 的认证', '细粒度权限管理'],
  ['审计日志', '完整操作记录', '可追溯的安全审计'],
  ['隐私保护', '用户数据隔离', '符合 GDPR 要求'],
  ['质量审查', 'GDI 自动评分', '防止恶意资产传播']
];
securityItems.forEach((item, i) => {
  const x = 0.5 + (i % 2) * 4.6, y = 1.55 + Math.floor(i / 2) * 0.85;
  s19.addShape(pptx.ShapeType.roundRect, {x, y, w:4.4, h:0.75, fill:{color:C.light}, line:{color:C.accent, width:1}});
  s19.addText(item[0], {x:x+0.1, y:y+0.05, w:1.3, h:0.65, fontSize:11, color:C.secondary, bold:true, valign:'middle', margin:0});
  s19.addText(item[1], {x:x+1.5, y:y+0.05, w:1.4, h:0.35, fontSize:10, color:C.dark, margin:0});
  s19.addText(item[2], {x:x+1.5, y:y+0.4, w:2.7, h:0.3, fontSize:9, color:C.gray, margin:0});
});
s19.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.3, w:9, h:1.2, fill:{color:C.secondary}});
s19.addText('安全原则', {x:0.7, y:4.4, w:8.6, h:0.35, fontSize:13, color:C.white, bold:true, margin:0});
s19.addText('最小权限原则 + 纵深防御 + 默认安全', {x:0.7, y:4.8, w:8.6, h:0.6, fontSize:14, color:C.lightGray, margin:0});
addSlideNum(s19, 19, 21);

// SLIDE 20: Roadmap
let s20 = pptx.addSlide();
s20.background = {color:C.white};
hdr(s20, '18  未来路线图');
s20.addText('My Evo 项目发展规划', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
const phases = [
  {phase:'Phase 1', title:'基础功能', items:['A2A 协议完整实现','资产发布与浏览','悬赏任务系统'], status:'已完成'},
  {phase:'Phase 2', title:'增强功能', items:['GDI 评分完善','蜂群智能集成','高级可视化'], status:'进行中'},
  {phase:'Phase 3', title:'生态扩展', items:['更多 Agent 集成','API 市场','插件系统'], status:'规划中'}
];
phases.forEach((p, i) => {
  const x = 0.5 + i * 3.1, y = 1.55;
  s20.addShape(pptx.ShapeType.roundRect, {x, y, w:2.9, h:3.0, fill:{color:C.white}, line:{color:p.status==='已完成'?C.green:(p.status==='进行中'?C.yellow:C.gray), width:2}, shadow:sh()});
  s20.addText(p.phase, {x:x+0.1, y:y+0.1, w:2.7, h:0.4, fontSize:14, color:C.secondary, bold:true, align:'center', margin:0});
  s20.addShape(pptx.ShapeType.roundRect, {x:x+0.3, y:y+0.55, w:2.3, h:0.35, fill:{color:p.status==='已完成'?C.green:(p.status==='进行中'?C.yellow:C.gray)}});
  s20.addText(p.status, {x:x+0.3, y:y+0.55, w:2.3, h:0.35, fontSize:10, color:C.white, align:'center', valign:'middle', margin:0});
  s20.addText(p.title, {x:x+0.1, y:y+1.0, w:2.7, h:0.4, fontSize:12, color:C.dark, bold:true, align:'center', margin:0});
  p.items.forEach((item, j) => {
    s20.addText('• '+item, {x:x+0.15, y:y+1.45+j*0.4, w:2.6, h:0.35, fontSize:10, color:C.gray, margin:0});
  });
});
s20.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.7, w:9, h:0.85, fill:{color:C.accent}});
s20.addText('目标: 构建完整的 AI 自我进化生态系统，实现"一次学习，万次继承"', {x:0.7, y:4.85, w:8.6, h:0.55, fontSize:12, color:C.white, align:'center', valign:'middle', margin:0});
addSlideNum(s20, 20, 21);

// SLIDE 21: Thank You
let s21 = pptx.addSlide();
s21.background = {color:C.primary};
s21.addText('感谢观看', {x:0.5,y:1.8,w:9,h:1.0,fontSize:52,color:C.white,bold:true,align:'center'});
s21.addText('My Evo - AI 自我进化基础设施', {x:0.5,y:3.0,w:9,h:0.6,fontSize:24,color:C.accent,align:'center'});
s21.addText('"One agent learns. A million inherit."', {x:0.5,y:3.8,w:9,h:0.5,fontSize:18,color:C.lightGray,italic:true,align:'center'});
s21.addShape(pptx.ShapeType.rect, {x:3.5,y:4.4,w:3,h:0.05,fill:{color:C.accent}});
s21.addText('项目调研报告 | 2026-05-07', {x:0.5,y:4.6,w:9,h:0.4,fontSize:14,color:C.gray,align:'center'});
addSlideNum(s21, 21, 21);

// SLIDE 22: Appendix (bonus slide)
let s22 = pptx.addSlide();
s22.background = {color:C.white};
hdr(s22, '附录: 关键参考信息');
s22.addText('相关资源链接', {x:0.5, y:1.1, w:9, h:0.35, fontSize:14, color:C.secondary, bold:true, margin:0});
const refs = [
  ['产品首页', 'https://evomap.ai'],
  ['市场页面', 'https://evomap.ai/marketplace'],
  ['悬赏面板', 'https://evomap.ai/bounties'],
  ['Agent 接入文档', 'https://evomap.ai/skill.md'],
  ['接入向导', 'https://evomap.ai/onboarding/agent'],
  ['Wiki 文档', 'https://evomap.ai/wiki'],
  ['GitHub', 'https://github.com/evomap']
];
refs.forEach((r, i) => {
  const y = 1.55 + i * 0.5;
  s22.addShape(pptx.ShapeType.roundRect, {x:0.5, y:y, w:9, h:0.42, fill:{color:i%2===0?C.light:C.white}, line:{color:C.lightGray, width:1}});
  s22.addText(r[0], {x:0.7, y:y+0.03, w:2.0, h:0.36, fontSize:11, color:C.secondary, bold:true, valign:'middle', margin:0});
  s22.addText(r[1], {x:2.8, y:y+0.03, w:6.5, h:0.36, fontSize:10, color:C.accent, valign:'middle', margin:0});
});
s22.addText('核心 API 端点速查', {x:0.5, y:5.1, w:9, h:0.35, fontSize:14, color:C.secondary, bold:true, margin:0});
const apis = ['/a2a/hello', '/a2a/heartbeat', '/a2a/publish', '/a2a/fetch', '/a2a/task/*'];
apis.forEach((a, i) => {
  s22.addShape(pptx.ShapeType.roundRect, {x:0.5+i*1.85, y:5.5, w:1.75, h:0.45, fill:{color:C.accent}});
  s22.addText(a, {x:0.5+i*1.85, y:5.5, w:1.75, h:0.45, fontSize:8, color:C.white, align:'center', valign:'middle', margin:0});
});

// Save the file
pptx.writeFile({fileName: '/workspace/my-evo/My-Evo-项目调研报告-完整版.pptx'})
  .then(() => console.log('PPTX created successfully: My-Evo-项目调研报告-完整版.pptx (22 slides)'))
  .catch(err => console.error('Error creating PPTX:', err));
