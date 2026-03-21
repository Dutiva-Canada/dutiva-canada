import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function logIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function logOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset`,
  });
  if (error) throw error;
}

export async function loadProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const keyMap = {
    companyName: "company_name",
    companyAddress: "company_address",
    defaultProvince: "default_province",
    brandColor: "brand_color",
    companyTagline: "company_tagline",
    tosAccepted: "tos_accepted",
    tosDate: "tos_date",
  };

  const mapped = {};
  for (const [key, value] of Object.entries(updates)) {
    mapped[keyMap[key] || key] = value;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(mapped)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadDocuments() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map((d) => ({
    id: d.id,
    templateId: d.template_id,
    templateName: d.template_name,
    province: d.province,
    lang: d.lang,
    date: d.created_at,
    html: d.html,
    formData: d.form_data,
  }));
}

export async function saveDocument(doc) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      template_id: doc.templateId,
      template_name: doc.templateName,
      province: doc.province,
      lang: doc.lang,
      form_data: doc.formData,
      html: doc.html,
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.rpc("trim_user_documents", { uid: user.id, max_docs: 50 });
  return data;
}

export async function clearDocuments() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function joinWaitlist(email) {
  const { data, error } = await supabase
    .from("waitlist")
    .upsert({ email, source: "landing_page" }, { onConflict: "email" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getWaitlistCount() {
  const { count, error } = await supabase
    .from("waitlist")
    .select("*", { count: "exact", head: true });
  if (error) return 0;
  return count || 0;
}

export { supabase };