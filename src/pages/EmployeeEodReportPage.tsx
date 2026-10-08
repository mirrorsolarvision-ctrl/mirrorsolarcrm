import { useState, useEffect } from 'react';
import { 
  FileText, Send, Calendar, CheckCircle2, History,
  PhoneCall, Users, Package, AlertCircle, TrendingUp, Sparkles
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import PageHero from '../components/PageHero';
import type { EodReport } from '../types/eod';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { isSuryaGharEmployee } from '../utils/employeeCalculations';
import './EmployeeEodReportPage.css';

export default function EmployeeEodReportPage() {
  const { currentUser } = useCRM();
  const { showToast } = useUI();

  const [reports, setReports] = useState<EodReport[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const [reportDate, setReportDate] = useState(todayStr);
  const [summary, setSummary] = useState('');
  const [nextDayPlan, setNextDayPlan] = useState('');
  const [blockers, setBlockers] = useState('');

  // Category-specific counters
  const [callsMade, setCallsMade] = useState<number>(0);
  const [visitsCompleted, setVisitsCompleted] = useState<number>(0);
  const [leadsCreated, setLeadsCreated] = useState<number>(0);
  const [kycProcessed, setKycProcessed] = useState<number>(0);
  const [subsidyVerified, setSubsidyVerified] = useState<number>(0);
  const [dispatchesDone, setDispatchesDone] = useState<number>(0);

  const isSuryaGhar = isSuryaGharEmployee(currentUser);
  const empCategory = currentUser?.employeeCategory || (isSuryaGhar ? 'PM Surya Ghar Incharge' : 'Marketing Employee');
  const isMarketing = !isSuryaGhar && (empCategory === 'Marketing Employee' || empCategory === 'Commercial Project Incharge');
  const isStock = empCategory === 'Stock Incharge';

  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      // Query by employeeId; sort in memory to be resilient even if composite index is building
      const q = query(
        collection(db, 'eod_reports'),
        where('employeeId', '==', currentUser.id)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: EodReport[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({ id: docSnap.id, ...docSnap.data() } as EodReport);
        });
        // Sort descending by createdAt
        fetched.sort((a, b) => {
          const rawA = a.createdAt as any;
          const rawB = b.createdAt as any;
          const tA = rawA?.toDate ? rawA.toDate().getTime() : (typeof rawA === 'string' ? new Date(rawA).getTime() : 0);
          const tB = rawB?.toDate ? rawB.toDate().getTime() : (typeof rawB === 'string' ? new Date(rawB).getTime() : 0);
          return tB - tA;
        });
        setReports(fetched);
        setLoading(false);
      }, (err) => {
        console.warn("EOD report snapshot notice:", err);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("EOD load error:", e);
      setLoading(false);
    }
  }, [currentUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      showToast('Please provide a summary of today’s work', 'error');
      return;
    }
    if (!currentUser) {
      showToast('User must be logged in to submit an EOD report', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const newReport: Omit<EodReport, 'id'> = {
        employeeId: currentUser.id,
        employeeName: currentUser.name || 'Employee',
        employeeCategory: empCategory,
        email: currentUser.email || '',
        date: reportDate,
        summary: summary.trim(),
        nextDayPlan: nextDayPlan.trim(),
        blockersOrIssues: blockers.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      if (isMarketing) {
        newReport.callsMade = Number(callsMade) || 0;
        newReport.visitsCompleted = Number(visitsCompleted) || 0;
        newReport.leadsCreated = Number(leadsCreated) || 0;
      } else if (isSuryaGhar) {
        newReport.kycApplicationsProcessed = Number(kycProcessed) || 0;
        newReport.subsidyDocumentsVerified = Number(subsidyVerified) || 0;
      } else if (isStock) {
        newReport.dispatchesCompleted = Number(dispatchesDone) || 0;
      }

      await addDoc(collection(db, 'eod_reports'), newReport);

      showToast('✓ Daily EOD Report submitted successfully to Admin!', 'success');
      setSummary('');
      setNextDayPlan('');
      setBlockers('');
      setCallsMade(0);
      setVisitsCompleted(0);
      setLeadsCreated(0);
      setKycProcessed(0);
      setSubsidyVerified(0);
      setDispatchesDone(0);
    } catch (err: any) {
      console.error('Error submitting EOD report:', err);
      showToast(err.message || 'Failed to submit EOD report', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryClass = () => {
    if (isMarketing) return 'marketing';
    if (isSuryaGhar) return 'suryaghar';
    if (isStock) return 'stock';
    return '';
  };

  return (
    <div className="eod-page-container fade-in">
      <PageHero 
        badge="End-of-Day Daily Reporting"
        icon={<FileText size={26} />}
        title="Daily Work Submission (EOD)"
        subtitle="Submit your daily activity summary, completed metrics, and goals for tomorrow."
      />

      <div className="eod-grid-layout">
        {/* Form Column */}
        <div className="eod-card">
          <div className="eod-card-header">
            <h2 className="eod-card-title">
              <Sparkles size={20} className="text-yellow" />
              Submit Today's Report
            </h2>
            <span className={`eod-category-badge ${getCategoryClass()}`}>
              {empCategory}
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="eod-form-grid">
              <div className="eod-form-group">
                <label htmlFor="eodReportDate">
                  <Calendar size={15} />
                  Reporting Date
                </label>
                <input 
                  id="eodReportDate"
                  name="reportDate"
                  type="date" 
                  value={reportDate} 
                  onChange={(e) => setReportDate(e.target.value)} 
                  required 
                />
              </div>

              <div className="eod-form-group">
                <label htmlFor="eodReportingStaff">
                  <Users size={15} />
                  Reporting Staff
                </label>
                <input 
                  id="eodReportingStaff"
                  name="reportingStaff"
                  type="text" 
                  value={currentUser?.name || ''} 
                  disabled 
                  style={{ background: '#f8fafc', color: '#64748b' }} 
                />
              </div>
            </div>

            {/* Role-Specific Metric Inputs */}
            {isMarketing && (
              <div className="eod-metrics-box">
                <div className="eod-metrics-title">Marketing & Sales Highlights</div>
                <div className="eod-metrics-grid">
                  <div className="eod-metric-input">
                    <label htmlFor="eodCallsMade">📞 Calls Made</label>
                    <input 
                      id="eodCallsMade"
                      name="callsMade"
                      type="number" 
                      min="0" 
                      value={callsMade} 
                      onChange={(e) => setCallsMade(Number(e.target.value))} 
                    />
                  </div>
                  <div className="eod-metric-input">
                    <label htmlFor="eodVisitsCompleted">🚗 Field Visits</label>
                    <input 
                      id="eodVisitsCompleted"
                      name="visitsCompleted"
                      type="number" 
                      min="0" 
                      value={visitsCompleted} 
                      onChange={(e) => setVisitsCompleted(Number(e.target.value))} 
                    />
                  </div>
                  <div className="eod-metric-input">
                    <label htmlFor="eodLeadsCreated">✨ Leads Created</label>
                    <input 
                      id="eodLeadsCreated"
                      name="leadsCreated"
                      type="number" 
                      min="0" 
                      value={leadsCreated} 
                      onChange={(e) => setLeadsCreated(Number(e.target.value))} 
                    />
                  </div>
                </div>
              </div>
            )}

            {isSuryaGhar && (
              <div className="eod-metrics-box">
                <div className="eod-metrics-title">PM Surya Ghar Operations Metrics</div>
                <div className="eod-metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <div className="eod-metric-input">
                    <label htmlFor="eodKycProcessed">📋 KYC Applications Processed</label>
                    <input 
                      id="eodKycProcessed"
                      name="kycProcessed"
                      type="number" 
                      min="0" 
                      value={kycProcessed} 
                      onChange={(e) => setKycProcessed(Number(e.target.value))} 
                    />
                  </div>
                  <div className="eod-metric-input">
                    <label htmlFor="eodSubsidyVerified">🏛 Subsidy Docs Verified</label>
                    <input 
                      id="eodSubsidyVerified"
                      name="subsidyVerified"
                      type="number" 
                      min="0" 
                      value={subsidyVerified} 
                      onChange={(e) => setSubsidyVerified(Number(e.target.value))} 
                    />
                  </div>
                </div>
              </div>
            )}

            {isStock && (
              <div className="eod-metrics-box">
                <div className="eod-metrics-title">Inventory & Dispatch Highlights</div>
                <div className="eod-metrics-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="eod-metric-input">
                    <label htmlFor="eodDispatchesDone">📦 Dispatches Completed to Customers / Dealers</label>
                    <input 
                      id="eodDispatchesDone"
                      name="dispatchesDone"
                      type="number" 
                      min="0" 
                      value={dispatchesDone} 
                      onChange={(e) => setDispatchesDone(Number(e.target.value))} 
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="eod-form-group">
              <label htmlFor="eodSummaryWork">Summary of Today's Work & Customer Updates *</label>
              <textarea 
                id="eodSummaryWork"
                name="summaryWork"
                rows={4} 
                value={summary} 
                onChange={(e) => setSummary(e.target.value)} 
                placeholder="Detail what activities you performed, customer meetings, status changes, quotations sent, or issues resolved..."
                required 
              />
            </div>

            <div className="eod-form-group">
              <label htmlFor="eodNextDayPlan">Tomorrow's Action Plan & Goals</label>
              <textarea 
                id="eodNextDayPlan"
                name="nextDayPlan"
                rows={2} 
                value={nextDayPlan} 
                onChange={(e) => setNextDayPlan(e.target.value)} 
                placeholder="What are your key priorities for the next working day?" 
              />
            </div>

            <div className="eod-form-group">
              <label htmlFor="eodBlockers">Blockers, Delays, or Material Needs (Optional)</label>
              <input 
                id="eodBlockers"
                name="blockers"
                type="text" 
                value={blockers} 
                onChange={(e) => setBlockers(e.target.value)} 
                placeholder="Any pending items requiring Admin assistance..." 
              />
            </div>

            <button 
              type="submit" 
              className="eod-btn-submit" 
              disabled={isSubmitting}
            >
              <Send size={18} />
              {isSubmitting ? 'Submitting Report...' : 'Submit Daily EOD Report'}
            </button>
          </form>
        </div>

        {/* History Column */}
        <div className="eod-card">
          <div className="eod-card-header">
            <h2 className="eod-card-title">
              <History size={20} />
              Past EOD Submissions
            </h2>
            <span className="eod-pill" style={{ background: '#f1f5f9' }}>
              {reports.length} Total
            </span>
          </div>

          {loading ? (
            <div className="eod-empty-state">
              <p>Loading submission logs...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="eod-empty-state">
              <AlertCircle size={36} />
              <p>No EOD reports submitted yet. Submit your first report today!</p>
            </div>
          ) : (
            <div className="eod-history-list">
              {reports.map((r) => (
                <div key={r.id} className="eod-history-card">
                  <div className="eod-history-meta">
                    <span className="eod-history-date">
                      <CheckCircle2 size={16} color="#16a34a" />
                      {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="eod-pill" style={{ color: '#64748b' }}>
                      {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="eod-history-summary">{r.summary}</div>

                  <div className="eod-history-metrics">
                    {r.callsMade !== undefined && r.callsMade > 0 && (
                      <span className="eod-pill">📞 {r.callsMade} Calls</span>
                    )}
                    {r.visitsCompleted !== undefined && r.visitsCompleted > 0 && (
                      <span className="eod-pill">🚗 {r.visitsCompleted} Visits</span>
                    )}
                    {r.leadsCreated !== undefined && r.leadsCreated > 0 && (
                      <span className="eod-pill">✨ {r.leadsCreated} Leads</span>
                    )}
                    {r.kycApplicationsProcessed !== undefined && r.kycApplicationsProcessed > 0 && (
                      <span className="eod-pill">📋 {r.kycApplicationsProcessed} KYC</span>
                    )}
                    {r.subsidyDocumentsVerified !== undefined && r.subsidyDocumentsVerified > 0 && (
                      <span className="eod-pill">🏛 {r.subsidyDocumentsVerified} Subsidy</span>
                    )}
                    {r.dispatchesCompleted !== undefined && r.dispatchesCompleted > 0 && (
                      <span className="eod-pill">📦 {r.dispatchesCompleted} Dispatches</span>
                    )}
                  </div>

                  {r.nextDayPlan && (
                    <div className="eod-history-plan">
                      <strong>Next Day:</strong> {r.nextDayPlan}
                    </div>
                  )}
                  {r.blockersOrIssues && (
                    <div className="eod-history-plan" style={{ color: '#dc2626' }}>
                      <strong>Blocker:</strong> {r.blockersOrIssues}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
