'use strict';

require('dotenv').config();

const MongoClient = require('mongodb').MongoClient;

async function db() {
    return await MongoClient.connect(
        process.env.MONGODB_URI,
        { useNewUrlParser: true, poolSize: 10 }
    );
}

module.exports = db;
