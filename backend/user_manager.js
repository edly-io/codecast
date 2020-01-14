
const md5 = require('md5');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const mysqlUtils = require('./mysql_utils');
const { checkLogin, checkAdmin } = require('./middlewares');


module.exports = function (app, config, callback) {

    app.set('trust proxy', 1) // trust first proxy

    const store = new MySQLStore(config.database);
    app.use(session({ ...config.session, store: store }));

    app.get('/login', function (req, res) {
        if (req.session.context && req.session.context.isActive) {
            res.redirect('/dashboard');
        } else {
            res.render('login.pug');
        }
    });

    app.get('/user/add', checkAdmin, function (req, res) {
        res.render('create_user.pug', { context: req.session.context });
    });

    app.get('/dashboard', checkLogin, function (req, res) {
        if (req.session.context.isAdmin) {
            res.redirect('/admin');
        } else {
            mysqlUtils.getRecords(req.session.context.userId, null, config.mysqlConnPool, function (err, records) {
                let context = req.session.context;
                if (!err) context['records'] = records;
                context['user'] = req.session.user;
                res.render('dashboard', {
                    baseUrl: config.baseUrl,
                    context,
                });
            });
        }
    });

    app.get('/admin', checkLogin, checkAdmin, function (req, res) {
        const userId = req.session.context.userId;
        const isAdmin = req.session.context.isAdmin;
        const username = req.session.context.username;
        mysqlUtils.getAllUsers(config.mysqlConnPool, function (err, users) {
            mysqlUtils.getRecords(userId, isAdmin, config.mysqlConnPool, function (err, records) {
                res.render('admin.pug', {
                    baseUrl: config.baseUrl,
                    context: {
                        users: users,
                        records: records,
                        username: username,
                        isAdmin: isAdmin,
                        user: req.session.user,
                    }
                });
            });
        });
    });

    app.post('/user/add', checkLogin, checkAdmin, function (req, res) {
        const email = req.body.email;
        const pass = md5(req.body.password);
        mysqlUtils.createUser(email, pass, config.mysqlConnPool, function (err, isSuccessful) {
            if (!err && isSuccessful) {
                res.redirect('/dashboard');
            } else {
                res.render('login.pug', { message: 'Unable to Create User' });
            }
        });
    });

    app.post('/login', function (req, res) {
        const email = req.body.email;
        const pass = md5(req.body.password);
        mysqlUtils.loginUser(email, pass, config.mysqlConnPool, function (err, userData) {
            if (!err && userData) {
                req.session.bucketId = userData[0].bucket_id;

                req.session.context = {
                    userId: userData[0].id,
                    bucketId: userData[0].bucket_id,
                    username: userData[0].email_id,
                    isActive: userData[0].is_active,
                    isAdmin: userData[0].is_admin,
                }

                req.session.identity = {
                    id: userData[0].id,
                    login: userData[0].email_id,
                };

                return userLogin(req, res);
            } else {
                res.render('login.pug', { message: 'Wrong Credentials' });
            }
        });

        function userLogin(req, res) {
            mysqlUtils.getUserConfig(req.session.context.bucketId, config.mysqlConnPool, function (err, userConfig) {
                if (err) return res.render('login.pug', { message: err.toString() });
                req.session.grants = userConfig.grants;
                req.session.user = JSON.stringify(getFrontendUser(req.session))
                res.redirect('/dashboard');
            });
        }
    });

    app.get('/logout', checkLogin, function (req, res) {
        req.session.destroy(function (err) {
            res.render('login.pug');
        });
    });

    function getFrontendUser(session) {
        if (!session.identity) return false;
        const { id, login } = session.identity;
        const grants = [];
        if (session.grants) {
            for (let grant of session.grants) {
                const { type, s3Bucket, s3Region, uploadPath } = grant;
                grants.push({
                    description: `s3:${s3Bucket}/${uploadPath}`,
                    url: `https://${s3Bucket}.s3.amazonaws.com/${uploadPath}/`,
                    type, s3Bucket, s3Region, uploadPath
                });
            }
        }
        return { id, login, grants };
    }

    config.getUserConfig = function (req, callback) {
        mysqlUtils.getUserConfig(req.session.context.bucketId, config.mysqlConnPool, callback);
    };

    callback(null);
};
