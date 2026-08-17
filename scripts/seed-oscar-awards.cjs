const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");
const fs = require("fs");

const firebaseConfig = {
  apiKey: "AIzaSyDummyKey",
  authDomain: "movieandtv-2832a.firebaseapp.com",
  projectId: "movieandtv-2832a",
  storageBucket: "movieandtv-2832a.appspot.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const oscarData = JSON.parse(fs.readFileSync(__dirname + "/oscar_6cat_database.json", "utf8"));

async function seedOscar() {
  console.log("Seeding 6-category Oscar awards (1970 - 2027) to Firestore AppConfig/oscar...");
  try {
    const docRef = doc(db, "AppConfig", "oscar");
    await setDoc(docRef, oscarData, { merge: true });
    console.log(`[OK] Successfully saved ${oscarData.items.length} years of 6-category Oscar awards to Firestore!`);
  } catch (error) {
    console.error("Error writing to Firestore:", error.message);
  }
}

seedOscar();
