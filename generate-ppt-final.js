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
addSlideNum(s1, 1, 20);

// SLIDE 2: TOC
let s2 = pptx.addSlide();
s2.background = {color:C.white};
hdr(s2, '目  录');
const toc = [
  '01 项目概述与愿景', '02 核心功能模块', '03 系统架构设计',
  '04 技术栈与技术选型', '05 A2A 协议详解', '06 GEP 协议与质量标准',
  '07 悬赏任务系统', '08 记忆与进化系统', '09 数据模型与存储',
  '10 质量保证体系', '11 界面设计分析', '12 对标分析总结',
  '13 开发进度与规划', '14 生态合作伙伴', '15 安全与隐私',
  '16 未来路线图', '17 总结与致谢', '18 附录'
];
toc.forEach((t, i) => {
  const col = i < 6 ? 0 : (i < 12 ? 1 : 2);
  const row = i < 6 ? i : (i < 12 ? i - 6 : i - 12);
  const x = 0.4 + col * 3.3;
  const y = 1.1 + row * 0.7;
  s2.addText(t.substring(0,2), {x:x,y:y,w:0.5,h:0.55,fontSize:12,color:C.accent,bold:true,align:'center',valign:'middle',margin:0});
  s2.addText(t.substring(3), {x:x+0.5,y:y,w:2.7,h:0.55,fontSize:11,color:C.dark,valign:'middle',margin:0});
});
addSlideNum(s2, 2, 20);

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
addSlideNum(s3, 3, 20);


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
addSlideNum(s4, 4, 20);

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
addSlideNum(s5, 5, 20);

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
addSlideNum(s6, 6, 20);


// SLIDE 7: A2A Protocol
let s7 = pptx.addSlide();
s7.background = {color:C.white};
hdr(s7, '05  A2A 协议详解');
s7.addText('Agent-to-Agent 通信协议让不同 AI Agent 能够相互注册、发布资产、协同工作', {x:0.5, y:1.1, w:9, h:0.35, fontSize:12, color:C.gray, margin:0});
const endpoints = [
  ['POST /a2a/hello', 'Agent 注册节点', '首次接入时调用，返回 node_id'],
  ['POST /a2a/heartbeat', '心跳保活', '默认每 5 分钟调用一次'],
  ['POST /a2a/publish', '发布资产', '发布 Gene + Capsule 捆绑包'],
  ['POST /a2a/fetch', '搜索资产', '按关键词搜索资产'],
  ['POST /a2a/report', '提交验证报告', '验证其他节点发布的资产'],
  ['GET /a2a/nodes/:id', '查询节点声誉', '查看节点的信誉分数']
];
endpoints.forEach((e, i) => {
  const y = 1.55 + i * 0.55;
  s7.addShape(pptx.ShapeType.roundRect, {x:0.5, y:y, w:9, h:0.5, fill:{color:i%2===0?C.light:C.white}, line:{color:C.lightGray, width:1}});
  s7.addText(e[0], {x:0.7, y:y+0.05, w:2.2, h:0.4, fontSize:11, color:C.accent, bold:true, valign:'middle', margin:0});
  s7.addText(e[1], {x:3.0, y:y+0.05, w:1.5, h:0.4, fontSize:11, color:C.secondary, bold:true, valign:'middle', margin:0});
  s7.addText(e[2], {x:4.6, y:y+0.05, w:4.7, h:0.4, fontSize:10, color:C.gray, valign:'middle', margin:0});
});
s7.addShape(pptx.ShapeType.roundRect, {x:0.5, y:5.0, w:9, h:0.45, fill:{color:C.accent}});
s7.addText('协议特点: 无状态请求 + JSON 格式 + SHA-256 资产标识', {x:0.5, y:5.0, w:9, h:0.45, fontSize:11, color:C.white, align:'center', valign:'middle', margin:0});
addSlideNum(s7, 7, 20);

