const {
  checkSupabaseStorageHealth,
  getSafeStorageConfigSnapshot,
} = require("../src/supabase-storage");

async function main() {
  const storageCheck = await checkSupabaseStorageHealth();
  const payload = {
    config: getSafeStorageConfigSnapshot(),
    storage: storageCheck,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = storageCheck.ok ? 0 : 1;
}

main().catch((error) => {
  console.error("Supabase Storage check failed unexpectedly:", error);
  process.exitCode = 1;
});
