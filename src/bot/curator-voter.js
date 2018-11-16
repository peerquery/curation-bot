'use strict';

const mdb = require('../config/connection');
const config = require('../config/config');

const dsteem = require('dsteem');
const client = new dsteem.Client(config.steem_rpc);

module.exports = async function(global_settings) {
    var mclient = await mdb();

    let actions = 'vote';

    //fetch team accounts including *project blog* but excluding *curators* and those *inactive*

    let cursor = await mclient
        .db()
        .collection('activityschemas')
        .aggregate([
            {
                $match: {
                    type: 'curation',
                    created: {
                        $gt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            },
            { $group: { _id: '$account', count: { $sum: 1 } } },
        ]);

    let results = await cursor.toArray();

    //console.log('-----db results: ', results);
    if (!results || results == '') return false;

    let data_array = [];

    for (let x in results) {
        let acc = results[x]._id;
        let data = {};
        data.data = {};

        (data.actions = 'vote'),
        (data.type = 'curator_pay'),
        (data.config = global_settings),
        //set universal letiables
        (data.data.author = acc);
        data.data.voter = global_settings.curation_bot_account;

        //get one latest post from the author's blog
        //the function returns posts by author and re-steemed posts by author so we fetch the last 5 posts
        let posts = await client.database.getDiscussions('blog', {
            tag: acc,
            limit: 5,
        });
        //console.log(posts)

        //and we filter to get the last one authored by the user
        let blog = function(posts) {
            for (let i in posts) {
                if (posts[i].author == acc) return posts[i];
            }
        };

        let post = blog(posts);

        if (!post || post == '') continue;

        const find = async voter =>
            post.active_votes.find(element => element.voter === voter);

        //check is post is already voted, if so then abort
        const voted = await find(global_settings.curation_bot_account);
        if (voted) continue;

        data.data.permlink = post.permlink;

        //calculate the vote worth for each curator based on their curation count
        //then we multiple by 100 since we used curator rate is based on %(100) instead the true 10,000 for 100% weight
        data.data.weight =
            results[x].count * global_settings.curation_curator_rate * 100;

        data_array.push(data);
        if (x == results.length - 1) return data_array;
    }
};
