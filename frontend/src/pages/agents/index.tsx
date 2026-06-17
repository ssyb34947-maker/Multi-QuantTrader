import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Alert,
  Button,
  DatePicker,
  Divider,
  Spin,
  Input,
  Segmented,
  Select,
  Slider,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import {
  ApiOutlined,
  ApartmentOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  ControlOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  FilterOutlined,
  PlusOutlined,
  RobotOutlined,
  SaveOutlined,
  SendOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'
import { useAppStore } from '@/stores'
import { contextInjectionPlan, csi2000DataPool, strategySkillRegistry } from '@/utils/mockData'
import { dataApi, type StockOption } from '@/api/endpoints'

const { Title, Text } = Typography

type NodeType = 'trigger' | 'agent' | 'tool' | 'output'
type AgentTone = 'neutral' | 'bull' | 'bear' | 'risk' | 'portfolio'
type RelationType = 'collaboration' | 'adversarial'
type BuilderMode = '设计' | '仿真' | '发布'

interface AgentTemplate {
  id: string
  name: string
  title: string
  description: string
  model: string
  tone: AgentTone
  capabilities: string[]
  skills: string[]
  mcpTools: string[]
  systemPrompt: string
}

interface CapabilityTemplate {
  id: string
  name: string
  description: string
  type: 'skill' | 'mcp'
}

interface RelationTemplate {
  id: RelationType
  name: string
  description: string
  color: string
}

interface WorkflowNode {
  id: string
  title: string
  subtitle: string
  type: NodeType
  x: number
  y: number
  width: number
  tone?: AgentTone
  meta: string[]
  skills?: string[]
  mcpTools?: string[]
  systemPrompt?: string
}

interface WorkflowEdge {
  from: string
  to: string
  relation: RelationType
  label: string
}

interface DragState {
  id: string
  offsetX: number
  offsetY: number
}

interface PersistedAgentBuilderState {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedId: string
  mode: BuilderMode
  humanApproval: boolean
  maxRounds: string
  zoom: number
  targetStock: string
  asOfDate: string
}

interface RelationDraft {
  from: string
  to: string
  relation: RelationType
  label: string
}

interface DemoStep {
  nodeId: string
  title: string
  status: string
  delayMs: number
  input: string
  process: string
  output: string
}

const defaultAsOfDate = csi2000DataPool.lastTradeDate

const CANVAS_WIDTH = 1640
const CANVAS_HEIGHT = 660
const MIN_ZOOM = 0.5
const MAX_ZOOM = 1.5
const STORAGE_KEY = 'duozhixing-fund-builder-state-v3'
const BACKTEST_DRAFT_KEY = 'duozhixing-backtest-draft-v1'

const professionalPrompts = {
  stockLoader: `你是多智星基金的股票上下文加载席位。用户输入股票名称或代码，以及分析时点；你必须仅调用已授权接口与 data/processed 中证 2000 数据池，获取该时点之前可用的信息，禁止使用未来数据。

工作要求：
1. 解析股票名称、证券代码、所属行业、上市年限、最新可用交易日、数据覆盖率与缺失情况。
2. 调用 market-data.mcp、stock-snapshot.mcp、coverage-report.mcp 获取日线、截面、基本面和覆盖报告。
3. 构建下游上下文包，包括：security_master、as_of_date、lookback_window、price_volume_panel、fundamental_snapshot、data_quality_flags。
4. 输出必须标注数据截止时间、字段来源、缺失字段、不可用数据和禁止使用的未来信息。`,
  fundamentalFactor: `你是多智星基金的基本面因子研究员，覆盖范围仅限中证 2000 股票池。你接收股票上下文加载席位传来的 as_of_date 之前基本面、行业与市值信息，并评估该股票的基本面因子质量。

工作要求：
1. 分析估值、盈利质量、成长性、资产负债、现金流、规模与行业相对位置，优先使用已授权基本面字段。
2. 给出因子暴露、分位数、行业中性比较、数据缺失影响和潜在财务风险。
3. 明确哪些结论可以进入多头 thesis，哪些结论只能作为风险约束。
4. 输出结构化 JSON，包含 fundamental_score、valuation_view、quality_view、growth_view、industry_relative_view、evidence、invalid_conditions。`,
  technicalFactor: `你是多智星基金的技术面因子研究员，覆盖范围仅限中证 2000 股票池。你接收 as_of_date 之前的前复权日线、成交额、换手率与模型特征，并评估趋势、动量、波动与流动性因子。

工作要求：
1. 分析 ret_1d/3d/5d/20d、均线偏离、波动率、成交额 z-score、换手率、振幅和量价背离。
2. 识别趋势延续、突破失败、短期过热、流动性承载能力和回撤敏感性。
3. 输出可被多头辩手使用的入场触发、止损位、目标持有期和仓位上限建议。
4. 输出结构化 JSON，包含 technical_score、trend_state、momentum_state、liquidity_state、risk_flags、entry_trigger、stop_loss_reference。`,
  bull: `你是多智星基金的多头辩手。A 股现阶段交易约束以做多为主，你的职责不是提出做空交易，而是在基本面因子、技术面因子和策略 Skill 支持下，构建是否值得做多股票 A 的投资论证。

工作要求：
1. 整合基本面因子研究员、技术面因子研究员和股票上下文加载席位的信息，形成 long thesis。
2. 给出核心催化剂、做多触发条件、目标仓位、风险预算占用、止盈/止损、预期持有期。
3. 必须等待空头辩手完成压力辩论后，修正或降级多头结论。
4. 输出结构化 JSON，包含 long_thesis、confidence、evidence_stack、position_advice、risk_controls、questions_for_bear。`,
  bear: `你是多智星基金的空头压力辩手。由于 A 股策略首要目标是做多，你的职责不是生成做空订单，而是对多头方案进行反证、压力测试和否决条件审查。

工作要求：
1. 从基本面恶化、估值过高、趋势衰竭、量价背离、流动性不足、数据质量不足、行业拥挤等角度挑战多头 thesis。
2. 对每条做多证据给出反证强度、压力情景、可能回撤路径和止损条件。
3. 如果风险不可接受，给出 reject；如果可控，给出 revise 和约束条件。
4. 输出结构化 JSON，包含 pressure_case、stress_scenarios、reject_conditions、position_haircut、required_revisions、residual_risk。`,
  portfolioManager: `你是多智星基金的组合经理，负责在空头压力辩论完成后，把基本面、技术面、多头观点、风险反证和 Strategy Skill 输出整合为是否纳入组合的做多方案。

工作要求：
1. 基于预期收益、波动率、相关性、行业暴露、换手成本、单票权重、资金使用率和风险预算进行组合构建。
2. A 股默认只输出 long/hold/skip，不输出做空交易。
3. 明确空头压力辩论如何影响仓位折扣、止损、观察清单或否决。
4. 输出包含 decision、target_weight、capital_allocation、risk_budget_usage、rebalance_plan、approval_required。`,
  riskManager: `你是多智星基金的首席风险经理，负责所有单票模拟、回测、策略入库和组合发布前的独立风控审核。

工作要求：
1. 检查 VaR、最大回撤、单票集中度、行业集中度、换手率、滑点敏感性、流动性承载和数据质量。
2. 对未完成空头压力辩论、缺少 as_of_date、使用未来数据、未通过回测或缺少用户授权的方案执行硬拒绝。
3. 对不满足约束的方案给出 reject 或 revise，不允许模糊放行。
4. 输出包含 risk_verdict、limit_breaches、required_revisions、approval_status、audit_notes。`,
  output: `你是多智星基金的回测与发布出口。仅当组合经理和风险经理均通过，并且用户授权策略入库或发布时，才生成中证 2000 回测任务、沙盒交易方案或 Strategy Skill 注册请求。`,
}

const agentTemplates: AgentTemplate[] = [
  {
    id: 'stock-loader',
    name: 'Stock Context Loader',
    title: '股票上下文加载席位',
    description: '解析股票名称和分析时点，调用接口获取该时点之前的个股信息、行情、基本面和数据质量。',
    model: 'context-loader-v1',
    tone: 'neutral',
    capabilities: ['证券解析', '时点截断', '上下文打包'],
    skills: ['security_context', 'as_of_guard', 'data_quality_check'],
    mcpTools: ['market-data.mcp', 'stock-snapshot.mcp', 'coverage-report.mcp'],
    systemPrompt: professionalPrompts.stockLoader,
  },
  {
    id: 'fundamental-factor',
    name: 'Fundamental Factor Analyst',
    title: '基本面因子研究员',
    description: '基于估值、盈利质量、成长、资产负债和行业相对位置评估基本面因子。',
    model: 'gpt-4.1 + fundamental-ranker',
    tone: 'neutral',
    capabilities: ['估值分位', '质量因子', '行业中性比较'],
    skills: ['fundamental_factor', 'valuation_check', 'quality_growth_analysis'],
    mcpTools: ['fundamental-store.mcp', 'stock-snapshot.mcp', 'strategy-skill-registry.mcp'],
    systemPrompt: professionalPrompts.fundamentalFactor,
  },
  {
    id: 'technical-factor',
    name: 'Technical Factor Analyst',
    title: '技术面因子研究员',
    description: '基于趋势、动量、波动、成交额和换手率评估技术面因子。',
    model: 'gpt-4.1 + technical-ranker',
    tone: 'neutral',
    capabilities: ['趋势动量', '量价结构', '流动性承载'],
    skills: ['technical_factor', 'momentum_probe', 'liquidity_check'],
    mcpTools: ['market-data.mcp', 'feature-panel.mcp', 'strategy-skill-registry.mcp'],
    systemPrompt: professionalPrompts.technicalFactor,
  },
  {
    id: 'bull',
    name: 'Bull Agent',
    title: '多头辩手',
    description: 'A 股首要做多，整合基本面和技术面证据形成 long thesis。',
    model: 'gpt-4.1',
    tone: 'bull',
    capabilities: ['做多论证', '目标仓位', '风险预算'],
    skills: ['bullish_thesis', 'long_only_policy', 'position_sizing'],
    mcpTools: ['market-data.mcp', 'stock-snapshot.mcp', 'strategy-skill-registry.mcp'],
    systemPrompt: professionalPrompts.bull,
  },
  {
    id: 'bear',
    name: 'Bear Pressure Agent',
    title: '空头压力辩手',
    description: '不生成做空交易，只负责对做多方案进行反证、压力测试和否决条件审查。',
    model: 'gpt-4.1',
    tone: 'bear',
    capabilities: ['风险反证', '压力情景', '仓位折扣'],
    skills: ['bearish_pressure', 'drawdown_probe', 'stress_scenario'],
    mcpTools: ['coverage-report.mcp', 'stock-snapshot.mcp', 'risk-engine.mcp'],
    systemPrompt: professionalPrompts.bear,
  },
  {
    id: 'portfolio-manager',
    name: 'Portfolio Manager Agent',
    title: '组合经理',
    description: '在压力辩论后输出 long/hold/skip、仓位和再平衡建议。',
    model: 'portfolio-policy-v2',
    tone: 'portfolio',
    capabilities: ['权重优化', '再平衡', '资金分配'],
    skills: ['portfolio_construction', 'capital_allocation', 'rebalance_policy'],
    mcpTools: ['strategy-skill-registry.mcp', 'optimizer.mcp', 'backtest-runner.mcp'],
    systemPrompt: professionalPrompts.portfolioManager,
  },
  {
    id: 'risk-manager',
    name: 'Risk Manager Agent',
    title: '风控经理',
    description: '作为发布前守门节点，校验回撤、集中度、流动性、未来函数和用户授权。',
    model: 'risk-rules-v3',
    tone: 'risk',
    capabilities: ['VaR 约束', '回撤预算', '交易熔断'],
    skills: ['risk_gate', 'var_check', 'exposure_limit'],
    mcpTools: ['risk-engine.mcp', 'order-sandbox.mcp', 'audit-log.mcp'],
    systemPrompt: professionalPrompts.riskManager,
  },
]

const relationTemplates: RelationTemplate[] = [
  {
    id: 'collaboration',
    name: '合作型讨论',
    description: '共享上下文、补充证据、汇总观点，适合研究员、组合经理与风控之间协同。',
    color: '#2563eb',
  },
  {
    id: 'adversarial',
    name: '对抗型辩论',
    description: '正反双方互相挑战假设、证据和风险边界，适合 Bull 与 Bear 的辩论关系。',
    color: '#dc2626',
  },
]

const capabilityTemplates: CapabilityTemplate[] = [
  { id: 'factor_research', name: 'factor_research', description: '因子挖掘、IC/IR、稳定性检验', type: 'skill' },
  { id: 'bullish_thesis', name: 'bullish_thesis', description: '看多论证、催化剂与目标仓位', type: 'skill' },
  { id: 'bearish_thesis', name: 'bearish_thesis', description: '反方论证、回撤与压力情景', type: 'skill' },
  { id: 'risk_gate', name: 'risk_gate', description: '发布前风控拦截与审批', type: 'skill' },
  { id: 'market-data', name: 'market-data.mcp', description: '行情、K 线、盘口与成交量数据', type: 'mcp' },
  { id: 'backtest-runner', name: 'backtest-runner.mcp', description: '提交回测任务并读取绩效归因', type: 'mcp' },
  { id: 'risk-engine', name: 'risk-engine.mcp', description: 'VaR、杠杆、敞口、相关性检查', type: 'mcp' },
  { id: 'strategy-skill-registry', name: 'strategy-skill-registry.mcp', description: '读取已授权策略 Skill 与候选模拟策略', type: 'mcp' },
]

const initialNodes: WorkflowNode[] = [
  { id: 'stock-loader', title: 'Stock Context Loader', subtitle: '输入股票 + as_of_date / 调接口取数', type: 'agent', x: 48, y: 260, width: 255, tone: 'neutral', meta: ['股票A', '仅取时点之前数据'], skills: ['security_context', 'as_of_guard'], mcpTools: ['market-data.mcp', 'stock-snapshot.mcp', 'coverage-report.mcp'], systemPrompt: professionalPrompts.stockLoader },
  { id: 'fundamental-factor', title: 'Fundamental Factor Analyst', subtitle: '基本面因子研究员', type: 'agent', x: 360, y: 120, width: 265, tone: 'neutral', meta: ['估值/质量/成长', '行业相对分位'], skills: ['fundamental_factor', 'valuation_check'], mcpTools: ['fundamental-store.mcp', 'stock-snapshot.mcp'], systemPrompt: professionalPrompts.fundamentalFactor },
  { id: 'technical-factor', title: 'Technical Factor Analyst', subtitle: '技术面因子研究员', type: 'agent', x: 360, y: 410, width: 265, tone: 'neutral', meta: ['趋势/动量/量价', '流动性承载'], skills: ['technical_factor', 'momentum_probe'], mcpTools: ['market-data.mcp', 'feature-panel.mcp'], systemPrompt: professionalPrompts.technicalFactor },
  { id: 'bull-agent', title: 'Bull Agent', subtitle: '多头辩手 / long thesis', type: 'agent', x: 720, y: 185, width: 255, tone: 'bull', meta: ['A股首要做多', '目标仓位建议'], skills: ['bullish_thesis', 'long_only_policy'], mcpTools: ['market-data.mcp', 'strategy-skill-registry.mcp'], systemPrompt: professionalPrompts.bull },
  { id: 'bear-agent', title: 'Bear Pressure Agent', subtitle: '空头压力辩手 / 风险反证', type: 'agent', x: 720, y: 390, width: 255, tone: 'bear', meta: ['不做空交易', '压力辩论'], skills: ['bearish_pressure', 'stress_scenario'], mcpTools: ['coverage-report.mcp', 'risk-engine.mcp'], systemPrompt: professionalPrompts.bear },
  { id: 'portfolio-manager', title: 'Portfolio Manager Agent', subtitle: '组合经理 / long-hold-skip', type: 'agent', x: 1080, y: 235, width: 265, tone: 'portfolio', meta: ['仓位折扣', '再平衡'], skills: ['portfolio_construction', 'capital_allocation'], mcpTools: ['strategy-skill-registry.mcp', 'optimizer.mcp'], systemPrompt: professionalPrompts.portfolioManager },
  { id: 'risk-manager', title: 'Risk Manager Agent', subtitle: '风控经理 / 硬闸门', type: 'agent', x: 1080, y: 455, width: 265, tone: 'risk', meta: ['VaR / 集中度', '未来函数检查'], skills: ['risk_gate', 'var_check'], mcpTools: ['risk-engine.mcp', 'audit-log.mcp'], systemPrompt: professionalPrompts.riskManager },
  { id: 'publish-plan', title: 'Backtest & Skill Gate', subtitle: '回测 / 沙盒 / 入库授权', type: 'output', x: 1410, y: 340, width: 230, meta: ['backtest required', 'user approval'], mcpTools: ['backtest-runner.mcp', 'order-sandbox.mcp'], systemPrompt: professionalPrompts.output },
]

const initialEdges: WorkflowEdge[] = [
  { from: 'stock-loader', to: 'fundamental-factor', relation: 'collaboration', label: '基本面上下文' },
  { from: 'stock-loader', to: 'technical-factor', relation: 'collaboration', label: '技术面上下文' },
  { from: 'fundamental-factor', to: 'bull-agent', relation: 'collaboration', label: '基本面证据' },
  { from: 'technical-factor', to: 'bull-agent', relation: 'collaboration', label: '技术面证据' },
  { from: 'bull-agent', to: 'bear-agent', relation: 'adversarial', label: '压力辩论' },
  { from: 'bear-agent', to: 'bull-agent', relation: 'adversarial', label: '反证修正' },
  { from: 'bull-agent', to: 'portfolio-manager', relation: 'collaboration', label: '做多方案' },
  { from: 'bear-agent', to: 'portfolio-manager', relation: 'collaboration', label: '风险折扣' },
  { from: 'portfolio-manager', to: 'risk-manager', relation: 'collaboration', label: '候选组合' },
  { from: 'risk-manager', to: 'publish-plan', relation: 'collaboration', label: '风控通过' },
]

const jiameiDemoSteps: DemoStep[] = [
  {
    nodeId: 'stock-loader',
    title: '股票上下文加载',
    status: '正在检索证券主数据与行情快照',
    delayMs: 5800,
    input: '用户输入：嘉美包装 / 002969，as_of_date=2026-05-20。',
    process: '调用 market-data.mcp、stock-snapshot.mcp、coverage-report.mcp；只读取 2026-05-20 及以前数据。',
    output: '中证2000成分股；包装印刷；最新收盘 18.65，跌幅 -2.71%，成交额 10.49 亿元，换手率 4.99%，覆盖 87 个交易日。',
  },
  {
    nodeId: 'fundamental-factor',
    title: '基本面因子研究',
    status: '正在合并财报、行业与现金流证据',
    delayMs: 7200,
    input: '接收 2026Q1 利润表、资产负债表、现金流和行业信息。',
    process: '计算成长、盈利质量、杠杆、现金流覆盖和行业可比性；检查公告日 2026-04-27，未越过 as_of_date。',
    output: '营收 8.57 亿元，同比 +42.31%；净利润 6693.96 万元，同比 +432.41%；资产负债率 25.82%；经营现金流 8138.94 万元。基本面评分 72/100。',
  },
  {
    nodeId: 'technical-factor',
    title: '技术面因子研究',
    status: '正在计算趋势、动量与流动性窗口',
    delayMs: 6500,
    input: '接收前复权日线、成交额、换手率和 60 日窗口。',
    process: '计算 5/10/20/60 日收益、均线偏离、成交额放大和回撤位置。',
    output: '5日 -2.25%，10日 -3.77%，20日 -17.91%，60日 -10.34%；收盘低于 MA20=20.80 与 MA60=22.94，短期仍在下行修复区。技术评分 41/100。',
  },
  {
    nodeId: 'bull-agent',
    title: '多头论证 Round 1',
    status: '正在生成第一版做多论证',
    delayMs: 8400,
    input: '接收基本面改善、现金流转正、低杠杆和技术面超跌信息。',
    process: '构建 A 股 long-only thesis：基本面改善提供中期支撑，但入场必须等待价格确认。',
    output: '初始主张：可以进入观察池；若放量站回 20.30-20.80 区间，视为超跌反弹确认。建议试探仓位 4%，信心 0.58。',
  },
  {
    nodeId: 'bear-agent',
    title: '空头压力辩论 Round 1',
    status: '正在构造压力场景并反驳多头假设',
    delayMs: 9100,
    input: '审查多头 thesis、近 20 日跌幅、成交波动和前期高点回撤。',
    process: '反证：股价从 60 日高点 29.00 回落至 18.65，趋势尚未反转；量能不稳定，追高风险高。',
    output: '第一轮反驳：不允许直接买入；若跌破 18.40 或反弹缩量，应跳过。建议仓位折扣 50%，必须设置硬止损。',
  },
  {
    nodeId: 'bull-agent',
    title: '多头回应 Round 2',
    status: '正在读取空头反证并修正交易条件',
    delayMs: 7900,
    input: '接收空头反驳：趋势未反转、反弹可能缩量、18.40 是关键失效位。',
    process: '多头重新评估：保留基本面改善观点，但取消立即买入，把交易从主动做多改为条件触发。',
    output: '修正主张：WATCH -> CONDITIONAL LONG。只有收盘站上 MA20=20.80 且成交额高于 20 日均额 1.1 倍才触发；初始仓位降至 2%。',
  },
  {
    nodeId: 'bear-agent',
    title: '空头复核 Round 2',
    status: '正在复核假突破、缩量与止损约束',
    delayMs: 8600,
    input: '审查多头修正后的条件单、2% 仓位、20.80 突破确认与 18.35 止损。',
    process: '检查假突破、跳空回落、成交额异常放大后次日衰减、行业小盘流动性冲击。',
    output: '二轮结论：接受条件做多，但必须加入三条硬约束：不追涨停、不在缩量突破买入、跌破 18.35 当日退出。残余风险中等。',
  },
  {
    nodeId: 'bull-agent',
    title: '多头最终修订',
    status: '正在吸收压力约束并重写多头方案',
    delayMs: 6900,
    input: '接收空头二轮约束：不追涨停、缩量突破无效、18.35 硬止损。',
    process: '将压力辩论转化为交易规则，降低主观判断，把入场、加仓、退出全部条件化。',
    output: '最终多头方案：条件单有效；触发后初始 2%，次日仍站上 20.80 可加至 3%，单票上限 4%；若触发失败继续观察。',
  },
  {
    nodeId: 'portfolio-manager',
    title: '组合经理整合',
    status: '正在计算组合权重与风险预算占用',
    delayMs: 6800,
    input: '合并基本面评分 72、技术面评分 41、多头最终方案、空头两轮压力约束。',
    process: '按中证2000单票约束、行业暴露和 A 股 long-only 规则生成 long/hold/skip。',
    output: '决策：WATCH -> CONDITIONAL LONG。仅在突破确认后建仓，目标仓位 2.0%，观察期 5-10 个交易日。',
  },
  {
    nodeId: 'risk-manager',
    title: '风控审核',
    status: '正在执行集中度、流动性与未来函数检查',
    delayMs: 6200,
    input: '接收候选仓位、止损、流动性、未来函数检查和两轮压力辩论记录。',
    process: '检查单票集中度、止损距离、日成交额承载、as_of_date 数据边界。',
    output: '风控通过条件单：止损 18.35；若触发买入，单票权重 2.0%，最大亏损预算约 0.16% 组合净值。',
  },
  {
    nodeId: 'publish-plan',
    title: '策略输出',
    status: '正在生成可回测策略草案',
    delayMs: 4800,
    input: '组合经理与风控经理均给出条件通过。',
    process: '生成可回测策略草案，等待用户授权后进入 Strategy Skill 库。',
    output: '策略：嘉美包装超跌反转条件做多。入场价触发：收盘站上 20.80 且成交额高于 20 日均值 1.1 倍；止损 18.35；止盈 23.20；持有 10 个交易日或跌破 MA5 退出。',
  },
]

const jiameiStrategyOutput = {
  name: '嘉美包装超跌反转条件做多策略',
  symbol: '002969 嘉美包装',
  asOfDate: '2026-05-20',
  verdict: 'WATCH -> CONDITIONAL LONG',
  entry: '收盘价站上 20.80，且成交额 > 20 日均额 1.1 倍；若盘中冲高但收盘未确认，不追单。',
  position: '初始仓位 2.0%；突破后第二日若仍站上 20.80，可加至 3.0%，单票上限 4.0%。',
  stopLoss: '硬止损 18.35；若跌破 18.40 且成交额放大，直接撤销做多观察。',
  takeProfit: '第一止盈 22.60，第二止盈 23.20；到达第一止盈后至少减仓 50%。',
  holding: '最长 10 个交易日；若收盘跌破 MA5 或换手率连续两日低于 4%，提前退出。',
  risk: '空头压力辩论后仓位折扣 50%；不允许在 20 日趋势未修复前满仓参与。',
  code: `# 多智星基金策略草案：嘉美包装超跌反转条件做多
# Backtrader DynamicStrategy hook: next(strategy, data)

ENTRY_PRICE_CONFIRM = 20.80
INITIAL_WEIGHT = 0.02
MAX_WEIGHT = 0.04
STOP_LOSS = 18.35
TAKE_PROFIT_1 = 22.60
TAKE_PROFIT_2 = 23.20
MAX_HOLDING_DAYS = 10

state = {"entry_bar": None, "trimmed": False}

def _position_size(strategy, data, weight):
    cash = strategy.broker.getvalue() * weight
    price = float(data.close[0])
    return max(100, int(cash / price / 100) * 100) if price > 0 else 0

def next(strategy, data):
    close = float(data.close[0])
    position = strategy.getposition(data)
    bar_index = len(data)

    if not position.size:
        state["trimmed"] = False
        if close > ENTRY_PRICE_CONFIRM:
            size = _position_size(strategy, data, INITIAL_WEIGHT)
            if size > 0:
                strategy.buy(data=data, size=size)
                state["entry_bar"] = bar_index
        return

    holding_days = bar_index - (state.get("entry_bar") or bar_index)
    if close < STOP_LOSS or holding_days >= MAX_HOLDING_DAYS:
        strategy.sell(data=data, size=position.size)
        return

    if close >= TAKE_PROFIT_1 and not state.get("trimmed"):
        strategy.sell(data=data, size=max(100, int(abs(position.size) * 0.5 / 100) * 100))
        state["trimmed"] = True
        return

    if close >= TAKE_PROFIT_2:
        strategy.sell(data=data, size=position.size)
`,
}

const isJiameiTarget = (value: string) => {
  const normalized = value.replace(/\s|\//g, '').toLowerCase()
  return normalized.includes('嘉美包装') || normalized.includes('002969')
}

const toneLabel: Record<AgentTone, string> = {
  neutral: '研究',
  bull: '看多',
  bear: '看空',
  risk: '风控',
  portfolio: '组合',
}


const nodeIcon: Record<NodeType, React.ReactNode> = {
  trigger: <ThunderboltOutlined />,
  agent: <RobotOutlined />,
  tool: <CodeOutlined />,
  output: <SendOutlined />,
}

const nodeClass = (node: WorkflowNode) => {
  const tone = node.tone ? ` agent-flow-node-${node.tone}` : ''
  return `agent-flow-node agent-flow-node-${node.type}${tone}`
}

const getNodeCenter = (node: WorkflowNode) => ({
  x: node.x + node.width / 2,
  y: node.y + 62,
})


const normalizePersistedNodes = (nodes: WorkflowNode[]) => {
  const defaults = new Map(initialNodes.map((node) => [node.id, node]))
  return nodes.map((node) => {
    const fallback = defaults.get(node.id)
    return {
      ...fallback,
      ...node,
      skills: node.skills ?? fallback?.skills,
      mcpTools: node.mcpTools ?? fallback?.mcpTools,
      systemPrompt: node.systemPrompt ?? fallback?.systemPrompt ?? professionalPrompts.fundamentalFactor,
    }
  })
}

const loadPersistedState = (): PersistedAgentBuilderState | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedAgentBuilderState
    if (!Array.isArray(parsed.nodes)) return null
    return {
      nodes: normalizePersistedNodes(parsed.nodes),
      edges: Array.isArray(parsed.edges) ? parsed.edges : initialEdges,
      selectedId: parsed.nodes.some((node) => node.id === parsed.selectedId) ? parsed.selectedId : 'portfolio-manager',
      mode: parsed.mode,
      humanApproval: parsed.humanApproval,
      maxRounds: parsed.maxRounds,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsed.zoom ?? 1)),
      targetStock: parsed.targetStock && !isJiameiTarget(parsed.targetStock) && parsed.targetStock !== '特发信息' ? parsed.targetStock : '',
      asOfDate: parsed.asOfDate ?? defaultAsOfDate,
    }
  } catch {
    return null
  }
}

