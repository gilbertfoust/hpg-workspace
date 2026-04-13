import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Globe } from "lucide-react";

const GRANT_PORTALS = [
  { name: "Grants.gov", url: "https://www.grants.gov", desc: "Centralized database for US federal grants" },
  { name: "Candid (Foundation Center + GuideStar)", url: "https://candid.org", desc: "Comprehensive database of global grantmakers" },
  { name: "Instrumentl", url: "https://www.instrumentl.com", desc: "Grant discovery & tracking platform for nonprofits" },
  { name: "GrantWatch Michigan", url: "https://michigan.grantwatch.com", desc: "Michigan-specific grant listings" },
  { name: "GrantStation", url: "https://grantstation.com", desc: "Grant research and writing resources" },
  { name: "SAM.gov", url: "https://sam.gov", desc: "System for Award Management — federal opportunities" },
  { name: "Foundation Directory Online", url: "https://fdo.foundationcenter.org", desc: "Foundation and corporate giving database" },
  { name: "OpenGrants.io", url: "https://opengrants.io", desc: "Open grants database" },
  { name: "ProPublica Nonprofit Explorer", url: "https://projects.propublica.org/nonprofits", desc: "Historical giving analysis across 240,000+ funder profiles" },
  { name: "SBIR.gov", url: "https://www.sbir.gov", desc: "Small Business Innovation Research grants" },
  { name: "SBA.gov", url: "https://www.sba.gov/funding-programs", desc: "Small Business Administration funding programs" },
  { name: "EDA.gov", url: "https://eda.gov/grant-resources", desc: "Economic Development Administration grants" },
  { name: "HelloAlice", url: "https://helloalice.com/funding", desc: "Small business & nonprofit funding opportunities" },
  { name: "HelloSkip", url: "https://helloskip.com", desc: "Grant matching for small businesses" },
  { name: "Foundant", url: "https://foundant.com", desc: "Grant lifecycle management platform" },
  { name: "NAV.com", url: "https://nav.com/resource/smallbusiness", desc: "Small business resource center" },
  { name: "Bollinger Foundation", url: null, desc: "Private foundation grant opportunities" },
  { name: "For Good Major", url: null, desc: "Grant search platform" },
];

export function GrantPortalsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          Grant Search Portals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GRANT_PORTALS.map((portal) => (
            <div
              key={portal.name}
              className="flex items-start gap-2 p-2 rounded-md border border-border/50 hover:bg-muted/50 transition-colors"
            >
              <Globe className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                {portal.url ? (
                  <a
                    href={portal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {portal.name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-sm font-medium">{portal.name}</p>
                )}
                {portal.desc && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{portal.desc}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
