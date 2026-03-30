import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import {
  signUp, logIn, logOut, getSession, onAuthChange,
  loadProfile, updateProfile,
  loadDocuments, saveDocument, clearDocuments,
} from "./lib/supabase";

// ═══════════════════════════════════════
// ESA NOTICE PERIOD CALCULATOR
// ═══════════════════════════════════════
const ESA_RULES = {
  ON: { name: "Ontario", act: "Employment Standards Act, 2000 (S.O. 2000, c. 41)",
    notice: y => y<1?1:y<3?2:y<4?3:y<5?4:y<6?5:y<7?6:y<8?7:8,
    severance: y => y >= 5 ? y : 0,
    sevNote: { en: "Severance applies if 5+ years service AND employer payroll ≥ $2.5M", fr: "Indemnité si 5+ ans de service ET masse salariale ≥ 2,5M$" }},
  QC: { name: "Québec", act: "Act respecting labour standards (CQLR c N-1.1)",
    notice: y => y<1?1:y<5?2:y<10?4:8,
    severance: () => 0,
    sevNote: { en: "Quebec does not have statutory severance pay. Notice or indemnity in lieu only.", fr: "Le Québec n'a pas d'indemnité de départ statutaire. Préavis ou indemnité seulement." }},
  BC: { name: "British Columbia", act: "Employment Standards Act (RSBC 1996, c 113)",
    notice: y => y<1?1:y<3?2:Math.min(y,8),
    severance: () => 0,
    sevNote: { en: "BC does not have separate severance pay. Notice or compensation for length of service only.", fr: "La C.-B. n'a pas d'indemnité de départ distincte." }},
  AB: { name: "Alberta", act: "Employment Standards Code (RSA 2000, c E-9)",
    notice: y => y<2?1:y<4?2:y<6?4:y<8?5:y<10?6:8,
    severance: () => 0,
    sevNote: { en: "Alberta does not have statutory severance pay beyond the notice requirement.", fr: "L'Alberta n'a pas d'indemnité de départ statutaire." }},
  SK: { name: "Saskatchewan", act: "Saskatchewan Employment Act (SS 2013, c S-15.1)",
    notice: y => y<1?1:y<3?2:y<5?4:y<10?6:8,
    severance: () => 0, sevNote: { en: "", fr: "" }},
  MB: { name: "Manitoba", act: "Employment Standards Code (CCSM c E110)",
    notice: y => y<1?1:y<3?2:y<5?4:y<10?6:8,
    severance: () => 0, sevNote: { en: "", fr: "" }},
  NS: { name: "Nova Scotia", act: "Labour Standards Code (RSNS 1989, c 246)",
    notice: y => y<2?1:y<5?2:y<10?4:8,
    severance: () => 0, sevNote: { en: "", fr: "" }},
  NB: { name: "New Brunswick", act: "Employment Standards Act (SNB 1982, c E-7.2)",
    notice: y => y<5?1:y<10?2:4,
    severance: () => 0, sevNote: { en: "", fr: "" }},
  PE: { name: "Prince Edward Island", act: "Employment Standards Act (RSPEI 1988, c E-6.2)",
    notice: y => y<5?1:y<10?2:y<15?4:6,
    severance: () => 0, sevNote: { en: "", fr: "" }},
  NL: { name: "Newfoundland and Labrador", act: "Labour Standards Act (RSNL 1990, c L-2)",
    notice: y => y<2?1:y<5?2:y<10?3:y<15?4:6,
    severance: () => 0, sevNote: { en: "", fr: "" }},
  FED: { name: "Federal", act: "Canada Labour Code (R.S.C., 1985, c. L-2)",
    notice: () => 2,
    severance: y => y >= 1 ? Math.round(y * 2 / 5 * 10) / 10 : 0,
    sevNote: { en: "Federal severance: 2 days' pay per year of service (minimum 5 days). Applies after 12 months continuous employment.", fr: "Indemnité fédérale : 2 jours de salaire par année de service (minimum 5 jours)." }},
  YT: { name: "Yukon", act: "Employment Standards Act (RSY 2002, c 72)",
    notice: y => y<1?1:y<3?2:y<4?3:y<5?4:y<6?5:y<7?6:y<8?7:8,
    severance: () => 0, sevNote: { en: "Yukon follows a similar notice scale to Ontario.", fr: "Le Yukon suit une échelle semblable à l'Ontario." }},
  NT: { name: "Northwest Territories", act: "Employment Standards Act (SNWT 2007, c 13)",
    notice: y => y<1?0:y<3?2:y<5?3:y<10?4:8,
    severance: () => 0, sevNote: { en: "NWT: No notice required for first 90 days of employment.", fr: "T.N.-O. : Aucun préavis requis durant les 90 premiers jours." }},
  NU: { name: "Nunavut", act: "Labour Standards Act (RSNWT (Nu) 1988, c L-1)",
    notice: y => y<1?0:y<3?2:y<5?3:y<10?4:8,
    severance: () => 0, sevNote: { en: "Nunavut: No notice required for first 90 days of employment.", fr: "Nunavut : Aucun préavis requis durant les 90 premiers jours." }},
};

function calcNotice(province, years) {
  const rule = ESA_RULES[province];
  if (!rule) return null;
  const y = parseFloat(years) || 0;
  return { noticeWeeks: rule.notice(y), severanceWeeks: rule.severance(y), act: rule.act, sevNote: rule.sevNote };
}

// ═══════════════════════════════════════
// DATA
// ═══════════════════════════════════════
const PROVINCES = [
  { code: "ON", en: "Ontario", fr: "Ontario" },
  { code: "QC", en: "Quebec", fr: "Québec" },
  { code: "BC", en: "British Columbia", fr: "Colombie-Britannique" },
  { code: "AB", en: "Alberta", fr: "Alberta" },
  { code: "MB", en: "Manitoba", fr: "Manitoba" },
  { code: "SK", en: "Saskatchewan", fr: "Saskatchewan" },
  { code: "NS", en: "Nova Scotia", fr: "Nouvelle-Écosse" },
  { code: "NB", en: "New Brunswick", fr: "Nouveau-Brunswick" },
  { code: "PE", en: "Prince Edward Island", fr: "Île-du-Prince-Édouard" },
  { code: "NL", en: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador" },
  { code: "FED", en: "Federal", fr: "Fédéral" },
  { code: "YT", en: "Yukon", fr: "Yukon" },
  { code: "NT", en: "Northwest Territories", fr: "Territoires du Nord-Ouest" },
  { code: "NU", en: "Nunavut", fr: "Nunavut" },
];

const TEMPLATES = [
  // ── ORIGINAL 8 ──
  { id: "offer", icon: "📋", cat: "hire",
    en: { name: "Employment Offer Letter", desc: "Formal job offer with terms, compensation, and start date" },
    fr: { name: "Lettre d'offre d'emploi", desc: "Offre formelle avec conditions et rémunération" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "companyAddress", en: "Company address", fr: "Adresse de l'entreprise", type: "text" },
      { id: "candidateName", en: "Candidate's full name", fr: "Nom complet du candidat", type: "text" },
      { id: "jobTitle", en: "Job title", fr: "Titre du poste", type: "text" },
      { id: "department", en: "Department", fr: "Département", type: "text" },
      { id: "startDate", en: "Start date", fr: "Date de début", type: "date" },
      { id: "salary", en: "Annual salary ($)", fr: "Salaire annuel ($)", type: "text" },
      { id: "payFrequency", en: "Pay frequency", fr: "Fréquence de paie", type: "select", options: [{ en: "Bi-weekly", fr: "Aux deux semaines" },{ en: "Semi-monthly", fr: "Bimensuel" },{ en: "Monthly", fr: "Mensuel" }]},
      { id: "employmentType", en: "Employment type", fr: "Type d'emploi", type: "select", options: [{ en: "Full-time, permanent", fr: "Temps plein, permanent" },{ en: "Part-time, permanent", fr: "Temps partiel, permanent" },{ en: "Full-time, contract", fr: "Temps plein, contrat" }]},
      { id: "hoursPerWeek", en: "Hours per week", fr: "Heures par semaine", type: "text" },
      { id: "probationMonths", en: "Probation period (months)", fr: "Période de probation (mois)", type: "text" },
      { id: "vacationWeeks", en: "Vacation (weeks/year)", fr: "Vacances (semaines/an)", type: "text" },
      { id: "benefits", en: "Benefits summary", fr: "Avantages sociaux", type: "textarea" },
      { id: "managerName", en: "Hiring manager name", fr: "Nom du gestionnaire", type: "text" },
      { id: "managerTitle", en: "Hiring manager title", fr: "Titre du gestionnaire", type: "text" },
      { id: "deadlineDays", en: "Days to accept offer", fr: "Jours pour accepter", type: "text" },
    ]},
  { id: "termination", icon: "⚠️", cat: "exit",
    en: { name: "Termination Letter", desc: "With or without cause, ESA-compliant notice and severance" },
    fr: { name: "Lettre de cessation", desc: "Avec ou sans motif, préavis conforme" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "jobTitle", en: "Job title", fr: "Titre du poste", type: "text" },
      { id: "hireDate", en: "Original hire date", fr: "Date d'embauche", type: "date" },
      { id: "terminationType", en: "Termination type", fr: "Type de cessation", type: "select", options: [{ en: "Without cause", fr: "Sans motif valable" },{ en: "With cause", fr: "Avec motif valable" }]},
      { id: "lastDay", en: "Last day of employment", fr: "Dernier jour d'emploi", type: "date" },
      { id: "yearsService", en: "Years of continuous service", fr: "Années de service continu", type: "text" },
      { id: "noticePeriod", en: "Notice period (weeks) — auto-calculated below", fr: "Préavis (semaines) — calculé automatiquement", type: "text" },
      { id: "severanceWeeks", en: "Severance (weeks) — auto-calculated below", fr: "Indemnité (semaines) — calculée automatiquement", type: "text" },
      { id: "continuationBenefits", en: "Benefits continuation period", fr: "Continuation des avantages", type: "text" },
      { id: "causeDetails", en: "Cause details (if with cause)", fr: "Détails du motif (si avec motif)", type: "textarea" },
      { id: "returnItems", en: "Company property to return", fr: "Biens à retourner", type: "textarea" },
      { id: "signerName", en: "Authorized signer name", fr: "Nom du signataire", type: "text" },
      { id: "signerTitle", en: "Authorized signer title", fr: "Titre du signataire", type: "text" },
    ]},
  { id: "warning", icon: "🔶", cat: "discipline",
    en: { name: "Written Warning", desc: "Progressive discipline with corrective action plan" },
    fr: { name: "Avertissement écrit", desc: "Mesures disciplinaires progressives" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "jobTitle", en: "Job title", fr: "Titre du poste", type: "text" },
      { id: "department", en: "Department", fr: "Département", type: "text" },
      { id: "warningLevel", en: "Warning level", fr: "Niveau", type: "select", options: [{ en: "First written warning", fr: "Premier avertissement" },{ en: "Second written warning", fr: "Deuxième avertissement" },{ en: "Final written warning", fr: "Dernier avertissement" }]},
      { id: "issueDate", en: "Date of this warning", fr: "Date de l'avertissement", type: "date" },
      { id: "incidentDates", en: "Date(s) of incident(s)", fr: "Date(s) de l'incident", type: "text" },
      { id: "policyViolated", en: "Policy or standard violated", fr: "Politique enfreinte", type: "text" },
      { id: "issueDescription", en: "Description of the issue", fr: "Description du problème", type: "textarea" },
      { id: "previousActions", en: "Previous corrective actions", fr: "Mesures antérieures", type: "textarea" },
      { id: "expectedImprovement", en: "Expected improvement", fr: "Amélioration attendue", type: "textarea" },
      { id: "supportProvided", en: "Support to be provided", fr: "Soutien offert", type: "textarea" },
      { id: "reviewDate", en: "Review date", fr: "Date de révision", type: "date" },
      { id: "consequences", en: "Consequences if not improved", fr: "Conséquences", type: "textarea" },
      { id: "managerName", en: "Manager name & title", fr: "Nom et titre du gestionnaire", type: "text" },
    ]},
  { id: "probation", icon: "⏳", cat: "hire",
    en: { name: "Probation Letter", desc: "Confirm completion or extend probation" },
    fr: { name: "Lettre de probation", desc: "Confirmer ou prolonger la probation" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "jobTitle", en: "Job title", fr: "Titre du poste", type: "text" },
      { id: "hireDate", en: "Date of hire", fr: "Date d'embauche", type: "date" },
      { id: "probationType", en: "Outcome", fr: "Résultat", type: "select", options: [{ en: "Successfully completed", fr: "Complétée avec succès" },{ en: "Extended", fr: "Prolongée" }]},
      { id: "originalEnd", en: "Original end date", fr: "Fin originale", type: "date" },
      { id: "newEnd", en: "New end date (if extended)", fr: "Nouvelle fin (si prolongée)", type: "date" },
      { id: "extensionReason", en: "Reason for extension", fr: "Raison de la prolongation", type: "textarea" },
      { id: "areasToImprove", en: "Areas for improvement", fr: "Points à améliorer", type: "textarea" },
      { id: "managerName", en: "Manager name & title", fr: "Nom du gestionnaire", type: "text" },
    ]},
  { id: "returnleave", icon: "🔄", cat: "leave",
    en: { name: "Return from Leave", desc: "Return to work confirmation letter" },
    fr: { name: "Retour de congé", desc: "Confirmation de retour au travail" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "jobTitle", en: "Job title", fr: "Titre du poste", type: "text" },
      { id: "leaveType", en: "Type of leave", fr: "Type de congé", type: "select", options: [{ en: "Maternity / Parental", fr: "Maternité / Parental" },{ en: "Medical / Disability", fr: "Médical / Invalidité" },{ en: "Personal leave", fr: "Congé personnel" }]},
      { id: "leaveStart", en: "Leave start date", fr: "Début du congé", type: "date" },
      { id: "returnDate", en: "Return date", fr: "Date de retour", type: "date" },
      { id: "sameRole", en: "Same role?", fr: "Même poste?", type: "select", options: [{ en: "Yes — same role", fr: "Oui — même poste" },{ en: "No — comparable role", fr: "Non — poste comparable" }]},
      { id: "newRole", en: "New role details (if changed)", fr: "Nouveau poste (si changé)", type: "textarea" },
      { id: "accommodations", en: "Accommodations (if any)", fr: "Mesures d'adaptation", type: "textarea" },
      { id: "hrContact", en: "HR contact", fr: "Contact RH", type: "text" },
    ]},
  { id: "policy", icon: "📑", cat: "policy",
    en: { name: "Workplace Policy", desc: "Harassment, attendance, or remote work policy" },
    fr: { name: "Politique de travail", desc: "Harcèlement, assiduité ou télétravail" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "policyType", en: "Policy type", fr: "Type de politique", type: "select", options: [{ en: "Harassment & Discrimination Prevention", fr: "Prévention du harcèlement" },{ en: "Attendance & Punctuality", fr: "Assiduité et ponctualité" },{ en: "Remote Work / Telework", fr: "Télétravail" }]},
      { id: "effectiveDate", en: "Effective date", fr: "Date d'entrée en vigueur", type: "date" },
      { id: "scope", en: "Applies to", fr: "S'applique à", type: "select", options: [{ en: "All employees", fr: "Tous les employés" },{ en: "Specific departments", fr: "Départements spécifiques" }]},
      { id: "departments", en: "Department(s) if specific", fr: "Département(s)", type: "text" },
      { id: "approverName", en: "Approved by (name & title)", fr: "Approuvé par", type: "text" },
      { id: "reviewDate", en: "Next review date", fr: "Prochaine révision", type: "date" },
    ]},
  { id: "roe", icon: "📊", cat: "exit",
    en: { name: "ROE Guidance", desc: "Record of Employment preparation checklist" },
    fr: { name: "Guide RE", desc: "Liste de vérification pour le relevé d'emploi" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "sin_last4", en: "Last 4 digits of SIN", fr: "4 derniers chiffres du NAS", type: "text" },
      { id: "reasonCode", en: "Reason for ROE", fr: "Raison du RE", type: "select", options: [{ en: "A — Shortage of work", fr: "A — Manque de travail" },{ en: "D — Illness/injury", fr: "D — Maladie" },{ en: "E — Quit", fr: "E — Départ" },{ en: "M — Dismissal", fr: "M — Congédiement" },{ en: "N — Leave", fr: "N — Congé" }]},
      { id: "lastDayWorked", en: "Last day worked", fr: "Dernier jour travaillé", type: "date" },
      { id: "lastDayPaid", en: "Last day paid", fr: "Dernier jour payé", type: "date" },
      { id: "payPeriodType", en: "Pay period type", fr: "Type de période de paie", type: "select", options: [{ en: "Weekly", fr: "Hebdomadaire" },{ en: "Bi-weekly", fr: "Aux deux semaines" },{ en: "Semi-monthly", fr: "Bimensuel" },{ en: "Monthly", fr: "Mensuel" }]},
      { id: "vacationPay", en: "Vacation pay owing ($)", fr: "Vacances dues ($)", type: "text" },
    ]},
  { id: "contractor", icon: "🤝", cat: "hire",
    en: { name: "Contractor Agreement", desc: "Independent contractor services agreement" },
    fr: { name: "Entente d'entrepreneur", desc: "Entente de services d'entrepreneur indépendant" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "companyAddress", en: "Company address", fr: "Adresse de l'entreprise", type: "text" },
      { id: "contractorName", en: "Contractor's name", fr: "Nom de l'entrepreneur", type: "text" },
      { id: "projectDesc", en: "Description of services", fr: "Description des services", type: "textarea" },
      { id: "deliverables", en: "Key deliverables", fr: "Livrables clés", type: "textarea" },
      { id: "startDate", en: "Start date", fr: "Date de début", type: "date" },
      { id: "endDate", en: "End date", fr: "Date de fin", type: "date" },
      { id: "compensation", en: "Compensation", fr: "Rémunération", type: "text" },
      { id: "paymentTerms", en: "Payment terms", fr: "Conditions de paiement", type: "text" },
      { id: "ownsTools", en: "Own tools?", fr: "Outils propres?", type: "select", options: [{ en: "Yes", fr: "Oui" },{ en: "No", fr: "Non" }]},
      { id: "confidentiality", en: "Confidentiality clause?", fr: "Clause de confidentialité?", type: "select", options: [{ en: "Yes", fr: "Oui" },{ en: "No", fr: "Non" }]},
      { id: "terminationNotice", en: "Termination notice (days)", fr: "Préavis de résiliation (jours)", type: "text" },
    ]},
  // ── NEW 8 ──
  { id: "promotion", icon: "⬆️", cat: "hire",
    en: { name: "Promotion / Salary Increase", desc: "Confirm promotion or compensation change" },
    fr: { name: "Promotion / Augmentation", desc: "Confirmer une promotion ou un changement de rémunération" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "currentTitle", en: "Current job title", fr: "Titre actuel", type: "text" },
      { id: "newTitle", en: "New job title", fr: "Nouveau titre", type: "text" },
      { id: "effectiveDate", en: "Effective date", fr: "Date d'entrée en vigueur", type: "date" },
      { id: "currentSalary", en: "Current salary ($)", fr: "Salaire actuel ($)", type: "text" },
      { id: "newSalary", en: "New salary ($)", fr: "Nouveau salaire ($)", type: "text" },
      { id: "reason", en: "Reason for change", fr: "Raison du changement", type: "textarea" },
      { id: "newResponsibilities", en: "New responsibilities (if promotion)", fr: "Nouvelles responsabilités", type: "textarea" },
      { id: "managerName", en: "Manager name & title", fr: "Nom du gestionnaire", type: "text" },
    ]},
  { id: "reference", icon: "✉️", cat: "exit",
    en: { name: "Employee Reference Letter", desc: "Professional reference for departing employee" },
    fr: { name: "Lettre de référence", desc: "Référence professionnelle pour un(e) employé(e)" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "jobTitle", en: "Job title held", fr: "Titre occupé", type: "text" },
      { id: "startDate", en: "Employment start date", fr: "Date de début d'emploi", type: "date" },
      { id: "endDate", en: "Employment end date", fr: "Date de fin d'emploi", type: "date" },
      { id: "duties", en: "Key responsibilities", fr: "Responsabilités principales", type: "textarea" },
      { id: "strengths", en: "Notable strengths & achievements", fr: "Forces et réalisations", type: "textarea" },
      { id: "character", en: "Character & work ethic description", fr: "Description du caractère", type: "textarea" },
      { id: "signerName", en: "Reference author name", fr: "Nom de l'auteur de la référence", type: "text" },
      { id: "signerTitle", en: "Reference author title", fr: "Titre de l'auteur", type: "text" },
      { id: "contactInfo", en: "Author contact (email/phone)", fr: "Contact de l'auteur", type: "text" },
    ]},
  { id: "investigation", icon: "🔍", cat: "discipline",
    en: { name: "Workplace Investigation Report", desc: "Formal findings of a workplace investigation" },
    fr: { name: "Rapport d'enquête", desc: "Conclusions formelles d'une enquête en milieu de travail" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "complainant", en: "Complainant name", fr: "Nom du/de la plaignant(e)", type: "text" },
      { id: "respondent", en: "Respondent name", fr: "Nom du/de la mis(e) en cause", type: "text" },
      { id: "investigator", en: "Investigator name & title", fr: "Nom de l'enquêteur", type: "text" },
      { id: "complaintDate", en: "Date complaint received", fr: "Date de réception de la plainte", type: "date" },
      { id: "incidentDate", en: "Date(s) of alleged incident(s)", fr: "Date(s) de l'incident allégué", type: "text" },
      { id: "allegationSummary", en: "Summary of allegations", fr: "Résumé des allégations", type: "textarea" },
      { id: "witnessesInterviewed", en: "Witnesses interviewed", fr: "Témoins interrogés", type: "textarea" },
      { id: "evidenceReviewed", en: "Evidence reviewed", fr: "Preuves examinées", type: "textarea" },
      { id: "findings", en: "Findings of fact", fr: "Constatations de fait", type: "textarea" },
      { id: "conclusion", en: "Conclusion (substantiated/not)", fr: "Conclusion (fondée ou non)", type: "select", options: [{ en: "Substantiated", fr: "Fondée" },{ en: "Not substantiated", fr: "Non fondée" },{ en: "Inconclusive", fr: "Non concluante" }]},
      { id: "recommendations", en: "Recommended actions", fr: "Mesures recommandées", type: "textarea" },
    ]},
  { id: "accommodation", icon: "♿", cat: "leave",
    en: { name: "Accommodation Response", desc: "Response to workplace accommodation request" },
    fr: { name: "Réponse d'adaptation", desc: "Réponse à une demande d'adaptation en milieu de travail" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "jobTitle", en: "Job title", fr: "Titre du poste", type: "text" },
      { id: "requestDate", en: "Date of accommodation request", fr: "Date de la demande", type: "date" },
      { id: "accommodationType", en: "Type of accommodation", fr: "Type d'adaptation", type: "select", options: [{ en: "Physical / Ergonomic", fr: "Physique / Ergonomique" },{ en: "Schedule / Hours", fr: "Horaire / Heures" },{ en: "Medical", fr: "Médicale" },{ en: "Religious", fr: "Religieuse" },{ en: "Other", fr: "Autre" }]},
      { id: "requestSummary", en: "Summary of request", fr: "Résumé de la demande", type: "textarea" },
      { id: "decision", en: "Decision", fr: "Décision", type: "select", options: [{ en: "Approved as requested", fr: "Approuvée telle que demandée" },{ en: "Approved with modifications", fr: "Approuvée avec modifications" },{ en: "Denied — undue hardship", fr: "Refusée — contrainte excessive" }]},
      { id: "accommodationDetails", en: "Accommodation details provided", fr: "Détails de l'adaptation", type: "textarea" },
      { id: "reviewDate", en: "Review date", fr: "Date de révision", type: "date" },
      { id: "hrContact", en: "HR contact", fr: "Contact RH", type: "text" },
    ]},
  { id: "resignation", icon: "👋", cat: "exit",
    en: { name: "Resignation Acceptance", desc: "Formal acceptance of employee's resignation" },
    fr: { name: "Acceptation de démission", desc: "Acceptation formelle de la démission" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "jobTitle", en: "Job title", fr: "Titre du poste", type: "text" },
      { id: "resignationDate", en: "Date resignation received", fr: "Date de réception", type: "date" },
      { id: "lastDay", en: "Last day of employment", fr: "Dernier jour d'emploi", type: "date" },
      { id: "yearsService", en: "Years of service", fr: "Années de service", type: "text" },
      { id: "exitInterview", en: "Exit interview scheduled?", fr: "Entrevue de départ prévue?", type: "select", options: [{ en: "Yes", fr: "Oui" },{ en: "No", fr: "Non" }]},
      { id: "returnItems", en: "Property to return", fr: "Biens à retourner", type: "textarea" },
      { id: "managerName", en: "Manager name & title", fr: "Nom du gestionnaire", type: "text" },
    ]},
  { id: "layoff", icon: "📉", cat: "exit",
    en: { name: "Layoff Notice", desc: "Temporary or permanent layoff notification" },
    fr: { name: "Avis de mise à pied", desc: "Notification de mise à pied temporaire ou permanente" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "jobTitle", en: "Job title", fr: "Titre du poste", type: "text" },
      { id: "layoffType", en: "Layoff type", fr: "Type de mise à pied", type: "select", options: [{ en: "Temporary", fr: "Temporaire" },{ en: "Permanent", fr: "Permanente" }]},
      { id: "effectiveDate", en: "Effective date", fr: "Date d'effet", type: "date" },
      { id: "expectedRecall", en: "Expected recall date (if temporary)", fr: "Date de rappel prévue (si temporaire)", type: "date" },
      { id: "yearsService", en: "Years of service", fr: "Années de service", type: "text" },
      { id: "reason", en: "Reason for layoff", fr: "Raison de la mise à pied", type: "textarea" },
      { id: "benefitsContinuation", en: "Benefits during layoff", fr: "Avantages pendant la mise à pied", type: "textarea" },
      { id: "recallRights", en: "Recall rights & process", fr: "Droits et processus de rappel", type: "textarea" },
      { id: "signerName", en: "Authorized signer", fr: "Signataire autorisé", type: "text" },
    ]},
  { id: "pip", icon: "📈", cat: "discipline",
    en: { name: "Performance Improvement Plan", desc: "Structured PIP with goals and timeline" },
    fr: { name: "Plan d'amélioration du rendement", desc: "Plan structuré avec objectifs et échéancier" },
    fields: [
      { id: "companyName", en: "Company name", fr: "Nom de l'entreprise", type: "text" },
      { id: "employeeName", en: "Employee's full name", fr: "Nom de l'employé(e)", type: "text" },
      { id: "jobTitle", en: "Job title", fr: "Titre du poste", type: "text" },
      { id: "department", en: "Department", fr: "Département", type: "text" },
      { id: "startDate", en: "PIP start date", fr: "Date de début du plan", type: "date" },
      { id: "endDate", en: "PIP end date", fr: "Date de fin du plan", type: "date" },
      { id: "performanceIssues", en: "Performance issues identified", fr: "Problèmes de rendement identifiés", type: "textarea" },
      { id: "goals", en: "Specific improvement goals", fr: "Objectifs d'amélioration", type: "textarea" },
      { id: "metrics", en: "How success will be measured", fr: "Comment le succès sera mesuré", type: "textarea" },
      { id: "support", en: "Support & resources provided", fr: "Soutien et ressources", type: "textarea" },
      { id: "checkInSchedule", en: "Check-in schedule", fr: "Calendrier des suivis", type: "text" },
      { id: "consequences", en: "Consequences if not met", fr: "Conséquences si non atteint", type: "textarea" },
      { id: "managerName", en: "Manager name & title", fr: "Nom du gestionnaire", type: "text" },
    ]},
  { id: "nda", icon: "🔒", cat: "policy",
    en: { name: "Non-Disclosure Agreement", desc: "Confidentiality and non-disclosure agreement" },
    fr: { name: "Entente de non-divulgation", desc: "Entente de confidentialité et de non-divulgation" },
    fields: [
      { id: "companyName", en: "Company legal name", fr: "Raison sociale", type: "text" },
      { id: "companyAddress", en: "Company address", fr: "Adresse de l'entreprise", type: "text" },
      { id: "recipientName", en: "Recipient's full name", fr: "Nom du destinataire", type: "text" },
      { id: "recipientType", en: "Recipient type", fr: "Type de destinataire", type: "select", options: [{ en: "Employee", fr: "Employé(e)" },{ en: "Contractor", fr: "Entrepreneur" },{ en: "Third party", fr: "Tiers" }]},
      { id: "effectiveDate", en: "Effective date", fr: "Date d'entrée en vigueur", type: "date" },
      { id: "confidentialInfo", en: "Description of confidential information", fr: "Description de l'information confidentielle", type: "textarea" },
      { id: "purpose", en: "Purpose of disclosure", fr: "Objet de la divulgation", type: "textarea" },
      { id: "durationYears", en: "Duration of obligations (years)", fr: "Durée des obligations (années)", type: "text" },
      { id: "returnDestruction", en: "Return or destroy upon termination?", fr: "Retourner ou détruire à la fin?", type: "select", options: [{ en: "Return all materials", fr: "Retourner tout le matériel" },{ en: "Destroy all materials", fr: "Détruire tout le matériel" }]},
    ]},
];

