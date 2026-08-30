import { getServiceRoleClient } from "./lib/supabase/server";
async function run() {
  const { data } = await getServiceRoleClient().from("articles").select("category").limit(10);
  console.log(data);
}
run();
