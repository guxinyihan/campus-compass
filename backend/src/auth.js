import jwt from 'jsonwebtoken';
import {User} from './models.js';
import {ApiFailure} from './validation.js';
export function accessToken(user, config) {
  return jwt.sign({role: user.role, tokenType: 'access'}, config.jwtSecret,
    {algorithm: 'HS256', issuer: 'campuscompass-api', audience: 'campuscompass-browser', subject: String(user._id), expiresIn: 900});
}
export function authenticate(config) {
  return async (req, res, next) => {
    const header = req.get('Authorization') || '';
    if (!header.startsWith('Bearer ')) throw new ApiFailure(401, 'UNAUTHORIZED', 'Sign in is required.');
    let claims;
    try {
      claims = jwt.verify(header.slice(7), config.jwtSecret, {algorithms: ['HS256'], issuer: 'campuscompass-api', audience: 'campuscompass-browser', maxAge: '15m'});
      if (claims.tokenType !== 'access' || !/^[a-f0-9]{24}$/i.test(claims.sub || '') || !Number.isInteger(claims.exp)) throw new Error();
    } catch { throw new ApiFailure(401, 'UNAUTHORIZED', 'Session expired or invalid. Sign in again.'); }
    const user = await User.findById(claims.sub);
    if (!user) throw new ApiFailure(401, 'UNAUTHORIZED', 'Session expired or invalid. Sign in again.');
    // Always read current server role; the signed role is not authorization authority.
    req.user = user;
    next();
  };
}
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) throw new ApiFailure(403, 'FORBIDDEN', 'This operation requires an authorized role.');
    next();
  };
}
