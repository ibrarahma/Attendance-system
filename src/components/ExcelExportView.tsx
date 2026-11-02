import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Share2,
  Mail,
  MessageSquare,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { Subject, ClassConfig } from '../utils/types';

interface ExcelExportViewProps {
  config: ClassConfig | null;
}

export const ExcelExportView: React.FC<ExcelExportViewProps> = ({ config }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [reportType, setReportType] = useState<'cr_prepared' | 'actual' | 'comparison'>('cr_prepared');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [periodType, setPeriodType] = useState<'semester' | 'monthly' | 'weekly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [downloading, setDownloading] = useState(false);
  const [lastGeneratedFile, setLastGeneratedFile] = useState<{
    blob: Blob;
    filename: string;
    url: string;
  } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSubjects();
    handlePeriodChange('monthly');
  }, []);

  const loadSubjects = async () => {
    try {
      const res = await api.getSubjects();
      setSubjects(res.subjects || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handlePeriodChange = (type: 'semester' | 'monthly' | 'weekly' | 'custom') => {
    setPeriodType(type);
    const today = new Date();
    if (type === 'semester') {
      setStartDate('');
      setEndDate('');
    } else if (type === 'monthly') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
      setStartDate(first);
      setEndDate(last);
    } else if (type === 'weekly') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff)).toISOString().slice(0, 10);
      const sunday = new Date(d.setDate(diff + 6)).toISOString().slice(0, 10);
      setStartDate(monday);
      setEndDate(sunday);
    }
  };

  const getPeriodLabel = (): string => {
    if (periodType === 'semester') return 'Full Academic Semester';
    if (periodType === 'monthly') {
      const date = startDate ? new Date(startDate) : new Date();
      return `Monthly (${date.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
    }
    if (periodType === 'weekly') return `Weekly (${startDate || 'Start'} to ${endDate || 'End'})`;
    return `Custom Range (${startDate} to ${endDate})`;
  };

  const handleGenerateExcel = async () => {
    setDownloading(true);
    setMessage(null);

    try {
      const result = await api.exportExcel({
        report_type: reportType,
        subject_id: selectedSubjectId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        period_label: getPeriodLabel(),
      });

      const url = window.URL.createObjectURL(result.blob);
      setLastGeneratedFile({
        blob: result.blob,
        filename: result.filename,
        url,
      });

      // Auto trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();

      setMessage({
        type: 'success',
        text: `Genuine Excel workbook "${result.filename}" generated and downloaded successfully!`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to generate Excel file' });
    } finally {
      setDownloading(false);
    }
  };

  // Teacher Sharing Handlers
  const handleShareWhatsApp = () => {
    const selectedSub = subjects.find(s => s.id === selectedSubjectId);
    const subLabel = selectedSub ? `${selectedSub.subject_code} - ${selectedSub.subject_name}` : 'All Subjects';
    const text = `Respected Faculty,\n\nPlease find attached the ${getPeriodLabel()} Class Attendance Report for ${config?.class_name || 'Our Class'} (${config?.department} Sem-${config?.semester} Sec-${config?.section || 'A'}).\n\nCourse: ${subLabel}\nStatus: CR-prepared attendance pending faculty verification.\nPrepared by: Class Representative.\n\nPlease review and verify for portal upload.`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleShareEmail = () => {
    const selectedSub = subjects.find(s => s.id === selectedSubjectId);
    const facultyEmail = selectedSub ? `${selectedSub.faculty_name.replace(/[^a-zA-Z]/g, '').toLowerCase()}@college.edu` : '';
    const subject = `[CR Attendance Submission] ${config?.department} Sem-${config?.semester} - ${getPeriodLabel()}`;
    const body = `Respected Faculty,\n\nI have prepared the attendance report for ${getPeriodLabel()}.\n\nClass: ${config?.class_name || 'B.Tech'} (${config?.department} Sem-${config?.semester} Sec-${config?.section || 'A'})\n\nThe file has been prepared by the Class Representative and is ready for your review and official university portal upload.\n\nDisclaimer: CR-prepared attendance pending faculty verification.\n\nSincerely,\nClass Representative`;
    const mailto = `mailto:${facultyEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const handleNativeShare = async () => {
    if (!lastGeneratedFile) return;
    if (navigator.canShare && navigator.canShare({ files: [new File([lastGeneratedFile.blob], lastGeneratedFile.filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] })) {
      try {
        const file = new File([lastGeneratedFile.blob], lastGeneratedFile.filename, {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        await navigator.share({
          title: `Attendance Report - ${config?.department}`,
          text: `CR Prepared Attendance Report for ${getPeriodLabel()}`,
          files: [file],
        });
      } catch (err) {
        console.log('Share dismissed or failed:', err);
      }
    } else {
      // Fallback
      handleShareWhatsApp();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
              Genuine .XLSX Generation
            </span>
            <span className="text-xs text-slate-400 font-mono">Format: SheetJS / Excel OpenXML</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mt-1">Excel Export & Teacher Dispatch</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate authentic Excel workbooks formatted specifically for faculty verification and portal submission.
          </p>
        </div>

        <button
          onClick={handleGenerateExcel}
          disabled={downloading}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{downloading ? 'Compiling Workbook...' : 'Generate & Download Excel (.xlsx)'}</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Export Options Form */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
        {/* Step 1: Report Variant */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            1. Select Export Format Variant
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              onClick={() => setReportType('cr_prepared')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                reportType === 'cr_prepared'
                  ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">Standard CR-Prepared Report</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Standard format sent to faculty. Omits internal audit history and provides verified roll, name, classes attended, percentage, and verification disclaimers.
              </p>
            </div>

            <div
              onClick={() => setReportType('actual')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                reportType === 'actual'
                  ? 'border-blue-600 bg-blue-50/40 text-blue-950'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <div className="font-bold text-xs mb-1">Original Actual Log Only</div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Reflects purely unmodified attendance markings saved directly from the classroom session, without any CR adjustments.
              </p>
            </div>

            <div
              onClick={() => setReportType('comparison')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                reportType === 'comparison'
                  ? 'border-purple-600 bg-purple-50/40 text-purple-950'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <div className="font-bold text-xs mb-1">Side-by-Side Comparison</div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Internal verification sheet showing Original Marks vs CR-Prepared Marks and differences for faculty review meetings.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Subject & Period Selection */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Subject */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-medium"
            >
              <option value="all">All Subjects (Combined Roster)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.subject_code} - {s.subject_name} ({s.faculty_name})
                </option>
              ))}
            </select>
          </div>

          {/* Period Preset */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Report Period Preset</label>
            <select
              value={periodType}
              onChange={(e) => handlePeriodChange(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-medium"
            >
              <option value="monthly">Current Month</option>
              <option value="weekly">Current Week</option>
              <option value="semester">Entire Semester</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodType('custom');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodType('custom');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            />
          </div>
        </div>

        {/* Informational Sheet Structure Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-slate-800">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Excel Workbook Specifications (Standard CR-Prepared)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div>• Header Title: Class Name, Branch, Semester, Section</div>
            <div>• Columns: Roll Number, Student Name, Subject Code, Subject Name</div>
            <div>• Classes Held & Attended with 1-decimal percentage</div>
            <div>• Clear Shortage Alert indicator (&lt;75%)</div>
            <div>• Preparation Date & Report Period label</div>
            <div>• Verification Status: "CR-prepared pending faculty verification"</div>
          </div>
        </div>
      </div>

      {/* 11. SHARING WITH TEACHERS */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">11. Sharing With Teachers & Faculty</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            The CR generates the official spreadsheet and transmits it to the subject faculty. The teacher reviews it and performs the official university portal upload.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* WhatsApp Sharing */}
          <button
            onClick={handleShareWhatsApp}
            className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Share via WhatsApp</span>
            </div>
            <p className="text-[11px] text-emerald-700">
              Opens WhatsApp with pre-filled message detailing subject, class, and attendance period for the teacher.
            </p>
          </button>

          {/* Email Sharing */}
          <button
            onClick={handleShareEmail}
            className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-blue-800 font-bold text-xs mb-1">
              <Mail className="w-4 h-4 text-blue-600" />
              <span>Share via Email</span>
            </div>
            <p className="text-[11px] text-blue-700">
              Generates a formal email draft to the course teacher with submission details and review notes.
            </p>
          </button>

          {/* Print / PDF */}
          <button
            onClick={() => window.print()}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs mb-1">
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print / Save as PDF</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Uses system print dialog to save a clean PDF copy for physical notice boards or departmental records.
            </p>
          </button>
        </div>

        {lastGeneratedFile && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                Ready: <strong>{lastGeneratedFile.filename}</strong>
              </span>
            </div>
            <a
              href={lastGeneratedFile.url}
              download={lastGeneratedFile.filename}
              className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Re-download
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
