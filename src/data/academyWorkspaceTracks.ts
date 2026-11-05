import type { AccessArea } from "@/lib/accessControl";

/** Additional Workspace Training only. The other four Academy divisions are
 * peer programs delivered through HPG Workspace, never children of this track.
 * Lessons may guide users through existing records without altering them.
 */
export type WorkspaceLesson = {
  id: string;
  name: string;
  goal: string;
  steps: string[];
  practice: string;
  path?: string;
  area?: AccessArea;
  readiness: "navigation" | "pending";
};
export type WorkspaceTrack = {
  id: string;
  title: string;
  audience: string;
  lessons: WorkspaceLesson[];
};

export const supplementalWorkspaceTracks: WorkspaceTrack[] = [
  {
    id: "hr", title: "Human Resources & Volunteer Care",
    audience: "Authorized HR colleagues and volunteer coordinators",
    lessons: [
      { id:"hr-directory",name:"Navigate the staff and volunteer directory",goal:"Locate a staff member's authorized role and reporting contact without altering personal records.",path:"/erp/hr/directory",area:"hr",readiness:"navigation",
        steps:["Open the HR Directory through the HR Hub.","Find an authorized staff profile and identify department, role, and reporting relationship.","Confirm the profile is the intended colleague before using contact details. Do not copy personal information into the training notes.","Return to the Academy without changing a record."],practice:"Identify where a colleague's department and reporting relationship would be verified." },
      { id:"hr-recruiting",name:"Review a volunteer application",goal:"Recognize the stages of recruitment and distinguish an application from an approved appointment.",path:"/erp/hr/recruiting",area:"hr",readiness:"navigation",
        steps:["Open Recruiting and review the applicant queue without changing stages.","Identify the documented role, application date, resume or supporting evidence, and next responsible reviewer.","Identify missing eligibility information before scheduling an interview.","Explain that an application does not constitute onboarding or access approval."],practice:"List three facts that should be checked before recommending an applicant for interview." },
      { id:"hr-onboarding",name:"Understand onboarding and account authorization",goal:"Distinguish volunteer acceptance, HR onboarding, and IT credential activation.",path:"/erp/hr/onboarding",area:"hr",readiness:"navigation",
        steps:["Open the HR Onboarding view.","Review the sequence of acceptance, orientation, appropriate agreements, supervised responsibilities, and workspace access.","Identify which tasks belong to HR, IT, and the departmental supervisor.","Do not activate an account or approve a real applicant while practising."],practice:"Identify the approval that must occur before someone receives access to restricted HPG records." },
      { id:"hr-reviews",name:"Locate the performance review process",goal:"Separate Academy orientation from formal evaluation and performance decisions.",path:"/erp/hr/reviews",area:"hr",readiness:"navigation",
        steps:["Open the HR Reviews area.","Identify the review period, evaluator, role expectations, and supporting evidence fields.","Explain why self-reported Academy completions do not establish performance or credential certification.","Follow the authorized approval and confidentiality rules when completing a real review."],practice:"Distinguish training completion, knowledge-check score, supervisor endorsement and a formal HR evaluation." },
    ],
  },
  {
    id:"program",title:"Programs & NGO Portfolio",
    audience:"Program teams, NGO coordinators and curriculum personnel",
    lessons:[
      {id:"program-overview",name:"Navigate Program Operations",goal:"Identify operational assignments and deliverables for a humanitarian initiative.",path:"/modules/program",area:"program",readiness:"navigation",
        steps:["Open Program Operations from the workspace.","Identify the owner, project, current deliverable, due date and status of an existing authorized program item.","Check whether the work concerns an entire NGO or a named project.","Return without changing project stages."],practice:"Explain how an NGO-level task differs from one assigned to a particular project."},
      {id:"program-ngo",name:"Check an NGO profile and named projects",goal:"Recognize organization-level records and project-specific responsibilities.",path:"/ngos",area:"ngos",readiness:"navigation",
        steps:["Open the NGO portfolio and identify an organization you are permitted to see.","Locate the organization's named projects, assigned coordinator and document areas.","Distinguish approved sponsorship status from an application in review.","Do not upload dummy files or alter the profile for training."],practice:"Identify where the organization, its projects and the assigned coordinator are shown."},
      {id:"program-onboard",name:"Understand NGO onboarding milestones",goal:"Trace the application, diligence, approval and document workflow.",path:"/ngo-coordination/onboarding",area:"program",readiness:"navigation",
        steps:["Open NGO Onboarding.","Identify stages for application, documentation, due diligence, approval, and continuing obligations.","Note which tasks require financial, legal, program or executive review.","Explain why account registration does not mean sponsorship approval."],practice:"Identify which milestone must be documented before a sponsorship arrangement becomes active."},
      {id:"program-reports",name:"Locate evidence for program reports",goal:"Recognize outcome evidence and reporting cadence without inventing results.",path:"/reports",area:"reports",readiness:"navigation",
        steps:["Open Reports and select only records available to your role.","Identify a reporting period, initiative/project, responsible author and source evidence.","Check whether the stated result is supported by submitted documentation.","Return to the Academy without modifying the report."],practice:"Describe one evidence requirement for a reported program outcome."},
    ],
  },
  {
    id:"operations",title:"Operations & Project Execution",
    audience:"Operations, project management and departmental coordinators",
    lessons:[
      {id:"ops-queue",name:"Review department assignments",goal:"Identify ownership, priorities and the current work item state.",path:"/work-items",area:"work_items",readiness:"navigation",
        steps:["Open Work Items and locate your department's authorized tasks.","Read the owner, due date, priority and required evidence for one task.","Identify whether the task is blocked by another person's approval or external material.","Do not move a live task solely for training."],practice:"State when a task should be escalated instead of marked complete."},
      {id:"ops-hub",name:"Navigate Operations Hub",goal:"Distinguish strategic operating milestones from individual work items.",path:"/modules/operations",area:"work_items",readiness:"navigation",
        steps:["Open the Operations Hub.","Identify functional responsibilities, cross-department handoffs and project status fields.","Locate the supporting work item or reporting source behind a milestone.","Record uncertainties for follow-up without creating fictitious records."],practice:"Find where an operational milestone is linked to accountable work."},
      {id:"ops-calendar",name:"Check the operating calendar",goal:"Read organizational deadlines and avoid creating conflicting commitments.",path:"/calendar",area:"calendar",readiness:"navigation",
        steps:["Open the operating calendar.","Locate one current event with its owning department, event type and relevant date.","Distinguish a planned milestone from a confirmed completed result.","Do not create a calendar event as a training sample."],practice:"Explain who should verify an interdepartmental deadline before it is changed."},
      {id:"ops-evidence",name:"Document a handoff without bypassing approvals",goal:"Understand how evidence and owner changes affect completion.",path:"/my-queue",area:"work_items",readiness:"navigation",
        steps:["Open My Queue and review a task with a linked document or handoff.","Identify the evidence field, responsible department and required reviewer.","Explain why one department's completed task may not authorize the next department's work.","Do not attach demonstration documents to a real task."],practice:"Name the receiving department, required evidence and approval before a handoff closes."},
    ],
  },
  {
    id:"technology",title:"Technology & Information Security",
    audience:"Authorized IT staff, technology managers and audit personnel",
    lessons:[
      {id:"it-console",name:"Navigate the IT support area",goal:"Find incident records and internal technical service responsibilities.",path:"/it",area:"it",readiness:"navigation",
        steps:["Open the IT support area.","Find the available incident intake, account support and troubleshooting views.","Identify incident priority, affected service and assigned owner.","Do not reset accounts, run production jobs or modify credentials while training."],practice:"Identify the minimum information necessary to triage a sign-in issue."},
      {id:"it-operations",name:"Review technology department work",goal:"Understand ownership of access, service changes and incident follow-up.",path:"/modules/it",area:"it",readiness:"navigation",
        steps:["Open the Technology/IT operations module.","Review the available work stages and handoff rules.","Identify whether a problem belongs to identity, application, hosting or data integrations.","Check that the affected staff member's identity is verified before requesting account changes."],practice:"State why a support email alone is insufficient authorization for elevated access."},
      {id:"it-audit",name:"Read the security audit trail",goal:"Locate change evidence without exposing credentials or private personal data.",path:"/audit/trail",area:"it",readiness:"navigation",
        steps:["Open the Audit Trail if your role permits it.","Identify an event date, action type, actor identifier and associated record.","Distinguish recorded evidence from an interpretation of why the event occurred.","Do not export or repost sensitive audit data as part of training."],practice:"Explain the difference between a change log and a permission grant."},
      {id:"it-permissions",name:"Review access permissions safely",goal:"Understand least-privilege access before granting staff accounts or roles.",path:"/audit/permissions",area:"it",readiness:"navigation",
        steps:["Open Permission Audit under your authorized IT role.","Review how access differs among staff, supervisors, board directors and NGO portal accounts.","Identify the manager and department authorization required for a role change.","Do not alter access rules while taking this lesson."],practice:"Identify who can authorize access to a restricted financial or HR module."},
    ],
  },
  {
    id:"administration",title:"Administration & Executive Secretariat",
    audience:"Authorized administration and executive secretariat personnel",
    lessons:[
      {id:"admin-department",name:"Navigate the Administration module",goal:"Find executive coordination tasks and responsible owners.",path:"/modules/administration",area:"work_items",readiness:"navigation",
        steps:["Open Administration Operations.","Identify the executive or interdepartmental request and its responsible owner.","Review a real task's deadline, supporting evidence and approval requirements.","Do not create fictional minutes or change project assignments."],practice:"Describe the distinction between a request for review and an approved executive decision."},
      {id:"admin-meetings",name:"Coordinate organizational appointments",goal:"Recognize meeting ownership, schedule constraints and accurate records.",path:"/calendar",area:"calendar",readiness:"navigation",
        steps:["Open the workspace Calendar.","Identify one authorized scheduled commitment and its intended participants.","Check the meeting purpose, time zone, relevant document and decision authority.","Explain what must be confirmed before inviting others or altering a meeting."],practice:"List the essential metadata in a reliable international meeting invitation."},
      {id:"admin-records",name:"Find an approved operational record",goal:"Keep evidence, approvals and signed agreements distinguishable.",path:"/documents",area:"documents",readiness:"navigation",
        steps:["Open Documents and navigate to the appropriate department or NGO.","Distinguish an unsigned draft from the signed approved record.","Check document version, relevant parties, effective date and access permissions.","Do not publish a private internal agreement during training."],practice:"Explain why an internal contract must preserve the final version and approval trail."},
      {id:"admin-reports",name:"Prepare departmental reporting inputs",goal:"Identify appropriate sources for executive and Board reports.",path:"/reports",area:"reports",readiness:"navigation",
        steps:["Open Reports and identify the department and reporting period.","Check that operational activities match their supporting work items or approved records.","Separate unresolved risks from verified achievements and proposed next actions.","Do not report training examples as actual departmental results."],practice:"Name the evidence you would require for a quarterly departmental status claim."},
    ],
  },
  {
    id:"compliance",title:"Governance, Compliance & Risk",
    audience:"Authorized internal compliance and governance personnel",
    lessons:[
      {id:"compliance-hub",name:"Locate internal compliance controls",goal:"Recognize the difference between a published policy and an unresolved risk.",path:"/governance/compliance",area:"compliance",readiness:"navigation",
        steps:["Open the internal Governance and Compliance module.","Identify the current policy or monitoring area visible to your account.","Check the owner, effective date and review history of any policy reference.","Do not mark a control satisfied without supporting evidence."],practice:"Identify what makes a policy operative rather than a draft."},
      {id:"compliance-policy",name:"Understand the policy register",goal:"Read the approval status and version of a documented control.",path:"/financial-hub/compliance/policies",area:"compliance",readiness:"navigation",
        steps:["Open the policy registry with an authorized compliance/finance account.","Identify policy scope, control owner, effective date and revision.","Separate a pending exception from approved policy language.","Do not approve or retire a policy for practice."],practice:"Locate the evidence necessary to demonstrate a policy was reviewed."},
      {id:"compliance-case",name:"Review a compliance case without changing it",goal:"Recognize the documented facts, escalation and corrective action.",path:"/governance/compliance",area:"compliance",readiness:"navigation",
        steps:["Locate an existing authorized case or monitoring item.","Read the reported concern, supporting evidence, responsible reviewer and stage.","Identify confidentiality and potential conflict-of-interest concerns.","Do not reveal private NGO or personnel information in course notes."],practice:"Name when a concern should be escalated to Legal or an independent reviewer."},
      {id:"compliance-audit",name:"Follow an audit or exception trail",goal:"Distinguish the underlying event from a compliance conclusion.",path:"/audit/trail",area:"it",readiness:"navigation",
        steps:["Open the audit trail only if explicitly authorized.","Identify a relevant action and its timestamp without copying restricted records.","Locate where a reviewer would document findings and recommendations.","Explain why an audit event alone does not establish wrongdoing."],practice:"Identify the source record and reviewer needed before resolving an exception."},
    ],
  },
  {
    id:"improvement",title:"Efficiency, Innovation & Process Improvement",
    audience:"Efficiency, innovation and management teams",
    lessons:[
      {id:"improvement-intake",name:"Capture a process improvement opportunity",goal:"Document an operational problem without creating a fictitious project.",path:"/work-items",area:"work_items",readiness:"navigation",
        steps:["Open Work Items and locate a process-improvement assignment if one exists.","Identify the existing process, the proposed adjustment and affected departments.","Separate evidence of the problem from assumptions about the solution.","Do not submit a new production request just for this exercise."],practice:"State a measurable operational problem and the evidence required to validate it."},
      {id:"improvement-metrics",name:"Define evidence for an efficiency measure",goal:"Distinguish an operational metric from an unsupported estimate.",path:"/reports",area:"reports",readiness:"navigation",
        steps:["Open the organizational Reports area.","Identify the observation period and data source for a relevant operating measure.","Describe the baseline and a comparison period before proposing an improvement.","Do not invent performance percentages or imply unverified causation."],practice:"Explain how a baseline, intervention and follow-up observation would be distinguished."},
      {id:"improvement-trial",name:"Plan a controlled improvement trial",goal:"Prepare a reversible change rather than bypassing department ownership.",path:"/documents",area:"documents",readiness:"navigation",
        steps:["Open authorized department planning documents.","Identify a proposed hypothesis, responsibilities, success criteria and rollback approach.","Determine whether Legal, IT, Finance or the affected department must approve a trial.","Do not test ideas on production financial, HR or Board records."],practice:"Outline one risk control and one observable success criterion for an internal trial."},
      {id:"improvement-handoff",name:"Hand off an approved improvement",goal:"Link an agreed change to accountable operational work.",path:"/my-queue",area:"work_items",readiness:"navigation",
        steps:["Open your assigned work and locate a process change that has an approved owner.","Identify the implementation task, acceptance evidence and reviewer.","Distinguish deployment from operational acceptance and training readiness.","Do not mark another department's work completed."],practice:"State who validates the outcome after an approved improvement has been implemented."},
    ],
  },
];
