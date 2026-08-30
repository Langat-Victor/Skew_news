import { getServiceRoleClient } from "./lib/supabase/server";
async function run() {
  const { data } = await getServiceRoleClient().from("articles").select("category, title").limit(20);
  console.log(data);
}
run();
