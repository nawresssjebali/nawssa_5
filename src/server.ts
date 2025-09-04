import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the Angular build (browser)
const browserDistFolder = resolve(__dirname, '../browser'); // or '../dist/projet_pfe_nawress_jebali'

// Create Express app
const app = express();

// Serve static files
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html', // default index
    redirect: false,
  })
);

// All other routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(resolve(browserDistFolder, 'index.html'));
});

// Start server
if (!process.env['PORT']) process.env['PORT'] = '80';
const port = parseInt(process.env['PORT'], 10);

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
