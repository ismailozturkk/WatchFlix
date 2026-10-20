const fs = require("fs");
const path = require("path");

const emmyDatabase = JSON.parse(
  fs.readFileSync(path.join(__dirname, "emmy_6cat_database.json"), "utf8")
);

async function seedEmmy() {
  console.log("Seeding 6-category Emmy awards (1970 - 2027) to Firestore AppConfig/emmy...");
  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: "movieandtv-2832a",
      });
    }
    const db = admin.firestore();
    const docRef = db.collection("AppConfig").doc("emmy");
    await docRef.set(emmyDatabase, { merge: true });
    console.log(`[OK] Successfully saved ${emmyDatabase.items.length} years of 6-category Emmy awards to Firestore!`);
  } catch (error) {
    console.log("Note: Admin SDK direct write:", error.message);
  }
}

seedEmmy();
