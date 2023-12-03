// module that handles file storage endpoints
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
// import mime from 'mime-types';
import fs from 'fs';
import { promisify } from 'util';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class FilesController {
  static async postUpload(req, res) {
    try {
      const user = await FilesController.retrieveUserBasedOnToken(req);

      if (!user) {
        return res.status(401).send({
          error: 'Unauthorized',
        });
      }

      const {
        name, type, parentId, isPublic, data,
      } = req.body;

      if (!name) {
        return res.status(400).send({
          error: 'Missing name',
        });
      }

      if (!type || !['folder', 'file', 'image'].includes(type)) {
        return res.status(400).send({
          error: 'Missing type',
        });
      }

      if (!data && type !== 'folder') {
        return res.status(400).send({
          error: 'Missing data',
        });
      }

      if (parentId) {
        const parent = await FilesController.getFileById(parentId);

        if (!parent) {
          return res.status(400).send({
            error: 'Parent not found',
          });
        }

        if (parent.type !== 'folder') {
          return res.status(400).send({
            error: 'Parent is not a folder',
          });
        }
      }

      const newFile = {
        userId: user._id.toString(),
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId || 0,
      };

      if (type === 'folder') {
        const result = await FilesController.insertFile(newFile);
        const writeResp = {
          id: result.insertedId,
          ...newFile,
        };
        delete writeResp._id;
        delete writeResp.localPath;
        // newFile.id = result.insertedId;
        // delete newFile._id;
        return res.status(201).send(writeResp);
      }
      const storeFolderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const fileName = uuidv4();
      const filePath = path.join(storeFolderPath, fileName);

      newFile.localPath = filePath;
      const decodedData = Buffer.from(data, 'base64');

      const pathExists = await FilesController.pathExists(storeFolderPath);
      if (!pathExists) {
        await fs.mkdir(storeFolderPath, { recursive: true });
      }

      fs.writeFile(filePath, decodedData, 'utf-8', (error) => {
        if (error) {
          console.error('Error writing file:', error);
          return res.status(500).send({
            error: 'Internal Server Error',
          });
        }
        return undefined;
      });

      const result = await FilesController.insertFile(newFile);
      const writeResp = {
        id: result.insertedId,
        ...newFile,
      };
      delete writeResp._id;
      delete writeResp.localPath;

      return res.status(201).send(writeResp);
    } catch (error) {
      console.error('Error in postUpload:', error);
      return res.status(500).send({
        error: 'Internal Server Error',
      });
    }
  }

  static async retrieveUserBasedOnToken(req) {
    const authToken = req.header('X-Token') || null;

    if (!authToken) return null;

    const token = `auth_${authToken}`;
    const userId = await redisClient.get(token);

    if (!userId) return null;

    return FilesController.getUserById(userId);
  }

  static async getUserById(userId) {
    const usersCollection = dbClient.client.db().collection('users');
    return usersCollection.findOne({ _id: ObjectId(userId) });
  }

  static async getFileById(fileId) {
    const filesCollection = dbClient.client.db().collection('files');
    return filesCollection.findOne({ _id: ObjectId(fileId) });
  }

  static async insertFile(file) {
    const filesCollection = dbClient.client.db().collection('files');
    return filesCollection.insertOne(file);
  }

  static async pathExists(path) {
    return promisify(fs.access)(path, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  static async getShow(req, res) {
    try {
      const user = await FilesController.retrieveUserBasedOnToken(req);

      if (!user) {
        return res.status(401).send({
          error: 'Unauthorized',
        });
      }

      const fileId = req.params.id;

      if (!fileId) {
        return res.status(400).send({
          error: 'Unauthorized',
        });
      }

      const file = await FilesController.getFileById(fileId);

      if (!file || file.userId.toString() !== user._id.toString()) {
        return res.status(404).send({
          error: 'Not found',
        });
      }

      return res.status(200).send(file);
    } catch (error) {
      console.error('Error in getShow:', error);
      return res.status(500).send({
        error: 'Internal Server Error',
      });
    }
  }

  static async getIndex(req, res) {
    try {
      const user = await FilesController.retrieveUserBasedOnToken(req);

      if (!user) {
        return res.status(401).send({
          error: 'Unauthorized',
        });
      }

      const parentId = req.query.parentId || 0;
      const page = req.query.page || 0;
      const pageSize = 20;

      const files = await FilesController.getFilesByParentId(
        user._id.toString(), parentId, page, pageSize,
      );

      return res.status(200).send(files);
    } catch (error) {
      console.error('Error in getIndex:', error);
      return res.status(500).send({
        error: 'Internal Server Error',
      });
    }
  }

  static async getFilesByParentId(userId, parentId, page, pageSize) {
    const filesCollection = dbClient.client.db().collection('files');
    const skip = page * pageSize;
    const query = { userId, parentId };
    const files = await filesCollection.find(query).skip(skip).limit(pageSize).toArray();
    // return files;
    const mappedFiles = files.map((file) => {
      const { _id, ...rest } = file;
      return { id: _id.toString(), ...rest };
    });

    return mappedFiles;
  }
}

export default FilesController;
