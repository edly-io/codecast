
# Quick start

Build [c-to-json](https://github.com/epixode/c-to-json/issues/1#issuecomment-390388305) and copy the executable at the root of this project.

Copy `config.json.template` to `config.json` and edit it like this.

{
  "port": 8001,
  "baseUrl": "http://localhost:8001",
  "mountPath": "/",
  "database": {
    "host"     : "localhost",
    "port"     : "3306",
    "user"     : "root",
    "password" : "password",
    "database" : "codecast"
  },
  "session": {
    "secret": "secret",
    "resave": false,
    "saveUninitialized": true,
    "cookie": {"secure": false, "maxAge": 604800}
  },
  "enableOauth": false
}

Use `user_management.sql` to create the database.

Add an S3Bucket Credentials in `buckets` table having `(bucket_id, value)` as `INSERT INTO buckets (bucket_id, value) values (0,'{ \"s3AccessKeyId\": \"<ACCESS-KEY>\", \"s3SecretAccessKey\": \"<SECRET>\", \"s3Region\": \"<REGION>\", \"s3Bucket\": \"<BUCKET>\", \"uploadPath\": \"<UPLOAD-PATH-IN-S3>\" }');`


Start with these commands:

    npm install
    npm run build
    npm start

For development "npm run build" is not needed as webpack is configured
to watch the source files:

    NODE_ENV=development npm start

# Build for offline use

    rm -rf build
    BUILD=offline NODE_ENV=production npm run build
    zip -r offline.zip build assets
