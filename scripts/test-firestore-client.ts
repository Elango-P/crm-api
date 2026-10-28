import axios from 'axios';

async function test() {
  const apiKey = 'AIzaSyAxsfNQS-gBvJRH53kHyaz3vX6v9luGPzw';
  const projectId = 'my-portfolio-e1326';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/customers?key=${apiKey}`;
  console.log(url);

  try {
    const res = await axios.get(url);
    console.log('Firestore HTTP GET Status:', res.status, 'Documents count:', res.data.documents ? res.data.documents.length : 0);
    if (res.data.documents) {
      console.log('Sample document:', JSON.stringify(res.data.documents[0]));
    }
  } catch (err: any) {
    console.error('Firestore Error Status:', err.response?.status);
    console.error('Firestore Error Data:', JSON.stringify(err.response?.data));
  }
}

test();
