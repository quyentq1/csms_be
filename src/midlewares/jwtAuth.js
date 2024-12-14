const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authorization = req.headers.authorization;

    if (authorization) {
        try {
            const [_, accessToken] = authorization.split(" ");
            const payload = jwt.verify(accessToken, process.env.ACCESSTOKEN_SECRET_KEY);
            req.token = payload;
            return next();
        } catch (error) {
            return res.status(401).json({ message: 'Access Token không hợp lệ' });
        }
    } else return res.status(400).json({ message: 'Access Token không hợp lệ' });
}