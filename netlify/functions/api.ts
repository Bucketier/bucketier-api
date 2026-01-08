import express, { Router } from "express";
import serverless from "serverless-http";
import admin, { ServiceAccount } from "firebase-admin";
import dotenv from "dotenv";

const LIST_ENTRY_TTL_SECONDS = 10;

const api = express();
const router = Router();
dotenv.config();

// Firebase
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY,
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
} as ServiceAccount;
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});
const database = admin.firestore();

// Middleware
api.use(express.json({
  limit: '1mb', // Just a bit less then 1MiB. Firebase limits to 1MiB.
}));

// Routes
router.get('/bucket', async (req, res) => {
  const { bucket_id } = req.query;

  if (!bucket_id) {
    return res.status(400).send({ error: 'Missing/Empty required query fields.' });
  }

  const documents = await database.collection("buckets")
    .where("bucket_id", "==", bucket_id)
    .limit(100)
    .get();

  return res.status(200).send(documents.docs.map(doc => doc.data()));
});

router.post('/bucket', async (req, res) => {

  if (!req.body || !req.body.bucket_id || !req.body.encrypted_data || !req.body.nonce) {
    return res.status(400).send({ error: 'Missing/Empty required body fields.' });
  }

  const timeStamp = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + LIST_ENTRY_TTL_SECONDS * 1000);
  const collection = database.collection("buckets");

  await database.runTransaction(async (transaction) => {
    const expiredQuery = collection.where("expiresAt", "<=", timeStamp).limit(1);
    const snapshot = await transaction.get(expiredQuery);

    // Update a existing document if one has expired.
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      transaction.update(doc.ref, {
        bucket_id: req.body.bucket_id,
        encrypted_data: req.body.encrypted_data,
        nonce: req.body.nonce,
        expiresAt,
        timeStamp,
      });
      return;
    }
    
    // Create a new document if non have expired.
    const docRef = collection.doc();
    transaction.set(docRef, {
      bucket_id: req.body.bucket_id,
      encrypted_data: req.body.encrypted_data,
      nonce: req.body.nonce,
      expiresAt,
      timeStamp,
    });
  });
  
  res.sendStatus(200);
});

// Export
api.use("/.netlify/functions/api", router);
export const handler = serverless(api);