const Agents: React.FC = () => {
  const themeMode = useAppStore((state) => state.theme)
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<DragState | null>(null)
  const [persistedState] = useState(() => loadPersistedState())
  const [nodes, setNodes] = useState<WorkflowNode[]>(() => persistedState?.nodes ?? initialNodes)
  const [edges, setEdges] = useState<WorkflowEdge[]>(() => persistedState?.edges ?? initialEdges)
  const [relationDraft, setRelationDraft] = useState<RelationDraft>(() => ({
    from: 'fundamental-factor',
    to: 'portfolio-manager',
    relation: 'collaboration',
    label: '协同讨论',
  }))
  const [targetStock, setTargetStock] = useState(() => persistedState?.targetStock ?? '')
  const [stockOptions, setStockOptions] = useState<StockOption[]>([])
  const [stockOptionsLoading, setStockOptionsLoading] = useState(true)
  const [stockPickerOpen, setStockPickerOpen] = useState(false)
  const [asOfDate, setAsOfDate] = useState(() => persistedState?.asOfDate ?? defaultAsOfDate)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationFinished, setSimulationFinished] = useState(false)
  const [jiameiDemoActive, setJiameiDemoActive] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [selectedId, setSelectedId] = useState(() => persistedState?.selectedId ?? 'portfolio-manager')
  const [mode, setMode] = useState<BuilderMode>(() => persistedState?.mode ?? '设计')
  const [humanApproval, setHumanApproval] = useState(() => persistedState?.humanApproval ?? true)
  const [maxRounds, setMaxRounds] = useState(() => persistedState?.maxRounds ?? '3')
  const [zoom, setZoom] = useState(() => persistedState?.zoom ?? 1)

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? nodes[0],
    [nodes, selectedId],
  )

  const filteredStockOptions = useMemo(() => {
    const keyword = targetStock.trim().replace(/\s|\//g, '').toLowerCase()
    if (!keyword) return []
    return stockOptions
      .filter((item) => `${item.stock_code}${item.stock_name}`.toLowerCase().includes(keyword))
      .slice(0, 8)
  }, [stockOptions, targetStock])

  const handleTargetStockChange = (value: string) => {
    setTargetStock(value)
    setSimulationFinished(false)
    setJiameiDemoActive(false)
    setStockPickerOpen(value.trim().length > 0)
  }

  const selectStockOption = (option: StockOption) => {
    setTargetStock(`${option.stock_name} / ${option.stock_code}`)
    setStockPickerOpen(false)
  }


  useEffect(() => {
    const persistedTargetStock = isJiameiTarget(targetStock) || targetStock === '特发信息' ? '' : targetStock
    const state: PersistedAgentBuilderState = { nodes, edges, selectedId, mode, humanApproval, maxRounds, zoom, targetStock: persistedTargetStock, asOfDate }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [asOfDate, edges, humanApproval, maxRounds, mode, nodes, selectedId, targetStock, zoom])

  useEffect(() => {
    let ignore = false
    dataApi.listAllStocks()
      .then((response) => {
        if (!ignore) setStockOptions(response.data ?? [])
      })
      .catch(() => {
        if (!ignore) setStockOptions([{ stock_code: '002969', stock_name: '嘉美包装' }])
      })
      .finally(() => {
        if (!ignore) setStockOptionsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  const updateSelectedNode = (changes: Partial<WorkflowNode>) => {
    setNodes((current) => current.map((node) => (node.id === selectedNode.id ? { ...node, ...changes } : node)))
  }

  const nodeOptions = useMemo(() => nodes.map((node) => ({ value: node.id, label: `${node.title} · ${node.subtitle}` })), [nodes])
  const validEdges = useMemo(() => {
    const index = new Set(nodes.map((node) => node.id))
    return edges.filter((edge) => index.has(edge.from) && index.has(edge.to))
  }, [edges, nodes])


  const simulationOrder = useMemo(() => [
    'stock-loader',
    'fundamental-factor',
    'technical-factor',
    'bull-agent',
    'bear-agent',
    'portfolio-manager',
    'risk-manager',
    'publish-plan',
  ].filter((id) => nodes.some((node) => node.id === id)), [nodes])

  const simulationTimeline = useMemo(() => (
    jiameiDemoActive ? jiameiDemoSteps.map((step) => step.nodeId) : simulationOrder
  ), [jiameiDemoActive, simulationOrder])
  const activeNodeId = isSimulating ? simulationTimeline[Math.min(activeStep, simulationTimeline.length - 1)] ?? '' : ''
  const completedCount = isSimulating ? activeStep : simulationFinished ? simulationTimeline.length : 0
  const completedNodeIds = useMemo(() => new Set(simulationTimeline.slice(0, completedCount)), [completedCount, simulationTimeline])
  const visibleDemoSteps = jiameiDemoActive ? jiameiDemoSteps.slice(0, Math.min(completedCount + (isSimulating ? 1 : 0), jiameiDemoSteps.length)) : []
  const showStrategyOutput = jiameiDemoActive && simulationFinished

  useEffect(() => {
    if (!isSimulating) return undefined
    const currentNodeId = simulationTimeline[Math.min(activeStep, simulationTimeline.length - 1)]
    const demoStepDelay = jiameiDemoActive ? jiameiDemoSteps[activeStep]?.delayMs : undefined
    const stepDelay = demoStepDelay ?? 1800
    const timer = window.setTimeout(() => {
      setActiveStep((current) => {
        if (current >= simulationTimeline.length - 1) {
          window.setTimeout(() => {
            setSimulationFinished(true)
            setIsSimulating(false)
          }, jiameiDemoActive ? 1400 : 900)
          return current
        }
        return current + 1
      })
    }, currentNodeId ? stepDelay : 1800)
    return () => window.clearTimeout(timer)
  }, [activeStep, isSimulating, jiameiDemoActive, simulationTimeline])

  const addAgent = (template: AgentTemplate) => {
    const count = nodes.filter((node) => node.id.startsWith(template.id)).length
    const id = `${template.id}-${count + 1}`
    const sourceId = selectedNode?.id && selectedNode.id !== id ? selectedNode.id : 'stock-loader'
    const instanceNumber = count + 1
    const newNode: WorkflowNode = {
      id,
      title: `${template.name} ${instanceNumber}`,
      subtitle: template.title,
      type: 'agent',
      x: 650,
      y: 85 + (count % 4) * 145,
      width: 245,
      tone: template.tone,
      meta: [template.capabilities[0], template.model],
      skills: template.skills,
      mcpTools: template.mcpTools,
      systemPrompt: template.systemPrompt,
    }
    setNodes((current) => [...current, newNode])
    setRelationDraft((current) => ({
      ...current,
      from: sourceId,
      to: id,
      label: current.relation === 'collaboration' ? '协同讨论' : '压力辩论',
    }))
    setSelectedId(id)
  }

  const removeSelected = () => {
    if (['trigger-market', 'publish-plan'].includes(selectedNode.id)) return
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
    setEdges((current) => current.filter((edge) => edge.from !== selectedNode.id && edge.to !== selectedNode.id))
    setSelectedId('portfolio-manager')
  }

  const agentCount = nodes.filter((node) => node.type === 'agent').length
  const relationCount = validEdges.length
  const skillCount = new Set(nodes.flatMap((node) => node.skills ?? [])).size
  const mcpToolCount = new Set(nodes.flatMap((node) => node.mcpTools ?? [])).size


  const getCanvasPointFromClient = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left + canvas.scrollLeft) / zoom,
      y: (clientY - rect.top + canvas.scrollTop) / zoom,
    }
  }, [zoom])

  const getCanvasPoint = (event: React.PointerEvent) => getCanvasPointFromClient(event.clientX, event.clientY)

  const handleNodePointerDown = (event: React.PointerEvent<HTMLButtonElement>, node: WorkflowNode) => {
    const point = getCanvasPoint(event)
    dragState.current = {
      id: node.id,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
    }
    setSelectedId(node.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDraggedNode = useCallback((clientX: number, clientY: number) => {
    const dragging = dragState.current
    if (!dragging) return
    const point = getCanvasPointFromClient(clientX, clientY)
    setNodes((current) => current.map((node) => {
      if (node.id !== dragging.id) return node
      return {
        ...node,
        x: Math.max(16, Math.min(CANVAS_WIDTH - node.width - 16, point.x - dragging.offsetX)),
        y: Math.max(16, Math.min(CANVAS_HEIGHT - 150, point.y - dragging.offsetY)),
      }
    }))
  }, [getCanvasPointFromClient])

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    moveDraggedNode(event.clientX, event.clientY)
  }

  const stopDragging = () => {
    dragState.current = null
  }

  useEffect(() => {
    const handleWindowPointerMove = (event: PointerEvent) => moveDraggedNode(event.clientX, event.clientY)
    const handleWindowPointerUp = () => stopDragging()
    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerUp)
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerUp)
    }
  }, [moveDraggedNode])

  const resetLayout = () => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    setSelectedId('portfolio-manager')
    setZoom(1)
  }

  const zoomOut = () => setZoom((current) => Math.max(MIN_ZOOM, Number((current - 0.1).toFixed(2))))
  const zoomIn = () => setZoom((current) => Math.min(MAX_ZOOM, Number((current + 0.1).toFixed(2))))


  const addRelation = () => {
    if (!relationDraft.from || !relationDraft.to || relationDraft.from === relationDraft.to) return
    const label = relationDraft.label.trim() || (relationDraft.relation === 'collaboration' ? '合作讨论' : '对抗辩论')
    const nextEdge: WorkflowEdge = { ...relationDraft, label }
    setEdges((current) => {
      const exists = current.some((edge) => edge.from === nextEdge.from && edge.to === nextEdge.to && edge.relation === nextEdge.relation)
      return exists ? current : [...current, nextEdge]
    })
  }

  const prepareRelationFromSelected = () => {
    const fallbackTarget = nodes.find((node) => node.id !== selectedNode.id)?.id ?? selectedNode.id
    setRelationDraft((current) => ({
      ...current,
      from: selectedNode.id,
      to: current.to !== selectedNode.id ? current.to : fallbackTarget,
    }))
  }

  const prepareRelationToSelected = () => {
    const fallbackSource = nodes.find((node) => node.id !== selectedNode.id)?.id ?? selectedNode.id
    setRelationDraft((current) => ({
      ...current,
      from: current.from !== selectedNode.id ? current.from : fallbackSource,
      to: selectedNode.id,
    }))
  }

  const removeRelation = (targetEdge: WorkflowEdge) => {
    setEdges((current) => current.filter((edge) => !(edge.from === targetEdge.from && edge.to === targetEdge.to && edge.relation === targetEdge.relation && edge.label === targetEdge.label)))
  }

  const resetRelations = () => {
    setEdges(initialEdges)
  }


  const startSimulation = () => {
    const usePresetFlow = isJiameiTarget(targetStock)
    const effectiveStock = usePresetFlow ? '嘉美包装 / 002969' : targetStock || '股票A'
    const effectiveDate = usePresetFlow ? jiameiStrategyOutput.asOfDate : asOfDate || defaultAsOfDate
    if (usePresetFlow) {
      setTargetStock(effectiveStock)
      setAsOfDate(effectiveDate)
    }
    setMode('仿真')
    setActiveStep(0)
    setSimulationFinished(false)
    setJiameiDemoActive(usePresetFlow)
    setSelectedId('stock-loader')
    setIsSimulating(true)
    setNodes((current) => current.map((node) => {
      if (node.id !== 'stock-loader') return node
      return {
        ...node,
        meta: [effectiveStock, `as_of=${effectiveDate}`, '仅取时点前数据'],
      }
    }))
  }

  const sendStrategyToBacktest = () => {
    window.localStorage.setItem(BACKTEST_DRAFT_KEY, JSON.stringify({
      source: '多智星基金',
      name: jiameiStrategyOutput.name,
      description: `${jiameiStrategyOutput.symbol} · ${jiameiStrategyOutput.verdict} · ${jiameiStrategyOutput.entry}`,
      code: jiameiStrategyOutput.code,
      language: 'python',
      tags: ['多智星基金', '中证2000', '条件做多', '压力辩论'],
      symbols: ['002969'],
      start_date: '2026-03-03',
      end_date: jiameiStrategyOutput.asOfDate,
      initial_capital: 1000000,
      slippage: 0.0004,
      commission: 0.0006,
      strategy_output: jiameiStrategyOutput,
    }))
    navigate('/backtest')
  }

  const stopSimulation = () => {
    setIsSimulating(false)
    setSimulationFinished(false)
    setActiveStep(0)
  }

  return (
    <div className={`page-shell agent-builder-page agent-builder-page-${themeMode}`}>
      <div className="page-header agent-builder-header">
        <div>
          <Title level={3} className="page-title">多智星基金</Title>
          <Text type="secondary">只支持两类 Agent 关系；每个基金席位通过上下文工程注入中证 2000 数据池、策略 Skill 与 MCP Tool。</Text>
        </div>
        <Space wrap>
          <Segmented value={mode} onChange={(value) => setMode(value as typeof mode)} options={['设计', '仿真', '发布']} />
          <Button icon={<ApiOutlined />}>导入 DSL</Button>
          <Button type="primary" icon={<SaveOutlined />}>保存编排</Button>
        </Space>
      </div>

      <div className="agent-builder-toolbar">
        <div className="agent-builder-kpis">
          <div><span>{agentCount}</span><Text type="secondary">Agent</Text></div>
          <div><span>{relationCount}</span><Text type="secondary">关系</Text></div>
          <div><span>{skillCount}</span><Text type="secondary">Skill</Text></div>
          <div><span>{mcpToolCount}</span><Text type="secondary">MCP Tool</Text></div>
        </div>
        <Space wrap>
          <Tag color="blue">合作型讨论</Tag>
          <Tag color="red">对抗型辩论</Tag>
          <Tag color="gold">人工审批: {humanApproval ? '开启' : '关闭'}</Tag>
          <Tag color="purple">数据池: {csi2000DataPool.indexCode}</Tag>
          <Tag color={isSimulating ? 'processing' : 'cyan'}>{isSimulating ? '数据流运行中' : '浏览器已记录状态'}</Tag>
        </Space>
      </div>

      <div className="fund-simulation-panel">
        <div>
          <Text strong>模拟初始化</Text>
          <div><Text type="secondary">输入股票名称与分析时点。第一个席位会调用接口获取该时点之前的信息，再传递给因子研究员和辩论链路。</Text></div>
        </div>
        <div className="fund-simulation-controls">
          <label className="stock-picker-field">
            <Text type="secondary">股票名称/代码</Text>
            <Input
              value={targetStock}
              onChange={(event) => handleTargetStockChange(event.target.value)}
              onFocus={() => setStockPickerOpen(targetStock.trim().length > 0)}
              placeholder="输入股票名称或代码"
            />
            {stockPickerOpen && (
              <div className="stock-suggestion-panel">
                {stockOptionsLoading && <div className="stock-suggestion-loading"><Spin size="small" /> <Text type="secondary">检索股票池</Text></div>}
                {!stockOptionsLoading && filteredStockOptions.length === 0 && <div className="stock-suggestion-empty"><Text type="secondary">暂无匹配股票</Text></div>}
                {!stockOptionsLoading && filteredStockOptions.map((item) => (
                  <button type="button" className="stock-suggestion-item" key={item.stock_code} onMouseDown={(event) => event.preventDefault()} onClick={() => selectStockOption(item)}>
                    <span><strong>{item.stock_name || item.stock_code}</strong><Text type="secondary">{item.stock_code}</Text></span>
                    <Tag color="blue">中证2000</Tag>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label>
            <Text type="secondary">分析时点</Text>
            <DatePicker
              value={asOfDate ? dayjs(asOfDate) : null}
              onChange={(date) => setAsOfDate(date ? date.format('YYYY-MM-DD') : defaultAsOfDate)}
              disabledDate={(current) => Boolean(current && current.isAfter(dayjs(defaultAsOfDate), 'day'))}
              format="YYYY-MM-DD"
              allowClear={false}
              style={{ width: '100%' }}
            />
          </label>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={startSimulation}>{isSimulating ? '重新启动' : '启动模拟'}</Button>
          <Button onClick={stopSimulation} disabled={!isSimulating}>停止</Button>
        </div>
        <div className="fund-simulation-steps">
          {simulationOrder.map((id, index) => {
            const node = nodes.find((item) => item.id === id)
            const status = id === activeNodeId ? 'running' : completedNodeIds.has(id) ? 'done' : 'idle'
            return <span className={`fund-simulation-step fund-simulation-step-${status}`} key={id}>{index + 1}. {node?.subtitle ?? id}</span>
          })}
        </div>
      </div>


      <div className="agent-builder-grid">
        <aside className="agent-builder-panel agent-builder-library">
          <div className="agent-panel-title">
            <Space><RobotOutlined />基金投研席位</Space>
            <Button size="small" type="text" icon={<PlusOutlined />} aria-label="新建多智星基金席位" />
          </div>
          <Input.Search placeholder="搜索席位 / Skill / MCP Tool" allowClear />

          <div className="agent-template-list">
            {agentTemplates.map((template) => (
              <button key={template.id} className={`agent-template-card agent-template-${template.tone}`} onClick={() => addAgent(template)}>
                <span className="agent-template-main">
                  <span className="agent-template-name">{template.name}</span>
                  <span className="agent-template-desc">{template.description}</span>
                  <span className="agent-capability-row">
                    <Tag color="blue">{template.skills.length} Skills</Tag>
                    <Tag color="purple">{template.mcpTools.length} MCP</Tag>
                  </span>
                </span>
                <span className="agent-template-meta">
                  <Tag>{toneLabel[template.tone]}</Tag>
                  <PlusOutlined />
                </span>
              </button>
            ))}
          </div>

          <Divider />

          <div className="agent-panel-title"><Space><SwapOutlined />关系类型</Space></div>
          <div className="logic-template-list">
            {relationTemplates.map((item) => (
              <div className={`logic-template-item relation-template-item relation-template-${item.id}`} key={item.id}>
                <span className="logic-template-icon" style={{ color: item.color, background: `${item.color}18` }}><SwapOutlined /></span>
                <span>
                  <Text strong>{item.name}</Text>
                  <Text type="secondary">{item.description}</Text>
                </span>
              </div>
            ))}
          </div>

          <Divider />

          <div className="agent-panel-title"><Space><ApartmentOutlined />Skill / MCP Tool</Space></div>
          <div className="agent-capability-list">
            {capabilityTemplates.map((item) => (
              <div className="agent-capability-item" key={item.id}>
                <Tag color={item.type === 'skill' ? 'blue' : 'purple'}>{item.type === 'skill' ? 'Skill' : 'MCP'}</Tag>
                <span>
                  <Text strong>{item.name}</Text>
                  <Text type="secondary">{item.description}</Text>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <main className="agent-canvas-shell">
          <div className="agent-canvas-topbar">
            <Space wrap>
              <Button icon={<ControlOutlined />} onClick={resetLayout}>自动排版</Button>
              <Button icon={<ExperimentOutlined />}>运行一次</Button>
              <Button icon={<FilterOutlined />}>显示关系类型</Button>
            </Space>
            <div className="agent-zoom-controls">
              <Button size="small" icon={<ZoomOutOutlined />} onClick={zoomOut} aria-label="缩小画布" />
              <Slider min={MIN_ZOOM} max={MAX_ZOOM} step={0.05} value={zoom} onChange={setZoom} tooltip={{ formatter: (value) => `${Math.round((value ?? 1) * 100)}%` }} />
              <Button size="small" icon={<ZoomInOutlined />} onClick={zoomIn} aria-label="放大画布" />
              <Text className="mono">{Math.round(zoom * 100)}%</Text>
            </div>
          </div>

          <div
            className="agent-canvas"
            ref={canvasRef}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <div className="agent-canvas-spacer" style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}>
              <div className="agent-canvas-stage" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})` }}>
                <svg className="agent-edge-layer" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-hidden="true">
              <defs>
                <marker id="agent-edge-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L8,3 z" fill="#64748b" />
                </marker>
                <marker id="agent-edge-arrow-red" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L8,3 z" fill="#dc2626" />
                </marker>
              </defs>
              {validEdges.map((edge, edgeIndex) => {
                const from = nodes.find((node) => node.id === edge.from)
                const to = nodes.find((node) => node.id === edge.to)
                if (!from || !to) return null
                const start = getNodeCenter(from)
                const end = getNodeCenter(to)
                const midX = start.x + (end.x - start.x) / 2
                const path = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`
                const pathId = `flow-path-${edgeIndex}`
                const edgeIsActive = isSimulating && (edge.from === activeNodeId || completedNodeIds.has(edge.from))
                return (
                  <g key={`${edge.from}-${edge.to}-${edgeIndex}`}>
                    <path id={pathId} className={`agent-edge agent-edge-${edge.relation} ${edgeIsActive ? 'is-flowing' : ''}`} d={path} markerEnd={edge.relation === 'adversarial' ? 'url(#agent-edge-arrow-red)' : 'url(#agent-edge-arrow)'} />
                    {edgeIsActive && (
                      <>
                        <circle className={`agent-flow-particle agent-flow-particle-${edge.relation}`} r="4">
                          <animateMotion dur="1.6s" repeatCount="indefinite" begin={`${(edgeIndex % 3) * 0.18}s`}>
                            <mpath href={`#${pathId}`} />
                          </animateMotion>
                        </circle>
                        <circle className={`agent-flow-particle agent-flow-particle-${edge.relation} is-secondary`} r="2.6">
                          <animateMotion dur="1.6s" repeatCount="indefinite" begin={`${0.55 + (edgeIndex % 2) * 0.2}s`}>
                            <mpath href={`#${pathId}`} />
                          </animateMotion>
                        </circle>
                      </>
                    )}
                    <text className={`agent-edge-label agent-edge-label-${edge.relation}`} x={midX - 26} y={(start.y + end.y) / 2 - 8}>{edge.label}</text>
                  </g>
                )
              })}
            </svg>

                {nodes.map((node) => (
                  <button
                    key={node.id}
                    className={`${nodeClass(node)} ${selectedId === node.id ? 'is-selected' : ''} ${node.id === activeNodeId ? 'is-running' : ''} ${completedNodeIds.has(node.id) ? 'is-done' : ''}`}
                    style={{ left: node.x, top: node.y, width: node.width }}
                    onPointerDown={(event) => handleNodePointerDown(event, node)}
                    onClick={() => setSelectedId(node.id)}
                  >
                <span className="agent-flow-node-head">
                  <span className="agent-flow-node-icon">{nodeIcon[node.type]}</span>
                  <span>{node.title}</span>
                </span>
                <span className="agent-flow-node-subtitle">{node.subtitle}</span>
                {(node.id === activeNodeId || completedNodeIds.has(node.id)) && <span className={`agent-work-status ${node.id === activeNodeId ? 'running' : 'done'}`}>{node.id === activeNodeId ? '调用中' : '已完成'}</span>}
                <span className="agent-flow-node-meta">{node.meta.map((item) => <span key={item}>{item}</span>)}</span>
                {(node.skills?.length || node.mcpTools?.length) && (
                  <span className="agent-flow-node-capabilities">
                    {node.skills?.slice(0, 2).map((item) => <span className="agent-skill-chip" key={item}>S: {item}</span>)}
                    {node.mcpTools?.slice(0, 2).map((item) => <span className="agent-mcp-chip" key={item}>MCP: {item}</span>)}
                  </span>
                )}
                  </button>
                ))}
              </div>
            </div>
          </div>
      {jiameiDemoActive && (
        <div className="jiamei-demo-panel">
          <div className="jiamei-demo-header">
            <div>
              <Text strong>运行记录</Text>
              <div><Text type="secondary">展示 Agent 思考、接口取数、数据传输与压力辩论。相关数字来自当前 data/ 中证 2000 样本或基于样本窗口计算。</Text></div>
            </div>
            <Tag color={showStrategyOutput ? 'green' : 'processing'}>{showStrategyOutput ? '策略已生成' : 'Agent 处理中'}</Tag>
          </div>
          <div className="jiamei-demo-log">
            {visibleDemoSteps.map((step, index) => {
              const status = step.nodeId === activeNodeId ? 'running' : completedNodeIds.has(step.nodeId) || showStrategyOutput ? 'done' : 'idle'
              return (
                <div className={`jiamei-demo-step jiamei-demo-step-${status}`} key={`${step.nodeId}-${index}`}>
                  <div className="jiamei-demo-step-head">
                    <span>{index + 1}. {step.title}</span>
                    <Tag color={status === 'running' ? 'blue' : 'green'}>{status === 'running' ? step.status : '完成'}</Tag>
                  </div>
                  <p><Text type="secondary">输入</Text>{step.input}</p>
                  <p><Text type="secondary">处理</Text>{step.process}</p>
                  <p><Text type="secondary">输出</Text>{step.output}</p>
                </div>
              )
            })}
          </div>

          {showStrategyOutput && (
            <div className="jiamei-strategy-output">
              <div className="jiamei-strategy-title">
                <div>
                  <Text strong>{jiameiStrategyOutput.name}</Text>
                  <div><Text type="secondary">{jiameiStrategyOutput.symbol} · as_of_date={jiameiStrategyOutput.asOfDate}</Text></div>
                </div>
                <Space wrap>
                  <Tag color="gold">{jiameiStrategyOutput.verdict}</Tag>
                  <Button size="small" type="primary" icon={<ExperimentOutlined />} onClick={sendStrategyToBacktest}>送入回测实验</Button>
                </Space>
              </div>
              <div className="jiamei-strategy-grid">
                <div><Text type="secondary">入场条件</Text><strong>{jiameiStrategyOutput.entry}</strong></div>
                <div><Text type="secondary">仓位</Text><strong>{jiameiStrategyOutput.position}</strong></div>
                <div><Text type="secondary">止损</Text><strong>{jiameiStrategyOutput.stopLoss}</strong></div>
                <div><Text type="secondary">止盈</Text><strong>{jiameiStrategyOutput.takeProfit}</strong></div>
                <div><Text type="secondary">持有/退出</Text><strong>{jiameiStrategyOutput.holding}</strong></div>
                <div><Text type="secondary">风险约束</Text><strong>{jiameiStrategyOutput.risk}</strong></div>
              </div>
            </div>
          )}
        </div>
      )}
        </main>

        <aside className="agent-builder-panel agent-inspector">
          <div className="agent-panel-title">
            <Space><SettingOutlined />属性面板</Space>
            <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={removeSelected} disabled={['trigger-market', 'publish-plan'].includes(selectedNode.id)} aria-label="删除当前节点" />
          </div>

          <div className="agent-inspector-identity">
            <span className="agent-inspector-icon">{nodeIcon[selectedNode.type]}</span>
            <div>
              <Text strong>{selectedNode.title}</Text>
              <Text type="secondary">{selectedNode.subtitle}</Text>
            </div>
          </div>

          <div className="agent-form-stack">
            <label>
              <Text type="secondary">节点类型</Text>
              <Select
                value={selectedNode.type}
                options={[
                  { value: 'trigger', label: '触发器' },
                  { value: 'agent', label: 'Agent' },
                  { value: 'tool', label: '工具' },
                  { value: 'output', label: '输出' },
                ]}
              />
            </label>
            <label>
              <Text type="secondary">系统提示词</Text>
              <Input.TextArea value={selectedNode.systemPrompt ?? ''} onChange={(event) => updateSelectedNode({ systemPrompt: event.target.value })} autoSize={{ minRows: 8, maxRows: 14 }} />
            </label>
            <label>
              <Text type="secondary">Skills</Text>
              <Select mode="tags" value={selectedNode.skills ?? []} onChange={(skills) => updateSelectedNode({ skills })} options={capabilityTemplates.filter((item) => item.type === 'skill').map((item) => ({ value: item.name, label: item.name }))} />
            </label>
            <label>
              <Text type="secondary">MCP Tools</Text>
              <Select mode="tags" value={selectedNode.mcpTools ?? []} onChange={(mcpTools) => updateSelectedNode({ mcpTools })} options={capabilityTemplates.filter((item) => item.type === 'mcp').map((item) => ({ value: item.name, label: item.name }))} />
            </label>
            <label>
              <Text type="secondary">最大辩论轮次</Text>
              <Input value={maxRounds} onChange={(event) => setMaxRounds(event.target.value)} suffix="rounds" />
            </label>
            <div className="agent-switch-row">
              <span>
                <Text strong>人工审批闸门</Text>
                <Text type="secondary">发布前要求 Portfolio Manager 与 Risk Manager 同时通过</Text>
              </span>
              <Switch checked={humanApproval} onChange={setHumanApproval} />
            </div>
          </div>

          <Divider />

          <div className="agent-relation-editor">
            <div className="agent-panel-title">
              <Space><SwapOutlined />添加关系</Space>
              <Button size="small" type="text" onClick={resetRelations}>重置</Button>
            </div>
            <div className="agent-relation-shortcuts">
              <Button size="small" onClick={prepareRelationFromSelected}>从当前席位连接</Button>
              <Button size="small" onClick={prepareRelationToSelected}>连接到当前席位</Button>
            </div>
            <div className="agent-form-stack">
              <label>
                <Text type="secondary">起点席位</Text>
                <Select showSearch optionFilterProp="label" value={relationDraft.from} options={nodeOptions} onChange={(from) => setRelationDraft((current) => ({ ...current, from }))} />
              </label>
              <label>
                <Text type="secondary">终点席位</Text>
                <Select showSearch optionFilterProp="label" value={relationDraft.to} options={nodeOptions} onChange={(to) => setRelationDraft((current) => ({ ...current, to }))} />
              </label>
              <label>
                <Text type="secondary">关系类型</Text>
                <Segmented
                  value={relationDraft.relation}
                  onChange={(relation) => setRelationDraft((current) => ({ ...current, relation: relation as RelationType }))}
                  options={[
                    { label: '合作型讨论', value: 'collaboration' },
                    { label: '对抗型辩论', value: 'adversarial' },
                  ]}
                />
              </label>
              <label>
                <Text type="secondary">关系标签</Text>
                <Input value={relationDraft.label} onChange={(event) => setRelationDraft((current) => ({ ...current, label: event.target.value }))} placeholder="例如：因子证据 / 反证挑战" />
              </label>
              <Button type="primary" icon={<PlusOutlined />} onClick={addRelation} disabled={relationDraft.from === relationDraft.to}>添加关系</Button>
            </div>
            <div className="agent-relation-list">
              {validEdges.map((edge, index) => {
                const from = nodes.find((node) => node.id === edge.from)
                const to = nodes.find((node) => node.id === edge.to)
                return (
                  <div className={`agent-relation-row agent-relation-row-${edge.relation}`} key={`${edge.from}-${edge.to}-${edge.relation}-${index}`}>
                    <div>
                      <Text strong>{edge.label}</Text>
                      <div><Text type="secondary">{from?.title} → {to?.title}</Text></div>
                    </div>
                    <Space>
                      <Tag color={edge.relation === 'collaboration' ? 'blue' : 'red'}>{edge.relation === 'collaboration' ? '合作' : '对抗'}</Tag>
                      <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => removeRelation(edge)} aria-label="删除关系" />
                    </Space>
                  </div>
                )
              })}
            </div>
          </div>

          <Divider />

          <div className="agent-checklist">
            <div className="agent-panel-title"><Space><CheckCircleOutlined />编排检查</Space></div>
            {[
              ['关系类型仅包含两类', validEdges.every((edge) => edge.relation === 'collaboration' || edge.relation === 'adversarial')],
              ['存在合作型讨论', validEdges.some((edge) => edge.relation === 'collaboration')],
              ['存在对抗型辩论', validEdges.some((edge) => edge.relation === 'adversarial')],
              ['基金席位已声明 Skill', nodes.filter((node) => node.type === 'agent').every((node) => (node.skills?.length ?? 0) > 0)],
              ['基金席位已声明 MCP Tool', nodes.filter((node) => node.type === 'agent').every((node) => (node.mcpTools?.length ?? 0) > 0)],
              ['辩论轮次上限已设置', Number(maxRounds) > 0],
            ].map(([label, ok]) => (
              <div className="agent-check-row" key={label as string}>
                <span className={ok ? 'is-ok' : 'is-warn'} />
                <Text>{label}</Text>
              </div>
            ))}
          </div>

          <div className="agent-context-panel">
            <div className="agent-panel-title"><Space><DatabaseOutlined />上下文注入</Space></div>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {contextInjectionPlan.map((item) => (
                <div className="agent-context-row" key={item.agent}>
                  <div>
                    <Text strong>{item.agent}</Text>
                    <div><Text type="secondary">{item.context}</Text></div>
                  </div>
                  <Tag color={item.status === '已注入' ? 'green' : 'gold'}>{item.status}</Tag>
                </div>
              ))}
            </Space>
          </div>

          <Alert type="info" showIcon message="执行语义" description={`多智星基金 DSL 可序列化为 nodes、relations、skills、mcp_tools、context 五部分；数据边界固定为 ${csi2000DataPool.name}，可调用策略 Skill ${strategySkillRegistry.length} 个。`} />
        </aside>
      </div>
    </div>
  )
}

export default Agents
