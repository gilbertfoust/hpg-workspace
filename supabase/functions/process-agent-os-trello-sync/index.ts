const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-os-worker-secret, x-work-item-trello-secret",
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
      eligible_count: 0,
      processed_count: 0,
      message: "The Trello synchronization worker was retired by Agent OS Phase 4. This endpoint cannot create, update, assign, move, archive, or synchronize any Trello or Workspace record.",
    }),
    { status: 410, headers },
  );
});
