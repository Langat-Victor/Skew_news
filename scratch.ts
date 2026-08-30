import { getServiceRoleClient } from "./lib/supabase/server";
async function run() {
  const { data, error } = await getServiceRoleClient()
    .from("articles")
    .select("category, article_analyses!inner(model)")
    .not("category", "is", null);
  if (error) {
    console.error(error);
  } else {
    console.log("Categories:", new Set(data.map(d => d.category)));
  }
}
run();
