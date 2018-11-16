'use strict';

const dsteem = require('dsteem');
const configs = require('../config/config');
const mdb = require('../config/connection');
const client = new dsteem.Client(configs.steem_rpc);

module.exports = async function(type) {
    var mclient = await mdb();
    var config = {};

    //console.log('   fetching globals ');

    //get local settings

    var projectied_fields = {
        curation_daily_limit: 1,
        curation_rest_day1: 1,
        curation_rest_day2: 1,
        curation_vote_interval_minutes: 1,
        curation_bot_account: 1,
        curation_common_comment: 1,
        curation_curator_rate: 1,
        curation_team_rate: 1,
        curation_project_rate: 1,
        curation_community_rate: 1,
    };

    var results = await mclient
        .db()
        .collection('settingsschemas')
        //.findOne({ identifier: 'default' }, { projection: projectied_fields })
        .findOne({ identifier: 'default' });

    //console.log(results)

    config.curation_daily_limit = results.curation_daily_limit;
    config.curation_rest_day1 = results.curation_rest_day1;
    config.curation_rest_day2 = results.curation_rest_day2;
    config.curation_vote_interval_minutes =
        results.curation_vote_interval_minutes;
    config.curation_common_comment = results.curation_common_comment;
    config.curation_curator_rate = results.curation_curator_rate;
    config.curation_team_rate = results.curation_team_rate;
    config.curation_project_rate = results.curation_project_rate;
    config.curation_community_rate = results.curation_community_rate;
    config.curation_bot_account = results.curation_bot_account;

    //set global steem values

    var acc = await client.database.getAccounts([results.curation_bot_account]);
    acc = acc[0];

    //console.log(acc)

    //voting_power = acc.voting_power
    config.voting_power = acc.voting_power;

    //calculate full vote(weight at 10000) worth
    var fund = await client.database.call('get_reward_fund', ['post']);
    config.recent_claims = fund.recent_claims;
    config.reward_balance = fund.reward_balance.split(' ')[0];

    var price = await client.database.getCurrentMedianHistoryPrice();
    config.sbd_median_price = price.base.amount;

    var total_vests =
        Number(acc.vesting_shares.split(' ')[0]) +
        Number(acc.received_vesting_shares.split(' ')[0]) -
        Number(acc.delegated_vesting_shares.split(' ')[0]);
    config.final_vest = total_vests * 1e6;

    //console.log(config)

    if (type) return config[type];
    return config;
};
