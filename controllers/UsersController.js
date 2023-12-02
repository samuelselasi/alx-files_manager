// Contains the create new user endpoint
import sha1 from 'sha1';
import Queue from 'bull';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
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
    res.status(201).json({ id: userId, email });
  }

  static async getMe(req, res) {
    try {
      const { 'x-token': token } = req.headers;

      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const key = `auth_${token}`;
      const userId = await redisClient.get(key);

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await dbClient.client.db().collection('users').findOne({ _id: ObjectId(userId) });

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.status(200).json({ id: user._id.toString(), email: user.email });
    } catch (error) {
      console.error('Error in getMe:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default UsersController;
