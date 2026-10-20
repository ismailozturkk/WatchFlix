const fs = require("fs");
const path = require("path");

const oscarDatabase = JSON.parse(
  fs.readFileSync(path.join(__dirname, "oscar_6cat_database.json"), "utf8")
);

async function seedOscar() {
  console.log("Seeding 6-category Oscar awards (1970 - 2027) to Firestore AppConfig/oscar...");
  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: "movieandtv-2832a",
      });
    }
    const db = admin.firestore();
    const docRef = db.collection("AppConfig").doc("oscar");
    await docRef.set(oscarDatabase, { merge: true });
    console.log(`[OK] Successfully saved ${oscarDatabase.items.length} years of 6-category Oscar awards to Firestore!`);
  } catch (error) {
    console.log("Note: Admin SDK direct write:", error.message);
  }
}

seedOscar();
