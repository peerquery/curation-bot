'use strict';

const mdb = require('../config/connection');
const config = require('../config/config');

const dsteem = require('dsteem');
const client = new dsteem.Client(config.steem_rpc);

module.exports = async function(global_settings) {
    var mclient = await mdb();

    //vote blog of moderators, admins and project

    //leave no comments after voting
    let actions = 'vote';

    //fetch team accounts including *project blog* but excluding *curators* and those *inactive*

    let results = await mclient
        .db()
        .collection('teamschemas')
        .find(
            { role: { $ne: 'curator' }, state: { $ne: 'inactive' } },
            { projection: { account: 1 } }
        )
        .toArray();

    if (!results || results == '') return false;

    let data_array = [];

    for (let x in results) {
        //console.log(results[x].account);

        let acc = results[x].account;

        //get one latest post from the author's blog
        //the function returns posts by author and re-steemed posts by author so we fetch the last 5 posts
        let posts = await client.database.getDiscussions('blog', {
            tag: acc,
            limit: 5,
        });

        //and we filter to get the last one actually authored by the user
        let blog = async function(posts) {
            for (let i in posts) {
                if (posts[i].author == acc) return posts[i];
            }
        };

        let post = await blog(posts);

        if (!post || post == '') continue;

        const find = async voter =>
            post.active_votes.find(element => element.voter === voter);

        //check is post is already voted, if so then abort
        const voted = await find(global_settings.curation_bot_account);
        if (voted) continue;

        //set universal variables
        let data = {};
        data.data = {};

        (data.actions = 'vote'),
        (data.type = 'team_project_pay'),
        (data.config = global_settings),
        (data.data.author = post.author);
        data.data.voter = global_settings.curation_bot_account;
        data.data.permlink = post.permlink;

        if (results[x].author == config.steem_account) {
            data.data.weight = global_settings.curation_project_rate * 100;
        } else {
            data.data.weight = global_settings.curation_team_rate * 100;
        }

        data_array.push(data);
        if (x == results.length - 1) return data_array;
    }
};
