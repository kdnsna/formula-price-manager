import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  History,
  Info,
  ListChecks,
  RotateCcw,
  Search,
  Settings2,
  Upload,
  X,
} from 'lucide-react';
import { CHANGE_STATUSES, DEFAULT_MONTH, EXPECTED_COUNTS, VIEWS } from './lib/constants';
import { exportExcel, exportJson } from './lib/exporters';
import { parseWorkbookFile } from './lib/excel';
import {
  buildRecordKey,
  createRecordId,
  detectFormulaWarnings,
  getMetricTitle,
  getNewConfigSyntheticId,
  getRecordForMetric,
  getRelatedMonthRules,
  getRelatedPriceComparison,
  getRelatedRecommendations,
  metricMatchesSearch,
  riskRank,
  textValue,
} from './lib/formula';
import { createInitialState, loadState, resetState, saveState } from './lib/storage';
import type { AppState, ChangeStatus, MetricFormula, MonthlyChangeRecord, NewConfigItem, ViewKey } from './types';

type DrawerTab = 'formula' | 'price' | 'unit' | 'month' | 'history';

const drawerTabs: Array<{ key: DrawerTab; label: string }> = [
  { key: 'formula', label: '公式说明' },
  { key: 'price', label: '单价切换' },
  { key: 'unit', label: '单位口径' },
  { key: 'month', label: '月度参数' },
  { key: 'history', label: '变更历史' },
];

