
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function run() {
  console.log("Starting PIN migration...");
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, pin_code, pin_hash")
    .not("pin_code", "is", null);

  if (error) {
    console.error("Error fetching profiles:", error);
    process.exit(1);
  }

  console.log(`Found ${profiles?.length || 0} profiles with pin_code.`);

  if (!profiles || profiles.length === 0) {
    console.log("No profiles need migration.");
    return;
  }

  for (const profile of profiles) {
    console.log(`Checking profile ${profile.full_name} (${profile.id})...`);
    if (profile.pin_code) {
      console.log(`Migrating PIN for ${profile.full_name}...`);
      const newHash = hashPin(profile.pin_code);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          pin_hash: newHash,
          pin_code: null
        })
        .eq("id", profile.id);

      if (updateError) {
        console.error(`Failed to migrate ${profile.full_name}:`, updateError);
      } else {
        console.log(`Successfully migrated ${profile.full_name}. pin_code is now NULL.`);
      }
    }
  }
  console.log("Migration task finished.");
}

run();
