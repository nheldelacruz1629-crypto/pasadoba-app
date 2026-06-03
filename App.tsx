import React, { useState, useEffect } from "react"
import {
  Plus, ChevronRight, ArrowLeft, X, BookOpen,
  Trash2, Check, BarChart2, AlertTriangle,
} from "lucide-react"

// ==========================================
// TYPES & INTERFACES
// ==========================================
type Page = "dashboard" | "c1" | "c2" | "c3" | "c4" | "subject"
type GradingSystem = "zero-based" | "weighted"
type ZeroFormula = "percentage" | "transmuted"

interface Column { id: string; label: string; score: string; total: string }
interface AssessmentType { id: string; name: string; weight: string; columns: Column[] }
interface Subject {
  id: string
  name: string
  gradingSystem: GradingSystem
  zeroFormula?: ZeroFormula
  assessmentTypes: AssessmentType[]
}

type GradeResult = {
  grade: number
  breakdown: { name: string; pct: number; weight: number }[]
  error?: string
}

// ==========================================
// UTILITY FUNCTIONS & CALCULATIONS
// ==========================================
const uid = () => Math.random().toString(36).slice(2)

function transmute(ig: number) {
  if (ig === 0) return 60
  return Math.round(((ig / 100) * 40 + 60) * 10) / 10
}

function computeResult(sub: Subject): GradeResult | null {
  for (const t of sub.assessmentTypes) {
    if (!t.columns.length) return null
    for (const c of t.columns) {
      if (c.score === "" || c.total === "") return null
      if (isNaN(+c.score) || isNaN(+c.total) || +c.total <= 0) return null
    }
  }

  const bd = sub.assessmentTypes.map(t => {
    const totalScore = t.columns.reduce((a, c) => a + +c.score, 0)
    const totalMax = t.columns.reduce((a, c) => a + +c.total, 0)
    return {
      name: t.name,
      pct: totalMax > 0 ? (totalScore / totalMax) * 100 : 0,
      weight: +t.weight,
    }
  })

  if (sub.gradingSystem === "zero-based") {
    const ts = sub.assessmentTypes.flatMap(t => t.columns).reduce((a, c) => a + +c.score, 0)
    const tt = sub.assessmentTypes.flatMap(t => t.columns).reduce((a, c) => a + +c.total, 0)
    const pct = tt > 0 ? (ts / tt) * 100 : 0
    const grade = sub.zeroFormula === "transmuted" ? transmute(pct) : +pct.toFixed(2)
    return { grade, breakdown: bd.map(b => ({ ...b, weight: 100 / bd.length })) }
  }

  if (sub.gradingSystem === "weighted") {
    const tw = bd.reduce((s, b) => s + b.weight, 0)
    if (Math.abs(tw - 100) > 0.5) {
      return { grade: 0, breakdown: bd, error: `Weights total ${tw.toFixed(1)}% — must equal 100%` }
    }
    const finalGrade = bd.reduce((s, b) => s + (b.pct * b.weight) / 100, 0)
    return { grade: +finalGrade.toFixed(2), breakdown: bd }
  }
  return null
}

function isReady(sub: Subject) {
  if (!sub.assessmentTypes.length) return false
  return sub.assessmentTypes.every(
    t => t.columns.length && t.columns.every(c => c.score !== "" && c.total !== "" && !isNaN(+c.score) && !isNaN(+c.total) && +c.total > 0)
  )
}

function gradeInfo(g: number, gs: GradingSystem) {
  return g >= 75 ? { desc: "Passed", pass: true } : { desc: "Failed", pass: false }
}

function gsLabel(gs: GradingSystem, zf?: ZeroFormula) {
  if (gs === "weighted") return "Custom Weighted"
  if (zf === "transmuted") return "Zero-Based · Transmuted"
  return "Zero-Based · Percentage"
}

// ==========================================
// REUSABLE PRESENTATIONAL COMPONENTS
// ==========================================
function UInput({
  label, type = "text", value, onChange, placeholder, onKeyDown, right,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
  right?: React.ReactNode
}) {
  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-foreground/70 mb-1">{label}</label>
      <div className="relative">
        <input
          type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent border-0 border-b-2 border-foreground/25 focus:border-primary pb-1.5 pr-8 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none transition-colors"
        />
        {right && <div className="absolute right-0 top-0">{right}</div>}
      </div>
    </div>
  )
}

function BluePanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-primary rounded-4xl p-6 shadow-xl shadow-primary/20 text-white ${className}`}>
      {children}
    </div>
  )
}

function GrayCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-muted/50 rounded-2xl p-6 shadow-inner border border-foreground/5 ${className}`}>
      {children}
    </div>
  )
}

function ScoreRow({ col, onScore, onTotal }: {
  col: Column
  onScore: (v: string) => void
  onTotal: (v: string) => void
}) {
  const pct = col.score !== "" && col.total !== "" && +col.total > 0
    ? ((+col.score / +col.total) * 100).toFixed(0) : null

  return (
    <div className="flex items-end gap-3 py-2.5 border-b border-foreground/10 last:border-0">
      <span className="text-sm font-semibold text-foreground w-28 shrink-0 pb-1 truncate">{col.label}</span>
      <div className="flex items-end gap-2 flex-1">
        <div className="flex-1">
          <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider block mb-1">Score</label>
          <input
            type="number" value={col.score} onChange={e => onScore(e.target.value)} min={0}
            className="w-full bg-transparent border-0 border-b-2 border-foreground/25 focus:border-primary pb-1 text-sm text-foreground focus:outline-none transition-colors [appearance:textfield]"
          />
        </div>
        <span className="text-foreground/40 pb-1 text-sm">/</span>
        <div className="flex-1">
          <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider block mb-1">Total</label>
          <input
            type="number" value={col.total} onChange={e => onTotal(e.target.value)} min={1}
            className="w-full bg-transparent border-0 border-b-2 border-foreground/25 focus:border-primary pb-1 text-sm text-foreground focus:outline-none transition-colors [appearance:textfield]"
          />
        </div>
      </div>
      <div className="w-10 text-right pb-1">
        {pct !== null ? (
          <span className="text-xs font-bold text-foreground/50">{pct}%</span>
        ) : (
          <span className="text-xs text-foreground/20">—</span>
        )}
      </div>
    </div>
  )
}

