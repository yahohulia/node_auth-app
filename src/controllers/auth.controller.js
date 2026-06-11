import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/user.js';
import { userService } from '../services/user.service.js';
import { jwtService } from '../services/jwt.service.js';
import { ApiError } from '../exeptions/api.error.js';
import { tokenService } from '../services/token.service.js';
import { emailService } from '../services/email.service.js';

function validateName(value) {
  if (!value) {
    return 'Name is required';
  }

  if (value.length < 3) {
    return 'Name must be at least 3 characters';
  }
}

function validateEmail(value) {
  if (!value) {
    return 'Email is required';
  }

  const emailPatern = /^[\w.+-]+@([\w-]+\.){1,3}[\w-]{2,}$/;

  if (!emailPatern.test(value)) {
    return 'Email is not valid';
  }
}

function validatePassword(value) {
  if (!value) {
    return 'Password is required';
  }

  if (value.length < 6) {
    return 'At least 6 characters';
  }
}

const register = async (req, res) => {
  const { name, email, password } = req.body;

  const errors = {
    name: validateName(name),
    email: validateEmail(email),
    password: validatePassword(password),
  };

  if (errors.name || errors.email || errors.password) {
    throw ApiError.badRequest('Bad request', errors);
  }

  const hashedPass = await bcrypt.hash(password, 10);

  await userService.register(name, email, hashedPass);

  res.send({ message: 'OK' });
};

const activate = async (req, res) => {
  const { activationToken } = req.params;

  const user = await User.findOne({ where: { activationToken } });

  if (!user) {
    res.sendStatus(404);

    return;
  }

  user.activationToken = null;
  await user.save();

  res.redirect(process.env.CLIENT_HOST + '/profile');
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await userService.findByEmail(email);

  if (user.activationToken) {
    throw ApiError.badRequest('Please activate your email first');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!user || !isPasswordValid) {
    throw ApiError.badRequest('Email or password is incorrect');
  }

  generateTokens(res, user);
  res.redirect(process.env.CLIENT_HOST + '/profile');
};

const logout = async (req, res) => {
  const { refreshToken } = req.cookies;

  const userData = jwtService.verifyRefresh(refreshToken);

  if (!userData || !refreshToken) {
    throw ApiError.unAuthorized();
  }

  await tokenService.remove(userData.id);

  res.status(204).redirect(process.env.CLIENT_HOST + '/login');
};

const refresh = async (req, res) => {
  const { refreshToken } = req.cookies;

  const userData = jwtService.verifyRefresh(refreshToken);
  const token = await tokenService.getByToken(refreshToken);

  if (!userData || !token) {
    throw ApiError.unAuthorized();
  }

  const user = await userService.findByEmail(userData.email);

  generateTokens(res, user);
};

const generateTokens = async (res, user) => {
  const normalizedUser = userService.normalize(user);

  const accessToken = jwtService.sign(normalizedUser);
  const refreshAccessToken = jwtService.signRefresh(normalizedUser);

  await tokenService.save(normalizedUser.id, refreshAccessToken);

  res.cookie('refreshToken', refreshAccessToken, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    HttpOnly: true,
  });

  res.send({
    user: normalizedUser,
    accessToken,
  });
};

const resetPassword = async (req, res) => {
  const { email } = req.body;

  const user = await userService.findByEmail(email);

  if (!user) {
    throw ApiError.notFound();
  }

  const confirmToken = uuidv4();

  user.confirmToken = confirmToken;
  user.confirmTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000);
  await user.save();

  await emailService.sendResetPassword(email, confirmToken);

  res.status(200).send('The message was sent by email');
};

const confirmResetPassword = async (req, res, next) => {
  const { confirmToken } = req.params;
  const { newPassword1, newPassword2 } = req.body;

  const user = await User.findOne({ where: { confirmToken } });

  if (!user) {
    throw ApiError.notFound();
  }

  if (user.confirmTokenExpiry < new Date()) {
    return next(ApiError.badRequest({ message: 'Token expired' }));
  }

  if (newPassword1.trim() !== newPassword2.trim()) {
    return next(
      ApiError.badRequest({ newPassword: 'New passwords do not match' }),
    );
  }

  const isSamePassword = await bcrypt.compare(newPassword1, user.password);

  if (isSamePassword) {
    return next(
      ApiError.badRequest({
        newPassword: 'New password must be different from old password',
      }),
    );
  }

  user.password = await bcrypt.hash(newPassword1, 10);
  user.confirmToken = null;
  user.confirmTokenExpiry = null;
  await user.save();

  res.status(200).send('Password changed');
};

export const authController = {
  register,
  activate,
  login,
  refresh,
  logout,
  resetPassword,
  confirmResetPassword,
};
