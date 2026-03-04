
import { getDirectusClient } from "./utils/directus.ts";
import { readItems } from "@directus/sdk";
import "$std/dotenv/load.ts";

const client = getDirectusClient();

console.log("--- Debugging Search for 'nlp' ---");

try {
  // 1. Search Video Lessons directly
  console.log("1. Searching video_lessons for 'nlp'...");
  const videoLessons = await client.request(
    readItems("video_lessons", {
      filter: {
        title: {
          _icontains: "nlp",
        },
      },
      fields: ["id", "title"],
    })
  );
  console.log("Found video lessons:", JSON.stringify(videoLessons, null, 2));

  if (videoLessons.length > 0) {
    const lessonId = videoLessons[0].id;
    console.log(`\n2. Checking parent module for lesson ID: ${lessonId}`);

    // 2. Check how this is linked in modules
    // We'll search modules that have this lesson
    const modules = await client.request(
      readItems("modules", {
        filter: {
          lessons: {
            item: {
              _eq: lessonId,
            },
            collection: {
              _eq: "video_lessons",
            },
          },
        },
        fields: ["id", "title", "lessons.collection", "lessons.item"],
      })
    );
    console.log("Found parent modules (using precise filter):", JSON.stringify(modules, null, 2));

    // 3. detailed inspection of a module's lessons to verify collection names
    console.log("\n3. Inspecting all modules to see raw lesson structure...");
    const allModules = await client.request(
      readItems("modules", {
        limit: 1,
        fields: ["id", "title", "lessons.collection", "lessons.item"],
      })
    );
     if (allModules.length > 0) {
        console.log("Sample module structure:", JSON.stringify(allModules[0], null, 2));
     }

  } else {
      console.log("No video lessons found matching 'nlp'.");
  }

} catch (error) {
  console.error("Error:", error);
}
