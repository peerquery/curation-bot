'use strict';

require('dotenv').config();

const dsteem = require('dsteem');
const vote_worth = require('../helpers/vote-worth');
const config = require('../config/config');
const client = new dsteem.Client(config.steem_rpc);
const key = dsteem.PrivateKey.fromString(process.env.BOT_POSTING_KEY);

const mdb = require('../config/connection');

module.exports = async function(obj) {
    try {
        var mclient = await mdb();

        if (!obj) return;

        var data = obj.data;
        var actions = obj.actions;
        var type = obj.type;
        var global_settings = obj.config;

        //set vote details
        var vote = {
            voter: data.voter,
            author: data.author,
            permlink: data.permlink,
            weight: data.weight,
        };
        //console.log(vote);

        //await the vote - unfortunately, if vote fails - the post has already been marked as voted
        var vote_results = await client.broadcast.vote(vote, key);
        //console.log(vote_results);

        if (actions == 'vote_comment') {
            //set comment details
            var comment = {
                author: data.user,
                title: '',
                body: data.body,
                json_metadata: data.json_metadata,
                parent_author: data.parent_author,
                parent_permlink: data.parent_permlink,
                permlink: data.new_permlink,
            };
            //console.log(comment);

            //comment
            try {
                var comment_results = await client.broadcast.comment(
                    comment,
                    key
                );
                //console.log(comment_results);
            } catch (e) {
                console.log(e);
            }
        }

        //calculate vote amount in $/USD
        var vote_amount = vote_worth(
            data.weight,
            global_settings.voting_power,
            global_settings.final_vest,
            global_settings.recent_claims,
            global_settings.reward_balance,
            global_settings.sbd_median_price
        );

        //record activity in db

        //update site activity
        var newActivity = {
            title: 'New post by @' + data.author + ' voted',
            slug_id: '/@' + data.author + '/' + data.permlink,
            action: actions,
            type: type,
            source: 'bot',
            account: data.user,
            description: 'New post by @' + data.author + ' voted',
            created: new Date(),
            value: vote_amount,
        };

        var results = await mclient
            .db()
            .collection('activityschemas')
            .insertOne(newActivity);

        //update site stats
        await mclient
            .db()
            .collection('statsschemas')
            .updateOne(
                { identifier: 'default' },
                { $inc: { curation_worth: vote_amount, bot_vote_count: 1 } }
            );

        //update report stats
        await mclient
            .db()
            .collection('reportschemas')
            .updateOne(
                { permlink: data.permlink },
                {
                    $inc: { curation_worth: vote_amount },
                    $set: { voted: 'true' },
                } //no need to increase the curation state to 3(voted, since its already done)
            );

        //update author stats
        await mclient
            .db()
            .collection('peerschemas')
            .updateOne(
                { account: data.author },
                { $inc: { curation_earnings: vote_amount, curation_votes: 1 } }
            );
    } catch (e) {
        console.log(e);
    }
};
