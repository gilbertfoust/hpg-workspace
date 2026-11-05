import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardCheck, RotateCcw, ShieldAlert } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type Choice = { label: string; correct: boolean; why: string };
type Stage = { situation: string; prompt: string; choices: Choice[] };
type Scenario = { id: string; title: string; department: string; objective: string; stages: Stage[] };

const correct = (label: string, why: string): Choice => ({ label, correct: true, why });
const wrong = (label: string, why: string): Choice => ({ label, correct: false, why });

const scenarios: Scenario[] = [
  { id:"ngo-intake",title:"Incomplete NGO sponsorship intake",department:"Program / Compliance",objective:"Practice identifying the next authorized action without approving a real organization.",stages:[
    {situation:"A fictional NGO called Example Community Trust submits an application, but its organizational budget is missing.",prompt:"What should happen next?",choices:[
      wrong("Approve the NGO and request the budget after signing.","A missing required budget should not be represented as a completed review."),
      correct("Record the missing item and request the budget in the approved portal.","The review can proceed with a documented outstanding requirement; sponsorship approval requires the appropriate evidence."),
      wrong("Ask the NGO to email bank credentials to a volunteer.","Sensitive financial credentials should not be collected this way.")
    ]},
    {situation:"The NGO responds with a project budget but indicates it wants sponsorship for the entire organization.",prompt:"Which record should the coordinator clarify?",choices:[
      correct("The scope: entire organization or specific project, plus the matching operating budget.","The sponsorship agreement and financial controls depend on the accurate scope."),
      wrong("Only the logo image.","Branding does not resolve the scope discrepancy."),
      wrong("A public announcement of approval.","Approval has not been established.")
    ]},
    {situation:"The documents now appear complete, but independent diligence is still pending.",prompt:"What is the accurate status?",choices:[
      wrong("Fully approved and immediately eligible for disbursement.","Document completeness does not replace diligence and contractual approval."),
      correct("Ready for the next authorized diligence/review stage, not final approval.","Separate review and approval remain necessary."),
      wrong("Remove the diligence task because this is a training example.","A real record would require the documented process; this simulation never changes it.")
    ]}
  ]},
  { id:"finance-control",title:"Restricted donation and receipt review",department:"Finance / Accounting",objective:"Practice expense verification without making a payment.",stages:[
    {situation:"A fictional sponsored project submits a request for $1,200 for supplies with an approved total budget, but no itemized expense breakdown.",prompt:"What should the reviewer request?",choices:[
      correct("An itemized budget tied to the approved purpose and authorized expenditure request.","An approved project total is not evidence for every particular payment."),
      wrong("An immediate bank transfer because the amount is below $2,000.","There is no established blanket permission based on the amount alone."),
      wrong("A public donation post instead of documentation.","Fundraising communications do not substitute for financial records.")
    ]},
    {situation:"After funds have been paid under an authorized process, the program sends a receipt without a transaction date.",prompt:"What next?",choices:[
      wrong("Mark the account reconciled because there is a receipt image.","Reconciliation needs verifiable transaction and period details."),
      correct("Request complete receipt details and compare against the recorded transaction and account statement.","Evidence must link to the correct payment, date, project and fiscal period."),
      wrong("Delete the expense record.","An unexplained deletion would damage the financial audit trail.")
    ]},
    {situation:"The bank statement shows a different amount than the receipt.",prompt:"What should the controller do?",choices:[
      correct("Record the discrepancy, investigate supporting evidence, and resolve under controls.","A mismatch should remain identifiable until supported and reviewed."),
      wrong("Edit the receipt image to match the bank statement.","Altering source evidence is unacceptable."),
      wrong("Ignore the difference and finalize the period.","Unresolved mismatches should not be silently cleared.")
    ]}
  ]},
  { id:"hr-scope",title:"Volunteer appointment and restricted access",department:"Human Resources / IT",objective:"Practice appropriate approval handoffs before someone gets internal system permissions.",stages:[
    {situation:"A prospective volunteer applies through the HR website and asks for Finance access in the initial email.",prompt:"What should HR do?",choices:[
      wrong("Create a Finance administrator account right away.","An application is not an authorization for elevated access."),
      correct("Verify application status, role requirements, and the hiring/onboarding decision.","Identity, appointment and responsibilities must be established before access is proposed."),
      wrong("Forward all active NGO bank instructions to the applicant.","Sensitive documents must not be disclosed to an unapproved applicant.")
    ]},
    {situation:"The volunteer is accepted for Communications work but still requests access to private HR records.",prompt:"What is the correct response?",choices:[
      correct("Provide role-appropriate Communications access and route any additional request through explicit authorization.","Least privilege limits sensitive data to the actual work assignment."),
      wrong("Grant all staff access so onboarding is faster.","Convenience is not a substitute for authorizing access."),
      wrong("Let the volunteer borrow another staff member's login.","Shared credentials defeat accountability.")
    ]},
    {situation:"The volunteer stops participating and the role ends.",prompt:"What happens to account access?",choices:[
      wrong("Keep every permission indefinitely.","Access must reflect the active authorized relationship."),
      correct("Follow the documented offboarding and account review process, preserving the audit trail.","Offboarding should remove unnecessary access while retaining appropriate records."),
      wrong("Publish the volunteer's private application online.","Personal information is not a public record.")
    ]}
  ]},
  { id:"editorial-consent",title:"Interview and magazine publication gate",department:"Communications / Marketing",objective:"Review consent, embargo and independent approval before a public release.",stages:[
    {situation:"A fictional interview is drafted, but the subject's permission form has not yet been verified.",prompt:"May an editor publish it?",choices:[
      wrong("Yes, because the article has already been written.","A complete draft does not establish consent."),
      correct("No; document and independently review the required consent evidence first.","The release process requires current permission and applicable editorial controls."),
      wrong("Yes, as long as the headline avoids the person's name.","Privacy risk may remain in the content and release scope.")
    ]},
    {situation:"Consent was verified, but a fact-checker disputes a central claim.",prompt:"What is the next step?",choices:[
      correct("Resolve or correct the claim and obtain the necessary current review.","A disputed claim blocks authorized release."),
      wrong("Schedule immediate publication before the fact check is finished.","Scheduling does not bypass editorial review."),
      wrong("Delete the documented dispute without a correction.","Removing evidence does not solve the accuracy concern.")
    ]},
    {situation:"The story and issue have approvals, but the embargo expires tomorrow.",prompt:"What can happen today?",choices:[
      correct("Prepare and preview internally, while respecting the embargo before public release.","Internal production and public release are distinct."),
      wrong("Publish now because the issue has an approved design proof.","Design approval does not override embargo timing."),
      wrong("Move private recordings to public storage automatically.","Private media requires separate release decisions.")
    ]}
  ]},
  { id:"board-quorum",title:"Board meeting motion and minutes",department:"Board Governance",objective:"Practice quorum, recusal and evidence rules without creating a meeting or casting a vote.",stages:[
    {situation:"A fictional Board meeting is a draft and the administrator has added a motion.",prompt:"Can directors vote on this draft now?",choices:[
      correct("No; meeting publication, attendance, session and motion-opening rules must first be satisfied.","A draft agenda does not create an open ballot."),
      wrong("Yes, because every director knows the motion title.","A known title is not a valid voting state."),
      wrong("Only the meeting administrator should vote for everyone.","The existing process records independent eligible director votes.")
    ]},
    {situation:"At the meeting, an eligible director has not recorded attendance.",prompt:"What should happen before their vote?",choices:[
      correct("Record their own attendance and confirm the motion is open.","Participation requires the governed attendance step."),
      wrong("Allow a colleague to cast the ballot on their behalf.","The ballot must be attributable to its eligible voter."),
      wrong("Treat inclusion on the email list as attendance.","Invitation and actual attendance are not the same.")
    ]},
    {situation:"The director helped create the work item under consideration and has a direct conflict.",prompt:"How should the director respond?",choices:[
      correct("Follow the recusal procedure, documenting a reason when required.","The governance process requires independence for conflicted decisions."),
      wrong("Vote yes because they know the project best.","A source-work conflict should not be bypassed."),
      wrong("Delete the motion from the record after voting begins.","Governed actions must preserve the record and applicable rules.")
    ]}
  ]},
  { id:"grant-integrity",title:"Grant recommendation and donor restrictions",department:"Development / Research",objective:"Distinguish an eligible donor opportunity from an approved grant application.",stages:[
    {situation:"A funding opportunity appears to support youth leadership, but eligibility for fiscal sponsors is not stated.",prompt:"What should the grant writer do?",choices:[
      wrong("Submit immediately with HPG named as applicant.","Eligibility and internal submission authorization remain unresolved."),
      correct("Read the funder's official rules and document the sponsorship eligibility question.","Verified donor restrictions control whether to proceed."),
      wrong("Assume every youth organization qualifies.","Mission similarity is not sufficient evidence of eligibility.")
    ]},
    {situation:"The NGO asks to include unverified program outcomes in the draft.",prompt:"What is the appropriate response?",choices:[
      correct("Request source evidence and clearly distinguish forecasts from verified results.","Applications must avoid presenting unsupported claims as established outcomes."),
      wrong("Add the outcomes because funders prefer large numbers.","Persuasive wording cannot justify false reporting."),
      wrong("Remove all quantitative data from the project.","Valid supported data can still be useful.")
    ]},
    {situation:"The proposal draft is finished but the budget still conflicts with the agreement.",prompt:"Is submission ready?",choices:[
      correct("Not yet; reconcile the budget and follow the required independent review.","A written draft does not authorize submission or override agreement terms."),
      wrong("Yes, because the narrative is polished.","Financial alignment is part of grant due diligence."),
      wrong("Submit the grant and update the internal agreement afterward.","A submission must reflect currently authorized terms.")
    ]}
  ]},
];

