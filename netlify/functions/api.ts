import express, { Router } from "express";
import serverless from "serverless-http";
import admin, { ServiceAccount } from "firebase-admin";
import dotenv from "dotenv";

const api = express();
const router = Router();
dotenv.config();

// Firebase
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
} as ServiceAccount;
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bucketier-1c8fb.firebaseio.com"
});
const database = admin.firestore();

// Middleware
api.use(express.json({
  limit: '1mb', // Just a bit less then 1MiB. Firebase limits to 1MiB.
}));

// Routes
router.get('/list', async (req, res) => {

  if (!req.body || !req.body.list_id) {
    return res.status(400).send({ error: 'Missing/Empty required body fields.' });
  }

  const documents = await database.collection("list_entry")
    .where("list_id", "==", req.body.list_id)
    .limit(100)
    .get();

  return res.status(200).send(documents.docs.map(doc => doc.data()));
});

// Export
api.use("/.netlify/functions/api", router);
export const handler = serverless(api);