// ═══════════════════════════════════════
// DOCUMENT GENERATORS (HTML)
// ═══════════════════════════════════════
function generateDocument(tid, fields, province, lang) {
  const prov = PROVINCES.find(p => p.code === province);
  const provName = prov ? prov[lang] : province;
  const today = new Date().toLocaleDateString(lang === "en" ? "en-CA" : "fr-CA", { year: "numeric", month: "long", day: "numeric" });
  const v = id => fields[id] || '<span class="blank">_______________</span>';
  const vr = id => fields[id] || "";
  const ov = id => { const r=fields[id];if(!r)return'<span class="blank">___</span>';const t=TEMPLATES.find(x=>x.id===tid);const f=t?.fields.find(x=>x.id===id);if(f?.type==="select"&&f.options){const o=f.options.find(x=>x.en===r||x.fr===r);return o?o[lang]:r}return r };
  const or = id => { const r=fields[id];if(!r)return"";const t=TEMPLATES.find(x=>x.id===tid);const f=t?.fields.find(x=>x.id===id);if(f?.type==="select"&&f.options){const o=f.options.find(x=>x.en===r||x.fr===r);return o?o.en:r}return r };
  const e = lang === "en";
  // Province-specific legislation
  const ACT = {
    ON:{en:"Employment Standards Act, 2000 (S.O. 2000, c. 41)",fr:"Loi de 2000 sur les normes d'emploi (L.O. 2000, ch. 41)",ot:44,vac:"4% of gross wages or 2 weeks per vacation entitlement year (s. 33, 35.2)",prob:"3 months",hr:"Ontario Human Rights Code (R.S.O. 1990, c. H.19)",ohs:"Occupational Health and Safety Act (R.S.O. 1990, c. O.1)"},
    QC:{en:"Act respecting labour standards (CQLR, c. N-1.1)",fr:"Loi sur les normes du travail (RLRQ, c. N-1.1)",ot:40,vac:"4% (under 3 yrs service) or 6% (3+ yrs) per s. 74–74.1",prob:"reasonable per Civil Code of Québec, art. 2091",hr:"Quebec Charter of Human Rights and Freedoms (CQLR, c. C-12)",ohs:"Act respecting occupational health and safety (CQLR, c. S-2.1)"},
    BC:{en:"Employment Standards Act (RSBC 1996, c. 113)",fr:"Employment Standards Act (RSBC 1996, c. 113)",ot:40,vac:"4% after 1 yr; 6% after 5 yrs (s. 58)",prob:"3 months",hr:"BC Human Rights Code (RSBC 1996, c. 210)",ohs:"Workers Compensation Act (RSBC 2019, c. 1)"},
    AB:{en:"Employment Standards Code (RSA 2000, c. E-9)",fr:"Employment Standards Code (RSA 2000, c. E-9)",ot:44,vac:"4% (under 5 yrs) or 6% (5+ yrs) per s. 34–35",prob:"3 months",hr:"Alberta Human Rights Act (RSA 2000, c. A-25.5)",ohs:"Occupational Health and Safety Act (SA 2020, c. O-2.2)"},
    MB:{en:"Employment Standards Code (CCSM, c. E110)",fr:"Code des normes d'emploi (C.P.L.M., ch. E110)",ot:40,vac:"2 weeks/4% (under 5 yrs); 3 weeks/6% (5+ yrs) per s. 44–45",prob:"90 days",hr:"Manitoba Human Rights Code (CCSM, c. H175)",ohs:"Workplace Safety and Health Act (CCSM, c. W210)"},
    SK:{en:"Saskatchewan Employment Act (SS 2013, c. S-15.1)",fr:"Saskatchewan Employment Act (SS 2013, c. S-15.1)",ot:40,vac:"3 weeks/yr after 1 yr; 4 weeks after 10 yrs (Part II, Div 6)",prob:"reasonable",hr:"Saskatchewan Human Rights Code, 2018 (SS 2018, c. S-24.2)",ohs:"Saskatchewan Employment Act, Part III"},
    NS:{en:"Labour Standards Code (RSNS 1989, c. 246)",fr:"Labour Standards Code (RSNS 1989, c. 246)",ot:48,vac:"2 weeks/4% per s. 33",prob:"reasonable",hr:"Nova Scotia Human Rights Act (RSNS 1989, c. 214)",ohs:"Workplace Health and Safety Regulations (NS Reg 52/2013)"},
    NB:{en:"Employment Standards Act (SNB 1982, c. E-7.2)",fr:"Loi sur les normes d'emploi (LN-B 1982, ch. E-7.2)",ot:44,vac:"1 week/4% (under 8 yrs); 6% after 8+ yrs per s. 22",prob:"6 months per s. 28.1",hr:"NB Human Rights Act (RSNB 2011, c. 171)",ohs:"Occupational Health and Safety Act (SNB 1983, c. O-0.2)"},
    PE:{en:"Employment Standards Act (RSPEI 1988, c. E-6.2)",fr:"Employment Standards Act (RSPEI 1988, c. E-6.2)",ot:48,vac:"2 weeks/4% per s. 23–24",prob:"6 months per s. 29(a)",hr:"PEI Human Rights Act (RSPEI 1988, c. H-12)",ohs:"Occupational Health and Safety Act (RSPEI 1988, c. O-1.01)"},
    NL:{en:"Labour Standards Act (RSNL 1990, c. L-2)",fr:"Labour Standards Act (RSNL 1990, c. L-2)",ot:40,vac:"2 weeks/4%; 3 weeks/6% after 15 yrs per s. 14–15",prob:"3 months per s. 43(3)",hr:"NL Human Rights Act, 2010 (SNL 2010, c. H-13.1)",ohs:"Occupational Health and Safety Act (RSNL 1990, c. O-3)"},
    FED:{en:"Canada Labour Code (R.S.C., 1985, c. L-2), Part III",fr:"Code canadien du travail (L.R.C. (1985), ch. L-2), Partie III",ot:40,vac:"2 weeks/4% (under 6 yrs); 3 weeks/6% (6+ yrs) per s. 184–185",prob:"common practice 3–6 months",hr:"Canadian Human Rights Act (R.S.C., 1985, c. H-6)",ohs:"Canada Labour Code, Part II"},
    YT:{en:"Employment Standards Act (RSY 2002, c. 72)",fr:"Employment Standards Act (RSY 2002, c. 72)",ot:40,vac:"2 weeks/4% per Part 4",prob:"6 months",hr:"Yukon Human Rights Act (RSY 2002, c. 116)",ohs:"Occupational Health and Safety Act (RSY 2002, c. 159)"},
    NT:{en:"Employment Standards Act (SNWT 2007, c. 13)",fr:"Employment Standards Act (SNWT 2007, c. 13)",ot:40,vac:"2 weeks/4%; 4 weeks/8% after 10 yrs per s. 22–23",prob:"90 days per s. 30(1)",hr:"NWT Human Rights Act (SNWT 2002, c. 18)",ohs:"Safety Act (RSNWT 1988, c. S-1)"},
    NU:{en:"Labour Standards Act (RSNWT (Nu) 1988, c. L-1)",fr:"Labour Standards Act (RSNWT (Nu) 1988, c. L-1)",ot:40,vac:"2 weeks/4% per s. 20",prob:"90 days",hr:"Nunavut Human Rights Act (SNWT (Nu) 2003, c. 12)",ohs:"Safety Act (RSNWT (Nu) 1988, c. S-1)"},
  };
  const act = ACT[province] || ACT["ON"];
  const actName = act[lang] || act.en;
  const esaRef = `<em>${actName}</em>`;
  const hrRef = `<em>${act.hr}</em>`;
  const ohsRef = `<em>${act.ohs}</em>`;
  const hr = '<div class="dhr"></div>';
  const sig = (n,t) => `<div class="sig-block"><div class="sig-line"></div><div class="sig-name">${n}</div>${t?`<div class="sig-title">${t}</div>`:""}</div>`;
  const hdr = () => `<div class="doc-header"><div class="doc-company">${v("companyName")}</div>${vr("companyAddress")?`<div class="doc-addr">${v("companyAddress")}</div>`:""}</div>${hr}`;
  const meta = (extra="") => `<div class="doc-meta"><div>${e?"Date":"Date"}: <strong>${today}</strong></div><div>${e?"Jurisdiction":"Juridiction"}: <strong>${provName}</strong></div>${extra}</div>${hr}`;
  const ack = (name) => `${hr}<p><strong>${e?"Acknowledgment of Receipt":"Accusé de réception"}</strong></p><p>${e?"I acknowledge that I have received, read, and understood this document. My signature below confirms receipt only and does not constitute agreement with the contents, nor a waiver of any rights I may have under applicable legislation, including the":"J'accuse réception de ce document. Ma signature ne constitue pas un accord avec le contenu, ni une renonciation à mes droits en vertu de"} ${esaRef}${e?" and the":" et du"} ${hrRef}.</p>${sig(name||v("employeeName"),"")}<div class="sig-date">${e?"Date":"Date"}: _______________________________</div>`;

  const noticeCalc = (tid === "termination" || tid === "layoff") ? calcNotice(province, vr("yearsService")) : null;

  const G = {
    offer: () => {
      return `${hdr()}${meta(`<div>${e?"Ref":"Réf"}: OFFER-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}</div>`)}
<div class="doc-type">${e?"EMPLOYMENT OFFER LETTER":"LETTRE D'OFFRE D'EMPLOI"}</div>
<div class="doc-classification">${e?"PRIVATE & CONFIDENTIAL":"PRIVÉ ET CONFIDENTIEL"}</div>

<p>${e?"Dear":"Cher(ère)"} ${v("candidateName")},</p>

<p>${e?`On behalf of <strong>${v("companyName")}</strong>, I am pleased to extend this formal offer of employment. We were impressed by your qualifications and experience, and we believe you will make a valuable contribution to our organization. This letter sets out the principal terms and conditions of your employment with us.`:`Au nom de <strong>${v("companyName")}</strong>, j'ai le plaisir de vous présenter cette offre d'emploi formelle. Nous avons été impressionnés par vos qualifications et votre expérience, et nous croyons que vous apporterez une contribution précieuse à notre organisation. Cette lettre établit les conditions principales de votre emploi.`}</p>

<h2>1. ${e?"POSITION AND REPORTING STRUCTURE":"POSTE ET STRUCTURE HIÉRARCHIQUE"}</h2>

<p>${e?`You are being offered the position of <strong>${v("jobTitle")}</strong> in the <strong>${v("department")}</strong> department on a <strong>${ov("employmentType")}</strong> basis. Your anticipated start date is <strong>${v("startDate")}</strong>. In this role, you will report directly to <strong>${v("managerName")}</strong>, <strong>${v("managerTitle")}</strong>.`:`Le poste offert est celui de <strong>${v("jobTitle")}</strong> au département de <strong>${v("department")}</strong>, sur une base de <strong>${ov("employmentType")}</strong>. Votre date de début prévue est le <strong>${v("startDate")}</strong>. Vous relèverez directement de <strong>${v("managerName")}</strong>, <strong>${v("managerTitle")}</strong>.`}</p>

<p>${e?`Your standard work schedule will consist of <strong>${v("hoursPerWeek")} hours per week</strong>. Hours worked beyond the standard overtime threshold of <strong>${act.ot} hours per week</strong>, as established under the ${esaRef}, will be compensated in accordance with the applicable overtime provisions of that Act.`:`Votre horaire standard sera de <strong>${v("hoursPerWeek")} heures par semaine</strong>. Les heures travaillées au-delà du seuil de <strong>${act.ot} heures par semaine</strong>, tel qu'établi par ${esaRef}, seront rémunérées selon les dispositions applicables en matière d'heures supplémentaires.`}</p>

<h2>2. ${e?"COMPENSATION AND PAYROLL":"RÉMUNÉRATION ET PAIE"}</h2>

<p>${e?`Your base annual salary will be <strong>$${v("salary")} CAD</strong>, payable <strong>${ov("payFrequency").toLowerCase()}</strong> by direct deposit to your designated bank account. This salary is subject to all statutory deductions required under federal and ${provName} legislation, including federal and provincial income tax, Canada Pension Plan contributions (or Quebec Pension Plan contributions, if applicable), and Employment Insurance premiums, as administered by the Canada Revenue Agency.`:`Votre salaire annuel de base sera de <strong>${v("salary")} $ CAD</strong>, payable <strong>${ov("payFrequency").toLowerCase()}</strong> par dépôt direct. Ce salaire est assujetti à toutes les retenues statutaires, y compris l'impôt fédéral et provincial, les cotisations au Régime de pensions du Canada (ou au Régime de rentes du Québec, le cas échéant) et les primes d'assurance-emploi.`}</p>

<p>${e?"Your compensation will be reviewed periodically in accordance with the Company's compensation review cycle. Any adjustments to salary are at the sole discretion of the Company and are not guaranteed.":"Votre rémunération sera révisée périodiquement selon le cycle de révision salariale de l'entreprise. Tout ajustement est à la discrétion de l'entreprise."}</p>

<h2>3. ${e?"VACATION AND LEAVE ENTITLEMENTS":"VACANCES ET DROITS AUX CONGÉS"}</h2>

<p>${e?`You will be entitled to <strong>${v("vacationWeeks")} weeks</strong> of paid vacation per calendar year, to be scheduled in accordance with Company policy and operational requirements. Vacation pay will be calculated and administered in compliance with the ${esaRef}, which provides for a statutory minimum entitlement of ${act.vac}.`:`Vous aurez droit à <strong>${v("vacationWeeks")} semaines</strong> de vacances payées par année, planifiées selon la politique de l'entreprise. La paie de vacances sera calculée conformément à ${esaRef}, qui prévoit un minimum statutaire de ${act.vac}.`}</p>

<p>${e?`In addition to vacation, you will be entitled to all statutory holidays and leaves of absence provided under the ${esaRef}, including but not limited to bereavement leave, family responsibility leave, and any other protected leaves established by ${provName} legislation.`:`En plus des vacances, vous aurez droit à tous les jours fériés et congés prévus par ${esaRef}, y compris les congés de deuil, de responsabilité familiale et tout autre congé protégé par la législation de ${provName}.`}</p>

${vr("benefits")?`<h2>4. ${e?"BENEFITS AND PERQUISITES":"AVANTAGES SOCIAUX"}</h2><p>${e?"The Company offers the following benefits program, subject to the terms and conditions of the applicable plan documents and carrier policies:":"L'entreprise offre le programme d'avantages suivant, selon les conditions des polices applicables :"}</p><div class="doc-quote">${v("benefits")}</div><p>${e?"Eligibility for benefits is subject to any applicable waiting periods specified in the plan documents. The Company reserves the right to amend, modify, or discontinue any benefit plan at its discretion, provided that statutory minimum entitlements under the "+esaRef+" are maintained.":"L'admissibilité est assujettie aux périodes d'attente. L'entreprise se réserve le droit de modifier tout régime, sous réserve des minimums de "+esaRef+"."}</p>`:""}

<h2>${vr("benefits")?"5":"4"}. ${e?"PROBATIONARY PERIOD":"PÉRIODE DE PROBATION"}</h2>

<p>${e?`Your employment will be subject to a probationary period of <strong>${v("probationMonths")} months</strong> commencing on your start date. During this period, your performance, conduct, attendance, and overall suitability for the position will be evaluated. The Company reserves the right to extend the probationary period where additional assessment time is required, provided such extension is communicated in writing.`:`Votre emploi sera assujetti à une période de probation de <strong>${v("probationMonths")} mois</strong>. Pendant cette période, votre rendement, votre conduite, votre assiduité et votre aptitude seront évalués. L'entreprise se réserve le droit de prolonger cette période par écrit.`}</p>

<p>${e?`During or at the conclusion of the probationary period, either party may terminate the employment relationship by providing the minimum notice required under the ${esaRef}. In ${provName}, the statutory probation reference is: <strong>${act.prob}</strong>. Termination during probation does not relieve the employer of its obligations regarding minimum notice or payment in lieu under the Act.`:`Pendant ou à la fin de la probation, l'une ou l'autre des parties peut mettre fin à l'emploi avec le préavis minimum requis par ${esaRef}. Le cadre de probation en ${provName} est : <strong>${act.prob}</strong>.`}</p>

<h2>${vr("benefits")?"6":"5"}. ${e?"CONDITIONS PRECEDENT":"CONDITIONS PRÉALABLES"}</h2>

<p>${e?"This offer of employment is conditional upon the satisfactory completion of the following:":"Cette offre d'emploi est conditionnelle à la réalisation satisfaisante des éléments suivants :"}</p>
<ul>
<li>${e?"Verification of your legal entitlement to work in Canada, as required under the <em>Immigration and Refugee Protection Act</em> (S.C. 2001, c. 27)":"Vérification de votre droit légal de travailler au Canada, tel que requis par la <em>Loi sur l'immigration et la protection des réfugiés</em> (L.C. 2001, ch. 27)"}</li>
<li>${e?"Satisfactory completion of professional reference checks":"Vérifications de références professionnelles satisfaisantes"}</li>
<li>${e?"Execution of all required Company agreements, which may include confidentiality, non-solicitation, and intellectual property assignment agreements":"Signature de toutes les ententes requises, pouvant inclure la confidentialité, la non-sollicitation et la cession de propriété intellectuelle"}</li>
<li>${e?"Provision of all required onboarding documentation, including banking information for payroll purposes and a completed TD1 (federal) and provincial personal tax credit return":"Fourniture de tous les documents d'intégration, y compris les informations bancaires et les formulaires TD1 fédéral et provincial"}</li>
</ul>

<h2>${vr("benefits")?"7":"6"}. ${e?"TERMINATION OF EMPLOYMENT":"CESSATION D'EMPLOI"}</h2>

<p>${e?`Following the probationary period, either party may terminate the employment relationship by providing written notice in accordance with the minimum requirements of the ${esaRef}, or payment in lieu of notice, or a combination thereof. The Company reserves the right to terminate your employment at any time for just cause without notice or payment in lieu, as permitted under common law principles and the ${esaRef}.`:`Après la probation, l'une ou l'autre des parties peut mettre fin à l'emploi en fournissant un préavis écrit conforme aux exigences minimales de ${esaRef}, ou une indemnité tenant lieu de préavis. L'entreprise se réserve le droit de mettre fin pour motif valable sans préavis.`}</p>

<p>${e?`Nothing in this agreement limits any entitlements you may have to notice of termination, severance pay, or other benefits under the ${esaRef} or at common law. In the event of any conflict between this letter and the Act, the statutory minimums shall prevail.`:`Rien dans cette entente ne limite vos droits à un préavis, une indemnité de départ ou d'autres avantages en vertu de ${esaRef} ou du droit commun.`}</p>

<h2>${vr("benefits")?"8":"7"}. ${e?"WORKPLACE HEALTH AND SAFETY":"SANTÉ ET SÉCURITÉ AU TRAVAIL"}</h2>

<p>${e?`As an employee, you are entitled to the protections afforded under the ${ohsRef}, including the right to know about hazards in the workplace, the right to participate in health and safety activities, and the right to refuse unsafe work. You will receive health and safety orientation during your onboarding.`:`En tant qu'employé(e), vous bénéficiez des protections prévues par ${ohsRef}, y compris le droit de connaître les dangers, le droit de participer aux activités de santé et sécurité, et le droit de refuser un travail dangereux.`}</p>

<h2>${vr("benefits")?"9":"8"}. ${e?"HUMAN RIGHTS AND ACCOMMODATION":"DROITS DE LA PERSONNE ET ADAPTATION"}</h2>

<p>${e?`${v("companyName")} is committed to providing a workplace free from discrimination and harassment as required under the ${hrRef}. If you require accommodation based on a protected ground at any point during your employment, you are encouraged to notify your manager or HR, and the Company will engage in the accommodation process in accordance with its legal obligations.`:`${v("companyName")} s'engage à offrir un milieu exempt de discrimination et de harcèlement tel que requis par ${hrRef}. Si vous avez besoin d'adaptation, veuillez aviser votre gestionnaire ou les RH.`}</p>

<h2>${vr("benefits")?"10":"9"}. ${e?"GOVERNING LAW AND ENTIRE AGREEMENT":"LOI APPLICABLE ET INTÉGRALITÉ DE L'ENTENTE"}</h2>

<p>${e?`This agreement and your employment are governed by the laws of ${provName} and the applicable federal laws of Canada. This letter, together with any documents referenced herein, constitutes the entire agreement between you and ${v("companyName")} regarding the terms of your employment and supersedes all prior discussions, negotiations, and agreements. Any amendments to this agreement must be made in writing and signed by both parties.`:`Cette entente est régie par les lois de ${provName} et les lois fédérales applicables. Cette lettre constitue l'intégralité de l'entente entre vous et ${v("companyName")} et remplace toutes les discussions antérieures.`}</p>

<h2>${vr("benefits")?"11":"10"}. ${e?"ACCEPTANCE":"ACCEPTATION"}</h2>

<p>${e?`This offer remains open for acceptance for <strong>${v("deadlineDays")} calendar days</strong> from the date of this letter. To accept, please sign and date both copies of this letter, retain one for your personal records, and return the other to the undersigned. If we do not receive your signed acceptance within the stated period, this offer shall be deemed to have been withdrawn.`:`Cette offre est valide pour <strong>${v("deadlineDays")} jours civils</strong>. Pour accepter, signez les deux copies, conservez-en une et retournez l'autre. Sans réponse dans le délai, l'offre sera considérée retirée.`}</p>

<p>${e?"We are excited about the prospect of you joining our team and look forward to your positive response.":"Nous sommes enthousiastes à l'idée de vous accueillir et attendons votre réponse."}</p>

<p>${e?"Sincerely":"Cordialement"},</p>
${sig(v("managerName"), v("managerTitle"))}
<p class="doc-small">${e?"For and on behalf of":"Pour et au nom de"} ${v("companyName")}</p>

${hr}
<div class="doc-type" style="font-size:13px">${e?"ACCEPTANCE BY CANDIDATE":"ACCEPTATION DU CANDIDAT"}</div>
<p>${e?`I, <strong>${v("candidateName")}</strong>, have read, understood, and agree to accept this offer of employment under the terms and conditions set out above. I confirm that I have had the opportunity to seek independent legal or other professional advice prior to signing this agreement, and that I am signing this document voluntarily.`:`Je, <strong>${v("candidateName")}</strong>, ai lu, compris et accepte cette offre d'emploi selon les conditions ci-dessus. Je confirme avoir eu la possibilité d'obtenir un avis indépendant.`}</p>
${sig(v("candidateName"),"")}
<div class="sig-date">${e?"Date":"Date"}: _______________________________</div>`;
    },

    termination: () => { const isCause = or("terminationType")==="With cause"; const nc = noticeCalc; return `${hdr()}${meta()}
<div class="doc-type">${e?"NOTICE OF TERMINATION OF EMPLOYMENT":"AVIS DE CESSATION D'EMPLOI"} — ${ov("terminationType").toUpperCase()}</div>
<div class="doc-classification">${e?"STRICTLY PRIVATE & CONFIDENTIAL":"STRICTEMENT PRIVÉ ET CONFIDENTIEL"}</div>

<p>${e?"Dear":"Cher(ère)"} ${v("employeeName")},</p>

<p><strong>${e?"Re: Termination of Your Employment":"Objet : Cessation de votre emploi"}</strong></p>

<p>${e?`This letter serves as formal notification that your employment with <strong>${v("companyName")}</strong> in the position of <strong>${v("jobTitle")}</strong> is terminated effective <strong>${v("lastDay")}</strong>. You were originally hired on <strong>${v("hireDate")}</strong> and have completed <strong>${v("yearsService")} year(s)</strong> of continuous service with the Company.`:`La présente constitue un avis formel que votre emploi auprès de <strong>${v("companyName")}</strong> au poste de <strong>${v("jobTitle")}</strong> prend fin à compter du <strong>${v("lastDay")}</strong>. Vous avez été embauché(e) le <strong>${v("hireDate")}</strong> et avez complété <strong>${v("yearsService")} année(s)</strong> de service continu.`}</p>

${isCause ? `
<h2>${e?"GROUNDS FOR TERMINATION":"MOTIFS DE CESSATION"}</h2>

<p>${e?`After thorough review and investigation, the Company has determined that your employment is being terminated for just cause based on the following conduct or performance deficiencies:`:`Après un examen approfondi, l'entreprise a déterminé que votre emploi prend fin pour motif valable en raison de ce qui suit :`}</p>

<div class="doc-quote">${v("causeDetails")}</div>

<p>${e?`As this termination is for just cause as recognized under common law and the ${esaRef}, you are not entitled to notice of termination or payment in lieu of notice beyond what may be required as a statutory minimum under the Act. The Company's position is that the conduct described above constitutes just cause sufficient to disentitle you to reasonable notice at common law.`:`Puisque cette cessation est pour motif valable tel que reconnu en droit commun et par ${esaRef}, vous n'avez pas droit à un préavis ou à une indemnité au-delà des minimums statutaires.`}</p>
` : `
<h2>${e?"NOTICE AND SEVERANCE ENTITLEMENTS":"PRÉAVIS ET INDEMNITÉ DE DÉPART"}</h2>

<p>${e?`This termination is without cause. In accordance with the ${esaRef} and in recognition of your <strong>${v("yearsService")} year(s)</strong> of continuous service, the Company is providing the following entitlements:`:`Cette cessation est sans motif. Conformément à ${esaRef} et en reconnaissance de vos <strong>${v("yearsService")} année(s)</strong> de service continu, l'entreprise vous offre ce qui suit :`}</p>

<p>${e?`<strong>Notice Period:</strong> You are being provided with <strong>${v("noticePeriod")} week(s)</strong> of working notice, pay in lieu of notice, or a combination thereof.`:`<strong>Préavis :</strong> Vous recevrez <strong>${v("noticePeriod")} semaine(s)</strong> de préavis travaillé, d'indemnité tenant lieu de préavis, ou d'une combinaison des deux.`}</p>

${vr("severanceWeeks") ? `<p>${e?`<strong>Severance Pay:</strong> In addition to the notice entitlement above, you will receive <strong>${v("severanceWeeks")} week(s)</strong> of base salary as severance pay.`:`<strong>Indemnité de départ :</strong> En plus du préavis, vous recevrez <strong>${v("severanceWeeks")} semaine(s)</strong> de salaire de base à titre d'indemnité de départ.`}</p>` : ""}

${vr("continuationBenefits") ? `<p>${e?`<strong>Benefits Continuation:</strong> Your group benefits coverage will continue for <strong>${v("continuationBenefits")}</strong> following your last day of active employment, subject to the terms of the applicable benefit plans and carrier requirements.`:`<strong>Continuation des avantages :</strong> Vos avantages collectifs seront maintenus pendant <strong>${v("continuationBenefits")}</strong> suivant votre dernier jour.`}</p>` : ""}

${nc ? `<div class="doc-quote"><p>${e?`<strong>Statutory Minimum Reference:</strong> Under the ${esaRef}, the minimum notice entitlement for an employee with <strong>${v("yearsService")} year(s)</strong> of continuous service is <strong>${nc.noticeWeeks} week(s)</strong>.`:`<strong>Référence statutaire :</strong> En vertu de ${esaRef}, le préavis minimum pour <strong>${v("yearsService")} année(s)</strong> de service est de <strong>${nc.noticeWeeks} semaine(s)</strong>.`}${nc.severanceWeeks > 0 ? (e?` Statutory severance entitlement: <strong>${nc.severanceWeeks} week(s)</strong> of pay.`:` Indemnité statutaire : <strong>${nc.severanceWeeks} semaine(s)</strong> de salaire.`) : ""}${nc.sevNote[lang] ? ` ${nc.sevNote[lang]}` : ""}</p></div>` : ""}

<p class="doc-note">${e?"All payments described above are subject to applicable statutory deductions, including federal and provincial income tax, CPP/QPP contributions, and EI premiums. Severance payments, where applicable, are contingent upon your execution of a full and final release of all claims against the Company, its officers, directors, and agents.":"Tous les paiements sont assujettis aux retenues statutaires. Les indemnités de départ, le cas échéant, sont conditionnelles à la signature d'une quittance complète et définitive."}</p>
`}

<h2>${e?"FINAL PAY AND ENTITLEMENTS":"PAIE FINALE ET DROITS"}</h2>

<p>${e?`Your final pay will include all earned and unpaid wages through your last day of employment, plus any accrued and outstanding vacation pay calculated in accordance with the ${esaRef}, which provides for a minimum of ${act.vac}. Your final pay will be processed on the next regularly scheduled pay date following your termination date, or within the timeframe prescribed by the ${esaRef}, whichever is earlier.`:`Votre paie finale comprendra tous les salaires gagnés jusqu'à votre dernier jour, plus la paie de vacances accumulée calculée conformément à ${esaRef}, qui prévoit un minimum de ${act.vac}. La paie sera traitée à la prochaine date de paie.`}</p>

<h2>${e?"RECORD OF EMPLOYMENT":"RELEVÉ D'EMPLOI"}</h2>

<p>${e?`A Record of Employment (ROE) will be issued electronically to Service Canada within five (5) calendar days of your last day of employment, as required under the <em>Employment Insurance Regulations</em> (SOR/96-332, s. 19). You may access your ROE through your My Service Canada Account (MSCA) online portal. If you wish to apply for Employment Insurance benefits, you should do so as soon as possible after your last day of work, as there may be a waiting period before benefits commence.`:`Un relevé d'emploi (RE) sera émis électroniquement à Service Canada dans les cinq (5) jours civils, tel que requis par le <em>Règlement sur l'assurance-emploi</em> (DORS/96-332, art. 19). Vous pouvez y accéder via Mon dossier Service Canada.`}</p>

<h2>${e?"RETURN OF COMPANY PROPERTY":"RETOUR DES BIENS DE L'ENTREPRISE"}</h2>

<p>${e?"You are required to return all Company property in your possession on or before your last day of employment. This includes, but is not limited to:":"Vous devez retourner tous les biens de l'entreprise au plus tard à votre dernier jour, y compris :"}</p>

<div class="doc-quote">${v("returnItems")}</div>

<p>${e?"Failure to return Company property may result in the Company pursuing recovery through available legal remedies. This does not authorize the Company to withhold wages owing to you, as wage deductions are governed by the "+esaRef+".":"Le défaut de retourner les biens peut entraîner des recours légaux. Ceci n'autorise pas l'entreprise à retenir les salaires dus."}</p>

<h2>${e?"CONTINUING OBLIGATIONS":"OBLIGATIONS CONTINUES"}</h2>

<p>${e?`You are reminded that any obligations regarding confidentiality, non-solicitation of clients or employees, non-competition, and intellectual property assignment that are contained in your employment agreement, offer letter, or any ancillary agreements you have signed remain in full force and effect following the termination of your employment, in accordance with their terms.`:`Les obligations de confidentialité, de non-sollicitation, de non-concurrence et de cession de propriété intellectuelle contenues dans vos ententes restent en vigueur après la cessation de votre emploi.`}</p>

<h2>${e?"YOUR RIGHTS":"VOS DROITS"}</h2>

<p>${e?`This letter is provided in accordance with the ${esaRef}. Nothing in this letter is intended to limit any minimum entitlements you may have under the Act or any other applicable legislation, including the ${hrRef}. You are strongly encouraged to seek independent legal advice regarding your rights and entitlements arising from the termination of your employment, including any potential entitlements at common law that may exceed the statutory minimums referenced in this letter.`:`Cette lettre est fournie conformément à ${esaRef}. Rien dans cette lettre ne vise à limiter vos droits minimaux. Nous vous encourageons fortement à consulter un avocat indépendant.`}</p>

<p>${e?"Sincerely":"Cordialement"},</p>
${sig(v("signerName"), v("signerTitle"))}
<p class="doc-small">${e?"For and on behalf of":"Pour et au nom de"} ${v("companyName")}</p>

${ack(v("employeeName"))}
<div class="sig-date">${e?"Witness":"Témoin"}: _______________________________</div>`; },

    warning: () => `${hdr()}${meta()}
<div class="doc-type">${ov("warningLevel").toUpperCase()}</div>
<div class="doc-classification">${e?"CONFIDENTIAL — EMPLOYEE FILE":"CONFIDENTIEL — DOSSIER DE L'EMPLOYÉ"}</div>

<p>${e?`<strong>Employee:</strong> ${v("employeeName")} | <strong>Position:</strong> ${v("jobTitle")}, ${v("department")} Department | <strong>Date Issued:</strong> ${v("issueDate")}`:`<strong>Employé(e) :</strong> ${v("employeeName")} | <strong>Poste :</strong> ${v("jobTitle")}, département ${v("department")} | <strong>Date :</strong> ${v("issueDate")}`}</p>

<p>${e?`This document constitutes a <strong>${ov("warningLevel").toLowerCase()}</strong> issued pursuant to the Company's progressive discipline policy. The purpose of this warning is to formally document the performance or conduct concern identified below, outline the required corrective actions, and advise you of the potential consequences if improvement is not demonstrated.`:`Ce document constitue un <strong>${ov("warningLevel").toLowerCase()}</strong> émis en vertu de la politique de mesures disciplinaires progressives de l'entreprise.`}</p>

<h2>${e?"DESCRIPTION OF THE CONCERN":"DESCRIPTION DU PROBLÈME"}</h2>

<p>${e?"<strong>Date(s) of incident(s):</strong>":"<strong>Date(s) de l'incident :</strong>"} ${v("incidentDates")}</p>
<p>${e?"<strong>Company policy or performance standard in question:</strong>":"<strong>Politique ou norme enfreinte :</strong>"} ${v("policyViolated")}</p>
<p>${e?"The specific conduct or performance concern is as follows:":"Le problème de conduite ou de rendement est décrit ci-dessous :"}</p>
<div class="doc-quote">${v("issueDescription")}</div>

<h2>${e?"HISTORY OF PRIOR CORRECTIVE ACTIONS":"HISTORIQUE DES MESURES CORRECTIVES"}</h2>
<p>${e?"The following corrective steps have been taken prior to this warning:":"Les mesures correctives suivantes ont été prises avant cet avertissement :"}</p>
<div class="doc-quote">${v("previousActions")}</div>

<h2>${e?"CORRECTIVE ACTION PLAN AND EXPECTATIONS":"PLAN CORRECTIF ET ATTENTES"}</h2>
<p>${e?"To address this concern, you are required to:":"Pour corriger cette situation, vous devez :"}</p>
<div class="doc-quote">${v("expectedImprovement")}</div>

<h2>${e?"SUPPORT AND RESOURCES":"SOUTIEN ET RESSOURCES"}</h2>
<p>${e?"The Company will provide the following support to assist you in meeting the expectations outlined above:":"L'entreprise fournira le soutien suivant :"}</p>
<div class="doc-quote">${v("supportProvided")}</div>

<h2>${e?"REVIEW TIMELINE":"ÉCHÉANCIER DE RÉVISION"}</h2>
<p>${e?`Your performance regarding this matter will be formally reviewed on <strong>${v("reviewDate")}</strong>. You are expected to demonstrate sustained, measurable improvement by that date. Additional check-ins may be scheduled between now and the review date to monitor your progress.`:`Votre rendement sera formellement révisé le <strong>${v("reviewDate")}</strong>. Une amélioration soutenue et mesurable est attendue. Des suivis additionnels pourront être planifiés.`}</p>

<h2>${e?"CONSEQUENCES OF NON-IMPROVEMENT":"CONSÉQUENCES EN CAS DE NON-AMÉLIORATION"}</h2>
<div class="doc-quote">${v("consequences")}</div>

<h2>${e?"YOUR RIGHTS":"VOS DROITS"}</h2>
<p>${e?`You have the right to provide a written response to this warning within five (5) business days of receipt. Your written response will be attached to this document and placed in your employee file. This warning is issued under the Company's internal discipline procedures and does not affect any rights you may have under the ${esaRef} or the ${hrRef}. You may also wish to consult with a union representative (if applicable) or seek independent advice.`:`Vous avez le droit de répondre par écrit dans les cinq (5) jours ouvrables. Votre réponse sera jointe à votre dossier. Cet avertissement n'affecte pas vos droits en vertu de ${esaRef} ou de ${hrRef}.`}</p>

${sig(v("managerName"),"")}
${ack(v("employeeName"))}
<div class="sig-date">${e?"Witness":"Témoin"}: _______________________________</div>`,

    probation: () => { const pass=or("probationType")==="Successfully completed"; return `${hdr()}${meta()}
<div class="doc-type">${e?"PROBATIONARY PERIOD":"PÉRIODE DE PROBATION"} — ${ov("probationType").toUpperCase()}</div>

<p>${e?"Dear":"Cher(ère)"} ${v("employeeName")},</p>
<p><strong>${e?"Re:":"Objet :"}</strong> ${v("jobTitle")} — ${e?"Probationary Period Review":"Révision de la période de probation"}</p>

<p>${e?`This letter is with reference to your probationary period for the position of <strong>${v("jobTitle")}</strong> at <strong>${v("companyName")}</strong>. You commenced employment on <strong>${v("hireDate")}</strong>, and your probationary period was originally scheduled to conclude on <strong>${v("originalEnd")}</strong>.`:`La présente concerne votre période de probation au poste de <strong>${v("jobTitle")}</strong>. Votre emploi a débuté le <strong>${v("hireDate")}</strong> et la probation devait se terminer le <strong>${v("originalEnd")}</strong>.`}</p>

${pass ? `
<h2>${e?"SUCCESSFUL COMPLETION":"PROBATION COMPLÉTÉE AVEC SUCCÈS"}</h2>
<p>${e?`We are pleased to confirm that you have <strong>successfully completed</strong> your probationary period. Following a thorough assessment of your performance, conduct, and suitability for the role, the Company is satisfied that you have met the expectations for this position. Effective immediately, your employment status is confirmed as a regular employee of ${v("companyName")}.`:`Nous avons le plaisir de confirmer que vous avez <strong>complété avec succès</strong> votre période de probation. Votre statut d'employé(e) régulier(ère) est confirmé.`}</p>
<p>${e?`All terms and conditions of your employment as outlined in your original offer letter remain in effect. Your entitlements under the ${esaRef}, including notice of termination and vacation provisions, will now accrue based on your original date of hire. Congratulations on this milestone, and we look forward to your continued contributions to the organization.`:`Toutes les conditions de votre emploi restent en vigueur. Vos droits en vertu de ${esaRef} s'accumulent depuis votre date d'embauche. Félicitations.`}</p>
` : `
<h2>${e?"EXTENSION OF PROBATIONARY PERIOD":"PROLONGATION DE LA PROBATION"}</h2>
<p>${e?`After careful review of your performance during the initial probationary period, the Company has determined that additional time is required to fully assess your suitability for the role. Accordingly, your probationary period is being <strong>extended to ${v("newEnd")}</strong>.`:`Après examen de votre rendement, l'entreprise a déterminé qu'un délai supplémentaire est nécessaire. Votre probation est <strong>prolongée au ${v("newEnd")}</strong>.`}</p>

<h2>${e?"REASON FOR EXTENSION":"RAISON DE LA PROLONGATION"}</h2>
<div class="doc-quote">${v("extensionReason")}</div>

<h2>${e?"AREAS REQUIRING IMPROVEMENT":"POINTS À AMÉLIORER"}</h2>
<div class="doc-quote">${v("areasToImprove")}</div>

<p>${e?`During this extended period, your progress will be monitored closely, and a formal review will take place before the new end date. If the required improvement is not demonstrated by <strong>${v("newEnd")}</strong>, the Company may take further action, which could include additional extension, demotion, or termination of employment in accordance with the ${esaRef}. The statutory probation framework in ${provName} provides: <strong>${act.prob}</strong>.`:`Pendant cette prolongation, vos progrès seront suivis. Si l'amélioration requise n'est pas démontrée, l'entreprise pourra prendre d'autres mesures, incluant une prolongation additionnelle ou la cessation d'emploi conformément à ${esaRef}. Le cadre de probation en ${provName} : <strong>${act.prob}</strong>.`}</p>
`}
${sig(v("managerName"),"")}
${ack(v("employeeName"))}`; },

    returnleave: () => `${hdr()}${meta()}
<div class="doc-type">${e?"RETURN TO WORK CONFIRMATION":"CONFIRMATION DE RETOUR AU TRAVAIL"}</div>

<p>${e?"Dear":"Cher(ère)"} ${v("employeeName")},</p>

<p>${e?`We are writing to confirm the arrangements for your return to work following your <strong>${ov("leaveType").toLowerCase()}</strong> leave of absence. Your leave commenced on <strong>${v("leaveStart")}</strong>, and your scheduled return to work date is <strong>${v("returnDate")}</strong>.`:`Nous confirmons les modalités de votre retour au travail suite à votre congé de <strong>${ov("leaveType").toLowerCase()}</strong>. Votre congé a débuté le <strong>${v("leaveStart")}</strong> et votre retour est prévu le <strong>${v("returnDate")}</strong>.`}</p>

<h2>${e?"POSITION AND TERMS UPON RETURN":"POSTE ET CONDITIONS AU RETOUR"}</h2>

${or("sameRole").includes("Yes") ? `<p>${e?`In accordance with the ${esaRef}, you will return to your position as <strong>${v("jobTitle")}</strong> under the same terms and conditions of employment that were in effect immediately prior to the commencement of your leave. Your compensation, reporting structure, work location, and all other material terms of employment remain unchanged.`:`Conformément à ${esaRef}, vous reprendrez votre poste de <strong>${v("jobTitle")}</strong> aux mêmes conditions qu'avant votre congé.`}</p>` : `<p>${e?`As your previous position has undergone restructuring during your absence, you will be assigned to a comparable position as required by the ${esaRef}. Under the Act, the employer is obligated to reinstate an employee returning from a protected leave to the same position or, where that is not possible, to a comparable position with no reduction in wages or benefits. The details of your comparable position are as follows:`:`Votre poste ayant été restructuré, vous serez affecté(e) à un poste comparable tel que requis par ${esaRef}. Les détails :`}</p><div class="doc-quote">${v("newRole")}</div>`}

${vr("accommodations") ? `<h2>${e?"WORKPLACE ACCOMMODATIONS":"MESURES D'ADAPTATION"}</h2>
<p>${e?`In accordance with the Company's duty to accommodate under the ${hrRef}, the following accommodations will be provided to support your transition back to work:`:`Conformément à l'obligation d'adaptation en vertu de ${hrRef}, les mesures suivantes seront mises en place :`}</p>
<div class="doc-quote">${v("accommodations")}</div>
<p>${e?"These accommodations will be reviewed periodically to ensure they remain appropriate and effective. If your needs change at any time, please notify your manager or HR immediately.":"Ces mesures seront révisées périodiquement. Si vos besoins changent, avisez votre gestionnaire ou les RH."}</p>` : ""}

<h2>${e?"YOUR RIGHTS AND PROTECTIONS":"VOS DROITS ET PROTECTIONS"}</h2>

<p>${e?`Under the ${esaRef}, employees returning from a statutory leave of absence are entitled to be reinstated to their former position or a comparable one, with no loss of seniority or service credits. Your pension contributions, benefit plan accruals, and seniority continue to accumulate as if you had been actively employed throughout the duration of your leave. The Company is prohibited from penalizing, disciplining, or terminating an employee for exercising their right to a protected leave of absence.`:`En vertu de ${esaRef}, les employé(e)s de retour d'un congé statutaire ont le droit d'être réintégré(e)s au même poste ou à un poste comparable, sans perte d'ancienneté. Vos cotisations de retraite et d'avantages continuent de s'accumuler.`}</p>

<p>${e?"For any questions prior to your return, please contact":"Pour toute question, veuillez contacter"}: <strong>${v("hrContact")}</strong></p>
<p>${e?"We look forward to welcoming you back to the team.":"Au plaisir de vous accueillir de nouveau."}</p>
${sig(v("hrContact"), v("companyName"))}`,

    policy: () => { const pt=or("policyType"); const scope=or("scope")==="All employees"?(e?"all employees, contractors, and volunteers":"tous les employés, entrepreneurs et bénévoles"):v("departments");
      if(pt.includes("Harassment")) return `${hdr()}${meta()}
<div class="doc-type">${e?"WORKPLACE HARASSMENT AND DISCRIMINATION PREVENTION POLICY":"POLITIQUE DE PRÉVENTION DU HARCÈLEMENT ET DE LA DISCRIMINATION"}</div>
<div class="doc-meta"><div>${e?"Effective":"En vigueur"}: <strong>${v("effectiveDate")}</strong></div><div>${e?"Next Review":"Prochaine révision"}: <strong>${v("reviewDate")}</strong></div></div>${hr}

<h2>1. ${e?"PURPOSE AND LEGISLATIVE FRAMEWORK":"OBJET ET CADRE LÉGISLATIF"}</h2>
<p>${e?`<strong>${v("companyName")}</strong> is committed to providing a work environment in which every individual is treated with dignity and respect, and which is free from all forms of harassment and discrimination. This policy reflects the Company's obligations under the ${hrRef}, the ${esaRef}, and the ${ohsRef}, as well as any other applicable federal, provincial, or territorial legislation.`:`<strong>${v("companyName")}</strong> s'engage à offrir un milieu de travail où chaque personne est traitée avec dignité et respect, exempt de harcèlement et de discrimination, conformément à ${hrRef}, ${esaRef} et ${ohsRef}.`}</p>

<h2>2. ${e?"SCOPE AND APPLICATION":"PORTÉE ET APPLICATION"}</h2>
<p>${e?`This policy applies to ${scope}. It governs conduct that occurs in the workplace, at work-related events and functions, during business travel, and through any work-related communications, including electronic communications such as email, messaging platforms, and social media when used in a work context.`:`Cette politique s'applique à ${scope}. Elle couvre la conduite au lieu de travail, lors d'événements liés au travail, en déplacement et dans les communications électroniques.`}</p>

<h2>3. ${e?"DEFINITIONS":"DÉFINITIONS"}</h2>
<p>${e?`<strong>Workplace Harassment</strong> means engaging in a course of vexatious comment or conduct against a worker in a workplace that is known or ought reasonably to be known to be unwelcome. This includes, but is not limited to: verbal abuse or threats; unwelcome remarks, jokes, innuendos, or taunts about a person's body, attire, age, marital status, or other protected characteristics; display of pornographic, racist, or otherwise offensive material; intimidation, bullying, or coercion; unwelcome physical contact; and sexual harassment.`:`<strong>Harcèlement</strong> signifie une conduite vexatoire qui est reconnue ou devrait raisonnablement être reconnue comme non sollicitée.`}</p>
<p>${e?`<strong>Discrimination</strong> means unequal or differential treatment of an individual based on a ground protected under the ${hrRef}, including but not limited to race, colour, ancestry, place of origin, ethnic origin, citizenship, creed/religion, sex (including pregnancy), sexual orientation, gender identity, gender expression, age, disability, marital status, family status, and record of offences (where pardoned).`:`<strong>Discrimination</strong> signifie un traitement inégal fondé sur un motif protégé par ${hrRef}.`}</p>

<h2>4. ${e?"RESPONSIBILITIES":"RESPONSABILITÉS"}</h2>
<p>${e?`<strong>All employees</strong> are responsible for treating every individual with respect, refraining from any form of harassment or discrimination, reporting incidents they witness or experience, cooperating fully in any investigation, and maintaining confidentiality.`:`<strong>Tous les employés</strong> doivent traiter chacun avec respect, signaler les incidents, coopérer aux enquêtes et maintenir la confidentialité.`}</p>
<p>${e?`<strong>Managers and supervisors</strong> are responsible for modeling respectful behavior, addressing complaints and concerns immediately and thoroughly, ensuring all employees under their supervision are aware of this policy, documenting and escalating concerns as appropriate, and taking corrective action where warranted.`:`<strong>Les gestionnaires</strong> doivent donner l'exemple, traiter les plaintes immédiatement et s'assurer que le personnel connaît cette politique.`}</p>

<h2>5. ${e?"COMPLAINT AND INVESTIGATION PROCEDURE":"PROCÉDURE DE PLAINTE ET D'ENQUÊTE"}</h2>
<ol>
<li>${e?"Any employee who believes they have been subjected to harassment or discrimination should report the matter to their direct supervisor, to Human Resources, or to any member of management they feel comfortable approaching.":"Signaler l'incident au superviseur, aux RH ou à tout gestionnaire."}</li>
<li>${e?"If the complaint involves the employee's direct supervisor, the complaint should be directed to the next level of management or to HR.":"Si la plainte concerne le superviseur, signaler au niveau supérieur."}</li>
<li>${e?"All complaints will be documented, acknowledged promptly, and investigated thoroughly, impartially, and as confidentially as reasonably possible. The scope and formality of the investigation will be proportionate to the nature and severity of the allegations.":"Toutes les plaintes seront documentées, examinées promptement et confidentiellement."}</li>
<li>${e?"Both the complainant and the respondent will be informed of the outcome of the investigation and any corrective measures to be taken.":"Les deux parties seront informées du résultat."}</li>
</ol>

<h2>6. ${e?"PROHIBITION OF RETALIATION":"INTERDICTION DE REPRÉSAILLES"}</h2>
<p>${e?`Retaliation against any individual who files a complaint in good faith, provides information during an investigation, or participates in any proceeding related to this policy is <strong>strictly prohibited</strong> and constitutes a separate and independent violation of this policy. Individuals who engage in retaliation will be subject to disciplinary action up to and including termination of employment.`:`Les représailles sont <strong>strictement interdites</strong> et constituent une violation distincte de cette politique.`}</p>

<h2>7. ${e?"CONSEQUENCES OF VIOLATION":"CONSÉQUENCES"}</h2>
<p>${e?"Violations of this policy will result in appropriate disciplinary action, which may include a verbal warning, written warning, suspension with or without pay, demotion, or termination of employment, depending on the nature, severity, and frequency of the conduct.":"Les violations entraîneront des mesures disciplinaires pouvant aller jusqu'au congédiement."}</p>

${hr}<p>${e?"Approved by":"Approuvé par"}: <strong>${v("approverName")}</strong> | ${today}</p>
${sig("","")}
<div class="sig-date">${e?"Employee Acknowledgment — Date":"Accusé de réception — Date"}: _______________________________</div>`;

      if(pt.includes("Attendance")) return `${hdr()}${meta()}
<div class="doc-type">${e?"ATTENDANCE AND PUNCTUALITY POLICY":"POLITIQUE D'ASSIDUITÉ ET DE PONCTUALITÉ"}</div>
<div class="doc-meta"><div>${e?"Effective":"En vigueur"}: <strong>${v("effectiveDate")}</strong></div></div>${hr}

<h2>1. ${e?"PURPOSE":"OBJET"}</h2>
<p>${e?`Regular and punctual attendance is essential to the efficient operations of <strong>${v("companyName")}</strong> and to the delivery of quality service to our clients and stakeholders. This policy establishes clear expectations and procedures regarding attendance, tardiness, and absences for ${scope}.`:`L'assiduité et la ponctualité sont essentielles aux opérations de <strong>${v("companyName")}</strong>. Cette politique établit les attentes pour ${scope}.`}</p>

<h2>2. ${e?"EXPECTATIONS":"ATTENTES"}</h2>
<p>${e?`All employees are expected to report to work on time as scheduled, be ready to begin work at the start of their shift, notify their supervisor as early as possible and no later than the start of their scheduled shift if they are unable to report to work, provide an estimated date of return when reporting an absence, and obtain prior approval for any planned time away from work. Leaving the workplace early without authorization from a supervisor will be treated as an unexcused absence.`:`Tous les employés doivent se présenter à l'heure, aviser leur superviseur en cas d'absence le plus tôt possible, et obtenir l'approbation préalable pour toute absence planifiée.`}</p>

<h2>3. ${e?"APPROVED AND PROTECTED ABSENCES":"ABSENCES AUTORISÉES ET PROTÉGÉES"}</h2>
<p>${e?`The following absences are approved and/or protected under the ${esaRef}: scheduled and approved vacation time; all statutory leaves of absence provided under the Act, including but not limited to pregnancy leave, parental leave, personal emergency leave, family responsibility leave, bereavement leave, and sick leave (where applicable); approved personal or sick days as per Company policy; jury duty and court appearances required by law; and religious observance accommodations provided in accordance with the ${hrRef}.`:`Les absences suivantes sont approuvées et/ou protégées par ${esaRef} : vacances, congés statutaires, jours de maladie approuvés, devoir de juré, et accommodements religieux.`}</p>

<h2>4. ${e?"MEDICAL DOCUMENTATION":"DOCUMENTATION MÉDICALE"}</h2>
<p>${e?`The Company may request a medical certificate or other supporting documentation for absences of three (3) or more consecutive scheduled working days, or where a pattern of absence is identified. Any request for medical documentation will be made in compliance with the ${hrRef} and applicable privacy legislation, and the Company will not request diagnosis-specific information unless it is necessary for accommodation purposes.`:`L'entreprise peut demander un certificat médical pour les absences de 3 jours ou plus, conformément à ${hrRef} et à la législation sur la protection de la vie privée.`}</p>

<h2>5. ${e?"PROGRESSIVE DISCIPLINE":"MESURES DISCIPLINAIRES PROGRESSIVES"}</h2>
<p>${e?"Unexcused absences and chronic tardiness will be addressed through the Company's progressive discipline process, which typically follows these steps: verbal counseling and documentation; first written warning; final written warning; and termination of employment. The severity of the disciplinary response may be adjusted based on the frequency, pattern, and impact of the attendance issue.":"Les absences non justifiées seront traitées par le processus de mesures disciplinaires progressives : avertissement verbal, premier avertissement écrit, dernier avertissement écrit, et cessation d'emploi."}</p>

${hr}<p>${e?"Approved by":"Approuvé par"}: <strong>${v("approverName")}</strong> | ${today}</p>${sig("","")}`;

      // Remote Work
      return `${hdr()}${meta()}
<div class="doc-type">${e?"REMOTE WORK AND TELEWORK POLICY":"POLITIQUE DE TÉLÉTRAVAIL"}</div>
<div class="doc-meta"><div>${e?"Effective":"En vigueur"}: <strong>${v("effectiveDate")}</strong></div></div>${hr}

<h2>1. ${e?"PURPOSE AND SCOPE":"OBJET ET PORTÉE"}</h2>
<p>${e?`This policy establishes the framework for remote work and telework arrangements at <strong>${v("companyName")}</strong>. It applies to ${scope}. Remote work is a privilege, not an entitlement, and is offered to balance operational needs with employee flexibility where the nature of the work permits.`:`Cette politique établit le cadre du télétravail chez <strong>${v("companyName")}</strong>. Elle s'applique à ${scope}. Le télétravail est un privilège, non un droit.`}</p>

<h2>2. ${e?"ELIGIBILITY":"ADMISSIBILITÉ"}</h2>
<p>${e?`Remote work arrangements are available to employees whose roles can be performed effectively outside the primary workplace, subject to written approval from their direct manager and HR. Eligibility is assessed based on job function requirements, individual performance history, operational and team collaboration needs, and the employee's ability to maintain a suitable and secure home workspace.`:`Le télétravail est offert aux employés dont les fonctions le permettent, sous réserve de l'approbation écrite du gestionnaire.`}</p>

<h2>3. ${e?"EXPECTATIONS AND OBLIGATIONS":"ATTENTES ET OBLIGATIONS"}</h2>
<p>${e?"Employees working remotely are expected to maintain regular working hours and be available during core business hours as established by their manager, attend all scheduled meetings whether in-person or virtual, maintain a dedicated safe and distraction-free workspace, respond to communications within reasonable timeframes consistent with in-office expectations, and comply with all Company policies as if working on-site, including but not limited to the Company's code of conduct, confidentiality policy, and IT security policy.":"Les employés en télétravail doivent maintenir les heures régulières, participer à toutes les réunions, maintenir un espace de travail sécuritaire, et respecter toutes les politiques de l'entreprise."}</p>

<h2>4. ${e?"EQUIPMENT, EXPENSES, AND TAX CONSIDERATIONS":"ÉQUIPEMENT, DÉPENSES ET CONSIDÉRATIONS FISCALES"}</h2>
<p>${e?`The Company will provide necessary work equipment, which typically includes a laptop and necessary software. The employee is responsible for maintaining reliable high-speed internet access and a suitable workspace. Reimbursement for home office expenses will be handled in accordance with Company policy and applicable CRA guidelines, including the T2200 Declaration of Conditions of Employment or the simplified flat-rate method, as applicable.`:`L'entreprise fournira l'équipement nécessaire. L'employé(e) est responsable de l'accès Internet et de l'espace de travail. Le remboursement des dépenses suivra les lignes directrices de l'ARC, y compris le T2200.`}</p>

<h2>5. ${e?"DATA SECURITY AND CONFIDENTIALITY":"SÉCURITÉ DES DONNÉES ET CONFIDENTIALITÉ"}</h2>
<p>${e?"Remote employees must comply with all IT security policies, including mandatory use of VPN when accessing company systems, use of secure and password-protected Wi-Fi networks, screen locking when away from the workstation, proper handling and storage of confidential information and documents, and prohibition of storing company data on personal devices without IT authorization. Breaches of data security may result in disciplinary action and may constitute grounds for termination.":"Les employés doivent respecter toutes les politiques de sécurité informatique, y compris l'utilisation du VPN, les réseaux Wi-Fi sécurisés, et le verrouillage d'écran."}</p>

<h2>6. ${e?"HEALTH AND SAFETY":"SANTÉ ET SÉCURITÉ"}</h2>
<p>${e?`The employer's health and safety obligations under the ${ohsRef} extend to the remote workspace. Employees must ensure their home workspace is free from hazards, report any workplace injury sustained while working remotely through the Company's standard incident reporting procedures, and cooperate with any reasonable requests from the Company to assess the safety of the remote workspace.`:`Les obligations de l'employeur en vertu de ${ohsRef} s'étendent au lieu de télétravail.`}</p>

<h2>7. ${e?"MODIFICATION AND TERMINATION OF ARRANGEMENT":"MODIFICATION ET RÉSILIATION"}</h2>
<p>${e?"Remote work arrangements may be modified, suspended, or terminated by the Company at any time with reasonable notice based on changes in business needs, performance concerns, position requirements, or organizational restructuring. Similarly, employees may request to return to fully on-site work at any time.":"Les ententes de télétravail peuvent être modifiées ou résiliées avec un préavis raisonnable."}</p>

${hr}<p>${e?"Approved by":"Approuvé par"}: <strong>${v("approverName")}</strong> | ${today}</p>${sig("","")}`;
    },

    roe: () => `${hdr()}${meta()}
<div class="doc-type">${e?"RECORD OF EMPLOYMENT — PREPARATION GUIDE AND CHECKLIST":"RELEVÉ D'EMPLOI — GUIDE DE PRÉPARATION ET LISTE DE VÉRIFICATION"}</div>
<div class="doc-classification">${e?"INTERNAL USE ONLY — PAYROLL AND HR":"USAGE INTERNE — PAIE ET RH"}</div>

<p>${e?`<strong>Employee:</strong> ${v("employeeName")} | <strong>SIN (last 4):</strong> ***-***-${v("sin_last4")} | <strong>Reason Code:</strong> ${ov("reasonCode")}`:`<strong>Employé(e) :</strong> ${v("employeeName")} | <strong>NAS (4 derniers) :</strong> ***-***-${v("sin_last4")} | <strong>Code :</strong> ${ov("reasonCode")}`}</p>
<p>${e?`<strong>Last Day Worked:</strong> ${v("lastDayWorked")} | <strong>Last Day Paid:</strong> ${v("lastDayPaid")} | <strong>Pay Period:</strong> ${ov("payPeriodType")} | <strong>Vacation Pay Owing:</strong> $${v("vacationPay")}`:`<strong>Dernier jour travaillé :</strong> ${v("lastDayWorked")} | <strong>Dernier jour payé :</strong> ${v("lastDayPaid")} | <strong>Période de paie :</strong> ${ov("payPeriodType")} | <strong>Vacances dues :</strong> ${v("vacationPay")} $`}</p>

<h2>${e?"FILING DEADLINE AND LEGAL REQUIREMENT":"DATE LIMITE ET OBLIGATION LÉGALE"}</h2>
<p>${e?`Under the <em>Employment Insurance Regulations</em> (SOR/96-332, s. 19(1)), employers are required to issue an ROE <strong>within five (5) calendar days</strong> of the employee's interruption of earnings, or within five (5) calendar days of becoming aware of the interruption, whichever is later. Failure to file an ROE on time may result in penalties under the <em>Employment Insurance Act</em> (S.C. 1996, c. 23) and can delay the employee's access to EI benefits. ROEs must be filed electronically through Service Canada's ROE Web system or through your payroll provider's integrated filing service.`:`En vertu du <em>Règlement sur l'assurance-emploi</em> (DORS/96-332, art. 19(1)), les employeurs doivent émettre un RE <strong>dans les 5 jours civils</strong> suivant l'interruption de rémunération.`}</p>

<h2>${e?"INSURABLE EARNINGS CHECKLIST — BLOCK 15":"RÉMUNÉRATION ASSURABLE — CASE 15"}</h2>
<ul>
<li>☐ ${e?"Regular wages and salary for all applicable pay periods":"Salaire régulier pour toutes les périodes applicables"}</li>
<li>☐ ${e?"Vacation pay — include in the pay period in which it was paid, not when it was earned":"Paie de vacances — inclure dans la période où elle a été payée"}</li>
<li>☐ ${e?"Statutory holiday pay":"Paie de jours fériés"}</li>
<li>☐ ${e?"Overtime pay":"Heures supplémentaires"}</li>
<li>☐ ${e?"Commissions (if applicable)":"Commissions (si applicable)"}</li>
<li>☐ ${e?"Retroactive pay increases (if applicable)":"Augmentations rétroactives (si applicable)"}</li>
<li>☐ ${e?"Taxable benefits and allowances (if applicable)":"Avantages imposables (si applicable)"}</li>
</ul>

<h2>${e?"COMMON ERRORS TO AVOID":"ERREURS COURANTES À ÉVITER"}</h2>
<ul>
<li>${e?"Do not include pay periods in which the employee had zero insurable earnings":"Ne pas inclure les périodes sans rémunération assurable"}</li>
<li>${e?"Ensure the last day for which paid (Block 11) matches your payroll records exactly — discrepancies are a leading cause of processing delays":"Vérifier la concordance du dernier jour payé avec les registres"}</li>
<li>${e?"Use the correct reason code — an incorrect code (particularly confusing Code A vs. Code M vs. Code E) can delay the employee's EI benefits by weeks and may trigger a Service Canada investigation":"Utiliser le bon code de raison — un code incorrect retarde les prestations d'AE"}</li>
<li>${e?"For employees with variable hours, report actual insurable hours per pay period (Block 15C), not scheduled or contracted hours":"Pour les heures variables, déclarer les heures réelles par période"}</li>
<li>${e?"Block 17 (vacation pay) must include only vacation pay that was paid or payable — do not include vacation time taken":"Case 17 : inclure uniquement la paie de vacances payée ou payable"}</li>
</ul>

<h2>${e?"SUBMISSION CHECKLIST":"LISTE DE SOUMISSION"}</h2>
<ul>
<li>☐ ${e?"ROE filed electronically via ROE Web (Service Canada) or payroll provider":"RE soumis électroniquement via RE Web ou fournisseur de paie"}</li>
<li>☐ ${e?"Employee notified of ROE issuance and informed of their right to access it through My Service Canada Account":"Employé(e) avisé(e) et informé(e) de son accès via Mon dossier Service Canada"}</li>
<li>☐ ${e?"Copy retained in employee file for Company records (recommended retention: 6 years per CRA guidelines)":"Copie conservée au dossier (conservation recommandée : 6 ans selon l'ARC)"}</li>
<li>☐ ${e?"Final pay processed including all outstanding entitlements under the "+actName:"Paie finale traitée incluant tous les droits en vertu de "+actName}</li>
</ul>

${hr}<p>${e?"Prepared by":"Préparé par"}: _______________________________  ${e?"Date":"Date"}: _______________________________</p>`,

    contractor: () => `<div class="doc-type">${e?"INDEPENDENT CONTRACTOR SERVICES AGREEMENT":"ENTENTE DE SERVICES D'ENTREPRENEUR INDÉPENDANT"}</div>${meta()}
<p><strong>${e?"BETWEEN":"ENTRE"}</strong></p>
<p>${v("companyName")} (${e?'"the Company"':'l\'« Entreprise »'})${vr("companyAddress")?`, ${v("companyAddress")}`:""}</p>
<p><strong>${e?"AND":"ET"}</strong></p>
<p>${v("contractorName")} (${e?'"the Contractor"':'l\'« Entrepreneur »'})</p>
${hr}

<h2>1. ${e?"ENGAGEMENT AND SERVICES":"ENGAGEMENT ET SERVICES"}</h2>
<p>${e?`The Company hereby engages the Contractor, and the Contractor agrees, to provide the following services (the "Services") on the terms and conditions set out in this Agreement:`:`L'Entreprise engage l'Entrepreneur pour fournir les services suivants selon les conditions de cette entente :`}</p>
<div class="doc-quote">${v("projectDesc")}</div>

<h2>2. ${e?"DELIVERABLES":"LIVRABLES"}</h2>
<div class="doc-quote">${v("deliverables")}</div>

<h2>3. ${e?"TERM":"DURÉE"}</h2>
<p>${e?`This Agreement commences on <strong>${v("startDate")}</strong> and, unless terminated earlier in accordance with the provisions of this Agreement, will continue until <strong>${v("endDate")}</strong>.`:`Cette entente débute le <strong>${v("startDate")}</strong> et se termine le <strong>${v("endDate")}</strong>.`}</p>

<h2>4. ${e?"COMPENSATION AND INVOICING":"RÉMUNÉRATION ET FACTURATION"}</h2>
<p>${e?`In consideration for the Services, the Company shall pay the Contractor at the rate of <strong>${v("compensation")}</strong>. Payment shall be made <strong>${v("paymentTerms")}</strong> upon receipt of a valid invoice. The Contractor is solely responsible for all applicable taxes arising from payments under this Agreement, including Goods and Services Tax (GST) and/or Harmonized Sales Tax (HST) registration and remittance where required under the <em>Excise Tax Act</em> (R.S.C., 1985, c. E-15). The Company will not withhold income tax, Canada Pension Plan contributions, or Employment Insurance premiums, as the Contractor is not an employee.`:`L'Entreprise paiera l'Entrepreneur au taux de <strong>${v("compensation")}</strong>. Paiement : <strong>${v("paymentTerms")}</strong>. L'Entrepreneur est seul responsable de toutes les taxes applicables, y compris la TPS/TVH.`}</p>

<h2>5. ${e?"INDEPENDENT CONTRACTOR STATUS":"STATUT D'ENTREPRENEUR INDÉPENDANT"}</h2>
<p>${e?`The parties acknowledge and agree that the Contractor is an independent contractor and not an employee, partner, agent, or joint venturer of the Company. The Contractor:`:`Les parties reconnaissent que l'Entrepreneur est un travailleur indépendant. L'Entrepreneur :`}</p>
<ul>
<li>${or("ownsTools")==="Yes"?(e?"Provides their own tools, equipment, materials, and workspace necessary to perform the Services":"Fournit ses propres outils, équipement, matériel et espace de travail"):(e?"Will use Company-provided tools and equipment for the duration of this engagement. <strong>Note:</strong> The Canada Revenue Agency considers ownership of tools to be a significant factor in determining worker classification. The use of Company-provided tools may indicate an employment relationship rather than a contractor relationship. The parties are encouraged to seek professional tax advice.":"Utilisera les outils de l'entreprise. <strong>Note :</strong> L'ARC considère la propriété des outils comme un facteur significatif. Ceci peut indiquer une relation d'emploi.")}</li>
<li>${e?"Retains full control over the manner, method, means, and timing of performing the Services, subject only to the agreed-upon deliverables and timelines":"Conserve le contrôle sur la manière, la méthode et l'horaire du travail"}</li>
<li>${e?"Is free to engage assistants or subcontractors at the Contractor's own expense, provided the Company's consent is obtained":"Peut engager des sous-traitants à ses frais avec le consentement de l'Entreprise"}</li>
</ul>

<div class="doc-quote"><p><strong>${e?"CRA CLASSIFICATION NOTICE":"AVIS DE CLASSIFICATION DE L'ARC"}</strong></p><p>${e?`The Canada Revenue Agency applies multiple tests to determine whether a worker is an employee or an independent contractor, including: (a) degree of control exercised by the payer; (b) ownership of tools; (c) chance of profit and risk of loss; (d) integration into the payer's business; and (e) the stated intention of the parties. This Agreement alone does not determine the Contractor's status for tax purposes. Misclassification may result in the Company being liable for unpaid source deductions, CPP/EI premiums, penalties, and interest. Both parties are advised to review CRA Guide RC4110 "Employee or Self-Employed?"`:`L'ARC utilise plusieurs critères pour déterminer le statut d'un travailleur : (a) degré de contrôle; (b) propriété des outils; (c) possibilité de profit/risque de perte; (d) intégration dans l'entreprise. Cette entente seule ne détermine pas le statut fiscal. Consultez le guide RC4110.`}</p></div>

${or("confidentiality")==="Yes"?`<h2>6. ${e?"CONFIDENTIALITY":"CONFIDENTIALITÉ"}</h2>
<p>${e?"The Contractor acknowledges that in the course of performing the Services, the Contractor may have access to confidential and proprietary information of the Company, including but not limited to trade secrets, client lists, business strategies, financial data, technical information, and employee information. The Contractor agrees to hold all such information in strict confidence, to use it solely for the purpose of performing the Services, and not to disclose it to any third party without the prior written consent of the Company. This obligation survives the termination of this Agreement by a period of two (2) years.":"L'Entrepreneur s'engage à maintenir la stricte confidentialité de toute information propriétaire. Cette obligation survit à la résiliation pour 2 ans."}</p>`:""} 

<h2>${or("confidentiality")==="Yes"?"7":"6"}. ${e?"TERMINATION":"RÉSILIATION"}</h2>
<p>${e?`Either party may terminate this Agreement by providing <strong>${v("terminationNotice")} days</strong> prior written notice to the other party. Upon termination, the Contractor shall promptly deliver all completed and in-progress work product to the Company and shall be compensated for all Services satisfactorily rendered up to and including the date of termination.`:`L'une ou l'autre des parties peut résilier cette entente avec un préavis écrit de <strong>${v("terminationNotice")} jours</strong>.`}</p>

<h2>${or("confidentiality")==="Yes"?"8":"7"}. ${e?"GOVERNING LAW":"LOI APPLICABLE"}</h2>
<p>${e?`This Agreement shall be governed by and construed in accordance with the laws of ${provName} and the applicable federal laws of Canada. The parties agree to submit to the exclusive jurisdiction of the courts of ${provName} for the resolution of any disputes arising under or in connection with this Agreement.`:`Cette entente est régie par les lois de ${provName} et les lois fédérales applicables du Canada.`}</p>

${hr}
<p><strong>${e?"IN WITNESS WHEREOF":"EN FOI DE QUOI"}</strong>, ${e?"the parties have executed this Agreement as of the date first written above.":"les parties ont signé cette entente à la date indiquée."}</p>
<div style="display:flex;gap:40px;flex-wrap:wrap">
${sig(v("companyName"), e?"Authorized Signatory":"Signataire autorisé")}
${sig(v("contractorName"), e?"Contractor":"Entrepreneur")}
</div>`,

    promotion: () => `${hdr()}${meta()}
<div class="doc-type">${e?"NOTICE OF PROMOTION AND SALARY ADJUSTMENT":"AVIS DE PROMOTION ET D'AJUSTEMENT SALARIAL"}</div>
<p>${e?"Dear":"Cher(ère)"} ${v("employeeName")},</p>
<p>${e?`I am pleased to confirm the following changes to your employment with <strong>${v("companyName")}</strong>, effective <strong>${v("effectiveDate")}</strong>.`:`J'ai le plaisir de confirmer les changements suivants à votre emploi, en vigueur le <strong>${v("effectiveDate")}</strong>.`}</p>
<h2>${e?"CHANGE SUMMARY":"RÉSUMÉ DES CHANGEMENTS"}</h2>
<p>${e?`You are being promoted from your current position of <strong>${v("currentTitle")}</strong> to the position of <strong>${v("newTitle")}</strong>. Your annual base salary will increase from <strong>$${v("currentSalary")} CAD</strong> to <strong>$${v("newSalary")} CAD</strong>, effective on the date noted above. This new salary will be subject to all applicable statutory deductions under federal and ${provName} tax legislation, CPP/QPP contributions, and EI premiums.`:`Vous êtes promu(e) de <strong>${v("currentTitle")}</strong> à <strong>${v("newTitle")}</strong>. Votre salaire passe de <strong>${v("currentSalary")} $ CAD</strong> à <strong>${v("newSalary")} $ CAD</strong>.`}</p>
<h2>${e?"REASON FOR CHANGE":"RAISON DU CHANGEMENT"}</h2>
<div class="doc-quote">${v("reason")}</div>
${vr("newResponsibilities")?`<h2>${e?"NEW RESPONSIBILITIES":"NOUVELLES RESPONSABILITÉS"}</h2><div class="doc-quote">${v("newResponsibilities")}</div>`:""}
<p>${e?`All other terms and conditions of your employment, including your vacation entitlements under the ${esaRef} and benefit plan participation, remain unchanged unless separately communicated in writing. Your original date of hire continues to apply for the purposes of calculating seniority, notice entitlements, and service-related benefits. Congratulations on this well-deserved recognition.`:`Toutes les autres conditions restent inchangées. Votre date d'embauche originale s'applique toujours pour l'ancienneté et les droits. Félicitations.`}</p>
${sig(v("managerName"),"")}
<p>${e?"Acknowledgment":"Accusé de réception"}:</p>
${sig(v("employeeName"),"")}
<div class="sig-date">${e?"Date":"Date"}: _______________________________</div>`,

    reference: () => `${hdr()}${meta()}
<div class="doc-type">${e?"PROFESSIONAL LETTER OF REFERENCE":"LETTRE DE RÉFÉRENCE PROFESSIONNELLE"}</div>
<p>${e?"To Whom It May Concern":"À qui de droit"},</p>
<p>${e?`I am writing to provide a professional reference for <strong>${v("employeeName")}</strong>, who was employed by <strong>${v("companyName")}</strong> in the capacity of <strong>${v("jobTitle")}</strong> from <strong>${v("startDate")}</strong> to <strong>${v("endDate")}</strong>.`:`Je rédige cette référence pour <strong>${v("employeeName")}</strong>, qui a été à l'emploi de <strong>${v("companyName")}</strong> au poste de <strong>${v("jobTitle")}</strong> du <strong>${v("startDate")}</strong> au <strong>${v("endDate")}</strong>.`}</p>
<h2>${e?"KEY RESPONSIBILITIES AND DUTIES":"RESPONSABILITÉS ET FONCTIONS PRINCIPALES"}</h2>
<p>${e?"During their tenure, the employee's principal responsibilities included:":"Pendant son emploi, les responsabilités principales comprenaient :"}</p>
<div class="doc-quote">${v("duties")}</div>
<h2>${e?"PROFESSIONAL STRENGTHS AND ACHIEVEMENTS":"FORCES PROFESSIONNELLES ET RÉALISATIONS"}</h2>
<div class="doc-quote">${v("strengths")}</div>
<h2>${e?"CHARACTER AND PROFESSIONAL CONDUCT":"CARACTÈRE ET CONDUITE PROFESSIONNELLE"}</h2>
<div class="doc-quote">${v("character")}</div>
<p>${e?`Based on my direct experience working with ${v("employeeName")}, I would not hesitate to recommend them for any position that aligns with their demonstrated skills, experience, and professional capabilities. Should you require any additional information, please do not hesitate to contact me at the details provided below.`:`Sur la base de mon expérience directe, je recommande ${v("employeeName")} sans réserve. N'hésitez pas à me contacter.`}</p>
${sig(v("signerName"), v("signerTitle"))}
<p class="doc-small">${e?"Contact":"Contact"}: ${v("contactInfo")}</p>`,

    investigation: () => `${hdr()}${meta()}
<div class="doc-type">${e?"WORKPLACE INVESTIGATION REPORT":"RAPPORT D'ENQUÊTE EN MILIEU DE TRAVAIL"}</div>
<div class="doc-classification">${e?"STRICTLY CONFIDENTIAL — PRIVILEGED AND WITHOUT PREJUDICE":"STRICTEMENT CONFIDENTIEL — PROTÉGÉ ET SANS PRÉJUDICE"}</div>

<p>${e?`<strong>Complainant:</strong> ${v("complainant")} | <strong>Respondent:</strong> ${v("respondent")}`:`<strong>Plaignant(e) :</strong> ${v("complainant")} | <strong>Mis(e) en cause :</strong> ${v("respondent")}`}</p>
<p>${e?`<strong>Investigator:</strong> ${v("investigator")} | <strong>Complaint Received:</strong> ${v("complaintDate")} | <strong>Incident Date(s):</strong> ${v("incidentDate")}`:`<strong>Enquêteur :</strong> ${v("investigator")} | <strong>Plainte reçue :</strong> ${v("complaintDate")} | <strong>Date(s) :</strong> ${v("incidentDate")}`}</p>

<h2>${e?"SUMMARY OF ALLEGATIONS":"RÉSUMÉ DES ALLÉGATIONS"}</h2>
<div class="doc-quote">${v("allegationSummary")}</div>

<h2>${e?"INVESTIGATION METHODOLOGY":"MÉTHODOLOGIE DE L'ENQUÊTE"}</h2>
<p>${e?`This investigation was conducted in accordance with the Company's Workplace Harassment and Discrimination Prevention Policy, the ${hrRef}, and the ${ohsRef}. The investigation followed principles of procedural fairness, including providing both parties with an opportunity to respond to the allegations and present their account of events.`:`Cette enquête a été menée conformément à la politique de prévention du harcèlement, à ${hrRef} et à ${ohsRef}.`}</p>

<p><strong>${e?"Witnesses Interviewed":"Témoins interrogés"}</strong></p>
<div class="doc-quote">${v("witnessesInterviewed")}</div>

<p><strong>${e?"Documentary and Other Evidence Reviewed":"Preuves documentaires examinées"}</strong></p>
<div class="doc-quote">${v("evidenceReviewed")}</div>

<h2>${e?"FINDINGS OF FACT":"CONSTATATIONS DE FAIT"}</h2>
<div class="doc-quote">${v("findings")}</div>

<h2>${e?"CONCLUSION":"CONCLUSION"}</h2>
<p>${e?"Based on the totality of the evidence gathered during this investigation, the allegations are determined to be":"Sur la base de l'ensemble des preuves recueillies, les allégations sont"}: <strong>${ov("conclusion")}</strong>.</p>

<h2>${e?"RECOMMENDATIONS":"RECOMMANDATIONS"}</h2>
<div class="doc-quote">${v("recommendations")}</div>

<p class="doc-note">${e?"This report is strictly confidential and is prepared for management decision-making purposes only. Distribution should be limited on a need-to-know basis. Both the complainant and respondent should be informed of the outcome of the investigation and any resulting actions, but should not receive copies of this full report. The investigation was conducted in accordance with the Company's duty of care and applicable legislation. This report does not constitute legal advice.":"Ce rapport est confidentiel et destiné à la direction seulement. Les deux parties seront informées du résultat."}</p>
${sig(v("investigator"), e?"Investigator":"Enquêteur")}
<div class="sig-date">${e?"Date":"Date"}: _______________________________</div>`,

    accommodation: () => `${hdr()}${meta()}
<div class="doc-type">${e?"RESPONSE TO WORKPLACE ACCOMMODATION REQUEST":"RÉPONSE À UNE DEMANDE D'ADAPTATION EN MILIEU DE TRAVAIL"}</div>

<p>${e?"Dear":"Cher(ère)"} ${v("employeeName")},</p>

<p>${e?`This letter is in response to your workplace accommodation request dated <strong>${v("requestDate")}</strong> in relation to your position as <strong>${v("jobTitle")}</strong>. We have carefully reviewed your request in accordance with the Company's duty to accommodate under the ${hrRef} and applicable provisions of the ${esaRef}.`:`En réponse à votre demande d'adaptation du <strong>${v("requestDate")}</strong> pour votre poste de <strong>${v("jobTitle")}</strong>, conformément à ${hrRef} et à ${esaRef}.`}</p>

<p>${e?`<strong>Accommodation Type:</strong> ${ov("accommodationType")} | <strong>Decision:</strong> ${ov("decision")}`:`<strong>Type :</strong> ${ov("accommodationType")} | <strong>Décision :</strong> ${ov("decision")}`}</p>

<h2>${e?"YOUR REQUEST":"VOTRE DEMANDE"}</h2>
<div class="doc-quote">${v("requestSummary")}</div>

<h2>${e?"ACCOMMODATION MEASURES":"MESURES D'ADAPTATION"}</h2>
<div class="doc-quote">${v("accommodationDetails")}</div>

<h2>${e?"REVIEW AND DURATION":"RÉVISION ET DURÉE"}</h2>
<p>${e?`This accommodation will be reviewed on <strong>${v("reviewDate")}</strong> to assess whether the measures remain appropriate and effective. If your circumstances change before the review date, or if the accommodation is not meeting your needs, please notify HR immediately so that adjustments can be considered.`:`Cette adaptation sera révisée le <strong>${v("reviewDate")}</strong>. Si vos besoins changent, avisez les RH immédiatement.`}</p>

<h2>${e?"YOUR RIGHTS":"VOS DROITS"}</h2>
<p>${e?`Under the ${hrRef}, employers have a legal duty to accommodate employees based on protected grounds to the point of undue hardship. Undue hardship is assessed based on cost, outside sources of funding (if any), and health and safety requirements. If you believe this response does not adequately address your accommodation needs, you have the right to request a further review by senior management, file a complaint with the applicable human rights commission (${province === "FED" ? "Canadian Human Rights Commission" : provName + " Human Rights Commission or Tribunal"}), or seek independent legal advice.`:`En vertu de ${hrRef}, l'employeur a l'obligation d'accommoder jusqu'à la contrainte excessive. Si cette réponse ne répond pas à vos besoins, vous pouvez demander une révision ou déposer une plainte auprès de la commission des droits de la personne.`}</p>

<p>${e?"Contact":"Contact"}: <strong>${v("hrContact")}</strong></p>
${sig(v("hrContact"), v("companyName"))}
${ack(v("employeeName"))}`,

    resignation: () => `${hdr()}${meta()}
<div class="doc-type">${e?"ACCEPTANCE OF RESIGNATION":"ACCEPTATION DE DÉMISSION"}</div>

<p>${e?"Dear":"Cher(ère)"} ${v("employeeName")},</p>

<p>${e?`This letter acknowledges receipt and formal acceptance of your resignation from the position of <strong>${v("jobTitle")}</strong> at <strong>${v("companyName")}</strong>, which was received on <strong>${v("resignationDate")}</strong>. In accordance with your notice, your last day of active employment will be <strong>${v("lastDay")}</strong>.`:`Nous accusons réception et acceptons votre démission du poste de <strong>${v("jobTitle")}</strong>, reçue le <strong>${v("resignationDate")}</strong>. Votre dernier jour sera le <strong>${v("lastDay")}</strong>.`}</p>

<p>${e?`You have provided <strong>${v("yearsService")} year(s)</strong> of service to the organization, and we appreciate the contributions you have made during your tenure.`:`Vous avez accumulé <strong>${v("yearsService")} année(s)</strong> de service. Nous apprécions vos contributions.`}</p>

${or("exitInterview")==="Yes"?`<h2>${e?"EXIT INTERVIEW":"ENTREVUE DE DÉPART"}</h2><p>${e?"An exit interview has been scheduled as part of the offboarding process. Your candid feedback is valued and will be treated confidentially. Details regarding the date, time, and format will be communicated to you separately.":"Une entrevue de départ sera planifiée. Vos commentaires seront traités confidentiellement."}</p>`:""}

<h2>${e?"FINAL PAY AND ENTITLEMENTS":"PAIE FINALE ET DROITS"}</h2>
<p>${e?`Your final pay will be processed on the next regularly scheduled pay date following your last day of employment. It will include all earned and unpaid wages through your last day of work, plus any accrued and outstanding vacation pay calculated in accordance with the ${esaRef}, which provides for a minimum entitlement of ${act.vac}. A Record of Employment (ROE) will be issued electronically to Service Canada within five (5) calendar days of your last day, as required under the <em>Employment Insurance Regulations</em>.`:`Votre paie finale sera traitée à la prochaine date de paie. Elle comprendra tous les salaires et la paie de vacances selon ${esaRef}. Un RE sera émis dans les 5 jours.`}</p>

<h2>${e?"RETURN OF COMPANY PROPERTY":"RETOUR DES BIENS"}</h2>
<p>${e?"Please ensure all Company property is returned on or before your last day:":"Veuillez retourner tous les biens de l'entreprise :"}</p>
<div class="doc-quote">${v("returnItems")}</div>

<h2>${e?"CONTINUING OBLIGATIONS":"OBLIGATIONS CONTINUES"}</h2>
<p>${e?"Any confidentiality, non-solicitation, non-competition, or intellectual property obligations contained in your employment agreement or ancillary agreements remain in full force and effect following your departure, in accordance with their terms.":"Les obligations de confidentialité et de non-sollicitation contenues dans vos ententes restent en vigueur."}</p>

<p>${e?`On behalf of everyone at ${v("companyName")}, we thank you for your ${v("yearsService")} years of dedicated service and wish you every success in your future professional endeavours.`:`Au nom de ${v("companyName")}, nous vous remercions pour vos ${v("yearsService")} années de service.`}</p>
${sig(v("managerName"),"")}`,

    layoff: () => { const nc = noticeCalc; const isTemp = or("layoffType")==="Temporary"; return `${hdr()}${meta()}
<div class="doc-type">${isTemp?(e?"NOTICE OF TEMPORARY LAYOFF":"AVIS DE MISE À PIED TEMPORAIRE"):(e?"NOTICE OF PERMANENT LAYOFF":"AVIS DE MISE À PIED PERMANENTE")}</div>
<div class="doc-classification">${e?"CONFIDENTIAL":"CONFIDENTIEL"}</div>

<p>${e?"Dear":"Cher(ère)"} ${v("employeeName")},</p>

<p>${e?`This letter serves as formal notice that your position as <strong>${v("jobTitle")}</strong> at <strong>${v("companyName")}</strong> is subject to a <strong>${isTemp?"temporary":"permanent"}</strong> layoff, effective <strong>${v("effectiveDate")}</strong>. You have completed <strong>${v("yearsService")} year(s)</strong> of continuous service with the Company.`:`La présente constitue un avis formel que votre poste de <strong>${v("jobTitle")}</strong> fait l'objet d'une mise à pied <strong>${isTemp?"temporaire":"permanente"}</strong> à compter du <strong>${v("effectiveDate")}</strong>.`}</p>

<h2>${e?"REASON FOR LAYOFF":"RAISON DE LA MISE À PIED"}</h2>
<div class="doc-quote">${v("reason")}</div>

${nc?`<h2>${e?"NOTICE ENTITLEMENT":"DROIT AU PRÉAVIS"}</h2>
<p>${e?`Under the ${esaRef}, you are entitled to a minimum of <strong>${nc.noticeWeeks} week(s)</strong> of written notice or payment in lieu of notice based on your ${v("yearsService")} year(s) of continuous service.`:`En vertu de ${esaRef}, vous avez droit à un minimum de <strong>${nc.noticeWeeks} semaine(s)</strong> de préavis.`}${nc.sevNote[lang]?` ${nc.sevNote[lang]}`:""}</p>`:""}

<h2>${e?"BENEFITS DURING LAYOFF":"AVANTAGES PENDANT LA MISE À PIED"}</h2>
<div class="doc-quote">${v("benefitsContinuation")}</div>

${isTemp?`<h2>${e?"RECALL RIGHTS AND EXPECTATIONS":"DROITS ET PROCESSUS DE RAPPEL"}</h2>
<p>${e?`Your expected recall date is <strong>${v("expectedRecall")}</strong>. The following outlines the recall process and your rights during the layoff period:`:`Date de rappel prévue : <strong>${v("expectedRecall")}</strong>.`}</p>
<div class="doc-quote">${v("recallRights")}</div>
<p>${e?`<strong>Important:</strong> Under the ${esaRef}, a temporary layoff that exceeds the maximum statutory duration will be deemed a termination of employment, which would trigger your full entitlements to notice of termination and, where applicable, severance pay under the Act. It is in both parties' interest to adhere to the expected recall timeline.`:`<strong>Important :</strong> Selon ${esaRef}, une mise à pied temporaire excédant la durée maximale sera considérée comme une cessation d'emploi.`}</p>`:""}

<h2>${e?"RECORD OF EMPLOYMENT":"RELEVÉ D'EMPLOI"}</h2>
<p>${e?"An ROE will be issued electronically within five (5) calendar days. You are encouraged to apply for Employment Insurance benefits as soon as possible through Service Canada.":"Un RE sera émis dans les 5 jours civils. Nous vous encourageons à demander les prestations d'AE."}</p>

${sig(v("signerName"),"")}
<p class="doc-small">${e?"For":"Pour"} ${v("companyName")}</p>
${ack(v("employeeName"))}`; },

    pip: () => `${hdr()}${meta()}
<div class="doc-type">${e?"PERFORMANCE IMPROVEMENT PLAN":"PLAN D'AMÉLIORATION DU RENDEMENT"}</div>
<div class="doc-classification">${e?"CONFIDENTIAL — EMPLOYEE FILE":"CONFIDENTIEL — DOSSIER DE L'EMPLOYÉ"}</div>

<p>${e?`<strong>Employee:</strong> ${v("employeeName")} | <strong>Position:</strong> ${v("jobTitle")}, ${v("department")} | <strong>PIP Period:</strong> ${v("startDate")} to ${v("endDate")}`:`<strong>Employé(e) :</strong> ${v("employeeName")} | <strong>Poste :</strong> ${v("jobTitle")}, ${v("department")} | <strong>Période :</strong> ${v("startDate")} au ${v("endDate")}`}</p>

<p>${e?`The purpose of this Performance Improvement Plan (PIP) is to formally document specific areas where your job performance has not met the required standards, establish clear and measurable improvement goals, provide you with the support and resources necessary to achieve those goals, and set a defined timeline for review.`:`L'objectif de ce Plan d'amélioration du rendement (PAR) est de documenter les domaines où votre rendement n'a pas atteint les normes requises et d'établir des objectifs d'amélioration clairs.`}</p>

<h2>${e?"PERFORMANCE CONCERNS":"PROBLÈMES DE RENDEMENT"}</h2>
<div class="doc-quote">${v("performanceIssues")}</div>

<h2>${e?"IMPROVEMENT OBJECTIVES":"OBJECTIFS D'AMÉLIORATION"}</h2>
<div class="doc-quote">${v("goals")}</div>

<h2>${e?"SUCCESS METRICS":"CRITÈRES DE SUCCÈS"}</h2>
<p>${e?"Your progress will be evaluated against the following measurable criteria:":"Vos progrès seront évalués selon les critères mesurables suivants :"}</p>
<div class="doc-quote">${v("metrics")}</div>

<h2>${e?"SUPPORT AND RESOURCES":"SOUTIEN ET RESSOURCES"}</h2>
<p>${e?"The Company is committed to providing you with the support necessary to succeed. The following resources will be made available:":"L'entreprise s'engage à fournir le soutien nécessaire :"}</p>
<div class="doc-quote">${v("support")}</div>

<h2>${e?"MONITORING AND CHECK-IN SCHEDULE":"SUIVI ET CALENDRIER"}</h2>
<p>${e?`Your progress will be monitored through regular check-in meetings: <strong>${v("checkInSchedule")}</strong>. During each check-in, your manager will review your progress against the objectives set out above, provide feedback, and make any necessary adjustments to the support plan.`:`Vos progrès seront suivis lors de rencontres régulières : <strong>${v("checkInSchedule")}</strong>.`}</p>

<h2>${e?"CONSEQUENCES":"CONSÉQUENCES"}</h2>
<div class="doc-quote">${v("consequences")}</div>

<h2>${e?"YOUR RIGHTS":"VOS DROITS"}</h2>
<p>${e?`This PIP is issued under the Company's performance management process and does not constitute a termination of employment. Your rights under the ${esaRef} and the ${hrRef} are not affected by this plan. You have the right to provide a written response to this PIP, which will be appended to your employee file. If you are a member of a bargaining unit, you may consult with your union representative regarding this plan.`:`Ce PAR est émis dans le cadre de la gestion du rendement et ne constitue pas une cessation. Vos droits en vertu de ${esaRef} et de ${hrRef} ne sont pas affectés.`}</p>

${sig(v("managerName"),"")}
${ack(v("employeeName"))}`,

    nda: () => `<div class="doc-type">${e?"NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT":"ENTENTE DE NON-DIVULGATION ET DE CONFIDENTIALITÉ"}</div>${meta()}

<p><strong>${e?"BETWEEN":"ENTRE"}</strong></p>
<p>${v("companyName")} (${e?'"the Disclosing Party"':'l\'« Partie divulgatrice »'})${vr("companyAddress")?`, ${v("companyAddress")}`:""}</p>
<p><strong>${e?"AND":"ET"}</strong></p>
<p>${v("recipientName")} (${e?'"the Receiving Party"':'l\'« Partie réceptrice »'}) — ${ov("recipientType")}</p>
${hr}

<h2>1. ${e?"DEFINITION OF CONFIDENTIAL INFORMATION":"DÉFINITION DE L'INFORMATION CONFIDENTIELLE"}</h2>
<p>${e?`For the purposes of this Agreement, "Confidential Information" means any and all information, in any form or medium, whether tangible or intangible, that is disclosed by the Disclosing Party to the Receiving Party, or to which the Receiving Party gains access in the course of the relationship between the parties, including but not limited to:`:`« Information confidentielle » désigne toute information divulguée par la Partie divulgatrice, y compris :`}</p>
<div class="doc-quote">${v("confidentialInfo")}</div>

<h2>2. ${e?"PURPOSE OF DISCLOSURE":"OBJET DE LA DIVULGATION"}</h2>
<div class="doc-quote">${v("purpose")}</div>

<h2>3. ${e?"OBLIGATIONS OF THE RECEIVING PARTY":"OBLIGATIONS DE LA PARTIE RÉCEPTRICE"}</h2>
<p>${e?"The Receiving Party agrees to:":"La Partie réceptrice s'engage à :"}</p>
<ul>
<li>${e?"Maintain the strict confidentiality of all Confidential Information using at least the same degree of care it uses to protect its own confidential information, and in no event less than a reasonable standard of care":"Maintenir la stricte confidentialité avec au moins le même degré de soin que pour ses propres informations"}</li>
<li>${e?"Use the Confidential Information solely and exclusively for the purpose stated in Section 2 above":"Utiliser l'information uniquement pour l'objet indiqué"}</li>
<li>${e?"Not disclose, publish, or otherwise disseminate Confidential Information to any third party without the prior written consent of the Disclosing Party":"Ne pas divulguer à un tiers sans consentement écrit"}</li>
<li>${e?"Limit access to Confidential Information to those of its employees, agents, or advisors who have a genuine need to know and who are bound by confidentiality obligations no less restrictive than those contained in this Agreement":"Limiter l'accès aux personnes ayant un besoin réel et liées par des obligations similaires"}</li>
<li>${e?"Promptly notify the Disclosing Party of any unauthorized use or disclosure of Confidential Information":"Aviser promptement de toute utilisation non autorisée"}</li>
</ul>

<h2>4. ${e?"EXCLUSIONS FROM CONFIDENTIAL INFORMATION":"EXCLUSIONS"}</h2>
<p>${e?"The obligations under this Agreement do not apply to information that: (a) is or becomes publicly available through no fault or action of the Receiving Party; (b) was already in the lawful possession of the Receiving Party prior to disclosure, as evidenced by written records; (c) is independently developed by the Receiving Party without reference to the Confidential Information; (d) is disclosed to the Receiving Party by a third party who is not under any obligation of confidentiality; or (e) is required to be disclosed by law, regulation, or valid court order, provided that the Receiving Party gives the Disclosing Party prompt written notice of such requirement to allow the Disclosing Party to seek a protective order.":"Les obligations ne s'appliquent pas aux informations : (a) publiques sans faute de la Partie réceptrice; (b) déjà en possession légale; (c) développées indépendamment; (d) divulguées par un tiers non lié; (e) exigées par la loi, avec préavis écrit."}</p>

<h2>5. ${e?"DURATION OF OBLIGATIONS":"DURÉE DES OBLIGATIONS"}</h2>
<p>${e?`The confidentiality obligations under this Agreement shall remain in full force and effect for a period of <strong>${v("durationYears")} years</strong> from the Effective Date, or until the Confidential Information no longer qualifies as confidential under the terms of this Agreement, whichever period is longer.`:`Les obligations demeurent en vigueur pour <strong>${v("durationYears")} ans</strong> ou jusqu'à ce que l'information ne soit plus confidentielle.`}</p>

<h2>6. ${e?"RETURN OR DESTRUCTION OF MATERIALS":"RETOUR OU DESTRUCTION DU MATÉRIEL"}</h2>
<p>${e?`Upon the termination of the relationship between the parties, or upon the written request of the Disclosing Party at any time, the Receiving Party shall promptly <strong>${ov("returnDestruction").toLowerCase()}</strong>, including all copies, reproductions, summaries, notes, and extracts thereof, whether in physical or electronic form. The Receiving Party shall certify in writing, within ten (10) business days of such request, that all Confidential Information has been returned or destroyed in accordance with this provision.`:`À la fin de la relation ou sur demande, la Partie réceptrice doit promptement <strong>${ov("returnDestruction").toLowerCase()}</strong> et le certifier par écrit dans les 10 jours ouvrables.`}</p>

<h2>7. ${e?"REMEDIES":"RECOURS"}</h2>
<p>${e?"The Receiving Party acknowledges that any unauthorized disclosure or use of Confidential Information may cause irreparable harm to the Disclosing Party for which monetary damages alone would be an inadequate remedy. Accordingly, the Disclosing Party shall be entitled to seek injunctive or other equitable relief in addition to any other remedies available at law or in equity, without the necessity of proving actual damages or posting a bond.":"La Partie réceptrice reconnaît que toute divulgation non autorisée peut causer un préjudice irréparable. La Partie divulgatrice peut demander une injonction en plus de tout autre recours."}</p>

<h2>8. ${e?"GOVERNING LAW AND JURISDICTION":"LOI APPLICABLE ET JURIDICTION"}</h2>
<p>${e?`This Agreement shall be governed by and construed in accordance with the laws of ${provName} and the applicable federal laws of Canada. The parties irrevocably submit to the exclusive jurisdiction of the courts of ${provName} for any proceedings arising out of or in connection with this Agreement.`:`Cette entente est régie par les lois de ${provName} et les lois fédérales applicables.`}</p>

<h2>9. ${e?"GENERAL PROVISIONS":"DISPOSITIONS GÉNÉRALES"}</h2>
<p>${e?"This Agreement constitutes the entire understanding between the parties with respect to the subject matter hereof and supersedes all prior negotiations, discussions, and agreements. No amendment to this Agreement shall be effective unless made in writing and signed by both parties. The waiver of any breach of this Agreement shall not constitute a waiver of any subsequent breach.":"Cette entente constitue l'intégralité de l'accord. Toute modification doit être écrite et signée."}</p>

${hr}
<p><strong>${e?"Effective Date":"Date d'entrée en vigueur"}</strong>: ${v("effectiveDate")}</p>
<div style="display:flex;gap:40px;flex-wrap:wrap">
${sig(v("companyName"), e?"Disclosing Party":"Partie divulgatrice")}
${sig(v("recipientName"), e?"Receiving Party":"Partie réceptrice")}
</div>`,
  };
  return (G[tid] || (() => ""))();
}

// ═══════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════
// Export: managed by component state — see handlePDF in main app

function copyToClipboard(html, onSuccess) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const text = tmp.textContent || tmp.innerText || "";
  // Try modern clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
  } else {
    fallbackCopy(text, onSuccess);
  }
}
function fallbackCopy(text, onSuccess) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand("copy"); onSuccess(); } catch {}
  document.body.removeChild(ta);
}

// ═══════════════════════════════════════
// PREMIUM SVG ICONS
// ═══════════════════════════════════════
const ICONS = {
  offer: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 15h6"/><path d="M9 11h6"/><path d="M12 18v-1"/></svg>,
  termination: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><line x1="9" y1="13" x2="15" y2="13"/></svg>,
  warning: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  probation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  returnleave: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
  policy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>,
  roe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M13 8h4"/><path d="M13 12h4"/><path d="M13 16h4"/></svg>,
  contractor: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  promotion: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="m8 14 4-4 4 4"/><path d="M4 20h16"/><line x1="4" y1="4" x2="20" y2="4"/></svg>,
  reference: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z"/><polyline points="22,6 12,13 2,6"/></svg>,
  investigation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>,
  accommodation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>,
  resignation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  layoff: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="11" x2="22" y2="11"/></svg>,
  pip: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  nda: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>,
};

function TemplateIcon({ id }) {
  return <div className="cico">{ICONS[id] || <span>•</span>}</div>;
}

// ═══════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// SIGNATURE PAD
// ═══════════════════════════════════════
function SignaturePad({ label, onSave, lang }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState("type"); // "draw" | "type"
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [saved, setSaved] = useState(null);
  const [savedMethod, setSavedMethod] = useState("");
  const t = (en, fr) => lang === "en" ? en : fr;

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  };

  const startDraw = (e) => { e.preventDefault(); setDrawing(true); const ctx = canvasRef.current.getContext("2d"); const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const draw = (e) => { if (!drawing) return; e.preventDefault(); const ctx = canvasRef.current.getContext("2d"); const p = getPos(e); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#1C1A15"; ctx.lineTo(p.x, p.y); ctx.stroke(); setHasStrokes(true); };
  const endDraw = () => setDrawing(false);
  const clearDraw = () => { if (canvasRef.current) { const ctx = canvasRef.current.getContext("2d"); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); } setHasStrokes(false); };

  const saveDrawn = () => { const data = canvasRef.current.toDataURL("image/png"); setSaved(data); setSavedMethod("drawn"); if (onSave) onSave(data); };

  const saveTyped = () => {
    // Render typed name onto a canvas to produce an image
    const c = document.createElement("canvas");
    c.width = 400; c.height = 80;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#FDFBF7";
    ctx.fillRect(0, 0, 400, 80);
    ctx.font = "italic 32px 'Instrument Serif', Georgia, serif";
    ctx.fillStyle = "#1C1A15";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, 16, 40);
    // Draw underline
    const textWidth = Math.min(ctx.measureText(typedName).width + 32, 380);
    ctx.strokeStyle = "#1C1A15";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 60);
    ctx.lineTo(textWidth, 60);
    ctx.stroke();
    const data = c.toDataURL("image/png");
    setSaved(data); setSavedMethod("typed"); if (onSave) onSave(data);
  };

  const reset = () => { setSaved(null); setSavedMethod(""); setTypedName(""); clearDraw(); };

  const timestamp = new Date().toLocaleDateString(lang==="en"?"en-CA":"fr-CA",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});

  if (saved) return (
    <div className="sig-saved">
      <div className="sig-saved-label">{label}</div>
      <img src={saved} alt="Signature" className="sig-saved-img" />
      <div className="sig-saved-info">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        {t("Digitally signed","Signé numériquement")} ({savedMethod === "typed" ? t("typed","tapé") : t("drawn","dessiné")}) — {timestamp}
      </div>
      <div className="sig-saved-legal">{t(
        "This electronic signature constitutes the signer's intent to authenticate this document, in accordance with the applicable Electronic Commerce Act and PIPEDA (S.C. 2000, c. 5). The typed or drawn mark, combined with the recorded timestamp, signer identity, and method of execution, satisfies the requirements for a valid electronic signature under Canadian law.",
        "Cette signature électronique constitue l'intention du signataire d'authentifier ce document, conformément aux lois applicables sur le commerce électronique et à la LPRPDE (L.C. 2000, ch. 5). La marque tapée ou dessinée, combinée à l'horodatage, l'identité et la méthode, satisfait aux exigences d'une signature électronique valide."
      )}</div>
      <button className="sig-reset" onClick={reset}>{t("Re-sign","Re-signer")}</button>
    </div>
  );

  return (
    <div className="sig-pad-wrap">
      <div className="sig-pad-label">{label}</div>
      <div className="sig-mode-toggle">
        <button className={`sig-mode-btn ${mode==="type"?"on":""}`} onClick={()=>setMode("type")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
          {t("Type Name","Taper le nom")}
        </button>
        <button className={`sig-mode-btn ${mode==="draw"?"on":""}`} onClick={()=>setMode("draw")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          {t("Draw","Dessiner")}
        </button>
      </div>

      {mode === "type" && <>
        <div className="sig-type-box">
          <input
            className="sig-type-input"
            placeholder={t("Type your full legal name","Tapez votre nom légal complet")}
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
          />
          {typedName && <div className="sig-type-preview">
            <div className="sig-type-rendered">{typedName}</div>
            <div className="sig-type-line"/>
          </div>}
        </div>
        <div className="sig-pad-actions">
          <button className="sig-pad-clear" onClick={()=>setTypedName("")} disabled={!typedName}>{t("Clear","Effacer")}</button>
          <button className="sig-pad-save" onClick={saveTyped} disabled={!typedName.trim()}>{t("Apply Signature","Appliquer la signature")}</button>
        </div>
      </>}

      {mode === "draw" && <>
        <div className="sig-pad-box">
          <canvas ref={canvasRef} width={280} height={100}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          />
          {!hasStrokes && <div className="sig-pad-hint">{t("Sign here — draw with mouse or finger","Signez ici — dessinez avec la souris ou le doigt")}</div>}
        </div>
        <div className="sig-pad-actions">
          <button className="sig-pad-clear" onClick={clearDraw} disabled={!hasStrokes}>{t("Clear","Effacer")}</button>
          <button className="sig-pad-save" onClick={saveDrawn} disabled={!hasStrokes}>{t("Apply Signature","Appliquer la signature")}</button>
        </div>
      </>}
    </div>
  );
}

// ═══════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════
function FadeIn({ children, delay = 0, style = {} }) {
  const [v, setV] = useState(false);
  useEffect(() => { const t = setTimeout(() => setV(true), delay); return () => clearTimeout(t); }, [delay]);
  return <div style={{ opacity: v?1:0, transform: v?"translateY(0)":"translateY(18px)", transition: `all 0.55s cubic-bezier(0.22,1,0.36,1)`, transitionDelay: `${delay}ms`, ...style }}>{children}</div>;
}


// Storage handled by Supabase (see src/lib/supabase.js)

// ═══════════════════════════════════════
// MARKDOWN PARSER FOR CHAT
// ═══════════════════════════════════════
function parseMarkdown(text) {
  if (!text) return "";
  let html = text
    // Escape HTML entities
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Code blocks (``` ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code>${code.trim()}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr/>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Process lists - unordered
  html = html.replace(/((?:^[-•] .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n')
      .filter(l => l.trim())
      .map(l => `<li>${l.replace(/^[-•] /, '')}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });

  // Process lists - ordered
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n')
      .filter(l => l.trim())
      .map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs - wrap remaining bare lines
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(h[1-3]|ul|ol|pre|blockquote|hr)/.test(trimmed)) return trimmed;
    // Don't wrap if it's already block-level
    if (trimmed.startsWith('<')) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
  }).join('');

  // Merge adjacent blockquotes
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br/>');

  return html;
}

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
function Dutiva() {
  const [lang, setLang] = useState("en");
  const [screen, setScreen] = useState("loading");
  const [sel, setSel] = useState(null);
  const [province, setProvince] = useState("");
  const [formData, setFormData] = useState({});
  const [doc, setDoc] = useState("");
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [anim, setAnim] = useState(0);
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", tosAccepted: false });
  const [authError, setAuthError] = useState("");
  const [onboardForm, setOnboardForm] = useState({ companyName: "", companyAddress: "", defaultProvince: "", employees: "", brandColor: "#C49355", companyTagline: "" });
  const [savedDocs, setSavedDocs] = useState([]);
  const [settingsTab, setSettingsTab] = useState("company");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [formMode, setFormMode] = useState("manual"); // manual | ai-assist
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilled, setAiFilled] = useState(false); // tracks if AI fill has run
  const [signatures, setSignatures] = useState({});
  const [chatFiles, setChatFiles] = useState([]);
  const [showPrintView, setShowPrintView] = useState(false);
  const chatFileRef = useRef(null);
  const chatEndRef = useRef(null);
  const ref = useRef(null);

  const t = (en, fr) => lang === "en" ? en : fr;
  const isPro = user?.plan === "pro";
  const freeDocsThisMonth = savedDocs.filter(d => {
    const docDate = new Date(d.date || d.created_at);
    const now = new Date();
    return docDate.getMonth() === now.getMonth() && docDate.getFullYear() === now.getFullYear();
  }).length;
  const freeDocLimitReached = !isPro && freeDocsThisMonth >= 2;
  const nav = useCallback(s => { setAnim(k => k+1); setScreen(s); }, []);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [screen]);

  // Load user on mount
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session) {
        const profile = await loadProfile();
        const docs = await loadDocuments();
        setUser(profile);
        setSavedDocs(docs || []);
        setLang(profile?.lang || "en");
        nav("dashboard");
      } else {
        nav("welcome");
      }
    })();

    const unsub = onAuthChange((session) => {
      if (!session) { setUser(null); nav("welcome"); }
    });
    return unsub;
    // Inject PWA meta tags for cross-platform optimization
    const head = document.head;
    const metas = [
      { name: "viewport", content: "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "theme-color", content: "#0B0E13" },
      { name: "format-detection", content: "telephone=no" },
      { name: "msapplication-TileColor", content: "#0B0E13" },
    ];
    metas.forEach(m => {
      if (!head.querySelector(`meta[name="${m.name}"]`)) {
        const tag = document.createElement("meta");
        tag.name = m.name; tag.content = m.content;
        head.appendChild(tag);
      }
    });
    // Set page title
    document.title = "Dutiva Canada";
  }, []);

  // Smart defaults from profile
  useEffect(() => {
    if (sel && user?.companyName && !formData.companyName) {
      setFormData(prev => ({ ...prev, companyName: user.companyName, companyAddress: user.companyAddress || "" }));
    }
  }, [sel]);

  // Auto-calculate notice/severance
  useEffect(() => {
    if ((sel?.id === "termination" || sel?.id === "layoff") && province && formData.yearsService) {
      const calc = calcNotice(province, formData.yearsService);
      if (calc) {
        setFormData(prev => ({
          ...prev,
          ...(prev.noticePeriod === undefined || prev.noticePeriod === "" || prev._autoNotice ? { noticePeriod: String(calc.noticeWeeks), _autoNotice: true } : {}),
          ...(prev.severanceWeeks === undefined || prev.severanceWeeks === "" || prev._autoSev ? { severanceWeeks: String(calc.severanceWeeks), _autoSev: true } : {}),
        }));
      }
    }
  }, [province, formData.yearsService, sel?.id]);

  const filtered = TEMPLATES.filter(tmpl => {
    if (!search) return true;
    const q = search.toLowerCase();
    return tmpl[lang].name.toLowerCase().includes(q) || tmpl[lang].desc.toLowerCase().includes(q);
  });
  const filled = sel ? sel.fields.filter(f => formData[f.id]?.trim()).length : 0;
  const total = sel ? sel.fields.length : 0;

  // ── Actions ──
  const handleSignup = async () => {
    if (!authForm.name || !authForm.email || !authForm.password) { setAuthError(t("All fields required","Tous les champs requis")); return; }
    if (authForm.password.length < 6) { setAuthError(t("Password must be 6+ characters","6+ caractères requis")); return; }
    if (!authForm.tosAccepted) { setAuthError(t("You must accept the Terms of Service","Vous devez accepter les conditions")); return; }
    setAuthError("");
    try {
      await signUp(authForm.email, authForm.password, authForm.name);
      const u = { name: authForm.name, email: authForm.email, lang };
      setUser(u);
      nav("onboarding");
    } catch (err) {
      setAuthError(err.message || t("Signup failed. Please try again.","Inscription échouée. Veuillez réessayer."));
    }
  };
  const handleLogin = async () => {
    if (!authForm.email || !authForm.password) { setAuthError(t("Email and password required","Courriel et mot de passe requis")); return; }
    setAuthError("");
    try {
      await logIn(authForm.email, authForm.password);
      const profile = await loadProfile();
      const docs = await loadDocuments();
      setUser(profile);
      setSavedDocs(docs || []);
      setLang(profile?.lang || "en");
      nav("dashboard");
    } catch (err) {
      setAuthError(err.message || t("Login failed. Check your email and password.","Connexion échouée. Vérifiez vos informations."));
    }
  };
  const handleOnboard = async () => {
    try {
      const updated = await updateProfile({ ...onboardForm, onboarded: true, lang });
      setUser(updated);
    } catch (err) {
      console.error("Onboarding save error:", err);
      setUser(prev => ({ ...prev, ...onboardForm, onboarded: true }));
    }
    nav("dashboard");
  };
  const handleGen = async () => {
    if (freeDocLimitReached) { nav("upgrade"); return; }
    const html = generateDocument(sel.id, formData, province, lang);
    setDoc(html);
    const entry = { templateId: sel.id, templateName: sel[lang].name, province, lang, date: new Date().toISOString(), html, formData: {...formData} };
    try {
      await saveDocument(entry);
      const docs = await loadDocuments();
      setSavedDocs(docs || []);
    } catch (err) {
      console.error("Document save error:", err);
      setSavedDocs(prev => [{ id: Date.now(), ...entry }, ...prev].slice(0, 50));
    }
    nav("preview");
  };
  const handleCopy = () => {
    copyToClipboard(doc, () => { setCopied(true); setTimeout(() => setCopied(false), 2200); });
  };
  const handlePDF = () => {
    setShowPrintView(true);
    setTimeout(() => {
      try { window.print(); } catch(e) {}
      // Keep print view open so user can retry or close manually
    }, 400);
  };
  const handleSaveSettings = async () => {
    const updates = {
      companyName: onboardForm.companyName || user.companyName,
      companyAddress: onboardForm.companyAddress || user.companyAddress,
      defaultProvince: onboardForm.defaultProvince || user.defaultProvince,
      employees: onboardForm.employees || user.employees,
      brandColor: onboardForm.brandColor || user.brandColor || "#C49355",
      companyTagline: onboardForm.companyTagline ?? user.companyTagline ?? "",
      lang,
    };
    try {
      const updated = await updateProfile(updates);
      setUser(updated);
    } catch (err) {
      console.error("Settings save error:", err);
      setUser(prev => ({ ...prev, ...updates }));
    }
    nav("dashboard");
  };
  const handleLogout = async () => {
    try { await logOut(); } catch (err) { console.error("Logout error:", err); }
    setUser(null);
    setAuthForm({ name: "", email: "", password: "" });
    nav("welcome");
  };

  // ── Stripe Upgrade ──
  const handleUpgrade = async () => {
    try {
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, email: user?.email }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(t("Could not start checkout. Please try again.", "Impossible de démarrer le paiement. Veuillez réessayer."));
      }
    } catch (err) {
      console.error("Upgrade error:", err);
      alert(t("Connection error. Please try again.", "Erreur de connexion. Veuillez réessayer."));
    }
  };

  // ── Chat: auto-scroll ──
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, chatLoading]);

  // ── Chat: send message ──
  // ── File upload for chat ──
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) { alert(lang === "en" ? "File too large (max 4MB)" : "Fichier trop volumineux (max 4 Mo)"); return; }

    try {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(",")[1];
          const mediaType = file.type;
          setChatFiles([{ type: "image", name: file.name, base64, mediaType }]);
        };
        reader.readAsDataURL(file);
      } else if (file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(",")[1];
          setChatFiles([{ type: "document", name: file.name, base64, mediaType: "application/pdf" }]);
        };
        reader.readAsDataURL(file);
      } else {
        // Text-based files
        const text = await file.text();
        setChatFiles([{ type: "text", name: file.name, content: text.slice(0, 15000) }]);
      }
    } catch { alert(lang === "en" ? "Could not read file" : "Impossible de lire le fichier"); }
  };

  const handleChat = async () => {
    if ((!chatInput.trim() && chatFiles.length === 0) || chatLoading) return;
    if (!isPro) { nav("upgrade"); return; }
    const userMsg = chatInput.trim();
    setChatInput("");
    const fileAttachments = [...chatFiles];
    setChatFiles([]);

    // Build display message
    const displayMsg = fileAttachments.length > 0
      ? (userMsg ? `📎 ${fileAttachments.map(f=>f.name).join(", ")}\n\n${userMsg}` : `📎 ${fileAttachments.map(f=>f.name).join(", ")}`)
      : userMsg;
    const newMessages = [...chatMessages, { role: "user", content: displayMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    const provName = PROVINCES.find(p => p.code === (user?.defaultProvince || "ON"))?.[lang] || "Ontario";
    const systemPrompt = `You are the Dutiva Advisor — a bilingual Senior HR & Payroll Specialist embedded in Dutiva Canada, a premium HR compliance platform for Canadian small businesses.

YOUR PROFESSIONAL IDENTITY:
- You combine the roles of HR Administrator, HR Generalist, HR Business Partner, Compensation & Benefits Analyst, and Payroll Specialist
- You have deep, practitioner-level expertise in Canadian employment standards legislation across all 14 jurisdictions (10 provinces, 3 territories, federal)
- Your specializations: talent acquisition & onboarding, total compensation & benefits administration, termination & severance, progressive discipline & performance management, workplace policy development, payroll compliance (CPP/QPP, EI, federal/provincial income tax, T4/RL-1), ROE preparation & EI administration, duty to accommodate & human rights obligations, leave management (statutory & discretionary), workplace investigations & complaints, independent contractor classification (CRA tests), occupational health & safety, and employment equity
- You are fluent in English and French and always respond in the language the user writes in

THE USER'S CONTEXT:
- Company: ${user?.companyName || "Not set"}
- Province/Jurisdiction: ${provName}
- Company size: ${user?.employees || "Not specified"} employees
- Language preference: ${lang === "en" ? "English" : "French"}

COMMUNICATION APPROACH:
You use professional corporate HR language as your default register — the language of board memos, compliance reports, and employment counsel. However, you are also skilled at translating complex legal and regulatory concepts into clear, plain language that a non-HR business owner can understand and act on. You adjust based on context:
- When citing legislation or explaining compliance requirements → formal, precise, corporate HR register
- When giving practical "here's what to do on Monday morning" guidance → clear, direct plain language
- Always accessible, never condescending — you're the senior colleague who explains without making people feel uninformed

ANALYTICAL FRAMEWORK — HOW YOU THINK:
You are rigorously objective, analytical, and evidence-based. You NEVER:
- Express personal opinions or subjective preferences on HR matters
- Say "I think" or "I feel" or "I believe" — you say "the legislation requires," "best practice indicates," "the CRA's position is"
- Speculate about outcomes without grounding in legislation, case law principles, or established HR standards
- Cherry-pick information to support a particular outcome — you present the full compliance picture

You ALWAYS:
- Ground every answer in verifiable sources: statutes, regulations, CRA publications, employment standards guides
- Cite specific legislation by name, section, and jurisdiction (e.g., "Under **s. 54(a)** of the *Employment Standards Act, 2000* (Ontario)...")
- Present the analysis as: **Legal requirement** → **Practical implication** → **Recommended action** → **Risk if non-compliant**
- When multiple interpretations exist, present them objectively with the weight of authority behind each
- Distinguish clearly between statutory minimums (what the law requires), common law considerations (what courts have awarded), and best practices (what leading employers do)
- Quantify when possible: notice periods in weeks, severance in weeks of salary, filing deadlines in calendar days
- Flag jurisdictional differences proactively — answer for the user's province first, then note material differences in ON, QC, BC, AB, FED

STRATEGIC DIMENSION:
Beyond compliance, you think strategically about:
- Risk mitigation: what exposure does this create? What documentation is needed?
- Employer brand impact: how does this decision affect retention and recruitment?
- Precedent-setting: will this create an expectation or pattern the employer must maintain?
- Cost-benefit: what's the financial exposure of non-compliance vs. the cost of compliance?
When relevant, you surface these strategic considerations after addressing the compliance question.

RESPONSE STRUCTURE:
1. **Direct answer first** — lead with the clear, actionable answer in 1-2 sentences
2. **Legislative basis** — cite the specific statute, section, and jurisdiction
3. **Practical guidance** — what to do, step by step if applicable
4. **Risk/strategic note** — flag exposure, documentation needs, or strategic considerations
5. **Template reference** — when Dutiva has a relevant template, mention it naturally

FORMATTING RULES (CRITICAL — your output renders as formatted HTML):
- Use ## for section headers (never #, keep headers concise and descriptive)
- Use **bold** for key terms, legislation names, section numbers, deadlines, and dollar amounts
- Use *italic* for act names, Latin terms, and defined legal concepts
- Use bullet lists (- item) for requirements, checklists, and options — keep items concise
- Use numbered lists (1. item) for sequential procedures
- Use > blockquote for critical warnings, legal caveats, or "consult a lawyer" flags
- Write short, scannable paragraphs (2-3 sentences max)
- Lead with the answer, never bury it
- Use --- to separate major sections in long answers

BOUNDARIES — NON-NEGOTIABLE:
- You provide HR and payroll compliance guidance grounded in Canadian employment standards legislation
- You are NOT a lawyer. You never provide legal advice, legal opinions, or case-specific legal conclusions
- For matters involving: potential litigation, wrongful dismissal claims beyond statutory minimums, human rights tribunal complaints, complex accommodation disputes, or ambiguous fact patterns → state clearly: "**This requires legal counsel**" and explain why
- Never guess at common law reasonable notice periods, damages, or settlement amounts — these require case-specific legal analysis
- Never provide medical advice — direct to the employee's healthcare provider or occupational health professional
- Never make assumptions about facts the user hasn't provided — ask clarifying questions
- Reference legislation and CRA guidance current as of 2025-2026
- If you are uncertain about a specific provision, say so — never fabricate a section number or statutory requirement`;

    try {
      // Build API messages, with file attachments on the last user message
      const apiMessages = newMessages.map((m, idx) => {
        if (m.role !== "user") return { role: m.role, content: m.content };
        // Only attach files to the last message
        if (idx === newMessages.length - 1 && fileAttachments.length > 0) {
          const contentBlocks = [];
          for (const f of fileAttachments) {
            if (f.type === "image") {
              contentBlocks.push({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } });
            } else if (f.type === "document") {
              contentBlocks.push({ type: "document", source: { type: "base64", media_type: f.mediaType, data: f.base64 } });
            } else if (f.type === "text") {
              contentBlocks.push({ type: "text", text: `[Attached file: ${f.name}]\n\n${f.content}` });
            }
          }
          contentBlocks.push({ type: "text", text: userMsg || "Please review the attached document and provide your HR/compliance analysis." });
          return { role: "user", content: contentBlocks };
        }
        return { role: m.role, content: m.content };
      });
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });
      const data = await response.json();
      const reply = data.content?.map(b => b.type === "text" ? b.text : "").join("") || (lang === "en" ? "I couldn't process that request. Please try again." : "Je n'ai pas pu traiter cette demande. Veuillez réessayer.");
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: lang === "en" ? "Connection error. Please check your network and try again." : "Erreur de connexion. Vérifiez votre réseau et réessayez." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── AI Auto-Fill ──
  const handleAiFill = async () => {
    if (!aiPrompt.trim() || !sel || aiLoading) return;
    if (!isPro) { nav("upgrade"); return; }
    setAiLoading(true);
    setAiFilled(false);
    const provName = PROVINCES.find(p => p.code === province)?.[lang] || "Ontario";
    const fieldList = sel.fields.map(f => `- "${f.id}": ${f[lang]}${f.type === "select" ? ` (options: ${f.options.map(o => o[lang]).join(", ")})` : f.type === "date" ? " (format: YYYY-MM-DD)" : ""}`).join("\n");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an HR document assistant for Dutiva Canada. The user will describe a situation and you must generate field values for an HR template. Province: ${provName}. Company: ${user?.companyName || "N/A"}. Company address: ${user?.companyAddress || "N/A"}.

RULES:
- Return ONLY a JSON object with field IDs as keys and values as strings
- Include ALL field IDs in your response — for fields you CAN fill, provide the value; for fields you CANNOT fill from the description, use an empty string ""
- For select fields, use EXACTLY one of the provided option values (use the ${lang === "en" ? "English" : "French"} option text)
- For dates, use YYYY-MM-DD format
- Use professional HR language
- Fill in realistic, compliant values based on the description
- If company name/address is known, use it for the companyName/companyAddress fields
- Do NOT invent information that was not stated or clearly implied — leave those fields as ""
- Do NOT include any text outside the JSON object
- Do NOT wrap in markdown code blocks`,
          messages: [{ role: "user", content: `Template: ${sel[lang].name}\nFields:\n${fieldList}\n\nSituation described by employer:\n"${aiPrompt.trim()}"\n\nGenerate the JSON field values (use "" for fields you cannot determine):` }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map(b => b.type === "text" ? b.text : "").join("") || "";
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setFormData(prev => ({ ...prev, ...parsed }));
      setAiFilled(true);
    } catch (err) {
      console.error("AI fill error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  // Compute which fields need attention after AI fill
  const missingFields = (aiFilled && sel) ? sel.fields.filter(f => !formData[f.id]?.trim()) : [];

  const AI_EXAMPLES = {
    offer: {
      en: "e.g., We're hiring Sarah Chen as a full-time Marketing Coordinator starting April 15. Salary $52,000/year, paid bi-weekly. She'll report to David Park, VP Marketing. 3-month probation. 2 weeks vacation. Benefits after 3 months. She has 5 days to accept.",
      fr: "ex. Nous embauchons Sarah Chen comme Coordonnatrice marketing à temps plein à partir du 15 avril. Salaire 52 000 $/an, aux deux semaines. Elle relèvera de David Park, VP Marketing. Probation de 3 mois. 2 semaines de vacances."
    },
    termination: {
      en: "e.g., I need to terminate John Smith, our warehouse manager, who has been with us for 5 years. He's being let go without cause due to restructuring. His salary is $65,000. Last day will be March 31. He has a company laptop and parking pass to return.",
      fr: "ex. Je dois mettre fin à l'emploi de Jean Tremblay, directeur d'entrepôt, en poste depuis 5 ans. Sans motif, restructuration. Salaire 65 000 $. Dernier jour le 31 mars. Portable et carte de stationnement à retourner."
    },
    warning: {
      en: "e.g., I need to issue a first written warning to Mike Johnson, our customer service rep in the Sales department. He's been consistently late — arrived 20-40 minutes late on March 3, 7, and 12. He was verbally warned on Feb 15. I want him reviewed in 30 days.",
      fr: "ex. Je dois émettre un premier avertissement écrit à Marc Dupont, représentant au service à la clientèle. Retards répétés de 20-40 min les 3, 7 et 12 mars. Avertissement verbal le 15 février. Révision dans 30 jours."
    },
    probation: {
      en: "e.g., Lisa Wong, our Junior Accountant hired on January 6, is finishing her 3-month probation on April 6. She's met expectations and I want to confirm her as a permanent employee.",
      fr: "ex. Lisa Wong, comptable junior embauchée le 6 janvier, termine sa probation de 3 mois le 6 avril. Elle a répondu aux attentes et je veux confirmer son emploi permanent."
    },
    returnleave: {
      en: "e.g., Angela Torres, our Office Manager, has been on maternity leave since September 2025. She's returning on April 7. Same role, same terms. She's requested a flexible schedule for the first month — starting at 9:30 instead of 8:30. HR contact is Priya Sharma.",
      fr: "ex. Angela Torres, directrice de bureau, est en congé de maternité depuis septembre 2025. Retour le 7 avril. Même poste. Elle demande un horaire flexible le premier mois — début à 9h30 au lieu de 8h30."
    },
    policy: {
      en: "e.g., I need a remote work policy for our company of 30 employees, effective May 1. It should apply to all employees. Approved by James Liu, CEO. Next review in one year.",
      fr: "ex. J'ai besoin d'une politique de télétravail pour nos 30 employés, en vigueur le 1er mai. S'applique à tous. Approuvée par James Liu, PDG. Révision dans un an."
    },
    roe: {
      en: "e.g., I need to prepare the ROE for Karen White, SIN ending in 4521. She was laid off due to shortage of work. Last day worked was March 14, last day paid was March 15. We pay bi-weekly. She has $1,200 in outstanding vacation pay.",
      fr: "ex. Je dois préparer le RE de Karen White, NAS se terminant par 4521. Mise à pied — manque de travail. Dernier jour travaillé 14 mars, dernier jour payé 15 mars. Paie aux deux semaines. 1 200 $ de vacances dues."
    },
    contractor: {
      en: "e.g., We're hiring a freelance web developer, Alex Rivera, to rebuild our company website. Contract runs April 1 to July 31. Rate is $95/hour, invoiced monthly, Net 30. They use their own equipment. Include a confidentiality clause. 15 days termination notice.",
      fr: "ex. Nous engageons un développeur web pigiste, Alex Rivera, pour refaire notre site. Contrat du 1er avril au 31 juillet. Taux 95 $/h, facturé mensuellement, Net 30. Équipement propre. Clause de confidentialité. Préavis de 15 jours."
    },
    promotion: {
      en: "e.g., I'm promoting Rachel Adams from Sales Associate to Sales Team Lead, effective April 1. Her salary goes from $48,000 to $58,000. She'll now manage a team of 4 and handle quarterly reporting.",
      fr: "ex. Je promeus Rachel Adams d'Associée aux ventes à Chef d'équipe des ventes, à compter du 1er avril. Salaire de 48 000 $ à 58 000 $. Elle gérera une équipe de 4 personnes."
    },
    reference: {
      en: "e.g., I need to write a reference for Tom Bradley, who worked as our Senior Graphic Designer from March 2021 to February 2026. He was excellent — led our rebrand, mentored junior designers, and always met deadlines. Very professional and creative. My contact is jmiller@company.ca.",
      fr: "ex. Je dois rédiger une référence pour Tom Bradley, Designer graphique senior de mars 2021 à février 2026. Excellent — a dirigé notre changement d'image, mentoré les juniors, toujours dans les délais."
    },
    investigation: {
      en: "e.g., Maria Lopez filed a harassment complaint on March 5 against her supervisor, Dan Peters. She alleges he made repeated inappropriate comments about her appearance on Feb 20 and 27. I interviewed Maria, Dan, and two witnesses (Amy Clark and Bob Hill). I also reviewed Slack messages. The allegations were substantiated.",
      fr: "ex. Maria Lopez a déposé une plainte de harcèlement le 5 mars contre son superviseur, Dan Peters. Elle allègue des commentaires inappropriés répétés les 20 et 27 février. J'ai interrogé les parties et deux témoins. Allégations fondées."
    },
    accommodation: {
      en: "e.g., David Nguyen, our warehouse associate, submitted a medical accommodation request on March 1 for a back injury. He needs ergonomic equipment and no lifting over 20 lbs for 3 months. We're approving it as requested. Review in 90 days. HR contact: hr@company.ca.",
      fr: "ex. David Nguyen, associé d'entrepôt, a demandé une adaptation médicale le 1er mars pour une blessure au dos. Il a besoin d'équipement ergonomique et aucune charge de plus de 10 kg pendant 3 mois. Approuvée. Révision dans 90 jours."
    },
    resignation: {
      en: "e.g., Emily Parker, our Accounting Clerk, submitted her resignation on March 10. She's been with us for 3 years. Her last day will be March 24. I'd like to schedule an exit interview. She needs to return her laptop, access card, and company credit card.",
      fr: "ex. Emily Parker, commis comptable, a remis sa démission le 10 mars. En poste depuis 3 ans. Dernier jour le 24 mars. Entrevue de départ prévue. Portable, carte d'accès et carte de crédit à retourner."
    },
    layoff: {
      en: "e.g., Due to a contract loss, I need to temporarily lay off 3 production workers, including James Wilson (Machine Operator, 4 years). Expected recall in 8-10 weeks. Benefits will continue during layoff. He needs to return his safety equipment.",
      fr: "ex. Suite à la perte d'un contrat, je dois mettre à pied temporairement 3 ouvriers, dont James Wilson (opérateur, 4 ans). Rappel prévu dans 8-10 semaines. Avantages maintenus. Équipement de sécurité à retourner."
    },
    pip: {
      en: "e.g., I need a performance improvement plan for Sandra Lee, our Customer Success Manager in the Operations dept. She's missed her client retention targets for 2 consecutive quarters and has had 3 client escalations. The PIP should run 60 days with bi-weekly check-ins. If not improved, next step is final written warning.",
      fr: "ex. J'ai besoin d'un plan d'amélioration pour Sandra Lee, gestionnaire du succès client au département Opérations. Objectifs de rétention manqués 2 trimestres consécutifs. Plan de 60 jours avec suivis aux deux semaines."
    },
    nda: {
      en: "e.g., We need an NDA for a new contractor, Kevin Park, who will have access to our client database and pricing strategy. The NDA should last 3 years. All materials must be returned upon termination. Effective April 1.",
      fr: "ex. Nous avons besoin d'une entente de non-divulgation pour un nouvel entrepreneur, Kevin Park, qui aura accès à notre base de données clients et notre stratégie de prix. Durée de 3 ans. Retour du matériel à la fin."
    },
  };

  const aiPlaceholder = sel ? (AI_EXAMPLES[sel.id]?.[lang] || "") : "";

  const showAutoCalc = (sel?.id === "termination" || sel?.id === "layoff") && province && formData.yearsService;
  const autoCalcData = showAutoCalc ? calcNotice(province, formData.yearsService) : null;
  const recentDocs = savedDocs.slice(0, 5);
  const provName = PROVINCES.find(p => p.code === province)?.[lang] || PROVINCES.find(p => p.code === (user?.defaultProvince || "ON"))?.[lang] || "Ontario";

  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300..700&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;-moz-text-size-adjust:100%;text-size-adjust:100%;overflow-x:hidden}
:root{--bg:#0B0E13;--bg2:#12161E;--bgc:#181D28;--srf:#222938;--bdr:#283040;--bdrh:rgba(200,150,90,0.25);--t1:#EDE9E0;--t2:#8D93A3;--t3:#636B80;--gold:#C49355;--goldh:#D4A76B;--gg:rgba(196,147,85,0.12);--gs:rgba(196,147,85,0.06);--sf:'Instrument Serif',Georgia,serif;--sn:'DM Sans',system-ui,sans-serif;--r:14px;--rs:10px;--r-sm:6px;--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px);--safe-left:env(safe-area-inset-left,0px);--safe-right:env(safe-area-inset-right,0px);--app-max:480px;--space-section:24px;--space-content:16px;--space-tight:8px}
body{background:var(--bg);overscroll-behavior:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
input:not([type="checkbox"]),textarea,select,button{-webkit-appearance:none;-moz-appearance:none;appearance:none;font-family:inherit;border-radius:0}
input[type="checkbox"]{font-family:inherit}
a{-webkit-tap-highlight-color:transparent}
/* ── Accessibility ── */
.skip-link{position:absolute;top:-100px;left:16px;padding:12px 20px;background:var(--gold);color:#0B0E13;font:700 14px var(--sn);border-radius:var(--rs);z-index:9999;transition:top 0.2s}
.skip-link:focus{top:16px}
*:focus-visible{outline:2px solid var(--gold);outline-offset:2px;border-radius:4px}
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
@media(forced-colors:active){.cta,.bp,.gold,.advisor-avatar,.dash-co-av,.esig-icon,.chat-persona-av,.ai-panel-icon{forced-color-adjust:none}}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
.app{font-family:var(--sn);max-width:var(--app-max);margin:0 auto;min-height:100vh;min-height:100dvh;background:var(--bg);color:var(--t1);display:flex;flex-direction:column;position:relative;padding-top:var(--safe-top);padding-left:var(--safe-left);padding-right:var(--safe-right)}
.app::after{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 25% 0%,rgba(196,147,85,0.05) 0%,transparent 55%);pointer-events:none;z-index:0}
.hdr{background:rgba(11,14,19,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:1px solid var(--bdr);padding:13px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.hdr-l{display:flex;align-items:center;gap:10px}
.logo{font-family:var(--sf);font-size:21px;color:var(--t1);letter-spacing:-0.02em}.logo b{color:var(--gold);font-weight:400}
.pill{padding:3px 8px;background:var(--gs);border:1px solid rgba(196,147,85,0.12);border-radius:5px;font-size:9.5px;font-weight:700;color:var(--gold);letter-spacing:0.12em;text-transform:uppercase}
.lbtn{background:var(--srf);border:1px solid var(--bdr);color:var(--t2);padding:6px 14px;border-radius:var(--r-sm);font:600 12.5px var(--sn);cursor:pointer;transition:all 0.2s;letter-spacing:0.06em}.lbtn:hover{border-color:var(--gold);color:var(--gold)}
.bdy{flex:1;overflow-y:auto;overflow-x:hidden;padding-bottom:calc(72px + var(--safe-bottom));position:relative;z-index:1;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain}.bdy::-webkit-scrollbar{width:4px}.bdy::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:2px}
.welc{padding:80px 32px 40px;text-align:center;display:flex;flex-direction:column;align-items:center}
.welc-logo{font-family:var(--sf);font-size:42px;color:var(--t1);margin-bottom:6px;letter-spacing:-0.03em}.welc-logo b{color:var(--gold);font-weight:400}
.welc-tag{font-size:13px;color:var(--t2);margin-bottom:40px;line-height:1.5}
.welc-sep{display:flex;align-items:center;gap:16px;width:100%;max-width:300px;margin:20px 0;color:var(--t3);font-size:12px}.welc-sep::before,.welc-sep::after{content:'';flex:1;height:1px;background:var(--bdr)}
.auth-form{width:100%;max-width:300px;display:flex;flex-direction:column;gap:14px;align-items:stretch}
.auth-form input{width:100%;padding:14px 16px;background:var(--bg2);border:1.5px solid var(--bdr);border-radius:var(--rs);font:15px var(--sn);color:var(--t1);outline:none;transition:all 0.3s}
.auth-form input:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gg)}.auth-form input::placeholder{color:var(--t3)}
.auth-err{font-size:12px;color:#E85D5D;text-align:center}
.auth-link{font-size:13px;color:var(--t2);margin-top:12px}.auth-link span{color:var(--gold);cursor:pointer;font-weight:600}
.dash-greet{padding:var(--space-section) 24px var(--space-tight)}
.dash-greet h1{font-family:var(--sf);font-size:28px;font-weight:400;color:var(--t1);margin-bottom:4px}
.dash-greet p{font-size:13px;color:var(--t2)}
.dash-co{margin:var(--space-content) 24px;padding:16px 18px;background:var(--bgc);border:1.5px solid var(--bdr);border-radius:var(--r);display:flex;align-items:center;gap:14px;cursor:pointer;transition:all 0.3s cubic-bezier(0.22,1,0.36,1)}
.dash-co:hover{border-color:var(--bdrh);transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,0,0,0.25)}
.dash-co-av{width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(196,147,85,0.15) 0%,rgba(196,147,85,0.05) 100%);border:1px solid rgba(196,147,85,0.2);border-radius:11px;color:var(--gold);font-family:var(--sf);font-size:20px;font-weight:700}
.dash-co-info{flex:1}.dash-co-nm{font-size:14.5px;font-weight:600;color:var(--t1)}.dash-co-mt{font-size:12px;color:var(--t2)}
.dash-sec{padding:var(--space-section) 24px var(--space-tight)}.dash-sec-t{font-size:10.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:var(--space-content);display:flex;align-items:center;gap:8px}.dash-sec-t::before{content:'';width:12px;height:1px;background:var(--gold)}
.dash-acts{padding:0 24px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dash-act{padding:20px 16px;background:var(--bgc);border:1.5px solid var(--bdr);border-radius:var(--r);cursor:pointer;transition:all 0.3s cubic-bezier(0.22,1,0.36,1);text-align:center;position:relative;overflow:hidden}
.dash-act::after{content:'';position:absolute;inset:0;background:linear-gradient(120deg,var(--gs) 0%,transparent 50%);opacity:0;transition:opacity 0.3s}
.dash-act:hover{border-color:var(--bdrh);transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.3)}
.dash-act:hover::after{opacity:1}
.dash-act-ic{margin-bottom:8px;color:var(--gold)}.dash-act-ic svg{width:28px;height:28px}
.dash-act-lb{font-size:13.5px;font-weight:600;color:var(--t1)}.dash-act-sub{font-size:11px;color:var(--t2);margin-top:3px}
.hist{margin:0 24px var(--space-tight);padding:14px 16px;background:var(--bgc);border:1.5px solid var(--bdr);border-radius:var(--r);cursor:pointer;transition:all 0.3s cubic-bezier(0.22,1,0.36,1);display:flex;align-items:center;gap:12px}.hist:hover{border-color:var(--bdrh);transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,0,0,0.25)}
.hist-ic{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--srf);border-radius:9px;color:var(--gold);flex-shrink:0}.hist-ic svg{width:18px;height:18px}
.hist-info{flex:1}.hist-nm{font-size:13px;font-weight:600;color:var(--t1)}.hist-dt{font-size:11px;color:var(--t3)}
.set-tabs{display:flex;gap:0;margin:0 24px 20px;background:var(--bg2);border-radius:var(--rs);overflow:hidden;border:1px solid var(--bdr)}
.set-tab{flex:1;padding:11px;text-align:center;font:600 12px var(--sn);color:var(--t3);cursor:pointer;transition:all 0.2s;border:none;background:none}.set-tab.on{background:var(--gold);color:#0B0E13}.set-tab:hover:not(.on){color:var(--t2)}
.onb{padding:40px 32px;text-align:center}
.onb h1{font-family:var(--sf);font-size:28px;font-weight:400;color:var(--t1);margin-bottom:6px}
.onb p{font-size:14px;color:var(--t2);margin-bottom:28px;line-height:1.5}
.onb-step{font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:20px}
.hero{padding:40px 24px 24px}.hero-ey{font-size:10.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:16px;display:flex;align-items:center;gap:8px}.hero-ey::before{content:'';width:20px;height:1px;background:var(--gold)}
.hero h1{font-family:var(--sf);font-size:36px;font-weight:400;line-height:1.12;color:var(--t1);margin-bottom:14px}.hero h1 em{font-style:italic;color:var(--gold)}.hero p{font-size:14.5px;line-height:1.6;color:var(--t2);max-width:340px}
.hero .count{font-size:12px;color:var(--t2);margin-top:12px}.hero .count b{color:var(--gold)}
.srch{margin:0 24px 24px;position:relative}.srch svg{position:absolute;left:15px;top:50%;transform:translateY(-50%)}.srch input{width:100%;padding:13px 16px 13px 44px;background:var(--bg2);border:1.5px solid var(--bdr);border-radius:var(--rs);font:14px var(--sn);color:var(--t1);outline:none;transition:all 0.3s}.srch input::placeholder{color:var(--t3)}.srch input:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gg)}
.grid{padding:0 24px;display:flex;flex-direction:column;gap:8px}
.card{background:var(--bgc);border:1.5px solid var(--bdr);border-radius:var(--r);padding:14px 16px;cursor:pointer;transition:all 0.3s cubic-bezier(0.22,1,0.36,1);display:flex;align-items:center;gap:12px;position:relative;overflow:hidden}
.card::after{content:'';position:absolute;inset:0;background:linear-gradient(120deg,var(--gs) 0%,transparent 50%);opacity:0;transition:opacity 0.3s}.card:hover{border-color:var(--bdrh);transform:translateY(-2px);box-shadow:0 8px 40px rgba(0,0,0,0.35)}.card:hover::after{opacity:1}
.cico{width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(196,147,85,0.1) 0%,rgba(196,147,85,0.04) 100%);border:1px solid rgba(196,147,85,0.15);border-radius:11px;flex-shrink:0;position:relative;z-index:1;color:var(--gold);transition:all 0.3s}.cico svg{width:20px;height:20px}
.card:hover .cico{background:linear-gradient(135deg,rgba(196,147,85,0.18) 0%,rgba(196,147,85,0.08) 100%);border-color:rgba(196,147,85,0.3);box-shadow:0 0 16px rgba(196,147,85,0.1)}
.cinf{flex:1;position:relative;z-index:1}.cnm{font-size:14px;font-weight:600;color:var(--t1);margin-bottom:1px}.cds{font-size:12px;color:var(--t2);line-height:1.35}
.carr{color:var(--t2);font-size:20px;transition:all 0.3s;position:relative;z-index:1}.card:hover .carr{color:var(--gold);transform:translateX(4px)}
.disc{margin:var(--space-section) 24px 0;padding:14px 16px;background:var(--gs);border:1px solid rgba(196,147,85,0.12);border-radius:var(--rs);font-size:11.5px;color:var(--t2);line-height:1.6}
.shdr{padding:var(--space-section) 24px 20px}
.back{display:inline-flex;align-items:center;gap:6px;color:var(--t2);font:500 13px var(--sn);cursor:pointer;margin-bottom:20px;background:none;border:none;padding:0;transition:color 0.2s}.back:hover{color:var(--gold)}
.st{font:400 26px/1.15 var(--sf);color:var(--t1);margin-bottom:6px}.ss{font-size:13px;color:var(--t2)}
.pgrid{padding:0 24px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pb{padding:11px 14px;background:var(--bgc);border:1.5px solid var(--bdr);border-radius:var(--rs);color:var(--t2);font:500 13px var(--sn);cursor:pointer;transition:all 0.2s;text-align:left}.pb:hover{border-color:var(--bdrh);color:var(--t1)}.pb.on{background:var(--gold);border-color:var(--gold);color:#0B0E13;font-weight:650}
.cta{margin:24px 24px 0;padding:14px;background:var(--gold);color:#0B0E13;border:none;border-radius:var(--rs);font:700 14.5px var(--sn);cursor:pointer;transition:all 0.2s;width:calc(100% - 48px)}.cta:hover{background:var(--goldh);box-shadow:0 4px 28px rgba(196,147,85,0.28)}.cta:disabled{background:var(--srf);color:var(--t3);cursor:default;box-shadow:none}
.frm{padding:0 24px}
.prog{display:flex;align-items:center;gap:14px;padding:0 24px 20px}.progt{flex:1;height:3px;background:var(--srf);border-radius:2px;overflow:hidden}.progf{height:100%;background:linear-gradient(90deg,var(--gold),var(--goldh));border-radius:2px;transition:width 0.4s cubic-bezier(0.22,1,0.36,1)}.progn{font:600 12px var(--sn);color:var(--t2);font-variant-numeric:tabular-nums;white-space:nowrap}
.fld{margin-bottom:18px}.fld label{display:block;font-size:10.5px;font-weight:650;color:var(--t2);margin-bottom:7px;letter-spacing:0.06em;text-transform:uppercase}
.fld input,.fld textarea,.fld select{width:100%;padding:12px 14px;background:var(--bg2);border:1.5px solid var(--bdr);border-radius:var(--rs);font:14.5px var(--sn);color:var(--t1);outline:none;transition:border-color 0.3s,box-shadow 0.3s}
.fld input:focus,.fld textarea:focus,.fld select:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gg)}
.fld input::placeholder,.fld textarea::placeholder{color:var(--t3)}.fld textarea{min-height:78px;resize:vertical;line-height:1.5;font-family:var(--sn)}
.fld select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23636B80' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:38px}
.auto-calc{margin:0 24px var(--space-content);padding:12px 16px;background:rgba(196,147,85,0.08);border:1px solid rgba(196,147,85,0.15);border-radius:var(--rs);font-size:12px;color:var(--gold);line-height:1.6}.auto-calc strong{font-weight:700}
/* ── Mode Toggle ── */
.mode-toggle{display:flex;gap:0;margin:0 24px var(--space-content);background:var(--bg2);border-radius:var(--rs);overflow:hidden;border:1px solid var(--bdr)}
.mode-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;font:600 12px var(--sn);color:var(--t3);cursor:pointer;transition:all 0.2s;border:none;background:none}
.mode-btn:hover:not(.on){color:var(--t2)}
.mode-btn.on{background:var(--gold);color:#0B0E13}
.mode-btn svg{flex-shrink:0}
/* ── AI Panel ── */
.ai-panel{margin:0 24px var(--space-content);background:linear-gradient(135deg,rgba(196,147,85,0.08) 0%,var(--bgc) 100%);border:1.5px solid rgba(196,147,85,0.2);border-radius:var(--r);padding:20px;animation:chatIn 0.3s ease}
.ai-panel-header{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.ai-panel-icon{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--gold),var(--goldh));border-radius:10px;color:#0B0E13;flex-shrink:0}
.ai-panel-title{font-size:14px;font-weight:700;color:var(--t1)}
.ai-panel-sub{font-size:11.5px;color:var(--t2);margin-top:1px}
.ai-panel-input{width:100%;padding:14px;background:var(--bg2);border:1.5px solid var(--bdr);border-radius:var(--rs);font:13.5px var(--sn);color:var(--t1);outline:none;min-height:100px;resize:vertical;line-height:1.55;transition:border-color 0.3s}
.ai-panel-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gg)}
.ai-panel-input::placeholder{color:var(--t3)}
.ai-panel-btn{width:100%;margin-top:12px;padding:13px;background:var(--gold);color:#0B0E13;border:none;border-radius:var(--rs);font:700 14px var(--sn);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px}
.ai-panel-btn:hover{background:var(--goldh);box-shadow:0 4px 20px rgba(196,147,85,0.25)}
.ai-panel-btn:disabled{background:var(--srf);color:var(--t3);cursor:default;box-shadow:none}
.ai-panel-note{margin-top:10px;font-size:12px;color:var(--gold);text-align:center}
.ai-panel-missing{margin-top:12px;padding:12px 14px;background:rgba(232,93,93,0.08);border:1px solid rgba(232,93,93,0.2);border-radius:var(--rs)}
.ai-panel-missing-title{font-size:12.5px;font-weight:700;color:#E8A54D;margin-bottom:4px}
.ai-panel-missing-list{font-size:11.5px;color:var(--t2);line-height:1.5}
/* ── Flagged Fields ── */
.fld-missing label{color:#E8A54D}
.fld-flag{display:inline-block;margin-left:8px;padding:1px 7px;background:rgba(232,165,77,0.12);border:1px solid rgba(232,165,77,0.25);border-radius:4px;font-size:9px;font-weight:700;color:#E8A54D;letter-spacing:0.06em;text-transform:uppercase;vertical-align:middle}
.input-missing{border-color:rgba(232,165,77,0.4) !important;background:rgba(232,165,77,0.04) !important}
.input-missing:focus{border-color:#E8A54D !important;box-shadow:0 0 0 3px rgba(232,165,77,0.12) !important}
.input-missing::placeholder{color:rgba(232,165,77,0.5) !important}
.ai-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(11,14,19,0.2);border-top-color:#0B0E13;border-radius:50%;animation:spin 0.6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.dwrap{margin:0 24px 20px}
.doc-paper{background:linear-gradient(180deg,#FDFBF7 0%,#F7F3EC 100%);border-radius:var(--r);padding:40px 28px 36px;max-height:70vh;overflow-y:auto;overflow-x:hidden;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;line-height:1.75;color:#1C1A15;box-shadow:0 20px 80px rgba(0,0,0,0.5),0 2px 8px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.6);position:relative;-webkit-overflow-scrolling:touch;scroll-behavior:smooth}
.doc-paper::before{content:'';position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#8B6D3F,#C49355,#D4A76B,#C49355,#8B6D3F);border-radius:var(--r) var(--r) 0 0}
.doc-paper::-webkit-scrollbar{width:3px}.doc-paper::-webkit-scrollbar-thumb{background:#C8C0B0;border-radius:2px}
.doc-paper .doc-header{text-align:center;margin-bottom:6px}.doc-paper .doc-company{font-size:20px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase}.doc-paper .doc-addr{font-size:11px;color:#6B655A}
.doc-paper .dhr{border:none;border-top:1.5px solid #D4CFC2;margin:16px 0}
.doc-paper .doc-meta{display:flex;flex-wrap:wrap;gap:4px 20px;font-size:11px;color:#6B655A}.doc-paper .doc-meta strong{color:#1C1A15}
.doc-paper .doc-type{font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:16px 0 3px}
.doc-paper .doc-classification{font-family:'DM Sans',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#C49355;text-align:center;margin-bottom:16px}
.doc-paper h2{font-family:'DM Sans',sans-serif;font-size:10.5px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8B6D3F;margin:22px 0 10px;padding-bottom:4px;border-bottom:1px solid #E8E2D6}
.doc-paper p{margin-bottom:10px}.doc-paper ul,.doc-paper ol{margin:0 0 12px 18px}.doc-paper li{margin-bottom:4px}
.doc-paper .doc-table{width:100%;border-collapse:collapse;margin:10px 0 14px;font-size:12.5px}.doc-paper .doc-table td{padding:6px 10px;border-bottom:1px solid #ECE7DC;vertical-align:top}.doc-paper .doc-table .dt-label{width:38%;font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#7A7468}
.doc-paper .doc-quote{background:#F2EEE5;border-left:3px solid #C49355;padding:10px 14px;margin:8px 0 14px;border-radius:0 4px 4px 0;font-size:12.5px;line-height:1.6}
.doc-paper .doc-note{font-size:11.5px;color:#6B655A;font-style:italic}.doc-paper .doc-small{font-size:11px;color:#7A7468}.doc-paper .blank{color:#C49355;font-weight:600}
.doc-paper .sig-block{margin:22px 0 6px;min-width:180px;display:inline-block}.doc-paper .sig-line{border-top:1.5px solid #1C1A15;width:200px;margin-bottom:4px}.doc-paper .sig-name{font-weight:700;font-size:13px}.doc-paper .sig-title{font-size:11px;color:#6B655A}.doc-paper .sig-date{font-size:12px;color:#6B655A;margin-top:6px}
.acts{padding:0 24px;display:flex;gap:8px;flex-wrap:wrap}
.bp{flex:1;min-width:120px;padding:13px;background:var(--gold);color:#0B0E13;border:none;border-radius:var(--rs);font:700 13.5px var(--sn);cursor:pointer;transition:all 0.2s}.bp:hover{background:var(--goldh)}
.bs{flex:1;min-width:120px;padding:13px;background:var(--bgc);color:var(--t1);border:1.5px solid var(--bdr);border-radius:var(--rs);font:600 13.5px var(--sn);cursor:pointer;transition:all 0.2s}.bs:hover{border-color:var(--gold);color:var(--gold)}
.bg{display:block;margin:10px 24px 0;padding:12px;background:transparent;color:var(--t2);border:1px solid var(--bdr);border-radius:var(--rs);font:500 13px var(--sn);cursor:pointer;width:calc(100% - 48px);transition:all 0.2s}.bg:hover{border-color:var(--t2);color:var(--t1)}
.pvh{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.lp{padding:3px 10px;background:var(--gs);border:1px solid rgba(196,147,85,0.12);border-radius:5px;font:650 10.5px var(--sn);color:var(--gold);letter-spacing:0.08em}
.doc-watermark{text-align:center;padding:12px 16px 0;font-size:10px;color:var(--t3);letter-spacing:0.03em}.doc-watermark span{color:var(--gold);font-weight:700}
/* ── Advisor Card ── */
.advisor-card{background:linear-gradient(135deg,rgba(196,147,85,0.1) 0%,var(--bgc) 100%);border:1.5px solid rgba(196,147,85,0.2);border-radius:var(--r);padding:18px 20px;cursor:pointer;transition:all 0.3s cubic-bezier(0.22,1,0.36,1);display:flex;align-items:center;justify-content:space-between}
.advisor-card:hover{border-color:var(--gold);transform:translateY(-2px);box-shadow:0 8px 32px rgba(196,147,85,0.12)}
.advisor-card-left{display:flex;align-items:center;gap:14px}
.advisor-avatar{width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--gold) 0%,var(--goldh) 100%);border-radius:12px;color:#0B0E13;flex-shrink:0}
.advisor-card-title{font-size:14px;font-weight:700;color:var(--t1)}.advisor-card-sub{font-size:11.5px;color:var(--t2);margin-top:1px}
.advisor-card-badge{padding:5px 12px;background:var(--gold);color:#0B0E13;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap}
/* ── Chat ── */
.chat-wrap{display:flex;flex-direction:column;height:calc(100vh - 58px);height:calc(100dvh - 58px);position:relative}
.chat-header{padding:20px 24px 16px}
.chat-persona{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.chat-persona-av{width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--gold),var(--goldh));border-radius:11px;color:#0B0E13;flex-shrink:0}
.chat-persona-av svg{width:20px;height:20px}
.chat-persona-info{flex:1}.chat-persona-name{font-size:15px;font-weight:700;color:var(--t1)}.chat-persona-role{font-size:11.5px;color:var(--t2)}
.chat-status{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--gold)}.chat-status::before{content:'';width:6px;height:6px;background:var(--gold);border-radius:50%}
.chat-messages{flex:1;overflow-y:auto;padding:0 24px 16px;display:flex;flex-direction:column;gap:12px}
.chat-messages::-webkit-scrollbar{width:3px}.chat-messages::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:2px}
.chat-msg{max-width:92%;padding:14px 16px;border-radius:14px;font-size:13.5px;line-height:1.65;animation:chatIn 0.3s ease}
@keyframes chatIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.chat-msg.user{align-self:flex-end;background:var(--gold);color:#0B0E13;border-bottom-right-radius:4px;max-width:80%;padding:12px 16px}
.chat-msg.assistant{align-self:flex-start;background:var(--bgc);color:var(--t1);border:1px solid var(--bdr);border-bottom-left-radius:4px;padding:18px 20px}
.chat-msg.assistant h1,.chat-msg.assistant h2,.chat-msg.assistant h3{font-family:var(--sn);color:var(--gold);margin:16px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--bdr);letter-spacing:0.04em}
.chat-msg.assistant h1{font-size:14px;font-weight:700}
.chat-msg.assistant h2{font-size:13px;font-weight:700}
.chat-msg.assistant h3{font-size:12.5px;font-weight:600;border-bottom:none;padding-bottom:0}
.chat-msg.assistant h1:first-child,.chat-msg.assistant h2:first-child,.chat-msg.assistant h3:first-child{margin-top:0}
.chat-msg.assistant p{margin:0 0 10px;line-height:1.65}
.chat-msg.assistant p:last-child{margin-bottom:0}
.chat-msg.assistant strong{color:var(--gold);font-weight:700}
.chat-msg.assistant em{color:var(--t2);font-style:italic}
.chat-msg.assistant ul,.chat-msg.assistant ol{margin:6px 0 12px 18px;padding:0}
.chat-msg.assistant li{margin-bottom:5px;line-height:1.55}
.chat-msg.assistant li::marker{color:var(--gold)}
.chat-msg.assistant code{background:rgba(196,147,85,0.1);color:var(--gold);padding:2px 6px;border-radius:4px;font-size:12px;font-family:'DM Sans',monospace}
.chat-msg.assistant pre{background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r-sm);padding:12px 14px;margin:8px 0 12px;overflow-x:auto;font-size:12px;line-height:1.5}
.chat-msg.assistant blockquote{border-left:3px solid var(--gold);padding:8px 14px;margin:8px 0 12px;background:rgba(196,147,85,0.04);border-radius:0 6px 6px 0;font-size:13px;color:var(--t2)}
.chat-msg.assistant hr{border:none;border-top:1px solid var(--bdr);margin:14px 0}
.chat-msg.assistant .legal-ref{display:inline;background:rgba(196,147,85,0.08);border:1px solid rgba(196,147,85,0.15);border-radius:4px;padding:1px 6px;font-size:11.5px;color:var(--gold);font-weight:600;white-space:nowrap}
.chat-msg.assistant a{color:var(--gold);text-decoration:underline}
.chat-typing{align-self:flex-start;padding:14px 18px;background:var(--bgc);border:1px solid var(--bdr);border-radius:14px;border-bottom-left-radius:4px;display:flex;gap:5px;align-items:center}
.chat-dot{width:6px;height:6px;background:var(--t3);border-radius:50%;animation:dotPulse 1.4s infinite}
.chat-dot:nth-child(2){animation-delay:0.2s}.chat-dot:nth-child(3){animation-delay:0.4s}
@keyframes dotPulse{0%,80%,100%{opacity:0.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}
.chat-suggestions{padding:0 24px 12px;display:flex;flex-wrap:wrap;gap:6px}
.chat-sug{padding:8px 14px;background:var(--bg2);border:1px solid var(--bdr);border-radius:20px;font-size:12px;color:var(--t2);cursor:pointer;transition:all 0.2s;white-space:nowrap}
.chat-sug:hover{border-color:var(--gold);color:var(--gold)}
.chat-input-wrap{padding:12px 24px calc(20px + var(--safe-bottom));display:flex;gap:8px;align-items:center;border-top:1px solid var(--bdr);background:rgba(11,14,19,0.9);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.chat-input{flex:1;padding:13px 16px;background:var(--bg2);border:1.5px solid var(--bdr);border-radius:24px;font:14px var(--sn);color:var(--t1);outline:none;transition:border-color 0.3s}
.chat-input:focus{border-color:var(--gold)}
.chat-input::placeholder{color:var(--t3)}
.chat-send{width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:var(--gold);border:none;border-radius:50%;cursor:pointer;transition:all 0.2s;flex-shrink:0;color:#0B0E13}
.chat-send:hover{background:var(--goldh);box-shadow:0 2px 12px rgba(196,147,85,0.3)}
.chat-send:disabled{background:var(--srf);color:var(--t3);cursor:default;box-shadow:none}
.chat-disc{padding:8px 24px;font-size:10px;color:var(--t3);text-align:center;line-height:1.4}
/* ── File Attachment ── */
.chat-attach{width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:var(--srf);border:1px solid var(--bdr);border-radius:50%;cursor:pointer;transition:all 0.2s;flex-shrink:0;color:var(--t2)}
.chat-attach:hover{border-color:var(--gold);color:var(--gold);background:var(--gs)}
.chat-file-preview{padding:4px 24px 0;display:flex;flex-wrap:wrap;gap:6px}
.chat-file-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg2);border:1px solid var(--bdr);border-radius:20px;font-size:12px;color:var(--t2)}
.chat-file-chip svg{color:var(--gold);flex-shrink:0}
/* ── E-Signature Section ── */
.esig-section{margin:0 24px 20px;background:var(--bgc);border:1.5px solid var(--bdr);border-radius:var(--r);padding:var(--space-section);overflow:hidden}
.esig-header{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--bdr)}
.esig-icon{width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--gold),var(--goldh));border-radius:10px;color:#0B0E13;flex-shrink:0}
.esig-title{font-size:15px;font-weight:700;color:var(--t1)}.esig-sub{font-size:11.5px;color:var(--t2);margin-top:1px}
.esig-legal{margin-top:16px;padding:14px 16px;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--rs);font-size:10.5px;color:var(--t3);line-height:1.6}
.esig-legal p{margin-bottom:6px}.esig-legal p:last-child{margin-bottom:0}.esig-legal strong{color:var(--t1)}.esig-legal em{color:var(--gold)}
/* ── Signature Pad ── */
.sig-pad-wrap{margin:12px 0;padding:16px;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--rs)}
.sig-pad-label{font-size:11px;font-weight:650;color:var(--t2);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px}
.sig-mode-toggle{display:flex;gap:0;margin-bottom:12px;background:var(--bg);border-radius:var(--rs);overflow:hidden;border:1px solid var(--bdr)}
.sig-mode-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;font:600 12px var(--sn);color:var(--t3);cursor:pointer;transition:all 0.2s;border:none;background:none}
.sig-mode-btn:hover:not(.on){color:var(--t2)}.sig-mode-btn.on{background:var(--gold);color:#0B0E13}
.sig-mode-btn svg{flex-shrink:0}
/* Typed signature */
.sig-type-box{margin-bottom:10px}
.sig-type-input{width:100%;padding:12px 14px;background:var(--bg);border:1.5px solid var(--bdr);border-radius:var(--r-sm);font:15px var(--sn);color:var(--t1);outline:none;transition:border-color 0.3s}
.sig-type-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gg)}
.sig-type-input::placeholder{color:var(--t3)}
.sig-type-preview{margin-top:12px;padding:16px 20px 12px;background:#FDFBF7;border-radius:var(--r-sm);border:1px solid #E8E2D6;text-align:left}
.sig-type-rendered{font-family:'Instrument Serif',Georgia,serif;font-size:28px;font-style:italic;color:#1C1A15;line-height:1.3;padding-bottom:4px}
.sig-type-line{border-top:1.5px solid #1C1A15;width:100%;margin-top:4px}
/* Draw pad */
.sig-pad-box{position:relative;border:1.5px solid var(--bdr);border-radius:var(--r-sm);overflow:hidden;background:#FDFBF7}
.sig-pad-box canvas{display:block;width:100%;height:100px;cursor:crosshair;touch-action:none}
.sig-pad-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#B0AAA0;pointer-events:none}
.sig-pad-actions{display:flex;gap:8px;margin-top:10px}
.sig-pad-clear{flex:1;padding:9px;background:none;border:1px solid var(--bdr);border-radius:var(--r-sm);font:500 12px var(--sn);color:var(--t3);cursor:pointer;transition:all 0.2s}
.sig-pad-clear:hover{border-color:var(--t2);color:var(--t1)}.sig-pad-clear:disabled{opacity:0.4;cursor:default}
.sig-pad-save{flex:2;padding:9px;background:var(--gold);border:none;border-radius:var(--r-sm);font:700 12px var(--sn);color:#0B0E13;cursor:pointer;transition:all 0.2s}
.sig-pad-save:hover{background:var(--goldh)}.sig-pad-save:disabled{background:var(--srf);color:var(--t3);cursor:default}
/* ── Saved Signature ── */
.sig-saved{margin:12px 0;padding:16px;background:var(--bg2);border:1px solid rgba(93,174,139,0.25);border-radius:var(--rs)}
.sig-saved-label{font-size:11px;font-weight:650;color:var(--t2);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px}
.sig-saved-img{max-width:220px;height:auto;background:#FDFBF7;border-radius:var(--r-sm);padding:8px;border:1px solid #E8E2D6;display:block;margin-bottom:8px}
.sig-saved-info{display:flex;align-items:center;gap:6px;font-size:11px;color:#5DAE8B;font-weight:600}
.sig-saved-info svg{color:#5DAE8B;flex-shrink:0}
.sig-reset{margin-top:8px;padding:6px 12px;background:none;border:1px solid var(--bdr);border-radius:var(--r-sm);font:500 11px var(--sn);color:var(--t3);cursor:pointer;transition:all 0.2s}
.sig-reset:hover{border-color:var(--t2);color:var(--t1)}
.sig-saved-legal{margin-top:10px;padding:10px 12px;background:rgba(93,174,139,0.06);border:1px solid rgba(93,174,139,0.15);border-radius:var(--r-sm);font-size:10px;color:var(--t3);line-height:1.55}
.tos-row{display:flex;align-items:center;gap:10px;padding:6px 0;text-align:left;width:100%;justify-content:flex-start}
.tos-cb{width:20px;height:20px;min-width:20px;accent-color:var(--gold);flex-shrink:0;cursor:pointer}
.tos-text{font-size:12.5px;color:var(--t2);line-height:1.45;text-align:left;flex:1}.tos-text span{color:var(--gold);cursor:pointer;font-weight:600}
.brand-preview{margin:12px 0 20px;padding:18px;background:var(--bg2);border:1.5px solid var(--bdr);border-radius:var(--r);text-align:center}
.brand-preview-bar{height:5px;border-radius:3px;margin-bottom:14px}
.brand-preview-name{font-family:var(--sf);font-size:18px;font-weight:700;color:var(--t1);margin-bottom:4px}
.brand-preview-tag{font-size:11px;color:var(--t2)}
.color-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:8px 0 4px}
.color-swatch{width:100%;aspect-ratio:1;border-radius:var(--r-sm);cursor:pointer;border:2px solid transparent;transition:all 0.2s}
.color-swatch.on{border-color:var(--t1);box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--t1)}
.legal-doc{padding:0 24px;font-size:13px;color:var(--t2);line-height:1.7}
.legal-doc h3{font:700 12px var(--sn);color:var(--t1);letter-spacing:0.06em;text-transform:uppercase;margin:20px 0 8px}
.legal-doc p{margin-bottom:10px}
.legal-doc ul{margin:0 0 12px 16px}.legal-doc li{margin-bottom:6px}

/* ══════════════════════════════════════════
   RESPONSIVE — TABLET (768px+)
   ══════════════════════════════════════════ */
@media(min-width:768px){
  :root{--app-max:640px}
  .hero h1{font-size:42px}
  .hero p{font-size:15.5px;max-width:440px}
  .welc-logo{font-size:52px}
  .welc-tag{font-size:15px;max-width:400px}
  .auth-form{max-width:380px}
  .pgrid{grid-template-columns:1fr 1fr 1fr}
  .dash-acts{grid-template-columns:1fr 1fr 1fr}
  .doc-paper{padding:48px 36px 44px;max-height:600px;font-size:15px}
  .frm{max-width:540px}
  .chat-msg{max-width:85%}
  .chat-msg.assistant{padding:20px 24px}
  .esig-section{padding:24px}
  .sig-pad-box canvas{height:120px}
  .card{padding:16px 20px}
  .set-tabs{max-width:400px;margin:0 auto 20px}
}

/* ══════════════════════════════════════════
   RESPONSIVE — DESKTOP (1024px+)
   ══════════════════════════════════════════ */
@media(min-width:1024px){
  :root{--app-max:780px;--space-section:32px;--space-content:20px}
  .hero{padding:56px 32px 32px}
  .hero h1{font-size:48px}
  .welc{padding:100px 40px 60px}
  .welc-logo{font-size:58px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 32px}
  .srch{margin:0 32px 28px}
  .shdr{padding:var(--space-section) 32px 24px}
  .frm{padding:0 32px;max-width:640px}
  .pgrid{padding:0 32px;grid-template-columns:1fr 1fr 1fr}
  .dash-acts{grid-template-columns:1fr 1fr 1fr}
  .dash-greet{padding:var(--space-section) 32px 12px}
  .dash-greet h1{font-size:32px}
  .dash-co{margin:var(--space-content) 32px}
  .dash-sec{padding:var(--space-section) 32px 12px}
  .hist{margin:0 32px var(--space-tight)}
  .disc{margin:var(--space-section) 32px 0}
  .doc-paper{padding:56px 48px 48px;max-height:700px;font-size:15.5px}
  .dwrap{margin:0 32px var(--space-section)}
  .acts{padding:0 32px}
  .bg{margin:10px 32px 0;width:calc(100% - 64px)}
  .esig-section{margin:0 32px var(--space-section);padding:var(--space-section)}
  .chat-msg{max-width:75%}
  .chat-msg.assistant{max-width:80%;padding:22px 28px}
  .chat-messages{padding:0 32px 16px}
  .chat-suggestions{padding:0 32px 12px}
  .chat-input-wrap{padding:14px 32px calc(20px + var(--safe-bottom))}
  .chat-file-preview{padding:4px 32px 0}
  .chat-disc{padding:8px 32px}
  .auto-calc{margin:0 32px var(--space-content)}
  .prog{padding:0 32px 22px}
  .mode-toggle{margin:0 32px var(--space-content)}
  .ai-panel{margin:0 32px var(--space-content)}
  .advisor-card{margin:0}
  .card:hover{transform:translateY(-3px);box-shadow:0 12px 48px rgba(0,0,0,0.4)}
  .sig-pad-box canvas{height:140px}
  .sig-saved-img{max-width:280px}
}

/* ══════════════════════════════════════════
   RESPONSIVE — WIDE DESKTOP (1440px+)
   ══════════════════════════════════════════ */
@media(min-width:1440px){
  :root{--app-max:860px}
  .hero h1{font-size:52px}
  .doc-paper{max-height:800px}
}

/* ══════════════════════════════════════════
   TOUCH OPTIMIZATION
   ══════════════════════════════════════════ */
@media(hover:none)and(pointer:coarse){
  .card,.pb,.dash-act,.hist,.chat-sug,.advisor-card,.lbtn,.mode-btn,.sig-mode-btn{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  .card:hover{transform:none;box-shadow:none}
  .card:active{transform:scale(0.98);opacity:0.9;transition:all 0.1s}
  .pb:active,.dash-act:active,.lbtn:active{transform:scale(0.97);opacity:0.9}
  .cta:active,.bp:active,.bs:active{transform:scale(0.98);opacity:0.9}
  .fld input,.fld textarea,.fld select,.auth-form input,.chat-input,.ai-panel-input,.sig-type-input{font-size:16px}
  .sig-pad-box{touch-action:none;-ms-touch-action:none}
}

/* ══════════════════════════════════════════
   HIGH-DPI / RETINA
   ══════════════════════════════════════════ */
@media(-webkit-min-device-pixel-ratio:2),(min-resolution:192dpi){
  .sig-pad-box canvas{image-rendering:auto}
  .dhr,.doc-paper .dhr{border-top-width:0.5px}
}

/* ══════════════════════════════════════════
   LANDSCAPE PHONE
   ══════════════════════════════════════════ */
@media(max-height:500px)and(orientation:landscape){
  .welc{padding:40px 32px 20px}
  .welc-logo{font-size:32px}
  .hero{padding:24px 24px 16px}
  .hero h1{font-size:28px}
  .doc-paper{max-height:300px}
  .chat-wrap{height:calc(100vh - 50px)}
}

/* ══════════════════════════════════════════
   SMALL PHONES (<375px)
   ══════════════════════════════════════════ */
@media(max-width:374px){
  .hero h1{font-size:28px}
  .hero p{font-size:13px}
  .card{padding:12px 14px;gap:10px}
  .cico{width:36px;height:36px}.cico svg{width:17px;height:17px}
  .cnm{font-size:13px}.cds{font-size:11px}
  .st{font-size:22px}
  .pgrid{grid-template-columns:1fr 1fr;gap:6px}
  .pb{padding:10px 12px;font-size:12px}
  .fld label{font-size:10px}
  .fld input,.fld textarea,.fld select{padding:11px 12px;font-size:14px}
  .welc{padding:60px 20px 30px}
  .welc-logo{font-size:34px}
  .auth-form{max-width:100%}
  .doc-paper{padding:28px 18px 24px;font-size:13px}
}

/* ══════════════════════════════════════════
   DARK MODE / LIGHT MODE SYSTEM PREFERENCE
   (App is dark by default — this prevents
   system light mode from affecting inputs)
   ══════════════════════════════════════════ */
@media(prefers-color-scheme:light){
  .fld input,.fld textarea,.fld select,.auth-form input,.chat-input,.ai-panel-input{color-scheme:dark}
}

/* ══════════════════════════════════════════
   REDUCED MOTION PREFERENCE
   ══════════════════════════════════════════ */
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important}
}

/* ══════════════════════════════════════════
   PRINT
   ══════════════════════════════════════════ */
@media print{
  body,.app,.app::after,.hdr,.bdy,.skip-link{all:unset !important;display:block !important;background:#fff !important;color:#000 !important;max-width:100% !important;overflow:visible !important;position:static !important;padding:0 !important;margin:0 !important}
  .hdr,.bdy,.skip-link,.app::after{display:none !important}
  .print-overlay{display:block !important;position:static !important;background:#fff !important;padding:0.5in !important}
  .print-overlay .print-close{display:none !important}
  .print-doc-body{max-height:none !important;box-shadow:none !important;border-radius:0 !important;padding:0 !important;background:#fff !important;color:#1C1A15 !important;font-family:'Cormorant Garamond',Georgia,serif !important;font-size:12pt !important;line-height:1.7 !important}
  .print-doc-body .doc-quote{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .print-doc-body .doc-company{font-size:16pt}.print-doc-body h2{font-size:9pt;color:#8B6D3F !important}
  .print-doc-body .doc-classification{color:#C49355 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .print-footer{display:block !important;margin-top:30px;padding-top:10px;border-top:1px solid #D4CFC2;text-align:center;font-family:'DM Sans',sans-serif;font-size:7pt;color:#B0AAA0}
}
/* ── Print Overlay (screen) ── */
.print-overlay{display:none;position:fixed;inset:0;z-index:9999;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch}
.print-overlay.active{display:flex;flex-direction:column}
.print-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:rgba(11,14,19,0.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--bdr);position:sticky;top:0;z-index:10}
.print-bar-title{font:600 14px var(--sn);color:var(--t1)}
.print-bar-actions{display:flex;gap:8px}
.print-bar-btn{padding:8px 16px;border-radius:var(--r-sm);font:600 12.5px var(--sn);cursor:pointer;transition:all 0.2s;border:none}
.print-bar-primary{background:var(--gold);color:#0B0E13}.print-bar-primary:hover{background:var(--goldh)}
.print-bar-secondary{background:var(--srf);color:var(--t2);border:1px solid var(--bdr)}.print-bar-secondary:hover{color:var(--t1);border-color:var(--t2)}
.print-doc-wrap{flex:1;padding:24px;display:flex;justify-content:center}
.print-doc-body{width:100%;max-width:680px;background:linear-gradient(180deg,#FDFBF7 0%,#F7F3EC 100%);border-radius:var(--r);padding:48px 36px;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;line-height:1.75;color:#1C1A15;box-shadow:0 20px 80px rgba(0,0,0,0.5)}
.print-doc-body .doc-header{text-align:center;margin-bottom:6px}.print-doc-body .doc-company{font-size:20px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.print-doc-body .doc-addr{font-size:11px;color:#6B655A}.print-doc-body .dhr{border:none;border-top:1.5px solid #D4CFC2;margin:16px 0}
.print-doc-body .doc-meta{display:flex;flex-wrap:wrap;gap:4px 20px;font-size:11px;color:#6B655A}.print-doc-body .doc-meta strong{color:#1C1A15}
.print-doc-body .doc-type{font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:center;margin:16px 0 3px}
.print-doc-body .doc-classification{font-family:'DM Sans',sans-serif;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#C49355;text-align:center;margin-bottom:16px}
.print-doc-body h2{font-family:'DM Sans',sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8B6D3F;margin:22px 0 10px;padding-bottom:4px;border-bottom:1px solid #E8E2D6}
.print-doc-body p{margin-bottom:10px}.print-doc-body ul,.print-doc-body ol{margin:0 0 12px 18px}.print-doc-body li{margin-bottom:4px}
.print-doc-body .doc-table{width:100%;border-collapse:collapse;margin:10px 0 14px;font-size:12.5px}.print-doc-body .doc-table td{padding:6px 10px;border-bottom:1px solid #ECE7DC;vertical-align:top}
.print-doc-body .doc-quote{background:#F2EEE5;border-left:3px solid #C49355;padding:10px 14px;margin:8px 0 14px;border-radius:0 4px 4px 0;font-size:12.5px;line-height:1.6}
.print-doc-body .doc-note{font-size:11.5px;color:#6B655A;font-style:italic}.print-doc-body .doc-small{font-size:11px;color:#7A7468}
.print-doc-body .blank{color:#C49355;font-weight:600}
.print-doc-body .sig-block{margin:22px 0 6px;min-width:180px;display:inline-block}.print-doc-body .sig-line{border-top:1.5px solid #1C1A15;width:200px;margin-bottom:4px}.print-doc-body .sig-name{font-weight:700;font-size:13px}.print-doc-body .sig-title{font-size:11px;color:#6B655A}
.print-footer{display:none;margin-top:30px;text-align:center;font-family:'DM Sans',sans-serif;font-size:8px;color:#B0AAA0}
.print-hint{text-align:center;padding:16px 24px 32px;font-size:12px;color:var(--t3);line-height:1.5}
.print-hint kbd{padding:2px 8px;background:var(--srf);border:1px solid var(--bdr);border-radius:4px;font:600 11px var(--sn);color:var(--t2)}
`;

  const SIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#636B80" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
  const PlusIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>;
  const GearIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>;
  const AdvisorIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v2"/><path d="M12 14h.01"/></svg>;

  const Header = () => (
    <header className="hdr">
      <div className="hdr-l" style={{cursor:"pointer"}} onClick={() => user?.onboarded && nav("dashboard")}>
        <div className="logo">Duti<b>va</b></div><span className="pill">Canada</span>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {user && <button className="lbtn" style={{padding:"6px 10px"}} onClick={()=>{setSettingsTab("company");setOnboardForm({companyName:user.companyName||"",companyAddress:user.companyAddress||"",defaultProvince:user.defaultProvince||"",employees:user.employees||""});nav("settings")}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        </button>}
        <button className="lbtn" onClick={() => {const nl=lang==="en"?"fr":"en";setLang(nl);if(user){const u={...user,lang:nl};setUser(u);updateProfile({lang:nl}).catch(()=>{})}}}>{lang==="en"?"FR":"EN"}</button>
      </div>
    </header>
  );

  if (screen === "loading") return <><style>{CSS}</style><div className="app" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><div className="logo" style={{fontSize:32}}>Duti<b>va</b></div></div></>;

  return (
    <><style>{CSS}</style>
    <div className="app" role="application" aria-label="Dutiva Canada">
      <a className="skip-link" href="#main-content" tabIndex={0} onClick={e=>{e.preventDefault();ref.current?.focus()}}>{t("Skip to main content","Aller au contenu principal")}</a>
      {!["welcome","signup","login"].includes(screen) && <Header />}
      <div className="bdy" ref={ref} key={anim} id="main-content" role="main" tabIndex={-1}>

        {/* ══ WELCOME ══ */}
        {screen === "welcome" && <FadeIn><div className="welc">
          <div className="welc-logo">Duti<b>va</b></div>
          <div style={{marginBottom:6}}><span className="pill">Canada</span></div>
          <p className="welc-tag">{t("The bilingual HR co-pilot for\nCanadian small businesses.","Le copilote RH bilingue pour\nles PME canadiennes.")}</p>
          <button className="cta" style={{width:"100%",maxWidth:300,margin:0}} onClick={()=>nav("signup")}>{t("Get Started — Free","Commencer — Gratuit")}</button>
          <div className="welc-sep">{t("or","ou")}</div>
          <button className="bs" style={{width:"100%",maxWidth:300,margin:0}} onClick={()=>nav("login")}>{t("Log in to your account","Se connecter")}</button>
          <p style={{fontSize:11.5,color:"var(--t3)",marginTop:28,lineHeight:1.6,maxWidth:260}}>{t("16 templates · 14 jurisdictions · EN/FR · ESA calculator · PDF export","16 modèles · 14 juridictions · EN/FR · Calculateur · PDF")}</p>
          <div style={{display:"flex",gap:16,marginTop:16,flexWrap:"wrap",justifyContent:"center"}}><span style={{fontSize:11,color:"var(--t3)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>nav("terms")}>{t("Terms","Conditions")}</span><span style={{fontSize:11,color:"var(--t3)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>nav("privacy")}>{t("Privacy","Confidentialité")}</span><span style={{fontSize:11,color:"var(--t3)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>nav("accessibility")}>{t("Accessibility","Accessibilité")}</span><span style={{fontSize:11,color:"var(--t3)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>nav("technology")}>{t("AI & Technology","IA et technologie")}</span></div>
          <p style={{fontSize:10,color:"var(--t3)",marginTop:16,opacity:0.6}}>© {new Date().getFullYear()} Dutiva Canada</p>
        </div></FadeIn>}

        {/* ══ SIGNUP ══ */}
        {screen === "signup" && <FadeIn><div className="welc">
          <div className="welc-logo" style={{fontSize:32}}>Duti<b>va</b></div>
          <p className="welc-tag">{t("Create your account","Créer votre compte")}</p>
          <div className="auth-form">
            <input placeholder={t("Full name","Nom complet")} value={authForm.name} onChange={e=>setAuthForm(p=>({...p,name:e.target.value}))} />
            <input placeholder={t("Email address","Adresse courriel")} type="email" value={authForm.email} onChange={e=>setAuthForm(p=>({...p,email:e.target.value}))} />
            <input placeholder={t("Password (6+ characters)","Mot de passe (6+ car.)")} type="password" value={authForm.password} onChange={e=>setAuthForm(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleSignup()} />
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",textAlign:"left",width:"100%",justifyContent:"flex-start"}}>
              <input type="checkbox" style={{width:18,height:18,minWidth:18,accentColor:"var(--gold)",cursor:"pointer",flexShrink:0,margin:0}} checked={authForm.tosAccepted} onChange={e=>setAuthForm(p=>({...p,tosAccepted:e.target.checked}))} />
              <span style={{fontSize:12.5,color:"var(--t2)",lineHeight:1.45,textAlign:"left"}}>{t(<>I agree to the <span style={{color:"var(--gold)",cursor:"pointer",fontWeight:600}} onClick={()=>nav("terms")}>Terms</span> and <span style={{color:"var(--gold)",cursor:"pointer",fontWeight:600}} onClick={()=>nav("privacy")}>Privacy Policy</span></>,<>J'accepte les <span style={{color:"var(--gold)",cursor:"pointer",fontWeight:600}} onClick={()=>nav("terms")}>Conditions</span> et la <span style={{color:"var(--gold)",cursor:"pointer",fontWeight:600}} onClick={()=>nav("privacy")}>Confidentialité</span></>)}</span>
            </div>
            {authError && <div className="auth-err">{authError}</div>}
            <button className="cta" style={{width:"100%",margin:0}} onClick={handleSignup}>{t("Create Account","Créer le compte")}</button>
          </div>
          <p className="auth-link">{t("Already have an account?","Déjà un compte?")} <span onClick={()=>{setAuthError("");nav("login")}}>{t("Log in","Se connecter")}</span></p>
        </div></FadeIn>}

        {/* ══ LOGIN ══ */}
        {screen === "login" && <FadeIn><div className="welc">
          <div className="welc-logo" style={{fontSize:32}}>Duti<b>va</b></div>
          <p className="welc-tag">{t("Welcome back","Bon retour")}</p>
          <div className="auth-form">
            <input placeholder={t("Email address","Adresse courriel")} type="email" value={authForm.email} onChange={e=>setAuthForm(p=>({...p,email:e.target.value}))} />
            <input placeholder={t("Password","Mot de passe")} type="password" value={authForm.password} onChange={e=>setAuthForm(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            {authError && <div className="auth-err">{authError}</div>}
            <button className="cta" style={{width:"100%",margin:0}} onClick={handleLogin}>{t("Log In","Se connecter")}</button>
          </div>
          <p className="auth-link">{t("No account?","Pas de compte?")} <span onClick={()=>{setAuthError("");nav("signup")}}>{t("Sign up","S'inscrire")}</span></p>
        </div></FadeIn>}

        {/* ══ ONBOARDING ══ */}
        {screen === "onboarding" && <>
          <FadeIn><div className="onb">
            <div className="onb-step">{t("Company Profile","Profil de l'entreprise")}</div>
            <h1>{t("Set up your company","Configurez votre entreprise")}</h1>
            <p>{t("This pre-fills every document. Change anytime in Settings.","Pré-remplit chaque document. Modifiable dans les paramètres.")}</p>
          </div></FadeIn>
          <FadeIn delay={100}><div className="frm">
            <div className="fld"><label>{t("Company name","Nom de l'entreprise")}</label><input value={onboardForm.companyName} onChange={e=>setOnboardForm(p=>({...p,companyName:e.target.value}))} /></div>
            <div className="fld"><label>{t("Address","Adresse")}</label><input value={onboardForm.companyAddress} onChange={e=>setOnboardForm(p=>({...p,companyAddress:e.target.value}))} /></div>
            <div className="fld"><label>{t("Default province","Province par défaut")}</label>
              <select value={onboardForm.defaultProvince} onChange={e=>setOnboardForm(p=>({...p,defaultProvince:e.target.value}))}>
                <option value="">{t("Select...","Sélectionner...")}</option>
                {PROVINCES.map(p => <option key={p.code} value={p.code}>{p[lang]}</option>)}
              </select></div>
            <div className="fld"><label>{t("Number of employees","Nombre d'employés")}</label>
              <select value={onboardForm.employees} onChange={e=>setOnboardForm(p=>({...p,employees:e.target.value}))}>
                <option value="">—</option><option value="1-5">1–5</option><option value="6-25">6–25</option><option value="26-50">26–50</option><option value="51+">51+</option>
              </select></div>
          </div></FadeIn>
          <FadeIn delay={200}>
            <button className="cta" disabled={!onboardForm.companyName} onClick={handleOnboard}>{t("Complete Setup →","Terminer →")}</button>
            <button className="bg" onClick={()=>{const u={...user,onboarded:true};setUser(u);saveUser(u);nav("dashboard")}}>{t("Skip for now","Passer")}</button>
          </FadeIn>
        </>}

        {/* ══ DASHBOARD ══ */}
        {screen === "dashboard" && <>
          <FadeIn><div className="dash-greet">
            <h1>{t(`Welcome, ${user?.name?.split(" ")[0]||""}`,`Bienvenue, ${user?.name?.split(" ")[0]||""}`)}</h1>
            <p>{t("What do you need today?","De quoi avez-vous besoin?")}</p>
          </div></FadeIn>
          {user?.companyName && <FadeIn delay={60}><div className="dash-co" onClick={()=>{setSettingsTab("company");setOnboardForm({companyName:user.companyName||"",companyAddress:user.companyAddress||"",defaultProvince:user.defaultProvince||"",employees:user.employees||""});nav("settings")}}>
            <div className="dash-co-av">{user.companyName.charAt(0).toUpperCase()}</div>
            <div className="dash-co-info">
              <div className="dash-co-nm">{user.companyName}</div>
              <div className="dash-co-mt">{PROVINCES.find(p=>p.code===user.defaultProvince)?.[lang]||""}{user.employees?` · ${user.employees} ${t("emp.","emp.")}`:""}</div>
            </div>
            <span className="carr">›</span>
          </div></FadeIn>}
          <FadeIn delay={100}>
            <div className="dash-sec"><div className="dash-sec-t">{t("HR Advisor","Conseiller RH")}</div></div>
            <div style={{padding:"0 24px",marginBottom:16}}>
              <div className="advisor-card" onClick={()=>nav("advisor")}>
                <div className="advisor-card-left">
                  <div className="advisor-avatar"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v2"/><path d="M12 14h.01"/></svg></div>
                  <div><div className="advisor-card-title">{t("Dutiva Advisor","Conseiller Dutiva")}</div><div className="advisor-card-sub">{t("Senior HR & Payroll Specialist","Spécialiste principal RH et paie")}</div></div>
                </div>
                <div className="advisor-card-badge">{t("Ask anything","Posez une question")}</div>
              </div>
            </div>

            <div className="dash-sec"><div className="dash-sec-t">{t("Quick Actions","Actions rapides")}</div></div>
            <div className="dash-acts">
              <div className="dash-act" onClick={()=>nav("home")}><div className="dash-act-ic"><PlusIcon/></div><div className="dash-act-lb">{t("New Document","Nouveau document")}</div><div className="dash-act-sub">{t("16 templates","16 modèles")}</div></div>
              <div className="dash-act" onClick={()=>{setSettingsTab("company");setOnboardForm({companyName:user?.companyName||"",companyAddress:user?.companyAddress||"",defaultProvince:user?.defaultProvince||"",employees:user?.employees||""});nav("settings")}}><div className="dash-act-ic"><GearIcon/></div><div className="dash-act-lb">{t("Settings","Paramètres")}</div><div className="dash-act-sub">{t("Company profile","Profil")}</div></div>
            </div>
          </FadeIn>
          {recentDocs.length > 0 && <FadeIn delay={160}>
            <div className="dash-sec"><div className="dash-sec-t">{t("Recent Documents","Documents récents")}</div></div>
            {recentDocs.map(d => {
              const tmpl = TEMPLATES.find(x=>x.id===d.templateId);
              return <div key={d.id} className="hist" onClick={()=>{setDoc(d.html);setSel(tmpl);setProvince(d.province);setFormData(d.formData||{});nav("preview")}}>
                <div className="hist-ic">{tmpl ? ICONS[tmpl.id] : null}</div>
                <div className="hist-info"><div className="hist-nm">{d.templateName}</div><div className="hist-dt">{new Date(d.date).toLocaleDateString(lang==="en"?"en-CA":"fr-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})} · {PROVINCES.find(p=>p.code===d.province)?.[lang]}</div></div>
                <span className="carr">›</span>
              </div>;
            })}
          </FadeIn>}
          {!recentDocs.length && <FadeIn delay={160}><div style={{padding:"40px 24px",textAlign:"center"}}><p style={{color:"var(--t3)",fontSize:14,lineHeight:1.6}}>{t("No documents yet.\nCreate your first one!","Aucun document.\nCréez votre premier!")}</p></div></FadeIn>}
          {!isPro && <FadeIn delay={200}><div style={{margin:"0 24px 16px",padding:"14px 16px",background:"var(--gs)",border:"1px solid rgba(196,147,85,0.2)",borderRadius:"var(--rs)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div><div style={{fontSize:13,fontWeight:700,color:"var(--gold)",marginBottom:2}}>{t("Free Plan","Plan gratuit")}</div><div style={{fontSize:11,color:"var(--t2)"}}>{freeDocsThisMonth}/2 {t("documents used this month","documents utilisés ce mois-ci")}</div></div>
            <button onClick={()=>nav("upgrade")} style={{background:"var(--gold)",color:"#0B0E13",border:"none",borderRadius:"var(--r-sm)",padding:"8px 16px",font:"700 12px var(--sn)",cursor:"pointer",whiteSpace:"nowrap"}}>{t("Upgrade","Passer à Pro")}</button>
          </div></FadeIn>}
          <FadeIn delay={220}><div className="disc">{t("⚖️ Dutiva provides templates and general guidance only. Not legal advice.","⚖️ Modèles et conseils généraux. Pas un avis juridique.")}</div></FadeIn>
        </>}

        {/* ══ SETTINGS ══ */}
        {screen === "settings" && <>
          <FadeIn><div className="shdr"><button className="back" onClick={()=>nav("dashboard")}>← {t("Dashboard","Tableau de bord")}</button><div className="st">{t("Settings","Paramètres")}</div></div></FadeIn>
          <FadeIn delay={60}><div className="set-tabs">
            <button className={`set-tab ${settingsTab==="company"?"on":""}`} onClick={()=>setSettingsTab("company")}>{t("Company","Entreprise")}</button>
            <button className={`set-tab ${settingsTab==="brand"?"on":""}`} onClick={()=>setSettingsTab("brand")}>{t("Brand","Marque")}</button>
            <button className={`set-tab ${settingsTab==="account"?"on":""}`} onClick={()=>setSettingsTab("account")}>{t("Account","Compte")}</button>
            <button className={`set-tab ${settingsTab==="data"?"on":""}`} onClick={()=>setSettingsTab("data")}>{t("Data","Données")}</button>
          </div></FadeIn>
          {settingsTab==="company" && <FadeIn delay={100}><div className="frm">
            <div className="fld"><label>{t("Company name","Nom")}</label><input value={onboardForm.companyName} onChange={e=>setOnboardForm(p=>({...p,companyName:e.target.value}))}/></div>
            <div className="fld"><label>{t("Address","Adresse")}</label><input value={onboardForm.companyAddress} onChange={e=>setOnboardForm(p=>({...p,companyAddress:e.target.value}))}/></div>
            <div className="fld"><label>{t("Province","Province")}</label><select value={onboardForm.defaultProvince} onChange={e=>setOnboardForm(p=>({...p,defaultProvince:e.target.value}))}><option value="">—</option>{PROVINCES.map(p=><option key={p.code} value={p.code}>{p[lang]}</option>)}</select></div>
            <div className="fld"><label>{t("Employees","Employés")}</label><select value={onboardForm.employees} onChange={e=>setOnboardForm(p=>({...p,employees:e.target.value}))}><option value="">—</option><option value="1-5">1–5</option><option value="6-25">6–25</option><option value="26-50">26–50</option><option value="51+">51+</option></select></div>
            <button className="cta" style={{width:"100%",margin:"8px 0 0"}} onClick={handleSaveSettings}>{t("Save Changes","Enregistrer")}</button>
          </div></FadeIn>}
          {settingsTab==="brand" && <FadeIn delay={100}><div className="frm">
            <div className="brand-preview">
              <div className="brand-preview-bar" style={{background:`linear-gradient(90deg, ${onboardForm.brandColor||"#C49355"}, ${onboardForm.brandColor||"#C49355"}88)`}}/>
              <div className="brand-preview-name">{onboardForm.companyName || user?.companyName || t("Your Company","Votre entreprise")}</div>
              <div className="brand-preview-tag">{onboardForm.companyTagline || t("Your tagline appears here","Votre slogan apparaît ici")}</div>
            </div>
            <div className="fld"><label>{t("Brand accent color","Couleur d'accent de marque")}</label>
              <div className="color-grid">
                {["#C49355","#3B82F6","#10B981","#8B5CF6","#EF4444","#EC4899","#F59E0B","#06B6D4","#6366F1","#84CC16","#1A1A18","#6B7280"].map(c => (
                  <div key={c} className={`color-swatch ${(onboardForm.brandColor||"#C49355")===c?"on":""}`} style={{background:c}} onClick={()=>setOnboardForm(p=>({...p,brandColor:c}))} />
                ))}
              </div>
              <input style={{marginTop:8}} placeholder={t("Or enter hex code: #C49355","Ou entrez un code hex: #C49355")} value={onboardForm.brandColor||""} onChange={e=>setOnboardForm(p=>({...p,brandColor:e.target.value}))} />
            </div>
            <div className="fld"><label>{t("Company tagline (optional)","Slogan de l'entreprise (optionnel)")}</label><input value={onboardForm.companyTagline||""} onChange={e=>setOnboardForm(p=>({...p,companyTagline:e.target.value}))} placeholder={t("e.g., Building better workplaces","ex. Bâtir de meilleurs milieux de travail")} /></div>
            <p style={{fontSize:11,color:"var(--t3)",lineHeight:1.5,marginBottom:14}}>{t("Your brand color and tagline will appear on the document letterhead. All documents include a 'Powered by Dutiva' mark.","Votre couleur et slogan apparaîtront sur l'en-tête. Tous les documents incluent la mention « Propulsé par Dutiva ».")}</p>
            <button className="cta" style={{width:"100%",margin:"8px 0 0"}} onClick={handleSaveSettings}>{t("Save Brand Settings","Enregistrer la marque")}</button>
          </div></FadeIn>}
          {settingsTab==="account" && <FadeIn delay={100}><div className="frm">
            {[{l:t("Name","Nom"),v:user?.name},{l:t("Email","Courriel"),v:user?.email},{l:t("Member since","Membre depuis"),v:user?.createdAt?new Date(user.createdAt).toLocaleDateString(lang==="en"?"en-CA":"fr-CA",{year:"numeric",month:"long",day:"numeric"}):"—"},{l:t("Language","Langue"),v:lang==="en"?"English":"Français"}].map((item,i)=><div key={i} style={{padding:"14px 0",borderBottom:"1px solid var(--bdr)"}}><div style={{fontSize:12,color:"var(--t2)",marginBottom:3}}>{item.l}</div><div style={{fontSize:15,color:"var(--t1)",fontWeight:600}}>{item.v}</div></div>)}
            <div style={{padding:"14px 0",display:"flex",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"var(--gold)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>nav("terms")}>{t("Terms","Conditions")}</span>
              <span style={{fontSize:12,color:"var(--gold)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>nav("privacy")}>{t("Privacy","Confidentialité")}</span>
              <span style={{fontSize:12,color:"var(--gold)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>nav("accessibility")}>{t("Accessibility","Accessibilité")}</span>
              <span style={{fontSize:12,color:"var(--gold)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>nav("technology")}>{t("AI & Tech","IA et tech.")}</span>
            </div>
            <button className="bg" style={{width:"100%",margin:"12px 0 0",borderColor:"#E85D5D",color:"#E85D5D"}} onClick={handleLogout}>{t("Log Out","Se déconnecter")}</button>
          </div></FadeIn>}
          {settingsTab==="data" && <FadeIn delay={100}><div className="frm">
            <div style={{padding:"20px 0",textAlign:"center",borderBottom:"1px solid var(--bdr)",marginBottom:16}}>
              <div style={{fontSize:32,color:"var(--gold)",fontWeight:700,fontFamily:"var(--sf)"}}>{savedDocs.length}</div>
              <div style={{fontSize:12,color:"var(--t2)",marginTop:4}}>{t("documents generated","documents générés")}</div>
            </div>
            <p style={{fontSize:12,color:"var(--t3)",lineHeight:1.5,marginBottom:12}}>{t("Document history is stored locally. Clearing cannot be undone.","L'historique est stocké localement. Irréversible.")}</p>
            <button className="bg" style={{width:"100%",margin:0,borderColor:"#E85D5D",color:"#E85D5D"}} onClick={async ()=>{try{await clearDocuments();}catch(e){console.error(e);}setSavedDocs([])}}>{t("Clear All History","Effacer l'historique")}</button>
          </div></FadeIn>}
        </>}

        {/* ══ HR ADVISOR ══ */}
        {screen === "advisor" && <div className="chat-wrap">
          <div className="chat-header">
            <button className="back" onClick={()=>{nav("dashboard")}}>← {t("Dashboard","Tableau de bord")}</button>
            <div className="chat-persona">
              <div className="chat-persona-av"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v2"/><path d="M12 14h.01"/></svg></div>
              <div className="chat-persona-info">
                <div className="chat-persona-name">{t("Dutiva Advisor","Conseiller Dutiva")}</div>
                <div className="chat-persona-role">{t("Senior HR & Payroll Specialist","Spécialiste principal RH et paie")}</div>
              </div>
            </div>
            <div className="chat-status">{t("Online","En ligne")} — {PROVINCES.find(p=>p.code===(user?.defaultProvince||"ON"))?.[lang]} {t("jurisdiction","juridiction")}</div>
          </div>

          <div className="chat-messages">
            {chatMessages.length === 0 && <FadeIn>
              <div style={{textAlign:"center",padding:"20px 0 8px"}}>
                <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.6,maxWidth:300,margin:"0 auto"}}>{t("Ask me anything about Canadian employment law, HR compliance, payroll, or workplace policies. I'll cite the specific legislation that applies to your jurisdiction.","Posez-moi toute question sur le droit du travail canadien, la conformité RH, la paie ou les politiques. Je citerai la législation applicable.")}</div>
              </div>
            </FadeIn>}
            {chatMessages.map((msg, i) => (
              msg.role === "user"
                ? <div key={i} className="chat-msg user">{msg.content}</div>
                : <div key={i} className="chat-msg assistant" dangerouslySetInnerHTML={{__html: parseMarkdown(msg.content)}} />
            ))}
            {chatLoading && <div className="chat-typing"><div className="chat-dot"/><div className="chat-dot"/><div className="chat-dot"/></div>}
            <div ref={chatEndRef}/>
          </div>

          {chatMessages.length === 0 && <div className="chat-suggestions">
            {(lang === "en" ? [
              "What's the minimum notice for terminating someone with 3 years of service?",
              "Do I need to pay overtime after 40 or 44 hours?",
              "How do I classify a worker as contractor vs employee?",
              "When is the ROE filing deadline?",
              "What are my obligations for maternity leave?",
              "Can I extend a probation period?",
            ] : [
              "Quel est le préavis minimum pour 3 ans de service?",
              "Les heures sup. après 40 ou 44 heures?",
              "Entrepreneur ou employé — comment classer?",
              "Date limite pour soumettre le RE?",
              "Obligations pour le congé de maternité?",
              "Puis-je prolonger une probation?",
            ]).map((q, i) => (
              <FadeIn key={i} delay={200 + i * 60}><button className="chat-sug" onClick={() => { setChatInput(""); const m = [{role:"user",content:q}]; setChatMessages(m); setChatLoading(true); const pn=PROVINCES.find(p=>p.code===(user?.defaultProvince||"ON"))?.[lang]||"Ontario"; fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`You are the Dutiva Advisor — a bilingual Senior HR & Payroll Specialist for Canadian small businesses. Company: ${user?.companyName||"Not set"}. Province: ${pn}. Size: ${user?.employees||"N/A"}. Language: ${lang==="en"?"English":"French"}.

APPROACH: You are rigorously objective, analytical, evidence-based. Never say "I think" — say "the legislation requires" or "the CRA's position is." Cite specific statutes by name and section. Structure as: direct answer → legislative basis → practical guidance → risk note.

FORMAT: Use ## for headers. **Bold** for legislation, section numbers, deadlines. *Italic* for act names. Bullet lists for requirements. > Blockquote for warnings. Short paragraphs (2-3 sentences). Lead with the direct answer. You are NOT a lawyer — flag when legal counsel is needed.`,messages:m})}).then(r=>r.json()).then(d=>{const reply=d.content?.map(b=>b.type==="text"?b.text:"").join("")||"Error"; setChatMessages(prev=>[...prev,{role:"assistant",content:reply}])}).catch(()=>setChatMessages(prev=>[...prev,{role:"assistant",content:lang==="en"?"Connection error.":"Erreur de connexion."}])).finally(()=>setChatLoading(false)) }}>{q}</button></FadeIn>
            ))}
          </div>}

          <div className="chat-disc">{t("Dutiva Advisor provides general HR & payroll guidance based on Canadian employment standards. This is not legal advice.","Le Conseiller fournit des conseils généraux. Ceci n'est pas un avis juridique.")}</div>
          {chatFiles.length > 0 && <div className="chat-file-preview">
            {chatFiles.map((f,i) => <div key={i} className="chat-file-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
              <span>{f.name}</span>
              <button onClick={()=>setChatFiles([])} style={{background:"none",border:"none",color:"var(--t3)",cursor:"pointer",padding:0,marginLeft:4}}>✕</button>
            </div>)}
          </div>}
          <div className="chat-input-wrap">
            <input type="file" ref={chatFileRef} style={{display:"none"}} accept=".pdf,.png,.jpg,.jpeg,.gif,.txt,.csv,.doc,.docx" onChange={handleFileUpload} />
            <button className="chat-attach" onClick={()=>chatFileRef.current?.click()} title={t("Attach document","Joindre un document")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input className="chat-input" placeholder={t("Ask a question or attach a document...","Posez une question ou joignez un document...")} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChat()} />
            <button className="chat-send" disabled={(!chatInput.trim()&&chatFiles.length===0)||chatLoading} onClick={handleChat}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>}

        {/* ══ TERMS OF SERVICE ══ */}
        {screen === "terms" && <>
          <FadeIn><div className="shdr"><button className="back" onClick={()=>nav(user?"settings":"signup")}>← {t("Back","Retour")}</button><div className="st">{t("Terms of Service","Conditions d'utilisation")}</div><div className="ss">{t("Last updated: March 2026","Dernière mise à jour : mars 2026")}</div></div></FadeIn>
          <FadeIn delay={80}><div className="legal-doc">
            <h3>1. {t("Acceptance of Terms","Acceptation des conditions")}</h3>
            <p>{t("By creating an account or using Dutiva Canada (the \"Service\"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. The Service is owned and operated by Dutiva Canada.","En créant un compte ou en utilisant Dutiva Canada (le « Service »), vous acceptez d'être lié par les présentes conditions. Le Service appartient à Dutiva Canada.")}</p>

            <h3>2. {t("Intellectual Property","Propriété intellectuelle")}</h3>
            <p>{t("All content, software, code, design, templates, document generators, text, graphics, logos, and the overall look and feel of Dutiva Canada are the exclusive intellectual property of Dutiva Canada and are protected under Canadian copyright law (Copyright Act, R.S.C., 1985, c. C-42) and applicable international treaties.","Tout le contenu, logiciel, code, design, modèles, générateurs de documents, texte, graphiques et logos de Dutiva Canada sont la propriété intellectuelle exclusive de Dutiva Canada, protégés par la Loi sur le droit d'auteur (L.R.C. (1985), ch. C-42) et les traités internationaux applicables.")}</p>
            <p>{t("You may not reproduce, distribute, modify, create derivative works from, publicly display, reverse engineer, decompile, or otherwise exploit any part of the Service without prior written consent from Dutiva Canada.","Vous ne pouvez reproduire, distribuer, modifier, créer des œuvres dérivées, afficher publiquement, décompiler ou exploiter autrement toute partie du Service sans consentement écrit préalable.")}</p>

            <h3>3. {t("License to Use","Licence d'utilisation")}</h3>
            <p>{t("Dutiva Canada grants you a limited, non-exclusive, non-transferable, revocable license to use the Service for your internal business purposes only. Documents generated through the Service may be used by your organization, but the underlying templates, logic, and system remain the property of Dutiva Canada.","Dutiva Canada vous accorde une licence limitée, non exclusive, non transférable et révocable pour utiliser le Service à des fins commerciales internes uniquement.")}</p>

            <h3>4. {t("Prohibited Uses","Utilisations interdites")}</h3>
            <ul>
              <li>{t("Reselling, sublicensing, or redistributing the Service or its outputs as a competing product","Revente, sous-licence ou redistribution du Service comme produit concurrent")}</li>
              <li>{t("Scraping, harvesting, or systematically downloading template content","Extraction systématique du contenu des modèles")}</li>
              <li>{t("Removing or altering any Dutiva Canada branding or attribution","Retrait ou modification de la marque Dutiva Canada")}</li>
              <li>{t("Using the Service for any unlawful purpose","Utilisation du Service à des fins illégales")}</li>
            </ul>

            <h3>5. {t("Disclaimer — Not Legal Advice","Avertissement — Pas un avis juridique")}</h3>
            <p>{t("Dutiva Canada provides templates and general HR guidance based on publicly available employment standards legislation. This is NOT legal advice. Documents generated are starting points and must be reviewed by a qualified legal professional before use. Dutiva Canada assumes no liability for decisions made based on the Service's outputs.","Dutiva Canada fournit des modèles et des conseils généraux basés sur la législation accessible au public. Ceci N'EST PAS un avis juridique. Les documents générés doivent être révisés par un professionnel juridique.")}</p>

            <h3>6. {t("Limitation of Liability","Limitation de responsabilité")}</h3>
            <p>{t("To the maximum extent permitted by law, Dutiva Canada shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the Service, including but not limited to employment disputes, regulatory penalties, or litigation costs.","Dans toute la mesure permise par la loi, Dutiva Canada ne sera pas responsable des dommages indirects, accessoires ou consécutifs découlant de l'utilisation du Service.")}</p>

            <h3>7. {t("Termination","Résiliation")}</h3>
            <p>{t("Dutiva Canada reserves the right to suspend or terminate your account at any time for violation of these Terms, without prior notice. Upon termination, your license to use the Service ceases immediately.","Dutiva Canada se réserve le droit de suspendre ou de résilier votre compte en cas de violation.")}</p>

            <h3>8. {t("Governing Law","Loi applicable")}</h3>
            <p>{t("These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein. Any disputes shall be resolved in the courts of Ontario, Canada.","Ces conditions sont régies par les lois de l'Ontario et les lois fédérales du Canada. Tout litige sera résolu devant les tribunaux de l'Ontario.")}</p>

            <h3>9. {t("Contact","Contact")}</h3>
            <p>{t("For permissions, licensing inquiries, or legal questions: legal@dutiva.ca","Pour permissions, licences ou questions juridiques : legal@dutiva.ca")}</p>
          </div></FadeIn>
          <FadeIn delay={160}><div className="disc" style={{marginBottom:20}}>© {new Date().getFullYear()} Dutiva Canada. {t("All rights reserved.","Tous droits réservés.")} {t("Protected under the Copyright Act (R.S.C., 1985, c. C-42).","Protégé par la Loi sur le droit d'auteur (L.R.C. (1985), ch. C-42).")}</div></FadeIn>
        </>}

        {/* ══ PRIVACY POLICY ══ */}
        {screen === "privacy" && <>
          <FadeIn><div className="shdr"><button className="back" onClick={()=>nav(user?"settings":"signup")}>← {t("Back","Retour")}</button><div className="st">{t("Privacy Policy","Politique de confidentialité")}</div><div className="ss">{t("Last updated: March 2026","Dernière mise à jour : mars 2026")}</div></div></FadeIn>
          <FadeIn delay={80}><div className="legal-doc">
            <h3>1. {t("Our Commitment","Notre engagement")}</h3>
            <p>{t("Dutiva Canada is committed to protecting the privacy and confidentiality of your personal and business information. We comply with Canada's Personal Information Protection and Electronic Documents Act (PIPEDA, S.C. 2000, c. 5) and applicable provincial privacy legislation.","Dutiva Canada s'engage à protéger la confidentialité de vos informations personnelles et commerciales, conformément à la LPRPDE (L.C. 2000, ch. 5) et à la législation provinciale applicable.")}</p>

            <h3>2. {t("Information We Collect","Informations collectées")}</h3>
            <ul>
              <li><strong>{t("Account information","Informations de compte")}</strong>: {t("Name, email address, company name, company address, and province.","Nom, courriel, nom et adresse de l'entreprise, province.")}</li>
              <li><strong>{t("Document data","Données de documents")}</strong>: {t("Information you enter into templates (employee names, compensation details, etc.) is stored locally in your browser and is NOT transmitted to our servers.","Les données entrées dans les modèles sont stockées localement dans votre navigateur et NE SONT PAS transmises à nos serveurs.")}</li>
              <li><strong>{t("Usage data","Données d'utilisation")}</strong>: {t("Aggregate, anonymized usage statistics to improve the Service.","Statistiques d'utilisation agrégées et anonymisées.")}</li>
            </ul>

            <h3>3. {t("Data Storage & Security","Stockage et sécurité")}</h3>
            <p>{t("Your company profile and document history are stored locally in your browser using encrypted persistent storage. Sensitive employee information entered into templates (names, SIN digits, salary details, termination reasons, etc.) is processed entirely on your device and is never transmitted to Dutiva Canada's servers.","Votre profil et votre historique sont stockés localement dans votre navigateur. Les informations sensibles ne sont jamais transmises à nos serveurs.")}</p>

            <h3>4. {t("Your Data Rights","Vos droits")}</h3>
            <ul>
              <li><strong>{t("Access","Accès")}</strong>: {t("You can view all stored data in Settings > Data.","Consultez vos données dans Paramètres > Données.")}</li>
              <li><strong>{t("Deletion","Suppression")}</strong>: {t("You can delete all document history at any time. Account deletion is available upon request.","Supprimez votre historique à tout moment. Suppression de compte sur demande.")}</li>
              <li><strong>{t("Portability","Portabilité")}</strong>: {t("Documents can be exported as PDF at any time.","Exportez en PDF à tout moment.")}</li>
              <li><strong>{t("Consent withdrawal","Retrait du consentement")}</strong>: {t("You may withdraw consent by deleting your account.","Retirez votre consentement en supprimant votre compte.")}</li>
            </ul>

            <h3>5. {t("Confidentiality of Business Data","Confidentialité des données d'entreprise")}</h3>
            <p>{t("Dutiva Canada recognizes that the information you enter — including employee names, compensation, termination details, and internal policies — is highly sensitive and confidential. We have designed the Service so that this data remains on your device. We will never access, sell, share, or disclose your business data to any third party, except as required by Canadian law or a valid court order.","Dutiva Canada reconnaît que les informations que vous entrez sont hautement sensibles et confidentielles. Ces données restent sur votre appareil. Nous ne les accéderons, vendrons, partagerons ou divulguerons jamais, sauf si la loi canadienne ou une ordonnance du tribunal l'exige.")}</p>

            <h3>6. {t("Third-Party Services","Services tiers")}</h3>
            <p>{t("The Service uses Google Fonts for typography rendering. No personal or business data is shared with Google or any other third party.","Le Service utilise Google Fonts. Aucune donnée n'est partagée avec Google ou un tiers.")}</p>

            <h3>7. {t("Data Breach Notification","Notification de violation")}</h3>
            <p>{t("In the unlikely event of a data breach affecting your personal information, we will notify affected users within 72 hours as required by PIPEDA and report to the Office of the Privacy Commissioner of Canada.","En cas de violation, nous aviserons les utilisateurs dans les 72 heures, conformément à la LPRPDE.")}</p>

            <h3>8. {t("Contact","Contact")}</h3>
            <p>{t("Privacy inquiries: privacy@dutiva.ca","Questions de confidentialité : privacy@dutiva.ca")}</p>
            <p>{t("You may also file a complaint with the Office of the Privacy Commissioner of Canada at www.priv.gc.ca.","Vous pouvez déposer une plainte auprès du Commissariat à la protection de la vie privée du Canada : www.priv.gc.ca.")}</p>
          </div></FadeIn>
          <FadeIn delay={160}><div className="disc" style={{marginBottom:20}}>© {new Date().getFullYear()} Dutiva Canada. {t("All rights reserved.","Tous droits réservés.")}</div></FadeIn>
        </>}

        {/* ══ ACCESSIBILITY POLICY ══ */}
        {screen === "accessibility" && <>
          <FadeIn><div className="shdr"><button className="back" onClick={()=>nav(user?"settings":"welcome")}>← {t("Back","Retour")}</button><div className="st">{t("Accessibility Commitment","Engagement en matière d'accessibilité")}</div><div className="ss">{t("Last updated: March 2026","Dernière mise à jour : mars 2026")}</div></div></FadeIn>
          <FadeIn delay={80}><div className="legal-doc">
            <h3>1. {t("Our Commitment","Notre engagement")}</h3>
            <p>{t("Dutiva Canada is committed to ensuring equal access to our platform for all users, including persons with disabilities. We strive to meet or exceed the accessibility standards established under the Accessible Canada Act (S.C. 2019, c. 10) and applicable provincial accessibility legislation, including the Accessibility for Ontarians with Disabilities Act, 2005 (S.O. 2005, c. 11) (AODA) and the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.","Dutiva Canada s'engage à assurer un accès égal à sa plateforme pour tous les utilisateurs, y compris les personnes en situation de handicap, conformément à la Loi canadienne sur l'accessibilité (L.C. 2019, ch. 10), la LAPHO et les WCAG 2.1 niveau AA.")}</p>

            <h3>2. {t("Accessibility Features","Fonctionnalités d'accessibilité")}</h3>
            <p>{t("Dutiva Canada incorporates the following accessibility measures:","Dutiva Canada intègre les mesures d'accessibilité suivantes :")}</p>
            <ul>
              <li>{t("Full keyboard navigation support — all interactive elements are accessible without a mouse","Navigation au clavier complète — tous les éléments interactifs sont accessibles sans souris")}</li>
              <li>{t("Visible focus indicators on all interactive elements for keyboard users","Indicateurs de focus visibles sur tous les éléments interactifs")}</li>
              <li>{t("ARIA landmark roles and labels for screen reader compatibility","Rôles et étiquettes ARIA pour la compatibilité avec les lecteurs d'écran")}</li>
              <li>{t("Skip-to-content link for efficient keyboard navigation","Lien d'accès direct au contenu principal")}</li>
              <li>{t("Sufficient colour contrast ratios meeting WCAG 2.1 AA standards","Ratios de contraste conformes aux normes WCAG 2.1 AA")}</li>
              <li>{t("Support for the prefers-reduced-motion system setting — all animations are disabled when this setting is active","Respect du paramètre système de mouvement réduit — les animations sont désactivées")}</li>
              <li>{t("Responsive design that supports text scaling up to 200% without loss of content or functionality","Design réactif supportant le redimensionnement du texte jusqu'à 200 %")}</li>
              <li>{t("Compatibility with assistive technologies, including screen readers (NVDA, JAWS, VoiceOver), voice control, and switch devices","Compatibilité avec les technologies d'assistance : lecteurs d'écran, contrôle vocal, etc.")}</li>
              <li>{t("Support for Windows High Contrast Mode and forced-colors media queries","Support du mode Contraste élevé de Windows")}</li>
            </ul>

            <h3>3. {t("Ongoing Improvement","Amélioration continue")}</h3>
            <p>{t("We recognize that accessibility is an ongoing process. We are committed to conducting regular accessibility audits, incorporating user feedback from persons with disabilities, training our development team on inclusive design best practices, and promptly addressing any accessibility barriers that are identified.","Nous reconnaissons que l'accessibilité est un processus continu. Nous nous engageons à effectuer des audits réguliers et à intégrer les commentaires des utilisateurs.")}</p>

            <h3>4. {t("Feedback and Accommodation Requests","Commentaires et demandes d'adaptation")}</h3>
            <p>{t("If you encounter any accessibility barriers while using Dutiva Canada, or if you require an alternative format for any of our content, please contact us at accessibility@dutiva.ca. We will make every reasonable effort to respond to your request within five (5) business days and to provide the requested accommodation in a timely manner.","Si vous rencontrez des obstacles, veuillez nous contacter à accessibility@dutiva.ca. Nous ferons tout effort raisonnable pour répondre dans les 5 jours ouvrables.")}</p>
          </div></FadeIn>
          <FadeIn delay={160}><div className="disc" style={{marginBottom:20}}>© {new Date().getFullYear()} Dutiva Canada</div></FadeIn>
        </>}

        {/* ══ TECHNOLOGY DISCLOSURE ══ */}
        {screen === "technology" && <>
          <FadeIn><div className="shdr"><button className="back" onClick={()=>nav(user?"settings":"welcome")}>← {t("Back","Retour")}</button><div className="st">{t("Technology and AI Disclosure","Divulgation technologique et IA")}</div><div className="ss">{t("Transparency statement","Déclaration de transparence")}</div></div></FadeIn>
          <FadeIn delay={80}><div className="legal-doc">
            <h3>1. {t("Use of Artificial Intelligence","Utilisation de l'intelligence artificielle")}</h3>
            <p>{t("Dutiva Canada uses artificial intelligence (AI) technology to power certain features of the platform, including the AI-Assisted document auto-fill feature and the Dutiva Advisor chatbot. These features use large language model (LLM) technology provided by Anthropic (Claude API) to generate content based on user inputs and established Canadian employment standards legislation.","Dutiva Canada utilise l'intelligence artificielle (IA) pour certaines fonctionnalités, y compris le remplissage automatique et le Conseiller Dutiva. Ces fonctionnalités utilisent la technologie de grands modèles de langage fournie par Anthropic (API Claude).")}</p>

            <h3>2. {t("Transparency About AI-Generated Content","Transparence sur le contenu généré par l'IA")}</h3>
            <p>{t("All AI-generated content in Dutiva Canada is clearly identified. When using the AI-Assisted mode for document creation, the system generates field values based on your description — these values are presented for your review and editing before any document is finalized. The Dutiva Advisor provides general HR and payroll guidance, not legal advice. AI-generated responses are based on the model's training data and may not reflect the most recent legislative amendments. Users should always verify critical compliance information against current government sources.","Tout contenu généré par l'IA est clairement identifié. En mode IA assistée, les valeurs sont présentées pour révision avant la finalisation. Le Conseiller fournit des conseils généraux, non des avis juridiques.")}</p>

            <h3>3. {t("Data Processing by AI","Traitement des données par l'IA")}</h3>
            <p>{t("When you use AI-powered features, the information you provide (your description, form field values, or chat messages) is sent to Anthropic's API for processing. Anthropic's data retention and privacy practices are governed by their own terms of service and privacy policy. Dutiva Canada does not store your AI interactions on its own servers beyond the current session. We recommend that you do not include Social Insurance Numbers (SIN), banking information, or other highly sensitive personal identifiers in AI-powered interactions.","Lorsque vous utilisez les fonctionnalités IA, les informations sont envoyées à l'API d'Anthropic. Nous recommandons de ne pas inclure de NAS ou d'informations bancaires dans les interactions IA.")}</p>

            <h3>4. {t("Human Oversight and Responsibility","Supervision humaine et responsabilité")}</h3>
            <p>{t("AI is a tool to assist — not replace — human judgment. Every document generated by Dutiva Canada should be reviewed by the employer or their authorized representative before being distributed, signed, or relied upon. The employer retains full responsibility for the accuracy, completeness, and appropriateness of any document produced using the platform. Dutiva Canada assumes no liability for decisions made based solely on AI-generated content without human review.","L'IA est un outil d'assistance, non un substitut au jugement humain. Chaque document doit être révisé par l'employeur avant d'être utilisé.")}</p>

            <h3>5. {t("Open Source and Third-Party Technologies","Technologies tierces et open source")}</h3>
            <p>{t("Dutiva Canada is built using React (Meta, open source), styled with custom CSS, and uses Google Fonts for typography (Instrument Serif, DM Sans, Cormorant Garamond). No personal or business data is shared with Google through font loading. The application runs as a client-side web application — your data remains in your browser's local storage unless you explicitly use AI-powered features, which require an internet connection.","Dutiva Canada utilise React (Meta, open source), CSS personnalisé et Google Fonts. Aucune donnée n'est partagée avec Google. L'application s'exécute côté client.")}</p>

            <h3>6. {t("Contact","Contact")}</h3>
            <p>{t("For questions about our technology practices: tech@dutiva.ca","Pour des questions sur nos pratiques technologiques : tech@dutiva.ca")}</p>
          </div></FadeIn>
          <FadeIn delay={160}><div className="disc" style={{marginBottom:20}}>© {new Date().getFullYear()} Dutiva Canada</div></FadeIn>
        </>}

        {/* ══ HOME (Templates) ══ */}
        {screen === "home" && <>
          <FadeIn><div className="hero">
            <div className="hero-ey">{t("Bilingual HR Templates","Modèles RH bilingues")}</div>
            <h1>{t(<>HR documents,<br/>done <em>right</em>.</>,<>Documents RH,<br/>bien <em>faits</em>.</>)}</h1>
            <div className="count"><b>16</b> {t("templates","modèles")} · <b>14</b> {t("jurisdictions","juridictions")} · <b>EN/FR</b></div>
          </div></FadeIn>
          <FadeIn delay={80}><div className="srch"><SIcon/><input placeholder={t("Search templates...","Rechercher...")} value={search} onChange={e=>setSearch(e.target.value)}/></div></FadeIn>
          <div className="grid">{filtered.map((tmpl,i) => <FadeIn key={tmpl.id} delay={100+i*35}><div className="card" onClick={() => {setSel(tmpl);setFormData({companyName:user?.companyName||"",companyAddress:user?.companyAddress||""});setProvince(user?.defaultProvince||"");setFormMode("manual");setAiPrompt("");setAiFilled(false);nav(user?.defaultProvince?"form":"configure")}}><TemplateIcon id={tmpl.id}/><div className="cinf"><div className="cnm">{tmpl[lang].name}</div><div className="cds">{tmpl[lang].desc}</div></div><span className="carr">›</span></div></FadeIn>)}</div>
          <FadeIn delay={600}><button className="bg" onClick={()=>nav("dashboard")}>← {t("Back to dashboard","Tableau de bord")}</button></FadeIn>
        </>}

        {/* ══ CONFIGURE ══ */}
        {screen === "configure" && sel && <>
          <FadeIn><div className="shdr"><button className="back" onClick={()=>{nav("home");setProvince("")}}>← {t("Back","Retour")}</button><div className="st">{sel[lang].name}</div><div className="ss">{t("Select province","Sélectionnez la province")}</div></div></FadeIn>
          <FadeIn delay={80}><div className="pgrid">{PROVINCES.map(p=><button key={p.code} className={`pb ${province===p.code?"on":""}`} onClick={()=>setProvince(p.code)}>{p[lang]}</button>)}</div></FadeIn>
          {province && <FadeIn delay={40}><button className="cta" onClick={()=>nav("form")}>{t("Continue →","Continuer →")}</button></FadeIn>}
        </>}

        {/* ══ FORM ══ */}
        {screen === "form" && sel && <>
          <FadeIn><div className="shdr"><button className="back" onClick={()=>nav("configure")}>← {t("Back","Retour")}</button><div className="st">{sel[lang].name}</div><div className="ss">{PROVINCES.find(p=>p.code===province)?.[lang]} — {lang==="en"?"EN":"FR"}</div></div></FadeIn>

          {/* Mode Toggle */}
          <FadeIn delay={30}><div className="mode-toggle">
            <button className={`mode-btn ${formMode==="manual"?"on":""}`} onClick={()=>setFormMode("manual")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              {t("Manual","Manuel")}
            </button>
            <button className={`mode-btn ${formMode==="ai-assist"?"on":""}`} onClick={()=>setFormMode("ai-assist")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93"/><path d="M8.24 2.69A4 4 0 0 0 8 6c0 1.95 1.4 3.58 3.25 3.93"/><path d="M12 18v4"/><path d="M8 22h8"/><rect x="6" y="10" width="12" height="8" rx="1"/></svg>
              {t("AI-Assisted","IA assistée")}
            </button>
          </div></FadeIn>

          {/* AI Auto-Fill Panel */}
          {formMode === "ai-assist" && <FadeIn delay={50}><div className="ai-panel">
            <div className="ai-panel-header">
              <div className="ai-panel-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93"/><path d="M8.24 2.69A4 4 0 0 0 8 6c0 1.95 1.4 3.58 3.25 3.93"/><path d="M12 18v4"/><path d="M8 22h8"/><rect x="6" y="10" width="12" height="8" rx="1"/></svg></div>
              <div>
                <div className="ai-panel-title">{t("Describe the situation","Décrivez la situation")}</div>
                <div className="ai-panel-sub">{t("AI will fill all fields based on your description","L'IA remplira les champs selon votre description")}</div>
              </div>
            </div>
            <textarea className="ai-panel-input" value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder={aiPlaceholder} />
            <button className="ai-panel-btn" disabled={!aiPrompt.trim()||aiLoading} onClick={handleAiFill}>
              {aiLoading ? <><span className="ai-spinner"/>  {t("Generating...","Génération...")}</> : <>{t("Auto-Fill with AI","Remplir avec l'IA")} →</>}
            </button>
            {aiFilled && missingFields.length === 0 && <p className="ai-panel-note" style={{color:"var(--gold)"}}>✓ {t(`All ${total} fields filled — review below`,`Tous les ${total} champs remplis — révisez ci-dessous`)}</p>}
            {aiFilled && missingFields.length > 0 && <div className="ai-panel-missing">
              <div className="ai-panel-missing-title">⚠ {t(`${missingFields.length} field${missingFields.length>1?"s":""} still need${missingFields.length===1?"s":""} your input`,`${missingFields.length} champ${missingFields.length>1?"s":""} nécessite${missingFields.length>1?"nt":""} votre saisie`)}</div>
              <div className="ai-panel-missing-list">{missingFields.map(f => f[lang]).join(" · ")}</div>
            </div>}
          </div></FadeIn>}

          <FadeIn delay={formMode==="ai-assist"?80:40}><div className="prog"><div className="progt"><div className="progf" style={{width:`${total>0?(filled/total)*100:0}%`}}/></div><span className="progn">{filled}/{total}</span></div></FadeIn>
          {autoCalcData && <FadeIn delay={60}><div className="auto-calc"><strong>⚡ {t("ESA minimums","Minimums")}</strong><br/>{t("Notice","Préavis")}: <strong>{autoCalcData.noticeWeeks} {t("wk","sem.")}</strong>{autoCalcData.severanceWeeks>0&&<> | {t("Severance","Indemnité")}: <strong>{autoCalcData.severanceWeeks} {t("wk","sem.")}</strong></>}<br/><span style={{fontSize:11,opacity:0.8}}>{autoCalcData.act}</span>{autoCalcData.sevNote[lang]&&<><br/><span style={{fontSize:11,opacity:0.8}}>{autoCalcData.sevNote[lang]}</span></>}</div></FadeIn>}
          <div className="frm">{sel.fields.map((f,i)=>{const isMissing = aiFilled && !formData[f.id]?.trim(); return <FadeIn key={f.id} delay={(formMode==="ai-assist"?100:80)+i*30}><div className={`fld ${isMissing?"fld-missing":""}`}><label>{f[lang]}{isMissing && <span className="fld-flag">{t("Required","Requis")}</span>}</label>{(f.type==="text"||f.type==="date")?<input type={f.type} value={formData[f.id]||""} className={isMissing?"input-missing":""} placeholder={isMissing?t("← Please fill in this field","← Veuillez remplir ce champ"):""} onChange={e=>{setFormData(p=>({...p,[f.id]:e.target.value,_autoNotice:f.id==="noticePeriod"?false:p._autoNotice,_autoSev:f.id==="severanceWeeks"?false:p._autoSev}))}}/>:f.type==="textarea"?<textarea value={formData[f.id]||""} className={isMissing?"input-missing":""} placeholder={isMissing?t("← Please fill in this field","← Veuillez remplir ce champ"):""} onChange={e=>setFormData(p=>({...p,[f.id]:e.target.value}))}/>:<select value={formData[f.id]||""} className={isMissing?"input-missing":""} onChange={e=>setFormData(p=>({...p,[f.id]:e.target.value}))}><option value="">{t("Select...","—")}</option>{f.options.map((o,j)=><option key={j} value={o.en}>{o[lang]}</option>)}</select>}</div></FadeIn>})}</div>
          <FadeIn delay={150}><button className="cta" disabled={filled<3} onClick={filled>=3?handleGen:undefined}>{t(`Generate (${filled}/${total})`,`Générer (${filled}/${total})`)}</button></FadeIn>
        </>}

        {/* ══ PREVIEW ══ */}
        {screen === "preview" && <>
          <FadeIn><div className="shdr"><button className="back" onClick={()=>nav("form")}>← {t("Edit","Modifier")}</button><div className="pvh"><div className="st">{t("Your Document","Votre document")}</div><span className="lp">{lang==="en"?"EN":"FR"}</span></div><div className="ss">{sel?.[lang].name} — {PROVINCES.find(p=>p.code===province)?.[lang]}</div></div></FadeIn>
          <FadeIn delay={120}><div className="dwrap"><div className="doc-paper" dangerouslySetInnerHTML={{__html:doc}}/><div className="doc-watermark">{t("Generated with","Généré avec")} Compliance<span>HR</span> Canada — dutiva.ca</div></div></FadeIn>

          {/* ── E-Signature Section ── */}
          <FadeIn delay={200}><div className="esig-section">
            <div className="esig-header">
              <div className="esig-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg></div>
              <div>
                <div className="esig-title">{t("Electronic Signatures","Signatures électroniques")}</div>
                <div className="esig-sub">{t("Legally binding under PIPEDA and provincial e-commerce legislation","Juridiquement contraignantes en vertu de la LPRPDE et des lois provinciales")}</div>
              </div>
            </div>

            <SignaturePad
              label={t("Signature — Authorized Representative (Employer)","Signature — Représentant autorisé (Employeur)")}
              lang={lang}
              onSave={(data) => setSignatures(p => ({...p, employer: data}))}
            />

            {(sel?.id === "offer" || sel?.id === "contractor" || sel?.id === "nda") && <SignaturePad
              label={t("Signature — Recipient (Employee / Contractor / Receiving Party)","Signature — Destinataire (Employé(e) / Entrepreneur / Partie réceptrice)")}
              lang={lang}
              onSave={(data) => setSignatures(p => ({...p, recipient: data}))}
            />}

            {(sel?.id === "termination" || sel?.id === "warning" || sel?.id === "probation" || sel?.id === "pip" || sel?.id === "accommodation" || sel?.id === "layoff") && <SignaturePad
              label={t("Signature — Employee Acknowledgment","Signature — Accusé de réception de l'employé(e)")}
              lang={lang}
              onSave={(data) => setSignatures(p => ({...p, recipient: data}))}
            />}

            {(sel?.id === "termination" || sel?.id === "warning") && <SignaturePad
              label={t("Signature — Witness","Signature — Témoin")}
              lang={lang}
              onSave={(data) => setSignatures(p => ({...p, witness: data}))}
            />}

            <div className="esig-legal">
              <p><strong>{t("Electronic Signature Validity","Validité de la signature électronique")}</strong></p>
              <p>{t(
                "This document has been executed using electronic signatures. Under Canadian law, electronic signatures are legally valid and enforceable pursuant to the following legislation:",
                "Ce document a été signé électroniquement. En vertu du droit canadien, les signatures électroniques sont juridiquement valides selon :"
              )}</p>
              <p>{t(
                "The Personal Information Protection and Electronic Documents Act (PIPEDA, S.C. 2000, c. 5, Part 2) establishes the legal framework for electronic signatures in federal jurisdiction and interprovincial transactions.",
                "La Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE, L.C. 2000, ch. 5, Partie 2) établit le cadre juridique fédéral."
              )}</p>
              <p>{t(
                province === "ON" ? "The Electronic Commerce Act, 2000 (S.O. 2000, c. 17) confirms that electronic signatures satisfy any legal requirement for a signature in Ontario, provided the signature is reliable and the parties have consented to its use." :
                province === "QC" ? "The Act to establish a legal framework for information technology (CQLR, c. C-1.1) provides that a document signed electronically has the same legal value as a handwritten signature in Quebec." :
                province === "BC" ? "The Electronic Transactions Act (SBC 2001, c. 10) confirms the legal validity of electronic signatures in British Columbia." :
                province === "AB" ? "The Electronic Transactions Act (SA 2001, c. E-5.5) confirms the legal validity of electronic signatures in Alberta." :
                province === "FED" ? "For federally regulated employers, PIPEDA Part 2 directly governs the validity of electronic signatures." :
                "Provincial electronic commerce legislation in " + provName + " confirms the legal validity of electronic signatures.",
                "La législation provinciale sur le commerce électronique de " + provName + " confirme la validité juridique des signatures électroniques."
              )}</p>
              <p>{t(
                "Each signature above includes the signer's drawn mark and a timestamp recording the date and time of execution. All parties acknowledge that they have consented to sign this document electronically and that this electronic signature carries the same legal weight as a handwritten signature.",
                "Chaque signature ci-dessus comprend la marque dessinée et un horodatage. Toutes les parties reconnaissent avoir consenti à signer ce document électroniquement."
              )}</p>
            </div>
          </div></FadeIn>

          <FadeIn delay={280}><div className="acts">
            <button className="bp" onClick={handlePDF}>📄 {t("Export","Exporter")}</button>
            <button className="bs" onClick={handleCopy}>{copied?t("✓ Copied","✓ Copié"):t("Copy","Copier")}</button>
            <button className="bs" onClick={()=>{const nl=lang==="en"?"fr":"en";setLang(nl);setDoc(generateDocument(sel.id,formData,province,nl))}}>{t("FR","EN")}</button>
          </div></FadeIn>
          <FadeIn delay={360}><button className="bg" onClick={()=>{nav("dashboard");setSel(null);setProvince("");setFormData({});setDoc("");setSignatures({})}}>{t("← Dashboard","← Tableau de bord")}</button></FadeIn>
          <FadeIn delay={400}><div className="disc">{t("⚖️ Review carefully. Not legal advice.","⚖️ Révisez. Pas un avis juridique.")}</div></FadeIn>
        </>}
      </div>

        {/* ══ UPGRADE SCREEN ══ */}
        {screen === "upgrade" && <>
          <FadeIn><div className="shdr"><button className="back" onClick={()=>nav("dashboard")}>← {t("Back","Retour")}</button><div className="st">{t("Upgrade to Pro","Passer à Pro")}</div></div></FadeIn>
          <FadeIn delay={60}><div style={{padding:"0 24px"}}>
            <div style={{textAlign:"center",padding:"32px 0 24px"}}>
              <div style={{fontSize:48,marginBottom:12}}>⚡</div>
              <div style={{fontFamily:"var(--sf)",fontSize:28,color:"var(--t1)",marginBottom:8}}>Dutiva Canada Pro</div>
              <div style={{fontSize:32,fontWeight:700,color:"var(--gold)",marginBottom:4}}>$9.99 <span style={{fontSize:16,fontWeight:400,color:"var(--t2)"}}>CAD/{t("month","mois")}</span></div>
              <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.5,maxWidth:280,margin:"0 auto"}}>{t("Less than a coffee a week. Cancel anytime.","Moins qu'un café par semaine. Annulez n'importe quand.")}</div>
            </div>
            {[
              [t("Unlimited documents","Documents illimités"), t("Generate as many HR documents as you need","Générez autant de documents RH que nécessaire")],
              [t("AI Auto-fill","Remplissage automatique IA"), t("Describe a situation — AI fills the form","Décrivez une situation — l'IA remplit le formulaire")],
              [t("Dutiva Advisor chatbot","Clavardage Conseiller Dutiva"), t("Ask any Canadian employment law question","Posez toute question sur le droit du travail canadien")],
              [t("Electronic signatures","Signatures électroniques"), t("Legally binding under PIPEDA","Juridiquement contraignantes en vertu de la LPRPDE")],
              [t("Document history (50 docs)","Historique (50 docs)"), t("Access and re-export your last 50 documents","Accédez à vos 50 derniers documents")],
              [t("Brand customization","Personnalisation de marque"), t("Your colour and tagline on every document","Votre couleur et slogan sur chaque document")],
            ].map(([title, desc], i) => (
              <div key={i} style={{display:"flex",gap:12,padding:"14px 0",borderBottom:"1px solid var(--bdr)"}}>
                <div style={{color:"var(--gold)",fontSize:18,flexShrink:0}}>✓</div>
                <div><div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:2}}>{title}</div><div style={{fontSize:12,color:"var(--t2)",lineHeight:1.4}}>{desc}</div></div>
              </div>
            ))}
            <div style={{padding:"24px 0 8px"}}>
              <button className="cta" style={{width:"100%",fontSize:16,padding:"16px"}} onClick={handleUpgrade}>
                {t("Upgrade Now — $9.99 CAD/month","Passer à Pro — 9,99 $ CAD/mois")}
              </button>
              <div style={{textAlign:"center",fontSize:11,color:"var(--t3)",marginTop:10,lineHeight:1.5}}>
                {t("Secure payment via Stripe. Cancel anytime.","Paiement sécurisé via Stripe. Annulez à tout moment.")}
              </div>
            </div>
            {!isPro && <div style={{background:"var(--gs)",border:"1px solid rgba(196,147,85,0.15)",borderRadius:"var(--rs)",padding:"12px 16px",marginBottom:16}}>
              <div style={{fontSize:12,color:"var(--t2)",textAlign:"center"}}>{t("Free plan: ","Plan gratuit : ")}{freeDocsThisMonth}/2 {t("documents used this month.","documents utilisés ce mois-ci.")}</div>
            </div>}
          </div></FadeIn>
        </>}

      {/* ══ PRINT OVERLAY ══ */}
      <div className={`print-overlay ${showPrintView ? "active" : ""}`}>
        <div className="print-bar">
          <div className="print-bar-title">{t("Print / Export Document","Imprimer / Exporter le document")}</div>
          <div className="print-bar-actions">
            <button className="print-bar-btn print-bar-secondary" onClick={()=>setShowPrintView(false)}>{t("Close","Fermer")}</button>
            <button className="print-bar-btn print-bar-primary" onClick={()=>{try{window.print()}catch(e){}}}>{t("Print / Save as PDF","Imprimer / Enregistrer en PDF")}</button>
          </div>
        </div>
        <div className="print-doc-wrap">
          <div className="print-doc-body" dangerouslySetInnerHTML={{__html: doc}} />
        </div>
        <div className="print-footer">
          {t("Generated with","Généré avec")} Dutiva Canada — dutiva.ca — © {new Date().getFullYear()} {t("All rights reserved","Tous droits réservés")}
        </div>
        <div className="print-hint">
          {t(<>Use <kbd>Ctrl</kbd> + <kbd>P</kbd> (Windows/Linux) or <kbd>⌘</kbd> + <kbd>P</kbd> (Mac) and select <strong>"Save as PDF"</strong> as the destination.</>,
            <>Utilisez <kbd>Ctrl</kbd> + <kbd>P</kbd> (Windows/Linux) ou <kbd>⌘</kbd> + <kbd>P</kbd> (Mac) et sélectionnez <strong>« Enregistrer en PDF »</strong>.</>)}
        </div>
      </div>

    </div></>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/*" element={<Dutiva />} />
      </Routes>
    </BrowserRouter>
  );
}