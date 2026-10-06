import React, { useState, useMemo } from 'react';
import { Sun, X, MessageSquare, Check, TrendingUp, Zap, Trees, ShieldCheck, DollarSign } from 'lucide-react';
import { calculateSolarRoi } from '../utils/solarRoiCalculations';
import { generateRoiPitchWhatsAppMessage, getWhatsAppDirectUrl } from '../utils/whatsappTemplates';
import './SolarRoiCalculatorModal.css';

interface SolarRoiCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCapacityKw?: number;
  initialCost?: number;
  initialSubsidy?: number;
  customerName?: string;
  customerPhone?: string;
  onApplyToQuotation?: (capacityKw: number, totalCost: number, subsidyAmount: number) => void;
}

export default function SolarRoiCalculatorModal({
  isOpen,
  onClose,
  initialCapacityKw = 3,
  initialCost,
  initialSubsidy,
  customerName = 'Valued Customer',
  customerPhone = '',
  onApplyToQuotation
}: SolarRoiCalculatorModalProps) {
  const [capacityKw, setCapacityKw] = useState<number>(initialCapacityKw || 3);
  const [tariffPerUnit, setTariffPerUnit] = useState<number>(7.5);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const roiData = useMemo(() => {
    return calculateSolarRoi({
      capacityKw,
      totalSystemCost: initialCost,
      subsidyAmount: initialSubsidy,
      tariffPerUnit
    });
  }, [capacityKw, tariffPerUnit, initialCost, initialSubsidy]);

  if (!isOpen) return null;

  const handleShareWhatsApp = () => {
    const text = generateRoiPitchWhatsAppMessage({
      customerName,
      capacityKw: roiData.capacityKw,
      monthlySavings: roiData.monthlySavings,
      annualSavings: roiData.annualSavingsYear1,
      lifetimeSavings: roiData.lifetime25YearSavings,
      netInvestment: roiData.netInvestment,
      paybackYears: roiData.paybackPeriodYears,
      paybackMonths: roiData.paybackPeriodMonths
    });

    const url = getWhatsAppDirectUrl(customerPhone, text);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleApply = () => {
    if (onApplyToQuotation) {
      onApplyToQuotation(roiData.capacityKw, roiData.totalSystemCost, roiData.subsidyAmount);
    }
    onClose();
  };

  return (
    <div className="solar-roi-modal-overlay" onClick={onClose}>
      <div className="solar-roi-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="solar-roi-modal-header">
          <div className="roi-header-brand">
            <div className="roi-header-icon">
              <Sun size={24} />
            </div>
            <div>
              <h2 className="roi-header-title">Solar ROI & Financial Savings Estimator</h2>
              <p className="roi-header-subtitle">Estimated calculations for {customerName} under PM Surya Ghar Muft Bijli Yojana</p>
            </div>
          </div>
          <button className="roi-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="solar-roi-modal-body">
          {/* INTERACTIVE SLIDERS */}
          <div className="roi-controls-grid">
            <div className="roi-control-group">
              <label className="roi-control-label">
                <span>System Capacity</span>
                <span className="roi-control-val">{capacityKw} kW</span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="25" 
                step="0.5"
                value={capacityKw} 
                onChange={(e) => setCapacityKw(parseFloat(e.target.value))}
                className="roi-slider"
              />
              <span className="roi-metric-subtext">Requires ~{roiData.recommendedRooftopSqFt} sq. ft roof area</span>
            </div>

            <div className="roi-control-group">
              <label className="roi-control-label">
                <span>Current Tariff (₹/Unit)</span>
                <span className="roi-control-val">₹{tariffPerUnit.toFixed(2)}/kWh</span>
              </label>
              <input 
                type="range" 
                min="4" 
                max="14" 
                step="0.25"
                value={tariffPerUnit} 
                onChange={(e) => setTariffPerUnit(parseFloat(e.target.value))}
                className="roi-slider"
              />
              <span className="roi-metric-subtext">Default DISCOM residential rate</span>
            </div>
          </div>

          {/* FINANCIAL SUMMARY CARDS */}
          <div className="roi-summary-grid">
            <div className="roi-metric-card highlight-green">
              <span className="roi-metric-title">Monthly Bill Savings</span>
              <span className="roi-metric-value">₹{roiData.monthlySavings.toLocaleString()}</span>
              <span className="roi-metric-subtext">~{roiData.monthlyGenerationUnits} Units generated/mo</span>
            </div>

            <div className="roi-metric-card highlight-blue">
              <span className="roi-metric-title">Annual Savings (Yr 1)</span>
              <span className="roi-metric-value">₹{roiData.annualSavingsYear1.toLocaleString()}</span>
              <span className="roi-metric-subtext">~{roiData.annualGenerationUnits.toLocaleString()} kWh/year</span>
            </div>

            <div className="roi-metric-card highlight-gold">
              <span className="roi-metric-title">Govt. Subsidy (DBT)</span>
              <span className="roi-metric-value">₹{roiData.subsidyAmount.toLocaleString()}</span>
              <span className="roi-metric-subtext">PM Surya Ghar Yojana</span>
            </div>

            <div className="roi-metric-card">
              <span className="roi-metric-title">Net Investment</span>
              <span className="roi-metric-value">₹{roiData.netInvestment.toLocaleString()}</span>
              <span className="roi-metric-subtext">Gross: ₹{roiData.totalSystemCost.toLocaleString()}</span>
            </div>
          </div>

          {/* PAYBACK & LIFETIME PROJECTION BANNER */}
          <div className="roi-payback-card">
            <div className="roi-payback-left">
              <span className="roi-payback-tag">Estimated Payback Period</span>
              <span className="roi-payback-val">
                {roiData.paybackPeriodYears} Years {roiData.paybackPeriodMonths > 0 ? `& ${roiData.paybackPeriodMonths} Months` : ''}
              </span>
              <span className="roi-payback-desc">
                After payback, enjoy <strong>20+ years of 100% FREE solar power</strong> with a 25-year cumulative return of <strong>₹{roiData.lifetime25YearSavings.toLocaleString()}</strong> ({roiData.returnOnInvestmentPercent}% Net ROI).
              </span>
            </div>
          </div>

          {/* ENVIRONMENTAL IMPACT */}
          <div className="roi-environmental-banner">
            <div className="roi-env-icon">🌱</div>
            <div>
              <strong>Eco Impact:</strong> Over 25 years, this {capacityKw} kW solar system eliminates <strong>{roiData.co2OffsetLifetimeTons} Tons of CO₂</strong> emissions, equivalent to planting <strong>{roiData.equivalentTreesPlanted.toLocaleString()} trees</strong>!
            </div>
          </div>
        </div>

        {/* MODAL ACTIONS */}
        <div className="roi-modal-actions">
          <button className="roi-btn roi-btn-outline" onClick={onClose}>
            Close
          </button>

          <button className="roi-btn roi-btn-whatsapp" onClick={handleShareWhatsApp}>
            <MessageSquare size={16} /> Share on WhatsApp
          </button>

          {onApplyToQuotation && (
            <button className="roi-btn roi-btn-primary" onClick={handleApply}>
              <Check size={16} /> Apply to Proposal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
