"use client";
import React, { useState } from "react";
import { Provider } from "react-redux";
import { store } from "./lib/redux/store";
import { ResumeForm } from "./components/ResumeForm";
import { Resume } from "./components/Resume";
import "./styles.css";
import { CandidateSelector } from "../cv-generator/candidate-selector";
import { Candidate } from "@/db/schema";
import { mapCandidateToResume } from "./lib/candidate-mapper";
import { setResume } from "./lib/redux/resumeSlice";

interface OpenResumeProps {
  candidates?: Candidate[];
}

const CandidateSelectorWrapper = ({ candidates }: { candidates: Candidate[] }) => {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");

  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    const candidate = candidates.find((c) => c.id === candidateId);
    if (candidate) {
      const resumeData = mapCandidateToResume(candidate);
      store.dispatch(setResume(resumeData));
    }
  };

  const candidateOptions = candidates.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
  }));

  return (
    <div className="absolute top-4 right-4 z-50 bg-white/90 backdrop-blur shadow-sm p-2 rounded-lg border">
      <CandidateSelector
        candidates={candidateOptions}
        value={selectedCandidateId}
        onChange={handleCandidateSelect}
      />
    </div>
  );
};

export const OpenResume = ({ candidates = [] }: OpenResumeProps) => {
  return (
    <Provider store={store}>
      <main className="relative h-full w-full overflow-hidden bg-gray-50 text-slate-900">
        {candidates.length > 0 && (
          <CandidateSelectorWrapper candidates={candidates} />
        )}
        <div className="grid grid-cols-3 md:grid-cols-6 h-full">
          <div className="col-span-3 h-full overflow-hidden">
            <ResumeForm />
          </div>
          <div className="col-span-3 h-full overflow-hidden">
            <Resume />
          </div>
        </div>
      </main>
    </Provider>
  );
};
