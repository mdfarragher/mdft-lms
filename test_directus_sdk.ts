import { createDirectus, rest, authentication, readMe } from 'npm:@directus/sdk';

try {
  const client = createDirectus('http://localhost:8055')
    .with(authentication())
    .with(rest());
  
  console.log("Directus SDK imported successfully.");
} catch (e) {
  console.error("Failed to initialize SDK:", e);
}
