# Introduction

A third party tool which enables an author to record coding tasks by using an interactive `C-Language Compiler`. This tool can help you embed and showcase the recorded tasks in any learning platform such as `Open edX` through an `iframe link`.

# Prerequisites

- MySql
- Node (Version: 12.x.x is recommended)

# Quick start

1. Clone this repo using following command

        git clone https://github.com/edly-io/codecast.git

2. At root directory of the project run the following commands to create a database

        mysql -u <YOUR MYSQL USER> -p

    1. To create database, run

            CREATE DATABASE <YOUR DATABASE NAME>;
            USE <YOUR DATABASE NAME>;
            SOURCE user_management_schema.sql;

    2. To add `s3` bucket credentials, run

            INSERT INTO buckets (bucket_id, value) values (0,'{ \"s3AccessKeyId\": \"<YOUR S3 ACCESS KEY ID>\", \"s3SecretAccessKey\": \"<YOUR S3 SECRET ACCESS KEY>\", \"s3Region\": \"<YOUR S3 REGION>\", \"s3Bucket\": \"<YOUR S3 BUCKET NAME>\", \"uploadPath\": \"uploads\" }');

    3. To add `admin` user, run

            INSERT INTO users (email_id, password, is_active, is_admin, bucket_id) values ('<YOUR ADMIN EMAIL ADDRESS>', '21232f297a57a5a743894a0e4a801fc3', 1, 1, 0);

3. At root level of the project make a file named `config.json` with the following settings

        {
            "port": 8001,
            "baseUrl": "http://localhost:8001",
            "mountPath": "/",
            "database": {
                "host": "<MYSQL_HOST>",
                "port": "<MYSQL_PORT_NUMBER>",
                "user": "<MYSQL_USER>",
                "password": "<MYSQL_PASSWORD>",
                "database": "<MYSQL_DATABASE_NAME>"
            },
            "session": {
                "secret": "<RANDOM_SESSION_SECRET>",
                "resave": false,
                "saveUninitialized": true,
                "cookie": {
                    "secure": false,
                    "maxAge": 60480000
                }
            },
            "enableOauth": false
        }

4. To install its required packages, run

        npm install

    You might see an error similar to this

        ../deps/mpg123/src/output/alsa.c:19:10: fatal error: alsa/asoundlib.h: No such file or directory #include <alsa/asoundlib.h>

    You can get rid of the above mentioned error by installing the following package

        sudo apt-get install libasound2-dev

    After that, run `npm install` command again and if you see any error something like that is given below, just ignore it and proceed to next step

        gyp ERR! build error
        gyp ERR! stack Error: `make` failed with exit code: 2
        gyp ERR! stack     at ChildProcess.onExit (/home/umar/.nvm/versions/node/v12.10.0/lib/node_modules/npm/node_modules/node-gyp/lib/build.js:196:23)
        gyp ERR! stack     at ChildProcess.emit (events.js:209:13)
        gyp ERR! stack     at Process.ChildProcess._handle.onexit (internal/child_process.js:272:12)
        gyp ERR! System Linux 4.15.0-20-generic
        gyp ERR! command "/home/umar/.nvm/versions/node/v12.10.0/bin/node" "/home/umar/.nvm/versions/node/v12.10.0/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js" "rebuild"
        gyp ERR! cwd /home/umar/Documents/Work/codecast/node_modules/speaker
        gyp ERR! node -v v12.10.0
        gyp ERR! node-gyp -v v5.0.3
        gyp ERR! not ok


5. To compile assets, run

        npm run build

    You may get the above mentioned error again, but you can ignore it and run the next command

        npm run start

6.  Go to `http://localhost:8001/login` link and login using your admin credentials

        Admin Email: <YOUR ADMIN EMAIL ADDRESS THAT YOU STORED IN DATABASE>
        Password: admin

<hr>

For development "npm run build" is not needed as webpack is configured
to watch the source files:

    NODE_ENV=development npm start

# Build for offline use

    rm -rf build
    BUILD=offline NODE_ENV=production npm run build
    zip -r offline.zip build assets
