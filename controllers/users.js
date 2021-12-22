const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Users = require('../models/users');
const messages = require('../errors/errorsMessages');
const NotFoundError = require('../errors/not-found');
const BadRequestError = require('../errors/bad-request');
const UnauthorizedError = require('../errors/unauthorized');
const ConflictRequestError = require('../errors/conflicting-reques');
const {
  SUCCESS_OK,
} = require('../errors/statusOk');

const { NODE_ENV, JWT_SECRET } = process.env;

const getUser = (req, res, next) => {
  Users.findById(req.user._id).then((user) => {
    if (!user) {
      throw new NotFoundError(messages.notFoundError);
    }
    res.status(200).send(user);
  })
    .catch(next);
};

const updateUser = (req, res, next) => {
  const userId = req.user._id;
  const { name, email } = req.body;
  Users.findByIdAndUpdate(userId, { name, email }, { new: true, runValidators: true })
    .then((user) => {
      res.status(200).send(user);
    })
    .catch((err) => {
      if (err.name === 'ValidationError') {
        throw new BadRequestError(messages.badRequestError);
      }
      if (err.code === 11000) {
        throw new ConflictRequestError(messages.conflictingError);
      }
      next(err);
    })
    .catch(next);
};

const createUser = (req, res, next) => {
  const {
    name, email, password,
  } = req.body;
  Users.findOne({ email })
    .then((user) => {
      if (user) {
        throw new ConflictRequestError(messages.conflictingError);
      } else {
        return bcrypt.hash(password, 12);
      }
    })
    .then((hash) => Users.create({
      name, email, password: hash,
    })
      .then((user) => res.status(200).send({
        name: user.name, email: user.email,
      }))
      .catch((err) => {
        if (err.name === 'ValidationError') {
          throw new BadRequestError(messages.badRequestError);
        } else {
          next(err);
        }
      }))
    .catch(next);
};

const signOut = (req, res) => {
  res.clearCookie('jwt').send(messages.cookiesDelete);
};

const login = (req, res, next) => {
  const { email, password } = req.body;

  Users.findOne({ email }).select('+password')
    .then((user) => {
      if (!user) {
        return Promise.reject(new Error(messages.unauthorizeError));
      }
      return bcrypt.compare(password, user.password)
        .then((matched) => {
          if (!matched) {
            return Promise.reject(new Error(messages.unauthorizeError));
          }

          const token = jwt.sign(
            { _id: user._id },
            NODE_ENV === 'production' ? JWT_SECRET : 'dev-secret',
            { expiresIn: '7d' },
          );
          res.status(SUCCESS_OK).send({ token });
        });
    })
    .catch(() => {
      throw new UnauthorizedError(messages.unauthorizeError);
    })
    .catch(next);
};

module.exports = {
  createUser,
  getUser,
  updateUser,
  signOut,
  login,
};