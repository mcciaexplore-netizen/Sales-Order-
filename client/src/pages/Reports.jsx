import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import Loading from '../components/Loading.jsx';
import { formatINR, formatDate } from '../utils/format';

const dateInputKey = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const todayKey = () => dateInputKey(new Date());

const daysAgoKey = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateInputKey(d);
};

const csvValue = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const downloadCsv = (filename, headers, rows) => {
  const csv = [
    headers.map(csvValue).join(','),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function ReportStat({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function DateRange({ startDate, endDate, setStartDate, setEndDate, onRun, loading }) {
  return (
    <div className="card">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
        <div>
          <label className="label">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
        </div>
        <button type="button" onClick={onRun} disabled={loading} className="btn-primary disabled:opacity-60">
          {loading ? 'Loading...' : 'Run Report'}
        </button>
      </div>
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [startDate, setStartDate] = useState(daysAgoKey(29));
  const [endDate, setEndDate] = useState(todayKey());
  const [sales, setSales] = useState(null);
  const [gst, setGst] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { startDate, endDate };
      const res = await api.get(activeTab === 'sales' ? '/orders/reports/sales' : '/orders/reports/gst', { params });
      if (activeTab === 'sales') setSales(res.data);
      else setGst(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const currentReport = activeTab === 'sales' ? sales : gst;

  const title = useMemo(() => (
    activeTab === 'sales' ? 'Sales Report' : 'GST Report'
  ), [activeTab]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Reports</h2>
        <p className="text-sm text-slate-500">Date-wise sales and GST return totals</p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-2" aria-label="Reports">
          <TabButton active={activeTab === 'sales'} onClick={() => setActiveTab('sales')}>Sales Report</TabButton>
          <TabButton active={activeTab === 'gst'} onClick={() => setActiveTab('gst')}>GST Report</TabButton>
        </nav>
      </div>

      <DateRange
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        onRun={fetchReport}
        loading={loading}
      />

      {error && (
        <div className="card border-red-200 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}

      {!currentReport && loading ? (
        <Loading label="Loading report..." />
      ) : activeTab === 'sales' ? (
        <SalesReport report={sales} title={title} />
      ) : (
        <GstReport report={gst} title={title} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-brand-500 text-brand-700'
          : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function SalesReport({ report, title }) {
  if (!report) return null;

  const handleDownload = () => {
    downloadCsv(
      `sales-report-${report.startDate}-to-${report.endDate}.csv`,
      ['Date', 'Orders', 'Total Sales'],
      [
        { Date: 'TOTAL', Orders: report.orderCount, 'Total Sales': report.totalSales },
        ...report.dailyBreakdown.map((row) => ({
          Date: row.date,
          Orders: row.orderCount,
          'Total Sales': row.totalSales,
        })),
      ]
    );
  };

  return (
    <div className="space-y-6">
      <ReportHeader title={title} report={report} onDownload={handleDownload} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReportStat label="Total Sales" value={formatINR(report.totalSales)} />
        <ReportStat label="Number of Orders" value={report.orderCount} />
      </div>
      <DailyTable
        headers={['Date', 'Orders', 'Total Sales']}
        rows={report.dailyBreakdown}
        renderRow={(row) => (
          <tr key={row.date} className="border-b border-slate-100 last:border-0">
            <td className="py-3 pr-4 text-slate-700">{formatDate(row.date)}</td>
            <td className="py-3 pr-4 text-right text-slate-600">{row.orderCount}</td>
            <td className="py-3 text-right font-medium text-slate-900">{formatINR(row.totalSales)}</td>
          </tr>
        )}
      />
    </div>
  );
}

function GstReport({ report, title }) {
  if (!report) return null;

  const handleDownload = () => {
    downloadCsv(
      `gst-report-${report.startDate}-to-${report.endDate}.csv`,
      ['Date', 'Orders', 'Taxable Value', 'CGST', 'SGST', 'IGST'],
      [
        {
          Date: 'TOTAL',
          Orders: report.dailyBreakdown.reduce((sum, row) => sum + row.orderCount, 0),
          'Taxable Value': report.totalTaxableValue,
          CGST: report.totalCgst,
          SGST: report.totalSgst,
          IGST: report.totalIgst,
        },
        ...report.dailyBreakdown.map((row) => ({
          Date: row.date,
          Orders: row.orderCount,
          'Taxable Value': row.taxableValue,
          CGST: row.cgst,
          SGST: row.sgst,
          IGST: row.igst,
        })),
      ]
    );
  };

  return (
    <div className="space-y-6">
      <ReportHeader title={title} report={report} onDownload={handleDownload} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportStat label="Total Taxable Value" value={formatINR(report.totalTaxableValue)} />
        <ReportStat label="Total CGST" value={formatINR(report.totalCgst)} />
        <ReportStat label="Total SGST" value={formatINR(report.totalSgst)} />
        <ReportStat label="Total IGST" value={formatINR(report.totalIgst)} />
      </div>
      <DailyTable
        headers={['Date', 'Orders', 'Taxable Value', 'CGST', 'SGST', 'IGST']}
        rows={report.dailyBreakdown}
        renderRow={(row) => (
          <tr key={row.date} className="border-b border-slate-100 last:border-0">
            <td className="py-3 pr-4 text-slate-700">{formatDate(row.date)}</td>
            <td className="py-3 pr-4 text-right text-slate-600">{row.orderCount}</td>
            <td className="py-3 pr-4 text-right font-medium text-slate-900">{formatINR(row.taxableValue)}</td>
            <td className="py-3 pr-4 text-right text-slate-700">{formatINR(row.cgst)}</td>
            <td className="py-3 pr-4 text-right text-slate-700">{formatINR(row.sgst)}</td>
            <td className="py-3 text-right text-slate-700">{formatINR(row.igst)}</td>
          </tr>
        )}
      />
    </div>
  );
}

function ReportHeader({ title, report, onDownload }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">
          {formatDate(report.startDate)} to {formatDate(report.endDate)}
        </p>
      </div>
      <button type="button" onClick={onDownload} className="btn-secondary">
        Download CSV
      </button>
    </div>
  );
}

function DailyTable({ headers, rows, renderRow }) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Daily Breakdown</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              {headers.map((header, index) => (
                <th key={header} className={`py-2 ${index === headers.length - 1 ? '' : 'pr-4'} font-medium ${index > 0 ? 'text-right' : ''}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="py-6 text-center text-sm text-slate-500">
                  No data for this date range.
                </td>
              </tr>
            ) : rows.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
