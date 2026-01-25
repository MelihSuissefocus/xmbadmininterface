import { getAllSkills } from "@/actions/skills";
import { getAllUsers } from "@/actions/users";
import { getAllEmailTemplates } from "@/actions/email-templates";
import { getAllSystemSettings } from "@/actions/system-settings";
import { getOrganization } from "@/actions/organizations";
import { getAllAuditLogs } from "@/actions/audit-logs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillsManagement } from "./skills-management";
import { UserManagement } from "@/components/settings/user-management";
import { OrganizationSettings } from "@/components/settings/organization-settings";
import { SystemSettingsPanel } from "@/components/settings/system-settings-panel";
import { EmailTemplatesPanel } from "@/components/settings/email-templates-panel";
import { AuditLogsPanel } from "@/components/settings/audit-logs-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [skills, users, emailTemplates, systemSettings, organization, auditLogs] = await Promise.all([
    getAllSkills(),
    getAllUsers(),
    getAllEmailTemplates(),
    getAllSystemSettings(),
    getOrganization(),
    getAllAuditLogs(50),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Einstellungen
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Verwalte alle Systemeinstellungen und Konfigurationen
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="users">Benutzer</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="organization">Unternehmen</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="email">E-Mail-Vorlagen</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UserManagement initialUsers={users} />
        </TabsContent>

        <TabsContent value="skills" className="space-y-4">
          <SkillsManagement initialSkills={skills} />
        </TabsContent>

        <TabsContent value="organization" className="space-y-4">
          <OrganizationSettings organization={organization} />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <SystemSettingsPanel initialSettings={systemSettings} />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <EmailTemplatesPanel initialTemplates={emailTemplates} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogsPanel logs={auditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

