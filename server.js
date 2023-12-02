// Creates the Express server
import express from 'express';
import routes from './routes';

const app = express();
const port = process.env.PORT || 5000;

app.use('/', routes);
app.use(express.json());

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});

export default app;
