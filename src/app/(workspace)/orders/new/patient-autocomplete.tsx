"use client";

import { useState } from "react";

export type PatientOption = { id: string; fullName: string; patientId: string };

export function PatientAutocomplete({ patients, defaultPatientId }: {
  patients: PatientOption[];
  defaultPatientId?: string;
}) {
  const initialPatient = patients.find((patient) => patient.id === defaultPatientId);
  const [query, setQuery] = useState(initialPatient ? `${initialPatient.fullName} · ${initialPatient.patientId}` : "");
  const [selectedId, setSelectedId] = useState(initialPatient?.id ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = normalizedQuery
    ? patients.filter((patient) => `${patient.fullName} ${patient.patientId}`.toLowerCase().includes(normalizedQuery)).slice(0, 8)
    : [];

  function selectPatient(patient: PatientOption) {
    setQuery(`${patient.fullName} · ${patient.patientId}`);
    setSelectedId(patient.id);
    setOpen(false);
  }

  return (
    <div className="patient-autocomplete">
      <input
        id="patient-search"
        type="search"
        className="h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
        value={query}
        autoComplete="off"
        placeholder="Type a patient name or ID"
        role="combobox"
        aria-label="Search for a patient"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls="patient-suggestions"
        aria-activedescendant={open && suggestions[activeIndex] ? `patient-option-${suggestions[activeIndex].id}` : undefined}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId("");
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && suggestions.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
          }
          if (event.key === "ArrowUp" && suggestions.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          if (event.key === "Enter" && open && suggestions[activeIndex]) {
            event.preventDefault();
            selectPatient(suggestions[activeIndex]);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      />
      <input type="hidden" name="clientId" value={selectedId} />
      {open && suggestions.length > 0 && <ul className="patient-suggestions" id="patient-suggestions" role="listbox">
        {suggestions.map((patient, index) => <li key={patient.id} role="presentation">
          <button id={`patient-option-${patient.id}`} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => selectPatient(patient)}>
            <strong>{patient.fullName}</strong><span>{patient.patientId}</span>
          </button>
        </li>)}
      </ul>}
      {query && !selectedId && <span className="field-hint" role="status">{suggestions.length ? "Select a patient from the suggestions." : "No patient matches that name or ID."}</span>}
    </div>
  );
}
