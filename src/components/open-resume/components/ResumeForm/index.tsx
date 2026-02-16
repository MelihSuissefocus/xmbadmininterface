"use client";
import { useState } from "react";
import {
  useAppSelector,
  useSaveStateToLocalStorageOnChange,
  useSetInitialStore,
} from "@/components/open-resume/lib/redux/hooks";
import { ShowForm, selectFormsOrder } from "@/components/open-resume/lib/redux/settingsSlice";
import { ProfileForm } from "@/components/open-resume/components/ResumeForm/ProfileForm";
import { WorkExperiencesForm } from "@/components/open-resume/components/ResumeForm/WorkExperiencesForm";
import { EducationsForm } from "@/components/open-resume/components/ResumeForm/EducationsForm";
import { ProjectsForm } from "@/components/open-resume/components/ResumeForm/ProjectsForm";
import { SkillsForm } from "@/components/open-resume/components/ResumeForm/SkillsForm";
import { ThemeForm } from "@/components/open-resume/components/ResumeForm/ThemeForm";
import { CustomForm } from "@/components/open-resume/components/ResumeForm/CustomForm";
import { FlexboxSpacer } from "@/components/open-resume/components/FlexboxSpacer";
import { cx } from "@/components/open-resume/lib/cx";

const formTypeToComponent: { [type in ShowForm]: () => JSX.Element } = {
  workExperiences: WorkExperiencesForm,
  educations: EducationsForm,
  projects: ProjectsForm,
  skills: SkillsForm,
  custom: CustomForm,
};

export const ResumeForm = () => {
  useSetInitialStore();
  useSaveStateToLocalStorageOnChange();

  const formsOrder = useAppSelector(selectFormsOrder);
  const [isHover, setIsHover] = useState(false);

  return (
    <div
      className={cx(
        "flex justify-center scrollbar-thin scrollbar-track-gray-100 md:h-[calc(100vh-var(--top-nav-bar-height))] md:justify-end md:overflow-y-scroll",
        isHover ? "scrollbar-thumb-gray-200" : "scrollbar-thumb-gray-100"
      )}
      onMouseOver={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <section className="flex max-w-2xl flex-col gap-8 p-[var(--resume-padding)]">
        <ProfileForm />
        {formsOrder.map((form) => {
          const Component = formTypeToComponent[form];
          return <Component key={form} />;
        })}
        <ThemeForm />
        <br />
      </section>
      <FlexboxSpacer maxWidth={50} className="hidden md:block" />
    </div>
  );
};
