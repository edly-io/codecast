exports.checkLogin = function (req, res, next) {
    if (req.session.context && req.session.context.isActive) {
        next();
    }else if (req.session.context && !req.session.context.isActive){
        res.render('login.pug', { 
            message: 'Kindly, contact admin to active your account'
        });
    } else {
        res.redirect('/login');
    }
}

exports.checkAdmin = function (req, res, next) {
    if (req.session.context && req.session.context.isAdmin) {
        next();
    } else {
        res.render('login.pug', { 
            message: 'Kindly, login with admin account to access admin panel'
        });
    }
}
