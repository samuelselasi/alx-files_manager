// module that handles authentication token
import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const credentialsBase64 = authHeader.slice('Basic '.length);
      const credentials = Buffer.from(credentialsBase64, 'base64').toString('utf-8');
      const [email, password] = credentials.split(':');

      const user = await dbClient.client.db().collection('users').findOne({ email, password: sha1(password) });
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const token = uuidv4();
      const key = `auth_${token}`;

      const expirationTimeInSeconds = 24 * 60 * 60;
      // await redisClient.set(key, user._id.toString());
      // await redisClient.expire(key, expirationTimeInSeconds);
      await redisClient.set(key, user._id.toString(), expirationTimeInSeconds);
      // await redisClient.setex(key, expirationTimeInSeconds, user._id.toString());

      res.status(200).json({ token });
    } catch (error) {
      console.error('Error in getConnect:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getDisconnect(req, res) {
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

      await redisClient.del(key);
      res.status(204).end();
    } catch (error) {
      console.error('Error in getDisconnect:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default AuthController;
