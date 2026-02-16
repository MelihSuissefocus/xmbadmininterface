import { Candidate } from "@/db/schema";
import {
    Resume,
    ResumeEducation,
    ResumeProfile,
    ResumeProject,
    ResumeSkills,
    ResumeWorkExperience,
} from "./redux/types";
import { initialFeaturedSkills } from "./redux/resumeSlice";

export const mapCandidateToResume = (candidate: Candidate): Resume => {
    // 1. Profile
    const profile: ResumeProfile = {
        name: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email || "",
        phone: candidate.phone || "",
        location: [candidate.postalCode, candidate.city].filter(Boolean).join(" ") || candidate.city || "",
        url: candidate.linkedinUrl || "",
        summary: candidate.notes || "", // Using notes as summary for now, or could use extraction summary if available
    };

    // 2. Work Experience
    const workExperiences: ResumeWorkExperience[] = (candidate.experience || []).map((exp) => ({
        company: exp.company,
        jobTitle: exp.role,
        date: `${exp.startMonth}/${exp.startYear} - ${exp.current ? "Present" : `${exp.endMonth}/${exp.endYear}`
            }`,
        descriptions: exp.description ? [exp.description] : [],
    }));

    // 3. Education
    const educations: ResumeEducation[] = (candidate.education || []).map((edu) => ({
        school: edu.institution,
        degree: edu.degree,
        date: `${edu.startMonth}/${edu.startYear} - ${edu.endMonth}/${edu.endYear}`,
        gpa: "",
        descriptions: [],
    }));

    // 4. Skills
    const skillsList = candidate.skills || [];
    // Take top 6 as featured if available, or just map what we have
    const featuredSkills = initialFeaturedSkills.map((fs, idx) => {
        if (idx < skillsList.length) {
            return { skill: skillsList[idx], rating: 4 };
        }
        return fs;
    });

    const skills: ResumeSkills = {
        featuredSkills: featuredSkills,
        descriptions: skillsList.length > 6 ? skillsList.slice(6) : [],
    };

    // 5. Projects (Default empty for now as Candidate schema doesn't have direct projects mapping)
    const projects: ResumeProject[] = [];

    // 6. Custom (Languages?)
    const customDescriptions: string[] = (candidate.languages || []).map(
        (lang) => `${lang.language} (${lang.level})`
    );

    return {
        profile,
        workExperiences,
        educations,
        projects,
        skills,
        custom: {
            descriptions: customDescriptions,
        },
    };
};
