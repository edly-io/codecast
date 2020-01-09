exports.checkLogin = function (req, res, next) {
    if (req.session.context && req.session.context.isActive) {
        next();
    } else {
        res.redirect('/login');
    }
}

exports.checkAdmin = function (req, res, next) {
    if (req.session.context && req.session.context.isAdmin) {
        next();
    } else {
        res.render('login.pug', { 
            message: 'Login with Admin Account to Access Admin Panel'
        });
    }
}