function FormulaCode({ text, compact = false }: { text: string; compact?: boolean }) {
  if (!text) return <span className="muted">未填写</span>;
  const parts = text.split(/(IF\[[^\]]+\]|M\d{7}|_p\d+[a-z]?|\/10000|-?\d+(?:\.\d+)?)/g);
  return (
    <code className={compact ? 'formula-code compact' : 'formula-code'}>
      {parts.map((part, index) => {
        let cls = '';
        if (/^IF\[/.test(part)) cls = 'token token-if';
        else if (/^M\d{7}$/.test(part)) cls = 'token token-metric';
        else if (/^_p\d+[a-z]?$/.test(part)) cls = 'token token-source';
        else if (part === '/10000') cls = 'token token-unit';
        else if (/^-?\d+(?:\.\d+)?$/.test(part)) cls = 'token token-number';
        return cls ? (
          <span className={cls} key={`${part}-${index}`}>
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </code>
  );
}

function RiskBadge({ level }: { level: string }) {
  const normalized = level || '无';
  return <span className={`badge risk risk-${normalized}`}>{normalized}</span>;
}

function StatusBadge({ status }: { status: ChangeStatus }) {
  return <span className={`badge status status-${status}`}>{status}</span>;
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{textValue(value) || '未列示'}</strong>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <Database size={28} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [activeView, setActiveView] = useState<ViewKey>('ledger');
  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_MONTH);
  const [search, setSearch] = useState('');
  const [boardFilter, setBoardFilter] = useState('全部');
  const [riskFilter, setRiskFilter] = useState('全部');
  const [statusFilter, setStatusFilter] = useState<'全部' | ChangeStatus>('全部');
  const [adjustmentFilter, setAdjustmentFilter] = useState('全部');
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('formula');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const boards = useMemo(() => Array.from(new Set(state.data.formulas.map((item) => item.board).filter(Boolean))).sort(), [state.data.formulas]);
  const selectedMetric = useMemo(
    () => state.data.formulas.find((metric) => metric.metricId === selectedMetricId) ?? null,
    [selectedMetricId, state.data.formulas],
  );

  const recordMap = useMemo(() => {
    const map = new Map<string, MonthlyChangeRecord>();
    state.records.forEach((record) => {
      map.set(buildRecordKey(record.month, record.metricId, record.recordType), record);
    });
    return map;
  }, [state.records]);

  const filteredMetrics = useMemo(() => {
    return state.data.formulas
      .filter((metric) => metricMatchesSearch(metric, search))
      .filter((metric) => boardFilter === '全部' || metric.board === boardFilter)
      .filter((metric) => riskFilter === '全部' || metric.riskLevel === riskFilter)
      .filter((metric) => adjustmentFilter === '全部' || metric.needsFormulaAdjustment.includes(adjustmentFilter))
      .filter((metric) => {
        if (statusFilter === '全部') return true;
        const record = recordMap.get(buildRecordKey(selectedMonth, metric.metricId, 'formula'));
        return (record?.status ?? '待确认') === statusFilter;
      })
      .sort((a, b) => {
        return riskRank(a.riskLevel) - riskRank(b.riskLevel) || Number(a.sequence) - Number(b.sequence);
      });
  }, [state.data.formulas, search, boardFilter, riskFilter, statusFilter, adjustmentFilter, selectedMonth, recordMap]);

  const monthRecords = useMemo(() => state.records.filter((record) => record.month === selectedMonth), [state.records, selectedMonth]);
  const highRiskCount = state.data.formulas.filter((item) => item.riskLevel === '高').length;
  const needAdjustmentCount = state.data.formulas.filter((item) => item.needsFormulaAdjustment.includes('是') || item.needsFormulaAdjustment.includes('确认')).length;
  const reviewedCount = monthRecords.filter((record) => record.status === '已复核').length;

  function upsertRecord(base: Omit<MonthlyChangeRecord, 'id' | 'createdAt' | 'updatedAt'>, updates: Partial<MonthlyChangeRecord>) {
    setState((current) => {
      const now = new Date().toISOString();
      const index = current.records.findIndex(
        (record) => record.month === base.month && record.metricId === base.metricId && record.recordType === base.recordType,
      );
      if (index >= 0) {
        const nextRecords = current.records.slice();
        nextRecords[index] = { ...nextRecords[index], ...updates, updatedAt: now };
        return { ...current, records: nextRecords };
      }
      const nextRecord: MonthlyChangeRecord = {
        ...base,
        ...updates,
        id: createRecordId(),
        createdAt: now,
        updatedAt: now,
      };
      return { ...current, records: [...current.records, nextRecord] };
    });
  }

  function updateMetricRecord(metric: MetricFormula, updates: Partial<MonthlyChangeRecord>) {
    upsertRecord(
      {
        month: selectedMonth,
        metricId: metric.metricId,
        metricName: getMetricTitle(metric),
        status: '待确认',
        note: '',
        beforeFormula: metric.originalFormula,
        afterFormula: '',
        source: metric.sourceNote || metric.formulaAdvice2026,
        recordType: 'formula',
      },
      updates,
    );
  }

  function addNewConfigRecord(item: NewConfigItem) {
    upsertRecord(
      {
        month: selectedMonth,
        metricId: getNewConfigSyntheticId(item),
        metricName: item.metricName2026,
        status: '待配置',
        note: item.reason,
        beforeFormula: '',
        afterFormula: item.actionAdvice,
        source: item.source,
        recordType: 'new-config',
      },
      { status: '待配置', note: item.reason, afterFormula: item.actionAdvice },
    );
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseWorkbookFile(file);
      setState((current) => ({ ...current, data }));
      setImportMessage(`已导入 ${file.name}：主表 ${data.formulas.length} 条，单价对比 ${data.priceComparisons.length} 条，新配 ${data.newConfigItems.length} 条。`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '导入失败，请检查 Excel 工作表名称。');
    } finally {
      event.target.value = '';
    }
  }

  function handleReset() {
    resetState();
    setState(createInitialState());
    setImportMessage('已恢复内置种子数据，并清空本地变更记录。');
  }

  function openMetric(metric: MetricFormula, tab: DrawerTab = 'formula') {
    setSelectedMetricId(metric.metricId);
    setDrawerTab(tab);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">价</div>
          <div>
            <strong>公式管理台</strong>
            <span>全员全产品计价</span>
          </div>
        </div>
        <nav>
          {VIEWS.map((view) => (
            <button className={activeView === view.key ? 'nav-item active' : 'nav-item'} key={view.key} onClick={() => setActiveView(view.key)}>
              {view.key === 'ledger' && <ClipboardList size={17} />}
              {view.key === 'formulaLibrary' && <BookOpen size={17} />}
              {view.key === 'newConfig' && <ListChecks size={17} />}
              {view.key === 'ruleTemplates' && <Settings2 size={17} />}
              {view.key === 'io' && <Database size={17} />}
              <span>{view.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>当前来源</span>
          <strong>{state.data.sourceName}</strong>
          <small>{new Date(state.data.importedAt).toLocaleString('zh-CN')}</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>全员全产品计价公式管理台</h1>
            <p>按月登记公式变更，追踪 25→26 单价切换、单位口径和新增配置。</p>
          </div>
          <div className="top-actions">
            <label className="month-control">
              <span>维护月份</span>
              <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
            </label>
            <button className="button primary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              导入 Excel
            </button>
            <button className="button" onClick={() => exportExcel(state)}>
              <FileSpreadsheet size={16} />
              导出台账
            </button>
            <input ref={fileInputRef} className="hidden-input" type="file" accept=".xlsx,.xls" onChange={handleImport} />
          </div>
        </header>

        <section className="summary-grid">
          <div className="summary-card">
            <span>公式主表</span>
            <strong>{state.data.formulas.length}</strong>
            <small>预期 {EXPECTED_COUNTS.formulas} 条</small>
          </div>
          <div className="summary-card danger">
            <span>高风险</span>
            <strong>{highRiskCount}</strong>
            <small>优先核实单位和单价</small>
          </div>
          <div className="summary-card warning">
            <span>需处理/确认</span>
            <strong>{needAdjustmentCount}</strong>
            <small>含调公式和建议优化</small>
          </div>
          <div className="summary-card success">
            <span>本月已复核</span>
            <strong>{reviewedCount}</strong>
            <small>本月记录 {monthRecords.length} 条</small>
          </div>
        </section>

        {activeView === 'ledger' && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>月度变更台账</h2>
                <span>默认把未登记项目视为“待确认”，状态和备注会自动保存到本机。</span>
              </div>
              <div className="filter-row">
                <label className="search-box">
                  <Search size={15} />
                  <input value={search} placeholder="搜索指标编号、公式、建议、口径" onChange={(event) => setSearch(event.target.value)} />
                </label>
                <select value={boardFilter} onChange={(event) => setBoardFilter(event.target.value)}>
                  <option>全部</option>
                  {boards.map((board) => (
                    <option key={board}>{board}</option>
                  ))}
                </select>
                <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                  <option>全部</option>
                  <option>高</option>
                  <option>中</option>
                  <option>低</option>
                  <option>无</option>
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '全部' | ChangeStatus)}>
                  <option>全部</option>
                  {CHANGE_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <select value={adjustmentFilter} onChange={(event) => setAdjustmentFilter(event.target.value)}>
                  <option>全部</option>
                  <option value="是">需调整</option>
                  <option value="确认">需确认</option>
                  <option value="否">无需调整</option>
                </select>
              </div>
            </div>
            <MetricTable metrics={filteredMetrics} records={state.records} month={selectedMonth} onOpen={openMetric} onUpdateRecord={updateMetricRecord} />
          </section>
        )}

        {activeView === 'formulaLibrary' && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>公式库</h2>
                <span>集中查看原公式、解释、风险和 2026 建议。</span>
              </div>
              <label className="search-box">
                <Search size={15} />
                <input value={search} placeholder="搜索公式库" onChange={(event) => setSearch(event.target.value)} />
              </label>
            </div>
            <MetricTable
              metrics={filteredMetrics}
              records={state.records}
              month={selectedMonth}
              onOpen={openMetric}
              onUpdateRecord={updateMetricRecord}
              libraryMode
            />
          </section>
        )}

        {activeView === 'newConfig' && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>2026 新增需新配</h2>
                <span>新增或拆分后的指标可以直接生成本月配置记录。</span>
              </div>
            </div>
            <div className="new-config-table">
              {state.data.newConfigItems.map((item) => {
                const syntheticId = getNewConfigSyntheticId(item);
                const record = getRecordForMetric(state.records, selectedMonth, syntheticId, 'new-config');
                return (
                  <div className="new-config-row" key={syntheticId}>
                    <div className="new-config-main">
                      <div>
                        <RiskBadge level={item.priority === '高' ? '高' : '中'} />
                        <strong>{item.metricName2026}</strong>
                        <span>{item.category2026}</span>
                      </div>
                      <p>{item.reason}</p>
                    </div>
                    <div className="new-config-action">
                      <span>{item.coverage}</span>
                      <button className={record ? 'button success-button' : 'button primary'} onClick={() => addNewConfigRecord(item)}>
                        {record ? <CheckCircle2 size={15} /> : <ClipboardList size={15} />}
                        {record ? '已入台账' : '生成记录'}
                      </button>
                    </div>
                    <div className="advice-strip">{item.actionAdvice}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeView === 'ruleTemplates' && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>规则模板</h2>
                <span>沉淀月份滚动、IF 分支和存量折算的通用写法。</span>
              </div>
            </div>
            <div className="rule-grid">
              {state.data.monthRules.map((rule) => (
                <article className="rule-card" key={rule.purpose}>
                  <div>
                    <strong>{rule.purpose}</strong>
                    <span>{rule.applicableMetrics}</span>
                  </div>
                  <label>一月写法</label>
                  <FormulaCode text={rule.januaryFormula} compact />
                  <label>第 n 月通用写法</label>
                  <FormulaCode text={rule.monthNFormula} compact />
                  <p>{rule.note}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeView === 'io' && (
          <section className="panel io-panel">
            <div className="panel-head">
              <div>
                <h2>导入导出</h2>
                <span>本地浏览器保存，不上传服务器。导出文件包含原始数据和月度变更记录。</span>
              </div>
            </div>
            <div className="io-grid">
              <button className="io-action" onClick={() => fileInputRef.current?.click()}>
                <Upload size={22} />
                <strong>导入 Excel</strong>
                <span>识别公式切换总表、25-26 单价对比、新增新配、修改建议和月份参数模板。</span>
              </button>
              <button className="io-action" onClick={() => exportExcel(state)}>
                <FileSpreadsheet size={22} />
                <strong>导出 Excel 台账</strong>
                <span>用于 WPS/Excel 继续加工或留档。</span>
              </button>
              <button className="io-action" onClick={() => exportJson(state)}>
                <FileJson size={22} />
                <strong>导出 JSON</strong>
                <span>完整备份本地数据和记录。</span>
              </button>
              <button className="io-action danger-action" onClick={handleReset}>
                <RotateCcw size={22} />
                <strong>恢复种子数据</strong>
                <span>清空本机记录并回到当前 Excel 的内置数据。</span>
              </button>
            </div>
            {importMessage && <div className="message-line">{importMessage}</div>}
            <div className="count-checks">
              <CountCheck label="公式主表" actual={state.data.formulas.length} expected={EXPECTED_COUNTS.formulas} />
              <CountCheck label="单价对比" actual={state.data.priceComparisons.length} expected={EXPECTED_COUNTS.priceComparisons} />
              <CountCheck label="新增新配" actual={state.data.newConfigItems.length} expected={EXPECTED_COUNTS.newConfigItems} />
              <CountCheck label="修改建议" actual={state.data.recommendations.length} expected={EXPECTED_COUNTS.recommendations} />
              <CountCheck label="月份模板" actual={state.data.monthRules.length} expected={EXPECTED_COUNTS.monthRules} />
            </div>
          </section>
        )}
      </main>

      {selectedMetric && (
        <MetricDrawer
          metric={selectedMetric}
          tab={drawerTab}
          setTab={setDrawerTab}
          month={selectedMonth}
          state={state}
          onClose={() => setSelectedMetricId(null)}
          onUpdateRecord={updateMetricRecord}
        />
      )}
    </div>
  );
}

function CountCheck({ label, actual, expected }: { label: string; actual: number; expected: number }) {
  const ok = actual === expected;
  return (
    <div className={ok ? 'count-check ok' : 'count-check warn'}>
      {ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      <span>{label}</span>
      <strong>
        {actual}/{expected}
      </strong>
    </div>
  );
}

function MetricTable({
  metrics,
  records,
  month,
  onOpen,
  onUpdateRecord,
  libraryMode = false,
}: {
  metrics: MetricFormula[];
  records: MonthlyChangeRecord[];
  month: string;
  onOpen: (metric: MetricFormula, tab?: DrawerTab) => void;
  onUpdateRecord: (metric: MetricFormula, updates: Partial<MonthlyChangeRecord>) => void;
  libraryMode?: boolean;
}) {
  if (!metrics.length) {
    return <EmptyState title="没有匹配的公式" detail="调整筛选条件或重新导入 Excel 后再试。" />;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-id">指标编号</th>
            <th>板块 / 小类</th>
            <th>原公式</th>
            <th>风险</th>
            <th>是否调整</th>
            <th>2026 建议</th>
            {!libraryMode && <th>本月状态</th>}
            {!libraryMode && <th>备注</th>}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => {
            const record = getRecordForMetric(records, month, metric.metricId, 'formula');
            const status = record?.status ?? '待确认';
            return (
              <tr key={metric.metricId}>
                <td className="metric-id-cell">
                  <button onClick={() => onOpen(metric)}>{metric.metricId}</button>
                  <span>{metric.formulaType}</span>
                </td>
                <td>
                  <strong>{metric.board}</strong>
                  <span className="line-detail">{getMetricTitle(metric)}</span>
                </td>
                <td className="formula-cell" onClick={() => onOpen(metric)}>
                  <FormulaCode text={metric.originalFormula} compact />
                </td>
                <td>
                  <RiskBadge level={metric.riskLevel} />
                </td>
                <td className="narrow-text">{metric.needsFormulaAdjustment}</td>
                <td className="advice-cell">{metric.formulaAdvice2026 || metric.priceChangeConclusion}</td>
                {!libraryMode && (
                  <td>
                    <select value={status} onChange={(event) => onUpdateRecord(metric, { status: event.target.value as ChangeStatus })}>
                      {CHANGE_STATUSES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </td>
                )}
                {!libraryMode && (
                  <td>
                    <input
                      className="table-note"
                      value={record?.note ?? ''}
                      placeholder="本月备注"
                      onChange={(event) => onUpdateRecord(metric, { note: event.target.value })}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MetricDrawer({
  metric,
  tab,
  setTab,
  month,
  state,
  onClose,
  onUpdateRecord,
}: {
  metric: MetricFormula;
  tab: DrawerTab;
  setTab: (tab: DrawerTab) => void;
  month: string;
  state: AppState;
  onClose: () => void;
  onUpdateRecord: (metric: MetricFormula, updates: Partial<MonthlyChangeRecord>) => void;
}) {
  const record = getRecordForMetric(state.records, month, metric.metricId, 'formula');
  const relatedPrice = getRelatedPriceComparison(metric, state.data.priceComparisons);
  const recommendations = getRelatedRecommendations(metric, state.data.recommendations);
  const rules = getRelatedMonthRules(metric, state.data.monthRules);
  const warnings = detectFormulaWarnings(metric);
  const history = state.records
    .filter((item) => item.metricId === metric.metricId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <div>
          <div className="drawer-title-line">
            <RiskBadge level={metric.riskLevel} />
            <strong>{metric.metricId}</strong>
            <StatusBadge status={record?.status ?? '待确认'} />
          </div>
          <h2>{getMetricTitle(metric)}</h2>
          <span>{metric.board} · {metric.formulaType}</span>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="关闭详情">
          <X size={18} />
        </button>
      </div>

      <div className="drawer-tabs">
        {drawerTabs.map((item) => (
          <button className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)} key={item.key}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="drawer-body">
        {warnings.length > 0 && (
          <div className="warning-list">
            <AlertTriangle size={16} />
            {warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        )}

        {tab === 'formula' && (
          <div className="drawer-section">
            <label>原公式</label>
            <FormulaCode text={metric.originalFormula} />
            <label>公式解释</label>
            <p>{metric.formulaDescription || '暂无解释'}</p>
            <label>2026 公式/配置建议</label>
            <p>{metric.formulaAdvice2026 || '暂无建议'}</p>
            <div className="form-grid">
              <label>
                本月状态
                <select value={record?.status ?? '待确认'} onChange={(event) => onUpdateRecord(metric, { status: event.target.value as ChangeStatus })}>
                  {CHANGE_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                变更后公式
                <textarea value={record?.afterFormula ?? ''} placeholder="记录调整后的公式或配置动作" onChange={(event) => onUpdateRecord(metric, { afterFormula: event.target.value })} />
              </label>
              <label className="wide">
                本月备注
                <textarea value={record?.note ?? ''} placeholder="登记本月确认过程、依据或待补事项" onChange={(event) => onUpdateRecord(metric, { note: event.target.value })} />
              </label>
            </div>
          </div>
        )}

        {tab === 'price' && (
          <div className="drawer-section">
            <div className="price-grid">
              <Field label="2025 匹配指标" value={metric.match2025} />
              <Field label="2026 匹配指标" value={metric.match2026} />
              <Field label="2025 计价口径" value={metric.unit2025} />
              <Field label="2026 计价单位" value={metric.unit2026} />
              <Field label="2025 存量/总量" value={metric.stock2025} />
              <Field label="2026 存量/总量" value={metric.stock2026} />
              <Field label="2025 正增长" value={metric.positive2025} />
              <Field label="2026 正增长" value={metric.positive2026} />
              <Field label="2025 负增长" value={metric.negative2025} />
              <Field label="2026 负增长" value={metric.negative2026} />
            </div>
            <label>25→26 单价变化结论</label>
            <p>{metric.priceChangeConclusion || relatedPrice?.changeDescription || '暂无变化说明'}</p>
            {relatedPrice && (
              <div className="related-box">
                <Info size={16} />
                <span>{relatedPrice.changeType}：{relatedPrice.changeDescription}</span>
              </div>
            )}
          </div>
        )}

        {tab === 'unit' && (
          <div className="drawer-section">
            <label>当前单位判断</label>
            <p>{metric.currentUnitJudgement || '暂无单位判断'}</p>
            <label>单位与口径关注</label>
            <p>{metric.unitAttention || '暂无专项关注'}</p>
            <label>来源与备注</label>
            <p>{metric.sourceNote || '暂无来源备注'}</p>
            {recommendations.length > 0 && (
              <>
                <label>关联修改建议</label>
                {recommendations.map((item) => (
                  <div className="recommendation-box" key={item.sequence}>
                    <RiskBadge level={item.riskLevel} />
                    <strong>{item.topic}</strong>
                    <span>{item.advice}</span>
                    <small>{item.adjustment2026}</small>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'month' && (
          <div className="drawer-section">
            {rules.length === 0 ? (
              <EmptyState title="暂无关联月度模板" detail="该公式未命中当前月份参数模板。" />
            ) : (
              rules.map((rule) => (
                <article className="rule-card drawer-rule" key={rule.purpose}>
                  <strong>{rule.purpose}</strong>
                  <span>{rule.applicableMetrics}</span>
                  <label>一月写法</label>
                  <FormulaCode text={rule.januaryFormula} compact />
                  <label>第 n 月通用写法</label>
                  <FormulaCode text={rule.monthNFormula} compact />
                  <p>{rule.note}</p>
                </article>
              ))
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="drawer-section">
            {history.length === 0 ? (
              <EmptyState title="暂无变更历史" detail="更新本月状态、备注或变更后公式后会自动生成记录。" />
            ) : (
              history.map((item) => (
                <div className="history-item" key={item.id}>
                  <div>
                    <History size={15} />
                    <strong>{item.month}</strong>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.note && <p>{item.note}</p>}
                  {item.afterFormula && <FormulaCode text={item.afterFormula} compact />}
                  <small>{new Date(item.updatedAt).toLocaleString('zh-CN')}</small>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export default App;
