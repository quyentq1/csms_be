const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

let register = async (req, res, next) => {
    let email = req.body.email;
    if(email === undefined) return res.status(400).send(' email Not Exists');
    let admin = await User.findOne({ where: { email, role_id: 1 } });
    if(admin) return res.status(409).send("Email Exists");
    else {
        try {
            let hashPassword = bcrypt.hashSync(req.body.password, 10);
            let newAdmin = { email: email, password: hashPassword, role_id: 1 };
            let createAdmin = await User.create(newAdmin);
            return res.send(createAdmin);
        } catch(err) {
            console.log(err);
            return res.status(400).send("Error");
        }
    }
}

let login = async (req, res, next) => {
    let email = req.body.email;
    if (email === undefined) return res.status(400).send(' email Not Exists');
    
    let password = req.body.password;
    if (password === undefined) return res.status(400).send(' password Not Exists');

    try {
        // Tìm kiếm user với email và role_id là Admin (1) hoặc Staff (3)
        let user = await User.findOne({ 
            where: { 
                email, 
                role_id: [1, 3]  // Kiểm tra cả role Admin và Staff
            } 
        });
        if (!user) {
            return res.status(401).send("Incorrect email or user does not have access");
        }
        // Kiểm tra mật khẩu
        let isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).send("Password is incorrect");
        }
        // console.log("Role", user);
        const token = jwt.sign({ email }, process.env.REFRESHTOKEN_SECRET_KEY, { expiresIn: process.env.REFRESHTOKEN_EXPIRES_IN });
        // Đăng nhập thành công, trả về thông tin người dùng
        // console.log('Generated Token:', token);
        const requires2FA = !!user.twoFASecret;
        return res.send({ email: user.email, role_id: user.role_id, token, requires2FA  });
    } catch (err) {
        console.log(err);
        return res.status(400).send("There was an error during login, please try again");
    }
};

let generate2fa = async (req, res, next) => {
    const { token } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.REFRESHTOKEN_SECRET_KEY);
        const email = decoded.email;
        const secret = speakeasy.generateSecret({ name: `csms.io.vn (${email})` });
        await User.update({ twoFASecret: secret.base32 }, { where: { email } });
        qrcode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
            if (err) {
                return res.status(500).json({ error: 'Error generating QR code' });
            }
            res.json({ qrCode: dataUrl });
        });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

let verify2fa = async (req, res, next) => {
    const { token, code } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.REFRESHTOKEN_SECRET_KEY);
        const email = decoded.email;

        const user = await User.findOne({ where: { email } });
        if (!user || !user.twoFASecret) {
            return res.status(400).json({ error: '2FA is not enabled for this user' });
        }
        const isValid = speakeasy.totp.verify({
            secret: user.twoFASecret,
            encoding: 'base32',
            token: code,
            window: 1,
        });
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid 2FA code' });
        }
        const finalToken = jwt.sign(
            { email: user.email },
            process.env.ACCESSTOKEN_SECRET_KEY,
            { expiresIn: process.env.REFRESHTOKEN_EXPIRES_IN }
        );
        res.json({ email: user.email, role_id: user.role_id, accessToken : finalToken });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}


module.exports = {
    register,
    login,
    generate2fa,
    verify2fa
};