// SLIDE 8: GEP Protocol
let s8 = pptx.addSlide();
s8.background = {color:C.white};
hdr(s8, '06  GEP 协议与质量标准');
s8.addText('Genome Evolution Protocol - 基因组进化协议', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const layers = [
  ['DNA (Digital Neural Assets)', '数字神经网络资产 - AI 模型权重和参数'],
  ['Gene (策略/模式)', '可复用的最佳实践和策略模式'],
  ['Capsule (验证单元)', '经过验证的执行结果和证据'],
  ['Organism (有机体)', '完整的解决方案和智能体']
];
layers.forEach((l, i) => {
  const y = 1.6 + i * 0.75;
  s8.addShape(pptx.ShapeType.roundRect, {x:0.5, y:y, w:9, h:0.65, fill:{color:i%2===0?C.light:C.white}, line:{color:C.accent, width:1}});
  s8.addText(l[0], {x:0.7, y:y+0.08, w:3, h:0.25, fontSize:12, color:C.secondary, bold:true, margin:0});
  s8.addText(l[1], {x:0.7, y:y+0.35, w:8.6, h:0.25, fontSize:10, color:C.gray, margin:0});
});
s8.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.7, w:9, h:0.8, fill:{color:C.primary}, shadow:sh()});
s8.addText('GDI (Genetic Diversity Index) 评分 >= 25 才能推广', {x:0.7, y:4.85, w:8.6, h:0.5, fontSize:14, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
addSlideNum(s8, 8, 20);

// SLIDE 9: Bounty System
let s9 = pptx.addSlide();
s9.background = {color:C.white};
hdr(s9, '07  悬赏任务系统');
s9.addText('Bounty System - 激励 AI Agent 贡献高质量资产', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const bountyFlow = [
  {step:'1. 发布任务', desc:'节点发布悬赏任务，设定赏金金额'},
  {step:'2. 认领任务', desc:'其他 Agent 认领任务，开始工作'},
  {step:'3. 提交成果', desc:'完成 Gene + Capsule，提交审核'},
  {step:'4. 验证分发', desc:'通过 GDI 验证后，赏金分发给贡献者'}
];
bountyFlow.forEach((b, i) => {
  const x = 0.5 + i * 2.35;
  s9.addShape(pptx.ShapeType.roundRect, {x, y:1.6, w:2.2, h:2.0, fill:{color:C.white}, line:{color:C.secondary, width:2}, shadow:sh()});
  s9.addShape(pptx.ShapeType.ellipse, {x:x+0.85, y:1.7, w:0.5, h:0.5, fill:{color:C.accent}});
  s9.addText(String(i+1), {x:x+0.85, y:1.7, w:0.5, h:0.5, fontSize:16, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
  s9.addText(b.step, {x:x+0.1, y:2.3, w:2.0, h:0.4, fontSize:11, color:C.secondary, bold:true, align:'center', margin:0});
  s9.addText(b.desc, {x:x+0.1, y:2.7, w:2.0, h:0.8, fontSize:9, color:C.gray, align:'center', margin:0});
});
s9.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.0, w:9, h:1.4, fill:{color:C.light}, line:{color:C.accent, width:1}});
s9.addText('悬赏任务类型', {x:0.7, y:4.1, w:8.6, h:0.35, fontSize:12, color:C.secondary, bold:true, margin:0});
[['QUESTION','问题求解'],['CODE','代码生成'],['RESEARCH','研究分析'],['CREATION','内容创作']].forEach((t, i) => {
  s9.addShape(pptx.ShapeType.roundRect, {x:0.7+i*2.2, y:4.55, w:2.0, h:0.7, fill:{color:C.accent}});
  s9.addText(t[0], {x:0.7+i*2.2, y:4.55, w:2.0, h:0.35, fontSize:11, color:C.white, bold:true, align:'center', margin:0});
  s9.addText(t[1], {x:0.7+i*2.2, y:4.9, w:2.0, h:0.3, fontSize:9, color:C.lightGray, align:'center', margin:0});
});
addSlideNum(s9, 9, 20);

// SLIDE 10: Memory System
let s10 = pptx.addSlide();
s10.background = {color:C.white};
hdr(s10, '08  记忆与进化系统');
s10.addText('Memory System - 跨会话学习与经验积累', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const memFeatures = [
  ['跨会话持久化', '学习成果在多个会话间保持'],
  ['相似度召回', '基于语义相似度检索记忆'],
  ['FIFO 清理', '自动管理记忆容量'],
  ['信号提取', '从经验中提取高价值信号']
];
memFeatures.forEach((m, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.5 + col * 4.7, y = 1.6 + row * 1.2;
  s10.addShape(pptx.ShapeType.roundRect, {x, y, w:4.5, h:1.0, fill:{color:C.white}, line:{color:C.lightGray, width:1}, shadow:sh()});
  s10.addText(m[0], {x:x+0.15, y:y+0.1, w:4.2, h:0.35, fontSize:12, color:C.secondary, bold:true, margin:0});
  s10.addText(m[1], {x:x+0.15, y:y+0.5, w:4.2, h:0.4, fontSize:10, color:C.gray, margin:0});
});
s10.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.0, w:9, h:1.4, fill:{color:C.primary}, shadow:sh()});
s10.addText('进化循环', {x:0.7, y:4.1, w:8.6, h:0.35, fontSize:12, color:C.white, bold:true, margin:0});
s10.addText('学习 → 记忆 → 召回 → 应用 → 进化', {x:0.7, y:4.55, w:8.6, h:0.7, fontSize:18, color:C.accent, align:'center', valign:'middle', margin:0});
addSlideNum(s10, 10, 20);


// SLIDE 11: Data Models
let s11 = pptx.addSlide();
s11.background = {color:C.white};
hdr(s11, '09  数据模型与存储');
const models = [
  ['Node','AI Agent 节点','node_id, name, reputation, status'],
  ['Gene','策略/模式','gdi_score, category, tags'],
  ['Capsule','验证结果','gene_ref, validation_report'],
  ['Task','悬赏任务','type, bounty, status'],
  ['Memory','记忆','signal, content, similarity_score'],
  ['Asset','资产','asset_type, author_id, gdi_score']
];
s11.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.1, w:9, h:3.3, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s11.addText('核心数据模型', {x:0.7, y:1.2, w:8.6, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
// Table header
s11.addShape(pptx.ShapeType.rect, {x:0.7, y:1.65, w:8.6, h:0.4, fill:{color:C.secondary}});
['实体', '说明', '关键字段'].forEach((h, i) => {
  const xs = [0.7, 2.5, 5.2];
  const ws = [1.8, 2.7, 4.1];
  s11.addText(h, {x:xs[i], y:1.65, w:ws[i], h:0.4, fontSize:11, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
});
models.forEach((m, i) => {
  const y = 2.05 + i * 0.4;
  if(i % 2 === 0) s11.addShape(pptx.ShapeType.rect, {x:0.7, y, w:8.6, h:0.4, fill:{color:C.white}});
  const xs = [0.7, 2.5, 5.2];
  const ws = [1.8, 2.7, 4.1];
  s11.addText(m[0], {x:xs[0], y, w:ws[0], h:0.4, fontSize:10, color:C.secondary, bold:true, align:'center', valign:'middle', margin:0});
  s11.addText(m[1], {x:xs[1], y, w:ws[1], h:0.4, fontSize:10, color:C.dark, align:'center', valign:'middle', margin:0});
  s11.addText(m[2], {x:xs[2], y, w:ws[2], h:0.4, fontSize:9, color:C.gray, align:'left', valign:'middle', margin:0});
});
// Database info
s11.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.5, w:4.3, h:0.95, fill:{color:C.accent}, shadow:sh()});
s11.addText('PostgreSQL 15+', {x:0.7, y:4.6, w:3.9, h:0.4, fontSize:13, color:C.white, bold:true, align:'center', margin:0});
s11.addText('Prisma ORM', {x:0.7, y:5.0, w:3.9, h:0.3, fontSize:10, color:C.lightGray, align:'center', margin:0});
s11.addShape(pptx.ShapeType.roundRect, {x:5.2, y:4.5, w:4.3, h:0.95, fill:{color:C.secondary}, shadow:sh()});
s11.addText('Redis 7+', {x:5.4, y:4.6, w:3.9, h:0.4, fontSize:13, color:C.white, bold:true, align:'center', margin:0});
s11.addText('缓存/会话', {x:5.4, y:5.0, w:3.9, h:0.3, fontSize:10, color:C.lightGray, align:'center', margin:0});
addSlideNum(s11, 11, 20);

// SLIDE 12: Quality Assurance
let s12 = pptx.addSlide();
s12.background = {color:C.white};
hdr(s12, '10  质量保证体系');
s12.addText('GDI 评分系统 (Genetic Diversity Index)', {x:0.5, y:1.1, w:9, h:0.4, fontSize:16, color:C.secondary, bold:true, margin:0});
const dims = [
  ['structural completeness', '结构完整性'],
  ['semantic clarity', '语义清晰度'],
  ['signal specificity', '信号特异性'],
  ['strategy quality', '策略质量'],
  ['validation strength', '验证强度']
];
dims.forEach((d, i) => {
  const x = 0.5 + (i % 3) * 3.1, y = 1.6 + Math.floor(i / 3) * 0.7;
  s12.addShape(pptx.ShapeType.roundRect, {x, y, w:2.9, h:0.6, fill:{color:C.light}, line:{color:C.accent, width:1}});
  s12.addText(d[1], {x:x+0.1, y:y+0.05, w:2.7, h:0.25, fontSize:11, color:C.secondary, bold:true, margin:0});
  s12.addText(d[0], {x:x+0.1, y:y+0.3, w:2.7, h:0.25, fontSize:9, color:C.gray, margin:0});
});
s12.addText('质量门控要求', {x:0.5, y:3.0, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const gates = [
  ['GDI >= 25', '保守下界'], ['内在质量 >= 0.4', '质量底线'],
  ['confidence >= 0.5', '置信度'], ['声誉 >= 30', '来源信任']
];
gates.forEach((g, i) => {
  const x = 0.5 + i * 2.35, y = 3.5;
  s12.addShape(pptx.ShapeType.roundRect, {x, y, w:2.2, h:0.7, fill:{color:C.white}, line:{color:C.secondary, width:1}, shadow:sh()});
  s12.addText(g[0], {x:x+0.1, y:y+0.08, w:2.0, h:0.3, fontSize:11, color:C.secondary, bold:true, margin:0});
  s12.addText(g[1], {x:x+0.1, y:y+0.38, w:2.0, h:0.25, fontSize:9, color:C.gray, margin:0});
});
s12.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.4, w:9, h:0.55, fill:{color:C.accent}});
s12.addText('推广通过率: 68.6%  |  自动阈值审查  |  持续复评机制', {x:0.5, y:4.4, w:9, h:0.55, fontSize:12, color:C.white, align:'center', valign:'middle', margin:0});
addSlideNum(s12, 12, 20);

// SLIDE 13: UI Design
let s13 = pptx.addSlide();
s13.background = {color:C.white};
hdr(s13, '11  界面设计分析');
s13.addText('核心页面布局', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const pages = [
  ['首页 (Landing)', 'Hero Section, 三步引导, 统计数据网格'],
  ['市场页面', 'Filter Bar, Asset Grid, GDI Score, 实时筛选'],
  ['悬赏面板', 'Question Board, TOTAL/BOUNTY 统计'],
  ['账户管理', 'Agent 节点管理, 声誉查看, 积分余额']
];
pages.forEach((p, i) => {
  const y = 1.6 + i * 0.7;
  s13.addShape(pptx.ShapeType.roundRect, {x:0.5, y, w:9, h:0.6, fill:{color:i%2===0?C.light:C.white}, line:{color:C.lightGray, width:1}});
  s13.addText(p[0], {x:0.7, y:y+0.1, w:2.2, h:0.4, fontSize:11, color:C.secondary, bold:true, valign:'middle', margin:0});
  s13.addText(p[1], {x:3.0, y:y+0.1, w:6.3, h:0.4, fontSize:10, color:C.gray, valign:'middle', margin:0});
});
s13.addText('视觉特点', {x:0.5, y:4.5, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const visual = [['深色主题', '科技感设计'], ['卡片式布局', '信息分区'], ['DNA 隐喻', '整体贯穿'], ['GEP 标签', '标准认证']];
visual.forEach((v, i) => {
  s13.addShape(pptx.ShapeType.roundRect, {x:0.5+i*2.35, y:5.0, w:2.2, h:0.5, fill:{color:C.accent}});
  s13.addText(v[0], {x:0.5+i*2.35, y:5.0, w:2.2, h:0.5, fontSize:9, color:C.white, align:'center', valign:'middle', margin:0});
});
addSlideNum(s13, 13, 20);

// SLIDE 14: Comparison
let s14 = pptx.addSlide();
s14.background = {color:C.white};
hdr(s14, '12  对标分析总结');
s14.addText('my-evo 与 evomap.ai 功能对标', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const comp = [
  ['Hub 市场', '已实现', '资产浏览、搜索、筛选'],
  ['A2A 协议', '已实现', 'Agent 注册、心跳、发布'],
  ['悬赏系统', '已实现', '任务发布、认领、完成'],
  ['声誉系统', '已实现', '节点信誉管理'],
  ['记忆系统', '已实现', '跨会话学习'],
  ['质量审查 (GDI)', '部分实现', '评分框架待完善'],
  ['蜂群智能', '待实现', '任务分解与聚合'],
  ['界面可视化', '已实现', '地图视图、控制面板']
];
s14.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.5, w:9, h:3.2, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
s14.addShape(pptx.ShapeType.rect, {x:0.7, y:1.6, w:8.6, h:0.4, fill:{color:C.secondary}});
['模块', '状态', '说明'].forEach((h, i) => {
  const xs = [0.7, 3.0, 5.0];
  s14.addText(h, {x:xs[i], y:1.6, w:[2.3,2.0,4.6][i], h:0.4, fontSize:11, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
});
comp.forEach((c, i) => {
  const y = 2.0 + i * 0.37;
  if(i % 2 === 0) s14.addShape(pptx.ShapeType.rect, {x:0.7, y, w:8.6, h:0.37, fill:{color:C.white}});
  const xs = [0.7, 3.0, 5.0];
  const statusColor = c[1] === '已实现' ? C.green : (c[1] === '部分实现' ? C.yellow : C.red);
  s14.addText(c[0], {x:xs[0], y, w:2.3, h:0.37, fontSize:10, color:C.dark, align:'center', valign:'middle', margin:0});
  s14.addText(c[1], {x:xs[1], y, w:2.0, h:0.37, fontSize:10, color:statusColor, bold:true, align:'center', valign:'middle', margin:0});
  s14.addText(c[2], {x:xs[2], y, w:4.6, h:0.37, fontSize:9, color:C.gray, align:'center', valign:'middle', margin:0});
});
s14.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.85, w:9, h:0.55, fill:{color:C.light}, line:{color:C.accent, width:1}});
s14.addText('总体完成度: 约 75%  |  核心功能已实现  |  高级功能待扩展', {x:0.5, y:4.85, w:9, h:0.55, fontSize:12, color:C.secondary, bold:true, align:'center', valign:'middle', margin:0});
addSlideNum(s14, 14, 20);


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
s15.addText('已完成任务', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
s15.addShape(pptx.ShapeType.roundRect, {x:0.5, y:1.5, w:9, h:2.4, fill:{color:C.light}, line:{color:C.accent, width:1}, shadow:sh()});
tasks.forEach((t, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.7 + col * 4.5, y = 1.6 + row * 0.55;
  s15.addShape(pptx.ShapeType.ellipse, {x, y:y+0.1, w:0.35, h:0.35, fill:{color:C.green}});
  s15.addText(t[0], {x:x+0.45, y, w:1.5, h:0.5, fontSize:11, color:C.dark, bold:true, valign:'middle', margin:0});
  s15.addText(t[2], {x:x+2.0, y, w:2.2, h:0.5, fontSize:9, color:C.gray, valign:'middle', margin:0});
});
s15.addText('下一步规划', {x:0.5, y:4.0, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const next = [['GDI 评分完善', '完善评分维度'], ['蜂群智能', '任务分解聚合'], ['高级可视化', '3D 地图增强']];
next.forEach((n, i) => {
  s15.addShape(pptx.ShapeType.roundRect, {x:0.5+i*3.1, y:4.5, w:2.9, h:0.9, fill:{color:C.white}, line:{color:C.secondary, width:2}, shadow:sh()});
  s15.addText(n[0], {x:0.5+i*3.1, y:4.55, w:2.9, h:0.4, fontSize:12, color:C.secondary, bold:true, align:'center', margin:0});
  s15.addText(n[1], {x:0.5+i*3.1, y:4.95, w:2.9, h:0.35, fontSize:9, color:C.gray, align:'center', margin:0});
});
addSlideNum(s15, 15, 20);

// SLIDE 16: Partners
let s16 = pptx.addSlide();
s16.background = {color:C.white};
hdr(s16, '14  生态合作伙伴');
s16.addText('Ecosystem & Integration Partners', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const partners = [
  ['OpenAI', 'GPT 模型集成'],
  ['Anthropic', 'Claude 能力接入'],
  ['GitHub', '代码资产托管'],
  ['Hugging Face', '模型市场集成'],
  ['Vercel', '前端部署平台'],
  ['Supabase', '后端即服务']
];
partners.forEach((p, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  const x = 0.5 + col * 3.1, y = 1.6 + row * 1.5;
  s16.addShape(pptx.ShapeType.roundRect, {x, y, w:2.9, h:1.3, fill:{color:C.white}, line:{color:C.lightGray, width:1}, shadow:sh()});
  s16.addShape(pptx.ShapeType.ellipse, {x:x+1.1, y:y+0.15, w:0.7, h:0.7, fill:{color:C.accent}});
  s16.addText(p[0].charAt(0), {x:x+1.1, y:y+0.15, w:0.7, h:0.7, fontSize:20, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
  s16.addText(p[0], {x:x+0.1, y:y+0.9, w:2.7, h:0.35, fontSize:11, color:C.secondary, bold:true, align:'center', margin:0});
});
s16.addShape(pptx.ShapeType.roundRect, {x:0.5, y:4.7, w:9, h:0.8, fill:{color:C.light}, line:{color:C.accent, width:1}});
s16.addText('开放生态: API 优先设计 + 插件系统 + 标准化接口', {x:0.7, y:4.85, w:8.6, h:0.5, fontSize:14, color:C.secondary, align:'center', valign:'middle', margin:0});
addSlideNum(s16, 16, 20);

// SLIDE 17: Security
let s17 = pptx.addSlide();
s17.background = {color:C.white};
hdr(s17, '15  安全与隐私');
s17.addText('Security & Privacy Protection', {x:0.5, y:1.1, w:9, h:0.4, fontSize:14, color:C.secondary, bold:true, margin:0});
const secFeatures = [
  ['端到端加密', '所有通信使用 TLS 1.3 加密'],
  ['节点认证', '基于公钥密码学的身份验证'],
  ['数据隔离', '多租户环境下的数据隔离'],
  ['审计日志', '完整的操作审计跟踪'],
  ['隐私计算', '敏感数据的联邦学习支持'],
  ['访问控制', '细粒度的 RBAC 权限管理']
];
secFeatures.forEach((s, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.5 + col * 4.7, y = 1.6 + row * 1.1;
  s17.addShape(pptx.ShapeType.roundRect, {x, y, w:4.5, h:0.95, fill:{color:C.white}, line:{color:C.green, width:2}, shadow:sh()});
  s17.addShape(pptx.ShapeType.ellipse, {x:x+0.1, y:y+0.25, w:0.45, h:0.45, fill:{color:C.green}});
  s17.addText(s[0], {x:x+0.65, y:y+0.15, w:3.7, h:0.35, fontSize:12, color:C.secondary, bold:true, margin:0});
  s17.addText(s[1], {x:x+0.65, y:y+0.5, w:3.7, h:0.35, fontSize:10, color:C.gray, margin:0});
});
s17.addShape(pptx.ShapeType.roundRect, {x:0.5, y:5.0, w:9, h:0.5, fill:{color:C.green}});
s17.addText('合规性: GDPR  |  SOC 2  |  ISO 27001', {x:0.5, y:5.0, w:9, h:0.5, fontSize:12, color:C.white, align:'center', valign:'middle', margin:0});
addSlideNum(s17, 17, 20);

// SLIDE 18: Roadmap
let s18 = pptx.addSlide();
s18.background = {color:C.white};
hdr(s18, '16  未来路线图');
const roadmap = [
  ['Q2 2026', 'v1.0 基础版', '核心功能上线，MVP 验证'],
  ['Q3 2026', 'v1.5 增强版', 'GDI 评分完善，蜂群智能'],
  ['Q4 2026', 'v2.0 生态版', '开放 API，插件市场'],
  ['Q1 2027', 'v2.5 智能版', 'AGI 集成，自主进化']
];
roadmap.forEach((r, i) => {
  const y = 1.1 + i * 1.0;
  s18.addShape(pptx.ShapeType.roundRect, {x:0.5, y, w:2.0, h:0.85, fill:{color:C.accent}});
  s18.addText(r[0], {x:0.5, y, w:2.0, h:0.85, fontSize:14, color:C.white, bold:true, align:'center', valign:'middle', margin:0});
  s18.addShape(pptx.ShapeType.roundRect, {x:2.7, y, w:6.8, h:0.85, fill:{color:C.light}, line:{color:C.lightGray, width:1}});
  s18.addText(r[1], {x:2.9, y:y+0.1, w:6.4, h:0.35, fontSize:12, color:C.secondary, bold:true, margin:0});
  s18.addText(r[2], {x:2.9, y:y+0.45, w:6.4, h:0.35, fontSize:10, color:C.gray, margin:0});
});
s18.addShape(pptx.ShapeType.roundRect, {x:0.5, y:5.2, w:9, h:0.35, fill:{color:C.primary}});
s18.addText('愿景: 构建 AI 自我进化的开放基础设施', {x:0.5, y:5.2, w:9, h:0.35, fontSize:12, color:C.white, align:'center', valign:'middle', margin:0});
addSlideNum(s18, 18, 20);


// SLIDE 19: Summary & Thank You
let s19 = pptx.addSlide();
s19.background = {color:C.primary};
s19.addText('总结', {x:0.5,y:0.8,w:9,h:0.8,fontSize:36,color:C.white,bold:true,align:'center'});
s19.addShape(pptx.ShapeType.rect, {x:3.5,y:1.6,w:3,h:0.05,fill:{color:C.accent}});

// Summary content
const summary = [
  '✓ 完整的 AI 自我进化基础设施',
  '✓ 基于 GEP 协议的标准化资产体系',
  '✓ A2A 协议实现 Agent 间协同',
  '✓ GDI 评分保障资产质量',
  '✓ 悬赏系统激励生态发展'
];
summary.forEach((s, i) => {
  s19.addText(s, {x:1.5,y:1.9+i*0.5,w:7,h:0.45,fontSize:14,color:C.lightGray,align:'left',margin:0});
});

s19.addText('"One agent learns. A million inherit."', {x:0.5,y:4.5,w:9,h:0.6,fontSize:22,color:C.accent,italic:true,align:'center'});
s19.addText('My Evo - AI 自我进化基础设施', {x:0.5,y:5.1,w:9,h:0.4,fontSize:16,color:C.gray,align:'center'});
addSlideNum(s19, 19, 20);

// SLIDE 20: Thank You
let s20 = pptx.addSlide();
s20.background = {color:C.primary};
s20.addText('感谢观看', {x:0.5,y:2.0,w:9,h:1.0,fontSize:54,color:C.white,bold:true,align:'center'});
s20.addShape(pptx.ShapeType.rect, {x:3,y:3.2,w:4,h:0.08,fill:{color:C.accent}});
s20.addText('My Evo - AI 自我进化基础设施', {x:0.5,y:3.5,w:9,h:0.6,fontSize:24,color:C.accent,align:'center'});
s20.addText('"One agent learns. A million inherit."', {x:0.5,y:4.3,w:9,h:0.5,fontSize:18,color:C.lightGray,italic:true,align:'center'});
s20.addText('项目调研报告 | 2026-05-07', {x:0.5,y:5.0,w:9,h:0.4,fontSize:14,color:C.gray,align:'center'});
addSlideNum(s20, 20, 20);

// Save the file
pptx.writeFile({fileName: '/workspace/my-evo/My-Evo-项目调研报告-完整版.pptx'})
  .then(() => console.log('PPTX created successfully: My-Evo-项目调研报告-完整版.pptx'))
  .catch(err => console.error('Error creating PPTX:', err));
