// Contains the create new user endpoint
import sha1 from 'sha1';
import Queue from 'bull';
import dbClient from '../utils/db';

const userQueue = new Queue('email sending');

class UsersController {
  static async postNew(req, res) {
    // console.log('Request Body:', req.body);
    const { email } = req.body;
    const { password } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }

    // const User = await (await dbClient.usersCollection()).findOne({ email });
    const usersCollection = await dbClient.client.db().collection('users');
    const User = await usersCollection.findOne({ email });

    if (User) {
      res.status(400).json({ error: 'Already exist' });
      return;
    }
    const insertData = await usersCollection.insertOne(
      { email, password: sha1(password) },
    );
    const userId = insertData.insertedId.toString();

    userQueue.add({ userId });
    res.status(201).json({ email, id: userId });
  }

  static async getMe(req, res) {
    const { user } = req;

    res.status(200).json({ email: user.email, id: user._id.toString() });
  }
}

export default UsersController;