function StepBar({ step }: { step: number }) {
  const STEPS = ["Subject", "Grading", "Assessments", "Scores"]
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            i < step ? "bg-white text-primary" :
            i === step ? "bg-white text-primary ring-4 ring-white/30" :
            "bg-white/20 text-white/60"
          }`}>
            {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-6 h-0.5 rounded-full ${i < step ? "bg-white/60" : "bg-white/20"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ==========================================
// MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  const [page, setPage] = useState<Page>("dashboard")
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem("pasadoba_subjects")
    return saved ? JSON.parse(saved) : []
  })

  const [draft, setDraft] = useState<{
    name: string; gradingSystem?: GradingSystem; zeroFormula?: ZeroFormula; assessmentTypes: AssessmentType[]
  }>({ name: "", assessmentTypes: [] })

  const [activeId, setActiveId] = useState<string | null>(null)
  const [newColLabel, setNewColLabel] = useState<Record<string, string>>({})

  const activeSub = subjects.find(s => s.id === activeId) ?? null

  useEffect(() => {
    localStorage.setItem("pasadoba_subjects", JSON.stringify(subjects))
  }, [subjects])

  const startCreate = () => {
    setDraft({ name: "", assessmentTypes: [] })
    setNewColLabel({})
    setPage("c1")
  }

  const chooseGS = (gs: GradingSystem, zf?: ZeroFormula) => {
    const types = [{ id: uid(), name: "", weight: gs === "weighted" ? "" : "100", columns: [] }]
    setDraft(p => ({ ...p, gradingSystem: gs, zeroFormula: zf, assessmentTypes: types }))
    setNewColLabel({})
    setPage("c3")
  }

  const updType = (id: string, f: "name" | "weight", v: string) =>
    setDraft(p => ({ ...p, assessmentTypes: p.assessmentTypes.map(t => t.id === id ? { ...t, [f]: v } : t) }))

  const delType = (id: string) =>
    setDraft(p => ({ ...p, assessmentTypes: p.assessmentTypes.filter(t => t.id !== id) }))

  const addType = () =>
    setDraft(p => ({ ...p, assessmentTypes: [...p.assessmentTypes, { id: uid(), name: "", weight: "", columns: [] }] }))

  const addColToDraft = (tid: string) => {
    const lbl = (newColLabel[tid] || "").trim()
    if (!lbl) return
    setDraft(p => ({
      ...p,
      assessmentTypes: p.assessmentTypes.map(t =>
        t.id === tid ? { ...t, columns: [...t.columns, { id: uid(), label: lbl, score: "", total: "" }] } : t
      ),
    }))
    setNewColLabel(p => ({ ...p, [tid]: "" }))
  }

  const delColFromDraft = (tid: string, cid: string) =>
    setDraft(p => ({
      ...p,
      assessmentTypes: p.assessmentTypes.map(t =>
        t.id === tid ? { ...t, columns: t.columns.filter(c => c.id !== cid) } : t
      ),
    }))

  const updDraftScore = (tid: string, cid: string, f: "score" | "total", v: string) =>
    setDraft(p => ({
      ...p,
      assessmentTypes: p.assessmentTypes.map(t =>
        t.id === tid ? { ...t, columns: t.columns.map(c => c.id === cid ? { ...c, [f]: v } : c) } : t
      ),
    }))

  const canGoC4 = () => {
    const ts = draft.assessmentTypes
    if (!ts.length) return false
    if (ts.some(t => !t.name.trim())) return false
    if (ts.some(t => !t.columns.length)) return false
    if (draft.gradingSystem === "weighted" && ts.some(t => !t.weight || isNaN(+t.weight) || +t.weight <= 0)) return false
    return true
  }

  const saveSubject = () => {
    const sub: Subject = {
      id: uid(), name: draft.name,
      gradingSystem: draft.gradingSystem!,
      zeroFormula: draft.zeroFormula,
      assessmentTypes: draft.assessmentTypes,
    }
    setSubjects(p => [...p, sub])
    setPage("dashboard")
  }

  const deleteSubject = (id: string) => {
    setSubjects(p => p.filter(s => s.id !== id))
    setActiveId(null)
    setPage("dashboard")
  }

  const updScore = (sid: string, tid: string, cid: string, f: "score" | "total", v: string) =>
    setSubjects(p => p.map(s =>
      s.id === sid ? {
        ...s, assessmentTypes: s.assessmentTypes.map(t =>
          t.id === tid ? { ...t, columns: t.columns.map(c => c.id === cid ? { ...c, [f]: v } : c) } : t
        ),
      } : s
    ))

  const stepIdx = ({ c1: 0, c2: 1, c3: 2, c4: 3 } as Record<string, number>)[page] ?? -1

  // ==========================================
  // UNIFIED CONTAINER ROUTING ENGINE
  // ==========================================
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {page === "dashboard" && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              <span className="font-black text-primary text-base tracking-wide uppercase">PasadoBa?</span>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full font-semibold border border-foreground/5 shadow-sm">
              Local Storage Active
            </span>
          </div>

          <BluePanel>
            <div className="mb-5">
              <h1 className="text-xl font-black text-white">My Subjects</h1>
              <p className="text-white/60 text-xs font-medium mt-0.5">
                {subjects.length} subject{subjects.length !== 1 ? "s" : ""} tracked
              </p>
            </div>

            {subjects.length === 0 ? (
              <GrayCard className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-7 h-7 text-primary" />
                </div>
                <p className="font-bold mb-1 text-foreground">No subjects yet</p>
                <p className="text-sm text-muted-foreground mb-5">Add your first subject to start tracking</p>
                <button onClick={startCreate}
                  className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-secondary transition-all shadow-md">
                  <Plus className="w-4 h-4" /> Add Subject
                </button>
              </GrayCard>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subjects.map(sub => {
                  const ready = isReady(sub)
                  const result = ready ? computeResult(sub) : null
                  const info = result && !result.error ? gradeInfo(result.grade, sub.gradingSystem) : null
                  const totalItems = sub.assessmentTypes.reduce((a, t) => a + t.columns.length, 0)
                  const filledItems = sub.assessmentTypes.reduce(
                    (a, t) => a + t.columns.filter(c => c.score !== "" && c.total !== "").length, 0
                  )

                  return (
                    <button
                      key={sub.id}
                      onClick={() => { setActiveId(sub.id); setPage("subject") }}
                      className="bg-card text-foreground rounded-2xl p-5 text-left hover:shadow-md transition-all group border border-foreground/5 flex flex-col justify-between min-h-40"
                    >
                      <div className="w-full">
                        <div className="flex items-start justify-between mb-3 w-full">
                          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                            <BookOpen className="w-5 h-5 text-primary" />
                          </div>
                          {info ? (
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              info.pass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                            }`}>
                              {info.desc}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                              {filledItems}/{totalItems} Items
                            </span>
                          )}
                        </div>

                        <h3 className="font-black text-base mb-0.5 leading-tight truncate">{sub.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3 font-semibold">{gsLabel(sub.gradingSystem, sub.zeroFormula)}</p>
                      </div>

                      <div className="w-full">
                        {result && !result.error ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className={`text-4xl font-black leading-none ${info?.pass ? "text-green-600" : "text-red-500"}`}>
                              {result.grade}
                            </span>
                            <span className="text-xs text-muted-foreground font-semibold">/100</span>
                          </div>
                        ) : (
                          <div>
                            <div className="w-full bg-primary/10 rounded-full h-2 overflow-hidden mb-1">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: totalItems > 0 ? `${(filledItems / totalItems) * 100}%` : "0%" }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">
                              {totalItems === 0 ? "No items configured" : `${filledItems} of ${totalItems} scores entered`}
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
                
                <button onClick={startCreate} className="border-2 border-dashed border-white/20 hover:border-white/40 rounded-2xl p-5 flex flex-col items-center justify-center text-center text-white/60 hover:text-white transition-all gap-2 min-h-40">
                  <Plus className="w-6 h-6" />
                  <span className="text-xs font-bold">Track Another Subject</span>
                </button>
              </div>
            )}
          </BluePanel>
        </div>
      )}

      {page === "c1" && (
        <div className="max-w-md mx-auto px-4 py-16">
          <BluePanel>
            <StepBar step={stepIdx} />
            <h2 className="text-2xl font-black text-white mb-2">Subject Name</h2>
            <p className="text-white/60 text-xs mb-6">What subject or course identifier are we tracking?</p>

            <div className="bg-card rounded-2xl p-6 text-foreground mb-6 shadow-inner">
              <UInput
                label="Subject / Course Code"
                placeholder="e.g., CPE 311, Physics 2"
                value={draft.name}
                onChange={v => setDraft(p => ({ ...p, name: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setPage("dashboard")} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white font-bold transition-colors">
                <ArrowLeft className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={() => setPage("c2")}
                disabled={!draft.name.trim()}
                className="inline-flex items-center gap-1.5 bg-white text-primary px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md hover:bg-white/90 disabled:opacity-40 transition-all"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </BluePanel>
        </div>
      )}

      {page === "c2" && (
        <div className="max-w-md mx-auto px-4 py-12">
          <BluePanel>
            <StepBar step={stepIdx} />
            <h2 className="text-3xl font-black text-white mb-0.5">Grading system</h2>
            <p className="text-white/70 text-sm mb-6">
              How is <span className="font-bold text-white">{draft.name || "OOP"}</span> graded?
            </p>

            <div className="space-y-4 text-foreground mb-6">
              {/* CUSTOM WEIGHTED SELECTION */}
              <button 
                onClick={() => chooseGS("weighted")} 
                className="w-full bg-[#edf0f5] hover:bg-white rounded-3xl p-5 text-left transition-all flex items-center justify-between group shadow-sm"
              >
                <div className="space-y-1">
                  <span className="block font-bold text-[#1e293b] text-base">Custom Weighted</span>
                  <span className="block text-xs text-[#64748b]">Define your own types and weights</span>
                  <span className="inline-block bg-[#cbd5e1] text-[#475569] text-[10px] font-bold px-2.5 py-0.5 mt-1 rounded-full">
                    Must total 100%
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-[#94a3b8] transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* ZERO-BASED PERCENTAGE SELECTION */}
              <button 
                onClick={() => chooseGS("zero-based", "percentage")} 
                className="w-full bg-[#edf0f5] hover:bg-white rounded-3xl p-5 text-left transition-all flex items-center justify-between group shadow-sm"
              >
                <div className="space-y-1">
                  <span className="block font-bold text-[#1e293b] text-base">Zero-Based · Percentage</span>
                  <span className="block text-xs text-[#64748b]">Score ÷ Total × 100</span>
                  <span className="inline-block bg-[#cbd5e1] text-[#475569] text-[10px] font-bold px-2.5 py-0.5 mt-1 rounded-full">
                    Raw %
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-[#94a3b8] transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* ZERO-BASED TRANSMUTED SELECTION */}
              <button 
                onClick={() => chooseGS("zero-based", "transmuted")} 
                className="w-full bg-[#edf0f5] hover:bg-white rounded-3xl p-5 text-left transition-all flex items-center justify-between group shadow-sm"
              >
                <div className="space-y-1">
                  <span className="block font-bold text-[#1e293b] text-base">Zero-Based · Transmuted</span>
                  <span className="block text-xs text-[#64748b]">(Percentage × 0.4) + 60</span>
                  <span className="inline-block bg-[#cbd5e1] text-[#475569] text-[10px] font-bold px-2.5 py-0.5 mt-1 rounded-full">
                    Min 60
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-[#94a3b8] transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            <button onClick={() => setPage("c1")} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white font-bold transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </BluePanel>
        </div>
      )}

      {page === "c3" && (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <BluePanel>
            <StepBar step={stepIdx} />
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-2xl font-black text-white">Configure Assessments</h2>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 uppercase tracking-wide">
                {gsLabel(draft.gradingSystem!, draft.zeroFormula)}
              </span>
            </div>
            <p className="text-white/60 text-xs mb-6">Map out individual tracking parameters and column identifiers.</p>

            <div className="space-y-4 text-foreground mb-6">
              {draft.assessmentTypes.map((type, tIdx) => (
                <div key={type.id} className="bg-card rounded-2xl p-5 border border-foreground/5 shadow-md">
                  <div className="flex gap-3 mb-4 items-end">
                    <div className="flex-1">
                      <UInput
                        label={draft.gradingSystem === "weighted" ? `Category ${tIdx + 1} Name` : "Category Name"}
                        placeholder="e.g., Quizzes, Midterms"
                        value={type.name}
                        onChange={v => updType(type.id, "name", v)}
                      />
                    </div>
                    {draft.gradingSystem === "weighted" && (
                      <div className="w-24">
                        <UInput
                          label="Weight (%)"
                          placeholder="e.g., 30"
                          type="number"
                          value={type.weight}
                          onChange={v => updType(type.id, "weight", v)}
                        />
                      </div>
                    )}
                    {draft.gradingSystem === "weighted" && draft.assessmentTypes.length > 1 && (
                      <button onClick={() => delType(type.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors mb-0.5">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="bg-muted/40 border border-foreground/5 rounded-xl p-4">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Tracked Requirements</span>
                    
                    {type.columns.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic mb-3">No individual columns added yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {type.columns.map(c => (
                          <span key={c.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold pl-2.5 pr-1 py-1 rounded-full border border-primary/10">
                            {c.label}
                            <button onClick={() => delColFromDraft(type.id, c.id)} className="p-0.5 text-primary/60 hover:text-primary rounded-full hover:bg-primary/10">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Add assessment (e.g., Quiz 1)"
                        value={newColLabel[type.id] || ""}
                        onChange={e => setNewColLabel(p => ({ ...p, [type.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && addColToDraft(type.id)}
                        className="flex-1 bg-transparent border-0 border-b border-foreground/25 focus:border-primary text-xs pb-1 text-foreground focus:outline-none transition-colors placeholder:text-muted-foreground/50"
                      />
                      <button onClick={() => addColToDraft(type.id)} className="p-1.5 bg-primary text-white rounded-lg hover:bg-secondary shadow-sm transition-all">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {draft.gradingSystem === "weighted" && (
                <button onClick={addType} className="w-full py-3 border-2 border-dashed border-white/30 text-white/80 hover:text-white hover:border-white/50 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all">
                  <Plus className="w-4 h-4" /> Add Weight Category
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setPage("c2")} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white font-bold transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setPage("c4")}
                disabled={!canGoC4()}
                className="inline-flex items-center gap-1.5 bg-white text-primary px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md hover:bg-white/90 disabled:opacity-40 transition-all"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </BluePanel>
        </div>
      )}

      {page === "c4" && (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <BluePanel>
            <StepBar step={stepIdx} />
            <h2 className="text-2xl font-black text-white mb-1">Enter Raw Data</h2>
            <p className="text-white/60 text-xs mb-6">Input initial score frameworks or check empty values before finalization.</p>

            <div className="space-y-4 text-foreground mb-6 max-h-[50vh] overflow-y-auto pr-1">
              {draft.assessmentTypes.map(t => (
                <div key={t.id} className="bg-card rounded-2xl p-5 border border-foreground/5 shadow-md">
                  <div className="flex items-center justify-between border-b border-foreground/5 pb-2 mb-2">
                    <span className="font-black">{t.name || "Assessments"}</span>
                    {draft.gradingSystem === "weighted" && (
                      <span className="text-xs font-bold text-muted-foreground">{t.weight}% Contribution</span>
                    )}
                  </div>
                  {t.columns.map(c => (
                    <ScoreRow
                      key={c.id}
                      col={c}
                      onScore={v => updDraftScore(t.id, c.id, "score", v)}
                      onTotal={v => updDraftScore(t.id, c.id, "total", v)}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setPage("c3")} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white font-bold transition-colors">
                <ArrowLeft className="w-4 h-4" /> Edit Layout
              </button>
              <button
                onClick={saveSubject}
                className="inline-flex items-center gap-1.5 bg-white text-primary px-6 py-3 rounded-2xl text-sm font-black shadow-md hover:bg-white/90 transition-all"
              >
                Save Tracked Subject <Check className="w-4 h-4" />
              </button>
            </div>
          </BluePanel>
        </div>
      )}

      {page === "subject" && activeSub && (
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setPage("dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-semibold transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Trackers
            </button>
            <button onClick={() => deleteSubject(activeSub.id)} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100/30 font-bold px-3 py-1.5 rounded-xl transition-all">
              <Trash2 className="w-3.5 h-3.5" /> Remove Subject
            </button>
          </div>

          {(() => {
            const ready = isReady(activeSub)
            const result = ready ? computeResult(activeSub) : null
            const info = result && !result.error ? gradeInfo(result.grade, activeSub.gradingSystem) : null
            return (
              <>
                <BluePanel className="mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 uppercase tracking-wide">
                        {gsLabel(activeSub.gradingSystem, activeSub.zeroFormula)}
                      </span>
                      <h1 className="text-3xl font-black text-white mt-2 mb-1">{activeSub.name}</h1>
                    </div>
                    {result && !result.error && (
                      <div className="flex items-baseline gap-2 bg-white/10 px-6 py-4 rounded-3xl self-start sm:self-auto">
                        <span className="text-5xl font-black tracking-tight">{result.grade}</span>
                        <span className="text-sm font-semibold opacity-70">/100</span>
                      </div>
                    )}
                  </div>
                </BluePanel>

                <div className="space-y-4 text-foreground">
                  {activeSub.assessmentTypes.map(t => (
                    <div key={t.id} className="bg-card rounded-2xl p-6 border border-foreground/5 shadow-md">
                      <div className="flex items-center justify-between border-b border-foreground/5 pb-3 mb-4">
                        <h3 className="font-bold text-lg">{t.name || "Assessments"}</h3>
                        {activeSub.gradingSystem === "weighted" && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                            {t.weight}% weight
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {t.columns.map(c => (
                          <ScoreRow
                            key={c.id}
                            col={c}
                            onScore={v => updScore(activeSub.id, t.id, c.id, "score", v)}
                            onTotal={v => updScore(activeSub.id, t.id, c.id, "total", v)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}