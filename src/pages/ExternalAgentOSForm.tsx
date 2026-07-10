import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { FormField } from "@/hooks/useFormTemplates";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const HPG_LOGO_URL =
  "https://img1.wsimg.com/isteam/ip/8d5502d6-d937-4d80-bd56-8074053e4d77/Humanity%20Pathways%20Global.jpg/:/rs=h:175,m";

type PageState = "loading" | "ready" | "submitting" | "submitted" | "error";

type ExternalFormResponse = {
  ok: boolean;
  submitted?: boolean;
  message?: string;
  expires_at?: string;
  form?: {
    id: string;
    name: string;
    description: string | null;
    schema_json: { fields?: FormField[] };
  };
  case?: {
    reference_number: string;
    organization_name: string | null;
    amount_usd: number;
    currency: string;
  };
  error?: string;
};

const isEmpty = (value: unknown) =>
  value === null || value === undefined ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

function validate(fields: FormField[], values: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.required) {
      if (field.type === "checkbox" ? value !== true : isEmpty(value)) {
        errors[field.name] = "This field is required.";
      }
    }
    if (field.type === "email" && !isEmpty(value)) {
      const email = String(value);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors[field.name] = "Enter a valid email address.";
      }
    }
  }
  return errors;
}

async function invokeExternalForm(body: Record<string, unknown>) {
  if (!supabase) throw new Error("The secure form service is not configured.");
  const { data, error } = await supabase.functions.invoke("agent-os-external-form", { body });
  const response = (data || {}) as ExternalFormResponse;
  if (error) throw new Error(response.error || error.message || "The secure form service could not be reached.");
  if (response.error) throw new Error(response.error);
  return response;
}

export default function ExternalAgentOSForm() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [response, setResponse] = useState<ExternalFormResponse | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");

  const fields = useMemo(() => response?.form?.schema_json?.fields || [], [response]);

  useEffect(() => {
    let cancelled = false;

    async function loadForm() {
      if (!token) {
        setErrorMessage("This secure form link is invalid.");
        setState("error");
        return;
      }

      try {
        const result = await invokeExternalForm({ action: "get", token });
        if (cancelled) return;
        setResponse(result);

        if (result.submitted) {
          setState("submitted");
          return;
        }

        setValues({
          ngo_profile_number: result.case?.reference_number || "",
          legal_organization_name: result.case?.organization_name || "",
          fee_amount_usd: "$100 USD",
        });
        setState("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "This secure form could not be loaded.");
        setState("error");
      }
    }

    loadForm();
    return () => { cancelled = true; };
  }, [token]);

  const handleChange = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!token || state !== "ready") return;
    const validationErrors = validate(fields, values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setState("submitting");
    try {
      const result = await invokeExternalForm({ action: "submit", token, payload: values });
      setResponse(result);
      setState("submitted");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The form could not be submitted.");
      setState("ready");
    }
  };

  if (state === "loading") {
    return (
      <PublicShell>
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PublicShell>
    );
  }

  if (state === "error") {
    return (
      <PublicShell>
        <Card className="mx-auto max-w-lg text-center">
          <CardContent className="pt-8">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">Secure form unavailable</h1>
            <p className="mt-2 text-muted-foreground">{errorMessage}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Please contact Humanity Pathways Global using the email thread that delivered this link.
            </p>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  if (state === "submitted") {
    return (
      <PublicShell>
        <Card className="mx-auto max-w-lg text-center">
          <CardContent className="pt-8">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <h1 className="mt-4 text-xl font-semibold">Form submitted securely</h1>
            <p className="mt-2 text-muted-foreground">
              {response?.message || "HPG Finance will verify the $100 USD payment before the confirmation letter is issued."}
            </p>
            {response?.case?.reference_number && (
              <Badge variant="outline" className="mt-4 font-mono">
                {response.case.reference_number}
              </Badge>
            )}
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <Alert>
          <LockKeyhole className="h-4 w-4" />
          <AlertTitle>Secure HPG activation form</AlertTitle>
          <AlertDescription>
            This invitation is unique to the organization and expires on {response?.expires_at ? new Date(response.expires_at).toLocaleDateString() : "the date stated in your email"}.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{response?.form?.name || "International NGO Activation Fee Form"}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  {response?.form?.description}
                </p>
              </div>
              <Badge>$100 USD</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-muted/30 p-4 text-sm">
              <p><span className="font-medium">Organization:</span> {response?.case?.organization_name || "International NGO"}</p>
              <p><span className="font-medium">HPG profile:</span> <span className="font-mono">{response?.case?.reference_number}</span></p>
              <p><span className="font-medium">Activation fee:</span> $100 USD</p>
            </div>

            <Separator className="my-6" />

            {errorMessage && (
              <Alert variant="destructive" className="mb-5">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Submission not completed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <FormRenderer
              fields={fields}
              values={values}
              errors={errors}
              onChange={handleChange}
            />

            <Separator className="my-6" />

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={state === "submitting"}
            >
              {state === "submitting" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting securely...</>
              ) : (
                "Submit activation fee form"
              )}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Submitting this form does not itself confirm payment. HPG Finance must verify the applicable payment before HPG issues the confirmation letter.
            </p>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 sm:py-12">
      <div className="mx-auto mb-7 flex max-w-2xl items-center justify-center">
        <img src={HPG_LOGO_URL} alt="Humanity Pathways Global" className="h-16 max-w-full object-contain" />
      </div>
      {children}
      <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
        Humanity Pathways Global · Secure International NGO Activation
      </p>
    </div>
  );
}