export default function AcademyPracticeLab() {
  const [selected,setSelected]=useState(scenarios[0].id);
  const [step,setStep]=useState(0);
  const [response,setResponse]=useState<number | null>(null);
  const [finished,setFinished]=useState(false);
  const scene=useMemo(()=>scenarios.find(s=>s.id===selected)||scenarios[0],[selected]);
  const current=scene.stages[step];
  const chosen=response===null?null:current.choices[response];
  const reset=(id=selected)=>{setSelected(id);setStep(0);setResponse(null);setFinished(false);};
  const next=()=>{if(step+1>=scene.stages.length){setFinished(true);}else{setStep(x=>x+1);setResponse(null);}};
  return <MainLayout title="Workspace Training — Safe Practice Lab"
    subtitle="Interactive fictional workplace decisions; no production records, payments, or votes are changed.">
    <div className="mx-auto max-w-5xl space-y-5">
      <Card><CardContent className="flex flex-wrap items-center gap-3 p-5">
        <ShieldAlert className="h-7 w-7 text-primary"/>
        <div className="min-w-64 flex-1 space-y-1">
          <p className="font-semibold">Simulation-only training environment</p>
          <p className="text-sm text-muted-foreground">All organizations, people, amounts, and tasks below are fictional. Responses stay in this page's temporary state and are never inserted into the HPG operational database. These exercises are not a grade, credential, or proof of independent competence.</p>
        </div>
        <Button size="sm" variant="outline" asChild><Link to="/learning"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Workspace Training</Link></Button>
      </CardContent></Card>
      <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit"><CardHeader><CardTitle className="text-lg">Practice scenarios</CardTitle>
          <CardDescription>Choose a departmental workflow.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {scenarios.map(s=><button type="button" key={s.id}
              onClick={()=>reset(s.id)}
              className={"w-full rounded-md border p-3 text-left text-sm transition hover:bg-muted/30 "+
                (selected===s.id?"border-primary bg-primary/5":"")}>
              <span className="font-medium">{s.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{s.department}</span>
            </button>)}
          </CardContent></Card>
        <Card><CardHeader><div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fictional scenario</Badge><Badge variant="outline">{scene.department}</Badge>
        </div>
        <CardTitle>{scene.title}</CardTitle><CardDescription>{scene.objective}</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          {finished?<div className="space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-6 w-6 text-primary"/>
              <h2 className="font-semibold text-lg">Practice scenario completed</h2></div>
            <p className="text-sm">You have worked through {scene.stages.length} simulated decisions. This does not change your account's official knowledge-check results or grant approval authority.</p>
            <Button variant="outline" onClick={()=>reset()}><RotateCcw className="mr-2 h-4 w-4"/>Restart scenario</Button>
          </div>:<>
            <div className="space-y-2"><div className="flex justify-between text-sm">
              <span>Decision {step+1} of {scene.stages.length}</span><span className="text-muted-foreground">No live data changes</span>
            </div><Progress value={100*(step+1)/scene.stages.length}/></div>
            <div className="rounded-lg bg-muted/35 p-5">
              <p className="text-sm text-muted-foreground">Situation</p><p className="mt-2 font-medium">{current.situation}</p>
            </div>
            <h3 className="font-semibold">{current.prompt}</h3>
            <div className="space-y-2">
              {current.choices.map((choice,i)=><button key={i} type="button" disabled={response!==null}
                onClick={()=>setResponse(i)} className={"w-full rounded-md border p-3 text-left text-sm transition "+
                  (response===i?"border-primary bg-primary/5":"hover:bg-muted/40")}>
                {choice.label}
              </button>)}
            </div>
            {chosen&&<div role="status" className="space-y-2 rounded-lg border p-4">
              <p className="font-semibold">{chosen.correct?"Appropriate next action":"Review the control before proceeding"}</p>
              <p className="text-sm">{chosen.why}</p>
              {chosen.correct?
                <Button onClick={next}><ClipboardCheck className="mr-2 h-4 w-4"/>{step+1===scene.stages.length?"Finish practice":"Continue to next decision"}</Button>:
                <Button variant="outline" onClick={()=>setResponse(null)}><RotateCcw className="mr-2 h-4 w-4"/>Try a different decision</Button>}
            </div>}
          </>}
        </CardContent></Card>
      </div>
    </div>
  </MainLayout>;
}
