const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve((request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  return new Response(
    JSON.stringify({
      status: "retired",
      provider: "trello",
      authoritative_system: "HPG Workspace / Supabase",
      message: "Trello webhook ingestion was retired by Agent OS Phase 4. Historical identifiers remain available only as provenance; this endpoint performs no reads, writes, routing, or synchronization.",
    }),
    { status: 410, headers },
  );
});
