// Creates the Express server
import express from 'express';
import router from './routes';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(router);

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});

export default app;
